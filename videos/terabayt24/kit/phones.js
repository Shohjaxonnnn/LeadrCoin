// Generic 3D iPhone layer. Page: window.PHONE3D.setTracks({name: {color, keys:[{t,x,y,s,rx,ry,rz,o}]}})
import * as THREE from 'three';
import { RoomEnvironment } from './lib/RoomEnvironment.js';
import { GLTFLoader } from './lib/GLTFLoader.js';
import { DRACOLoader } from './lib/DRACOLoader.js';

const PX = 448;
const PLATEAU_SLOT = 3, PLATEAU_Y = '0.30';
const KEEP = new Set(['zFdeDaGNRwzccye', 'ujsvqBWRMnqdwPx', 'hUlRcbieVuIiOXG', 'jlzuBkUzuJqgiAK', 'xNrofRCqOXXHVZt']);
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(1080, 1920, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.03).texture;
scene.environmentIntensity = 0.9;
const cam = new THREE.PerspectiveCamera(30, 1080 / 1920, 0.1, 50); cam.position.set(0, 0, 8);
const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-3, 4, 5); scene.add(key);
const rim = new THREE.DirectionalLight(0x02f894, 3.5); rim.position.set(4, -1, -2); scene.add(rim);
const rim2 = new THREE.DirectionalLight(0x02f894, 2.0); rim2.position.set(-4, 2, -1); scene.add(rim2);
const fill = new THREE.DirectionalLight(0xbfffe6, 0.6); fill.position.set(0, -4, 4); scene.add(fill);

const dl = new DRACOLoader(); dl.setDecoderPath(new URL('./lib/draco/', import.meta.url).href);
const MODELS = { iphone: { url: './iphone.glb', axis: 'y', size: 1.63 }, macbook: { url: './macbook.glb', axis: 'x', size: 2.3 } };
const loader = new GLTFLoader().setDRACOLoader(dl);
const ready = Promise.all(Object.entries(MODELS).map(([k, m]) => loader.loadAsync(new URL(m.url, import.meta.url).href).then((g) => { m.gltf = g; })));

function makePhone(tint, model = 'iphone') {
  const M = MODELS[model];
  const m = M.gltf.scene.clone(true);
  m.traverse((o) => {
    if (!o.isMesh) return;
    o.material = o.material.clone();
    if (tint && !KEEP.has(o.material.name)) o.material.color = new THREE.Color(tint);
  });
  const box = new THREE.Box3().setFromObject(m), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
  const k = M.size / sz[M.axis]; m.position.copy(c).multiplyScalar(-k); m.scale.setScalar(k);
  const g = new THREE.Group(); g.add(m);
  g.updateMatrixWorld(true);
  // The camera plateau and the Apple logo share palette slot 3 (semi-transparent black "glass") of PaletteMaterial003.
  // On a coloured phone that slot paints the plateau as a dark square, so repaint the slot with the body colour
  // above the logo (phone-space y > PLATEAU_Y) and leave the logo itself black.
  if (tint) m.traverse((o) => {
    if (!o.isMesh || o.material.name !== 'PaletteMaterial003') return;
    const toRoot = { value: o.matrixWorld.clone() };
    o.material.onBeforeCompile = (sh) => {
      sh.uniforms.toRoot = toRoot;
      sh.vertexShader = 'uniform mat4 toRoot;\nvarying float vRootY;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvRootY = (toRoot * vec4(position, 1.0)).y;');
      sh.fragmentShader = 'varying float vRootY;\n' + sh.fragmentShader.replace('#include <map_fragment>',
        `#include <map_fragment>
        #ifdef USE_MAP
          if (floor(vMapUv.x * 16.0) == ${PLATEAU_SLOT}.0 && vRootY > ${PLATEAU_Y}) diffuseColor = vec4(diffuse * 0.82, 1.0);
        #endif`);
    };
    o.material.customProgramCacheKey = () => 'plateau-fix';
  });
  g.userData.mats = []; m.traverse((o) => { if (o.isMesh) g.userData.mats.push([o.material, o.material.opacity, o.material.transparent]); });
  return g;
}
const COLORS = { bordo: '#741b2e', qora: '#26272c', kumush: '#c9ccd1', yashil: '#2f6b55', kok: '#2b3f66' };
const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const outQ = (p) => 1 - Math.pow(1 - p, 4);
const DEF = { x: 540, y: 1000, s: 1, rx: 0, ry: 0, rz: 0, o: 1, z: 0 };
let phones = [];

function sample(keys, t) {
  if (t <= keys[0].t) return keys[0];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (t <= b.t) {
      const p = (t - a.t) / (b.t - a.t), e = (b.e === 'out' ? outQ : ease)(p), r = {};
      for (const k in DEF) r[k] = a[k] + (b[k] - a[k]) * e;
      return r;
    }
  }
  return keys[keys.length - 1];
}

window.PHONE3D = {
  ready,
  setTracks(tracks) {
    phones = Object.values(tracks).map((tr) => {
      const g = makePhone(tr.color && (COLORS[tr.color] || tr.color), tr.model); scene.add(g);
      let prev = DEF;
      const keys = tr.keys.map((k) => (prev = Object.assign({}, prev, k)));
      return { g, keys, float: tr.float ?? 1, phase: tr.phase || 0 };
    });
  },
};
window.render3d = (t) => {
  for (const ph of phones) {
    const k = sample(ph.keys, t), g = ph.g;
    const fl = ph.float * Math.min(1, Math.max(0, t - ph.keys[0].t - 0.8));
    g.position.set((k.x - 540) / PX, (960 - k.y) / PX + 0.03 * Math.sin(t * 2.2 + ph.phase) * fl, k.z);
    g.rotation.set(k.rx + 0.04 * Math.sin(t * 1.6 + ph.phase) * fl, k.ry + 0.06 * Math.sin(t * 1.2 + ph.phase) * fl, k.rz);
    g.scale.setScalar(0.9 * k.s);
    g.visible = k.o > 0.01;
    const fade = k.o < 0.999;
    if (fade !== g.userData.fade) { for (const [m, , tr0] of g.userData.mats) { m.transparent = fade || tr0; m.needsUpdate = true; } g.userData.fade = fade; }
    for (const [m, o0] of g.userData.mats) m.opacity = o0 * k.o;
  }
  renderer.render(scene, cam);
};
window.WAIT3D = ready;
