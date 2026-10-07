import { AUTOPILOT, PHYSICS } from './config.js';

const KELVIN_TO_C = (k) => k - 273.15;
const C_TO_KELVIN = (c) => c + 273.15;

/** @typedef {'MONTEE' | 'FREINAGE / ANTICIPATION' | 'STABILISATION' | 'INACTIF'} AutopilotPhase */

/**
 * Masse volumique de l'air chaud dans l'enveloppe (même pression approximée).
 */
export function rhoInternal(T_int, T_ext, rho_ext) {
  return rho_ext * (T_ext / T_int);
}

/**
 * Température d'équilibre statique (F_A = P, v = 0).
 */
export function equilibriumTemperatureK(env = null) {
  const { envelopeVolume: V, dryMass: M, T_ext, rho_ext } = PHYSICS;
  const T_e = env?.T_ext ?? T_ext;
  const rho_e = env?.rho_ext ?? rho_ext;

  const rho_int_eq = (rho_e * V - M) / V;
  if (rho_int_eq <= 0) return Infinity;
  return (rho_e * T_e) / rho_int_eq;
}

export class PhysicsEngine {
  constructor(environment) {
    this.environment = environment ?? { windVector: { x: 0, z: 0 }, T_ext: PHYSICS.T_ext, rho_ext: PHYSICS.rho_ext };

    this.altitude = 0;
    this.velocityZ = 0;
    this.accelerationZ = 0;
    this.T_int = PHYSICS.T_ext;

    this.burnerManual = false;
    this.autopilotEnabled = false;
    this.targetAltitude = 300;

    this._burnerAuto = false;
    /** Télémetrie IA (HUD) */
    this._vzTarget = 0;
    this._TConsigne = PHYSICS.T_ext;
    this._autopilotPhase = /** @type {AutopilotPhase} */ ('INACTIF');
    this._dTdt = 0;
  }

  setEnvironment(env) {
    this.environment = env;
  }

  reset() {
    this.altitude = 0;
    this.velocityZ = 0;
    this.accelerationZ = 0;
    this.T_int = this.environment.T_ext ?? PHYSICS.T_ext;
    this._burnerAuto = false;
    this._autopilotPhase = 'INACTIF';
    this._dTdt = 0;
  }

  get state() {
    const T_ext = this.environment.T_ext ?? PHYSICS.T_ext;
    const rho_ext = this.environment.rho_ext ?? PHYSICS.rho_ext;
    const rho_int = rhoInternal(this.T_int, T_ext, rho_ext);
    const M_total = PHYSICS.dryMass + rho_int * PHYSICS.envelopeVolume;
    const T_eq = equilibriumTemperatureK(this.environment);

    return {
      altitude: this.altitude,
      velocityZ: this.velocityZ,
      accelerationZ: this.accelerationZ,
      T_int: this.T_int,
      T_intC: KELVIN_TO_C(this.T_int),
      T_ext,
      T_eq,
      T_eqC: Number.isFinite(T_eq) ? KELVIN_TO_C(T_eq) : null,
      T_consigne: this._TConsigne,
      T_consigneC: KELVIN_TO_C(this._TConsigne),
      vzTarget: this._vzTarget,
      autopilotPhase: this._autopilotPhase,
      dTdt: this._dTdt,
      rho_int,
      M_total,
      burnerActive: this.isBurnerActive(),
      autopilotEnabled: this.autopilotEnabled,
      targetAltitude: this.targetAltitude,
      windVector: { ...this.environment.windVector },
    };
  }

  isBurnerActive() {
    if (this.autopilotEnabled) return this._burnerAuto;
    return this.burnerManual;
  }

  /**
   * Vitesse de variation thermique (K/s) pour un état brûleur donné.
   */
  _thermalRateK(T_int, T_ext, burnerOn) {
    let rate = -PHYSICS.coolingK * (T_int - T_ext);
    if (burnerOn) rate += PHYSICS.burnerHeatingRate;
    return rate;
  }

  /**
   * Température extrapolée linéairement sur un horizon (anticipation inertie).
   */
  _predictTemperature(T_int, T_ext, burnerOn, horizonSec) {
    const rate = this._thermalRateK(T_int, T_ext, burnerOn);
    return T_int + rate * horizonSec;
  }

  /**
   * Profil de vitesse verticale (freinage parabolique, sans dépassement).
   */
  _computeVzTarget(altitudeError) {
    const { v_max, a_brake, altitudeCaptureRadius } = AUTOPILOT;
    const E = altitudeError;
    const absE = Math.abs(E);

    if (absE < altitudeCaptureRadius) return 0;

    const v_limit = Math.sqrt(2 * a_brake * absE);
    const v_cmd = Math.min(v_max, v_limit);
    return E > 0 ? v_cmd : -v_cmd;
  }

