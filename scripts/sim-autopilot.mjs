import { createDefaultEnvironment } from '../src/config.js';
import { PhysicsEngine } from '../src/PhysicsEngine.js';

const physics = new PhysicsEngine(createDefaultEnvironment());
physics.autopilotEnabled = true;
physics.targetAltitude = 300;

const dt = 0.02;
let maxAlt = 0;
let overshoot = 0;

for (let t = 0; t < 3600; t += dt) {
  physics.step(dt);
  maxAlt = Math.max(maxAlt, physics.altitude);
  if (t > 200) overshoot = Math.max(overshoot, physics.altitude - 300);
}

console.log({
  finalAlt: physics.altitude.toFixed(2),
  maxAlt: maxAlt.toFixed(2),
  maxOvershootAboveTarget: overshoot.toFixed(2),
  vz: physics.velocityZ.toFixed(3),
  phase: physics.state.autopilotPhase,
});
