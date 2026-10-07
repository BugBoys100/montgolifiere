import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * Scène Three.js minimaliste : sol, ciel, nuages, montgolfière.
 */
export class Scene3D {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.burnerIntensity = 0;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x8ecae6, 1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xb8d4e8, 80, 1200);

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.5, 3000);
    this.camera.position.set(18, 8, 22);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 80;
    this.controls.maxPolarAngle = Math.PI * 0.48;

    this._buildLights();
    this._buildGround();
    this._buildClouds();
    this._buildBalloon();

    this._target = new THREE.Vector3(0, 2, 0);
    this.controls.target.copy(this._target);

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    this.resize();
  }

  _buildLights() {
    const hemi = new THREE.HemisphereLight(0xdceefb, 0x6b705c, 0.65);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff5e6, 1.1);
    sun.position.set(40, 80, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 200;
    sun.shadow.camera.left = -60;
    sun.shadow.camera.right = 60;
    sun.shadow.camera.top = 60;
    sun.shadow.camera.bottom = -60;
    this.scene.add(sun);
  }

  _buildGround() {
    const grid = new THREE.GridHelper(400, 40, 0x94a3b8, 0xcbd5e1);
    grid.position.y = 0;
    this.scene.add(grid);

    const planeGeo = new THREE.PlaneGeometry(400, 400);
    const planeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.95,
      metalness: 0,
    });
    const plane = new THREE.Mesh(planeGeo, planeMat);
    plane.rotation.x = -Math.PI / 2;
    plane.receiveShadow = true;
    plane.position.y = -0.02;
    this.scene.add(plane);
  }

  _buildClouds() {
    this.cloudGroup = new THREE.Group();
    const cloudData = [
      { x: -35, y: 45, z: -20, s: 1.2 },
      { x: 50, y: 90, z: 15, s: 1.5 },
      { x: -15, y: 140, z: 40, s: 1.0 },
      { x: 30, y: 200, z: -35, s: 1.3 },
      { x: -55, y: 280, z: 10, s: 1.1 },
    ];

    for (const c of cloudData) {
      const cloud = this._makeLowPolyCloud(c.s);
      cloud.position.set(c.x, c.y, c.z);
      this.cloudGroup.add(cloud);
    }
    this.scene.add(this.cloudGroup);
  }

  _makeLowPolyCloud(scale) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      flatShading: true,
      roughness: 1,
    });
    const puff = (x, y, z, r) => {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat);
      m.position.set(x, y, z);
      group.add(m);
    };
    puff(0, 0, 0, 2.2);
    puff(1.8, 0.2, 0.5, 1.6);
    puff(-1.5, 0.1, -0.3, 1.5);
    puff(0.4, 0.6, -0.8, 1.3);
    group.scale.setScalar(scale);
    return group;
  }

  _buildBalloon() {
    this.balloonRoot = new THREE.Group();

    const envelopeMat = new THREE.MeshStandardMaterial({
      color: 0xe63946,
      flatShading: true,
      roughness: 0.75,
    });
    const envelope = new THREE.Mesh(new THREE.IcosahedronGeometry(3.2, 1), envelopeMat);
    envelope.scale.set(1, 1.25, 1);
    envelope.castShadow = true;
    this.balloonRoot.add(envelope);

    const basketMat = new THREE.MeshStandardMaterial({ color: 0x8d5524, flatShading: true });
    const basket = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 1.2), basketMat);
    basket.position.y = -4.2;
    basket.castShadow = true;
    this.balloonRoot.add(basket);

    const ropeMat = new THREE.LineBasicMaterial({ color: 0x4a3728 });
    const ropeGeo = new THREE.BufferGeometry();
    const ropeVerts = new Float32Array([
      -1, -1.5, -1, -0.5, -3.8, -0.5,
      1, -1.5, -1, 0.5, -3.8, -0.5,
      -1, -1.5, 1, -0.5, -3.8, 0.5,
      1, -1.5, 1, 0.5, -3.8, 0.5,
    ]);
    ropeGeo.setAttribute('position', new THREE.BufferAttribute(ropeVerts, 3));
    this.balloonRoot.add(new THREE.LineSegments(ropeGeo, ropeMat));

    this.flameGroup = new THREE.Group();
    this.flameGroup.position.set(0, -3.75, 0);
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xff9500,
      transparent: true,
      opacity: 0.85,
    });
    this.flameCore = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.9, 5), flameMat);
    this.flameOuter = new THREE.Mesh(
      new THREE.ConeGeometry(0.4, 1.2, 5),
      new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.45 }),
    );
    this.flameGroup.add(this.flameOuter);
    this.flameGroup.add(this.flameCore);
    this.flameGroup.visible = false;
    this.balloonRoot.add(this.flameGroup);

    this.scene.add(this.balloonRoot);
  }

  /**
   * @param {{ altitude: number, burnerActive: boolean }} physicsState
   * @param {number} timeSec temps pour animation flamme
   */
  update(physicsState, timeSec) {
    const alt = physicsState.altitude;
    const visualScale = 0.08;
    this.balloonRoot.position.y = 2 + alt * visualScale;

    this._target.set(0, this.balloonRoot.position.y - 1.5, 0);
    this.controls.target.lerp(this._target, 0.08);

    const targetIntensity = physicsState.burnerActive ? 1 : 0;
    this.burnerIntensity += (targetIntensity - this.burnerIntensity) * 0.15;

    this.flameGroup.visible = this.burnerIntensity > 0.05;
    const flicker = 0.85 + 0.15 * Math.sin(timeSec * 22);
    const s = (0.6 + 0.5 * this.burnerIntensity) * flicker;
    this.flameCore.scale.set(1, s, 1);
    this.flameOuter.scale.set(1, s * 1.15, 1);
    this.flameCore.material.opacity = 0.5 + 0.4 * this.burnerIntensity;
  }

  render() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    this.renderer.dispose();
    this.controls.dispose();
  }
}
