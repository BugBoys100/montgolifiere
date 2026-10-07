/** Constantes physiques et paramètres de simulation (SI). */

export const PHYSICS = {
  g: 9.81,
  /** Volume de l'enveloppe (m³) */
  envelopeVolume: 2800,
  /** Masse à vide (nacelle + enveloppe sèche, kg) */
  dryMass: 550,
  /** Température extérieure (K) — 15 °C */
  T_ext: 288.15,
  /** Masse volumique air au sol (kg/m³) */
  rho_ext: 1.225,
  /** Coefficient de traînée vertical */
  dragCoefficient: 0.85,
  /** Section frontale effective (m²) */
  dragArea: 12,
  /** Refroidissement de Newton (1/s) */
  coolingK: 0.012,
  /** Montée de T_int avec brûleur à pleine puissance (K/s) */
  burnerHeatingRate: 2.8,
  /** Limite affichage / clamp soft du thermomètre (°C) */
  displayTempMinC: 15,
  displayTempMaxC: 120,
};

/** Régulateur prédictif en cascade (autopilote). */
export const AUTOPILOT = {
  v_max: 2.2,
  a_brake: 0.15,
  altitudeCaptureRadius: 0.2,
  /** Horizon de prédiction thermique (s) */
  thermalHorizon: 5.0,
  /** Horizon prédiction altitude / cinétique (s) */
  kinematicHorizon: 4.0,
  /** Gain vitesse → consigne température (K·s/m) */
  Kp_v: 9.0,
  /** Gain accélération → consigne température (K·s²/m) */
  Kd_a: 3.5,
  /** Bande de stabilisation altitude (m) */
  holdBand: 0.5,
  holdVelocity: 0.2,
  /** Marge thermique avant consigne pour couper le brûleur (K) */
  thermalCutMarginK: 2.0,
};

/** Facteurs de time-warp (index slider → multiplicateur dt). */
export const TIME_WARP_FACTORS = [1, 2, 5, 10];

/**
 * Environnement extérieur (extension future : vent horizontal).
 * @typedef {{ windVector: { x: number, z: number }, T_ext: number, rho_ext: number }} Environment
 */
export function createDefaultEnvironment() {
  return {
    windVector: { x: 0, z: 0 },
    T_ext: PHYSICS.T_ext,
    rho_ext: PHYSICS.rho_ext,
  };
}
