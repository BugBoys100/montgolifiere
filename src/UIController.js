import { PHYSICS, TIME_WARP_FACTORS } from './config.js';

/**
 * HUD, entrées utilisateur et liaison avec le moteur physique.
 */
export class UIController {
  /**
   * @param {import('./PhysicsEngine.js').PhysicsEngine} physics
   * @param {{ onTimeWarpChange?: (factor: number) => void }} [callbacks]
   */
  constructor(physics, callbacks = {}) {
    this.physics = physics;
    this.onTimeWarpChange = callbacks.onTimeWarpChange ?? (() => {});

    this.els = {
      thermoFill: document.getElementById('thermo-fill'),
      thermoEq: document.getElementById('thermo-equilibrium'),
      thermoConsigne: document.getElementById('thermo-consigne'),
      tInt: document.getElementById('t-int-display'),
      tEq: document.getElementById('t-eq-display'),
      tConsigne: document.getElementById('t-consigne-display'),
      altitude: document.getElementById('altitude'),
      velocity: document.getElementById('velocity'),
      acceleration: document.getElementById('acceleration'),
      timeWarp: document.getElementById('time-warp'),
      timeFactor: document.getElementById('time-factor'),
      burnerBtn: document.getElementById('burner-btn'),
      burnerState: document.getElementById('burner-state'),
      targetAltitude: document.getElementById('target-altitude'),
      autopilotToggle: document.getElementById('autopilot-toggle'),
      autopilotPhase: document.getElementById('autopilot-phase'),
      autopilotStatus: document.getElementById('autopilot-status'),
    };

    this.timeWarpIndex = 0;
    this._bindEvents();
    this._syncTimeWarpLabel();
  }

  getTimeWarpFactor() {
    return TIME_WARP_FACTORS[this.timeWarpIndex] ?? 1;
  }

  _bindEvents() {
    this.els.timeWarp.addEventListener('input', () => {
      this.timeWarpIndex = Number(this.els.timeWarp.value);
      this._syncTimeWarpLabel();
      this.onTimeWarpChange(this.getTimeWarpFactor());
    });

    this.els.burnerBtn.addEventListener('mousedown', () => this._setManualBurner(true));
    this.els.burnerBtn.addEventListener('mouseup', () => this._setManualBurner(false));
    this.els.burnerBtn.addEventListener('mouseleave', () => this._setManualBurner(false));
    this.els.burnerBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this._setManualBurner(true);
    });
    this.els.burnerBtn.addEventListener('touchend', () => this._setManualBurner(false));

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        this._setManualBurner(true);
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') this._setManualBurner(false);
    });

    this.els.autopilotToggle.addEventListener('click', () => {
      this.physics.autopilotEnabled = !this.physics.autopilotEnabled;
      this._syncAutopilotUi();
    });

    this.els.targetAltitude.addEventListener('change', () => {
      const v = Number(this.els.targetAltitude.value);
      if (Number.isFinite(v) && v >= 0) this.physics.targetAltitude = v;
    });
  }

  _setManualBurner(on) {
    if (this.physics.autopilotEnabled) return;
    this.physics.burnerManual = on;
  }

  _syncTimeWarpLabel() {
    const f = this.getTimeWarpFactor();
    this.els.timeFactor.textContent = `×${f}`;
  }

  _syncAutopilotUi() {
    const on = this.physics.autopilotEnabled;
    this.els.autopilotToggle.textContent = on ? 'Désactiver autopilote' : 'Activer autopilote';
    this.els.autopilotToggle.classList.toggle('btn--active', on);
    this.els.autopilotStatus.textContent = on
      ? `Cible ${this.physics.targetAltitude.toFixed(0)} m · v* ${this.physics.state.vzTarget.toFixed(2)} m/s`
      : 'IA inactive';
    if (!on) {
      this.els.autopilotPhase.textContent = '—';
      this.els.autopilotPhase.className = 'ia-phase ia-phase--idle';
      this.els.thermoConsigne.classList.remove('thermo-consigne--visible');
    }
    if (on) this.physics.burnerManual = false;
  }

  /** @param {ReturnType<import('./PhysicsEngine.js').PhysicsEngine.prototype['state']>} s */
  update(s) {
    const { displayTempMinC, displayTempMaxC } = PHYSICS;
    const range = displayTempMaxC - displayTempMinC;
    const tC = s.T_intC;
    const pct = clamp((tC - displayTempMinC) / range, 0, 1);
    this.els.thermoFill.style.height = `${pct * 100}%`;

    if (s.T_eqC != null && Number.isFinite(s.T_eqC)) {
      const eqPct = clamp((s.T_eqC - displayTempMinC) / range, 0, 1);
      this.els.thermoEq.style.bottom = `${eqPct * 100}%`;
      this.els.tEq.textContent = `${s.T_eqC.toFixed(1)} °C`;
    } else {
      this.els.tEq.textContent = '—';
    }

    this.els.tInt.textContent = `${tC.toFixed(1)} °C`;
    if (s.autopilotEnabled) {
      this.els.tConsigne.textContent = `${s.T_consigneC.toFixed(1)} °C`;
      const consPct = clamp((s.T_consigneC - displayTempMinC) / range, 0, 1);
      this.els.thermoConsigne.style.bottom = `${consPct * 100}%`;
      this.els.thermoConsigne.classList.add('thermo-consigne--visible');
    } else {
      this.els.tConsigne.textContent = '—';
      this.els.thermoConsigne.classList.remove('thermo-consigne--visible');
    }

    this.els.altitude.textContent = `${s.altitude.toFixed(1)} m`;

    const vz = s.velocityZ;
    this.els.velocity.textContent = `${vz >= 0 ? '+' : ''}${vz.toFixed(2)} m/s`;
    this.els.velocity.classList.remove('metric__value--up', 'metric__value--down', 'metric__value--neutral');
    if (Math.abs(vz) < 0.05) this.els.velocity.classList.add('metric__value--neutral');
    else if (vz > 0) this.els.velocity.classList.add('metric__value--up');
    else this.els.velocity.classList.add('metric__value--down');

    this.els.acceleration.textContent = `${s.accelerationZ >= 0 ? '+' : ''}${s.accelerationZ.toFixed(2)} m/s²`;

    const burner = s.burnerActive;
    this.els.burnerState.textContent = burner ? 'ON' : 'OFF';
    this.els.burnerState.classList.toggle('burner-state--on', burner);
    this.els.burnerBtn.classList.toggle('btn--burner-on', burner && !s.autopilotEnabled);

    if (s.autopilotEnabled) {
      this.els.autopilotStatus.textContent = `Cible ${s.targetAltitude.toFixed(0)} m · v* ${s.vzTarget.toFixed(2)} m/s`;
      this.els.autopilotPhase.textContent = s.autopilotPhase;
      this.els.autopilotPhase.className = 'ia-phase ' + phaseClass(s.autopilotPhase);
    }
  }
}

function phaseClass(phase) {
  switch (phase) {
    case 'MONTEE':
      return 'ia-phase--montee';
    case 'FREINAGE / ANTICIPATION':
      return 'ia-phase--freinage';
    case 'STABILISATION':
      return 'ia-phase--stabilisation';
    default:
      return 'ia-phase--idle';
  }
}

function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x));
}
