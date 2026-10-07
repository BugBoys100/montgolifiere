import { createDefaultEnvironment } from './config.js';
import { PhysicsEngine } from './PhysicsEngine.js';
import { Scene3D } from './Scene3D.js';
import { UIController } from './UIController.js';

const canvas = document.getElementById('canvas3d');
const environment = createDefaultEnvironment();
const physics = new PhysicsEngine(environment);
const scene3D = new Scene3D(canvas);

let timeWarpFactor = 1;
const ui = new UIController(physics, {
  onTimeWarpChange: (f) => {
    timeWarpFactor = f;
  },
});

const clock = { last: performance.now() };

function loop(now) {
  const dtReal = Math.min((now - clock.last) / 1000, 0.05);
  clock.last = now;
  const dtSim = dtReal * timeWarpFactor;

  physics.step(dtSim);

  const state = physics.state;
  scene3D.update(state, now / 1000);
  ui.update(state);
  scene3D.render();

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
