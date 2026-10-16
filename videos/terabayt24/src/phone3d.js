import * as THREE from 'three';
import { RoomEnvironment } from './lib/RoomEnvironment.js';
import { GLTFLoader } from './lib/GLTFLoader.js';
import { DRACOLoader } from './lib/DRACOLoader.js';

const PX = 448; // pixels per world unit at z=0 (camera z=8, fov 30, 1920px)
const KEEP = new Set(['zFdeDaGNRwzccye', 'ujsvqBWRMnqdwPx', 'hUlRcbieVuIiOXG', 'jlzuBkUzuJqgiAK', 'xNrofRCqOXXHVZt']);
const dl = new DRACOLoader(); dl.setDecoderPath('./lib/draco/');
const gltf = await new GLTFLoader().setDRACOLoader(dl).loadAsync('./iphone.glb');

function makePhone(tint) {
  const m = gltf.scene.clone(true);
  m.traverse(o => {
    if (!o.isMesh) return;
    o.material = o.material.clone();
    if (tint && !KEEP.has(o.material.name)) o.material.color = new THREE.Color(tint);
  });
  const box = new THREE.Box3().setFromObject(m), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
  const k = 1.63 / sz.y; m.position.copy(c).multiplyScalar(-k); m.scale.setScalar(k);
  const g = new THREE.Group(); g.add(m); g.scale.setScalar(0.9); return g;
}

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(1080, 1920, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
scene.environmentIntensity = 0.9;
const cam = new THREE.PerspectiveCamera(30, 1080 / 1920, 0.1, 50); cam.position.set(0, 0, 8);
const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-3, 4, 5); scene.add(key);
const rim = new THREE.DirectionalLight(0x02f894, 3.5); rim.position.set(4, -1, -2); scene.add(rim);
const rim2 = new THREE.DirectionalLight(0x02f894, 2.0); rim2.position.set(-4, 2, -1); scene.add(rim2);
const fill = new THREE.DirectionalLight(0xbfffe6, 0.6); fill.position.set(0, -4, 4); scene.add(fill);

const A = makePhone('#741b2e');   // bordo
const B = makePhone('#26272c');        // qora (original black titanium)
scene.add(A, B);

const w = (px, py) => [(px - 540) / PX, (960 - py) / PX];
const clamp = (x) => Math.min(1, Math.max(0, x));
const outQuart = (p) => 1 - Math.pow(1 - p, 4);
const outBack = (p) => { const c = 1.4; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };

function place(ph, t, t0, from, to, rotZ, rotYEnd, dir, phase) {
  const p = clamp((t - t0) / 1.1), e = outQuart(p), eb = outBack(clamp((t - t0) / 1.1));
  const [fx, fy] = w(...from), [tx, ty] = w(...to);
  ph.position.set(fx + (tx - fx) * e, fy + (ty - fy) * eb, -2.5 * (1 - e));
  const fl = clamp((t - t0 - 0.9) / 0.6);
  ph.position.y += 0.035 * Math.sin((t - 1.5) * 2.4 + phase) * fl;
  ph.rotation.set(
    0.12 * (1 - e) + 0.05 * Math.sin((t - 1.5) * 1.7 + phase) * fl,
    rotYEnd + dir * 2 * Math.PI * (1 - e) + 0.07 * Math.sin((t - 1.5) * 1.3 + phase) * fl,
    rotZ * eb);
  ph.visible = t >= t0;
}

window.render3d = (t) => {
  place(A, t, 0.55, [-300, 1300], [275, 1070], 0.14, 0.32, -1, 0);
  place(B, t, 0.65, [1380, 1300], [805, 1050], -0.15, -0.32, 1, 1.7);
  renderer.render(scene, cam);
};
window.ready3d = true;