  /**
   * Contrôleur prédictif à cascade : profil v_z → consigne T → commande brûleur.
   */
  _updateAutopilot() {
    const T_ext = this.environment.T_ext ?? PHYSICS.T_ext;
    const alt = this.altitude;
    const vz = this.velocityZ;
    const az = this.accelerationZ;
    const target = this.targetAltitude;

    const E = target - alt;
    const T_eq = equilibriumTemperatureK(this.environment);

    this._vzTarget = this._computeVzTarget(E);

    const e_v = this._vzTarget - vz;
    let T_consigne = T_eq + AUTOPILOT.Kp_v * e_v - AUTOPILOT.Kd_a * az;

    if (Math.abs(E) < AUTOPILOT.holdBand) {
      T_consigne = T_eq + AUTOPILOT.Kp_v * 0.35 * e_v - AUTOPILOT.Kd_a * 0.5 * az;
    }

    const a_brake = AUTOPILOT.a_brake;
    const stopDist = (vz * vz) / (2 * a_brake);
    let forceCoast = false;

    const warmEnough = this.T_int > T_eq - 8;
    const aboveProfileSpeed = vz > this._vzTarget + 0.05;

    if (E > AUTOPILOT.altitudeCaptureRadius && aboveProfileSpeed && warmEnough) {
      forceCoast = true;
      T_consigne = Math.min(T_consigne, T_eq - 2 - 3 * (vz - this._vzTarget));
    }

    if (E > 0 && vz > 0.05) {
      const stopMargin = stopDist / Math.max(E, 0.5);
      if (stopMargin > 0.62) {
        forceCoast = true;
        T_consigne = Math.min(T_consigne, T_eq - 5 - 2.5 * vz);
      }
    }

    const marginT = this.T_int - T_eq;
    if (E > 0 && marginT > 0 && warmEnough) {
      const coolRate = Math.max(PHYSICS.coolingK * (this.T_int - T_ext), 0.05);
      const coastTime = marginT / coolRate;
      const thermalClimb = vz * coastTime + 0.5 * Math.max(az, 0) * coastTime * coastTime;
      if (thermalClimb > E * 0.72) {
        forceCoast = true;
        T_consigne = Math.min(T_consigne, T_eq - 6 - 2 * vz);
      }
    }

    const tKin = Math.max(AUTOPILOT.kinematicHorizon, vz / Math.max(a_brake, 0.05));
    const altPredict = alt + vz * tKin + 0.5 * az * tKin * tKin;
    if (E > 0 && altPredict > target - 0.5 && vz > 0.08) {
      forceCoast = true;
      T_consigne = Math.min(T_consigne, T_eq - 3 - 2 * vz);
    }

    T_consigne = clamp(T_consigne, T_ext, C_TO_KELVIN(160));
    this._TConsigne = T_consigne;

    const horizon = AUTOPILOT.thermalHorizon;
    const cutLine = T_consigne - AUTOPILOT.thermalCutMarginK;
    const T_fut_ifOff = this._predictTemperature(this.T_int, T_ext, false, horizon);
    const T_fut_ifOn = this._predictTemperature(this.T_int, T_ext, true, horizon);

    if (forceCoast) {
      this._burnerAuto = false;
    } else if (T_fut_ifOff >= cutLine) {
      this._burnerAuto = false;
    } else if (T_fut_ifOn >= cutLine && this._burnerAuto) {
      this._burnerAuto = false;
    } else {
      this._burnerAuto = true;
    }

    if (Math.abs(E) < AUTOPILOT.holdBand && Math.abs(vz) < AUTOPILOT.holdVelocity) {
      const holdTarget = T_eq + 0.25;
      const T_pulseOff = this._predictTemperature(this.T_int, T_ext, false, 2.5);
      this._burnerAuto = T_pulseOff < holdTarget;
    }

    this._dTdt = this._thermalRateK(this.T_int, T_ext, this._burnerAuto);
    this._autopilotPhase = this._resolveAutopilotPhase(E, vz);
  }

  /** @returns {AutopilotPhase} */
  _resolveAutopilotPhase(E, vz) {
    const { holdBand, holdVelocity } = AUTOPILOT;

    if (Math.abs(E) < holdBand && Math.abs(vz) < holdVelocity) {
      return 'STABILISATION';
    }

    const risingCoast = E > 0 && !this._burnerAuto && vz > 0.08;
    const overSpeed = E > 0 && vz > this._vzTarget + 0.25;
    const kineticOvershoot = E > 0 && this.velocityZ > 0 && this._vzTarget < this.velocityZ - 0.1;

    if (risingCoast || overSpeed || kineticOvershoot) {
      return 'FREINAGE / ANTICIPATION';
    }

    if (E > 0.3) return 'MONTEE';
    if (E < -0.3) return 'FREINAGE / ANTICIPATION';

    return 'STABILISATION';
  }

  step(dt) {
    if (dt <= 0) return;

    if (this.autopilotEnabled) {
      this._updateAutopilot();
    } else {
      this._burnerAuto = false;
      this._autopilotPhase = 'INACTIF';
      this._vzTarget = 0;
      this._TConsigne = this.T_int;
    }

    const burnerOn = this.isBurnerActive();
    const T_ext = this.environment.T_ext ?? PHYSICS.T_ext;
    const rho_ext = this.environment.rho_ext ?? PHYSICS.rho_ext;
    const V = PHYSICS.envelopeVolume;
    const g = PHYSICS.g;

    let dT = this._thermalRateK(this.T_int, T_ext, burnerOn);
    this._dTdt = dT;
    this.T_int += dT * dt;
    this.T_int = Math.max(T_ext, Math.min(C_TO_KELVIN(200), this.T_int));

    const rho_int = rhoInternal(this.T_int, T_ext, rho_ext);
    const M_air = rho_int * V;
    const M_total = PHYSICS.dryMass + M_air;

    const F_buoyancy = rho_ext * V * g;
    const weight = (PHYSICS.dryMass + M_air) * g;
    const vz = this.velocityZ;
    const F_drag = 0.5 * rho_ext * PHYSICS.dragCoefficient * PHYSICS.dragArea * vz * Math.abs(vz);

    const F_net = F_buoyancy - weight - F_drag;
    this.accelerationZ = F_net / M_total;
    this.velocityZ += this.accelerationZ * dt;
    this.altitude += this.velocityZ * dt;
    this.altitude = Math.max(0, this.altitude);

    if (this.altitude <= 0 && this.velocityZ < 0) {
      this.velocityZ = 0;
      this.accelerationZ = Math.max(0, this.accelerationZ);
    }

    void this.environment.windVector;
  }
}

function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x));
}
