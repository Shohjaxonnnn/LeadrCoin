/* 3D layer for the Orzu Mobile reels (Three.js, bundled to ../kit3d.js by esbuild).
   Models are downloaded assets (assets/models/<name>/…), loaded once and cloned per use.
   World units are stage pixels: x right from the centre, y up, z towards the camera; at z=0 one unit = one pixel,
   so models are placed with the same numbers the 2D layout uses. Every instance is wrapped in a Node: a plain
   object with x, y, rotation/rotationX/Y/Z (degrees), scale, opacity and visible that GSAP tweens like a DOM element. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const W = 1080, H = 1920, FOV = 30;
const DIST = (H / 2) / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
let renderer, scene, camera;
const nodes = [];

/* downloaded models. h: on-stage height (px) at scale 1; turn: rotation that shows the back to the camera;
   textures/alias: where an FBX's textures live and how its stored file names map to the files we have */
const MODELS = {
  'iphone18-black':    { url: '/assets/models/iphone18-black/source/apple_iphone_18_pro_max_black.glb', h: 620, turn: Math.PI },
  'iphone18-burgundy': { url: '/assets/models/iphone18-burgundy/source/apple_iphone_18_pro_max_burgundy.glb', h: 620, turn: Math.PI },
  'iphone18-silver':   { url: '/assets/models/iphone18-silver/source/apple_iphone_18_pro_max_silver.glb', h: 620, turn: Math.PI },
  'iphone17-orange':   { url: '/assets/models/iphone17-orange/source/iPhone 16 Pro Max(Post).fbx', h: 620, turn: 0,
                         textures: '/assets/models/iphone17-orange/textures/',
                         alias: { 'Apple-iPhone-16-Pro-camera-system-240909_inline.jpg.large.jpg': 'Apple-iPhone-16-Pro-camera-system-240909_i.jpg' } },
};
const loaded = {};

function init(canvas) {
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.85;
  camera = new THREE.PerspectiveCamera(FOV, W / H, 10, DIST * 3);
  camera.position.set(0, 0, DIST);
  // lighting tuned to the blue reels: white key from the top left, strong blue rims behind both sides
  const key = new THREE.DirectionalLight(0xffffff, 2.0); key.position.set(-600, 900, 1400); scene.add(key);
  const rimL = new THREE.DirectionalLight(0x2a8cff, 5.0); rimL.position.set(-1400, 300, -600); scene.add(rimL);
  const rimR = new THREE.DirectionalLight(0x4db8ff, 4.0); rimR.position.set(1400, -200, -500); scene.add(rimR);
  scene.add(new THREE.HemisphereLight(0x4db8ff, 0x020615, 0.8));
}

/* load a model once, normalise it: centred, scaled to MODELS[name].h px tall, back facing the camera */
async function load(name) {
  if (loaded[name]) return loaded[name];
  const m = MODELS[name];
  let root;
  if (m.url.endsWith('.fbx')) {
    const manager = new THREE.LoadingManager();
    const settled = new Promise(ok => { manager.onLoad = ok; setTimeout(ok, 8000); });
    manager.setURLModifier(u => { if (!/\.(jpe?g|png)$/i.test(u)) return u; const f = decodeURIComponent(u.split(/[\\/]/).pop()); return m.textures + encodeURIComponent((m.alias || {})[f] || f); });
    root = await new FBXLoader(manager).loadAsync(encodeURI(m.url));
    await settled;
    // drop texture slots whose file was not shipped with the model; a missing colour map (the lens texture here)
    // would render flat white, so that surface becomes dark glass instead
    root.traverse(o => o.material && [].concat(o.material).forEach(mat => ['map', 'normalMap', 'bumpMap', 'specularMap', 'emissiveMap']
      .forEach(k => { if (mat[k] && !mat[k].image) { mat[k] = null; if (k === 'map' && mat.color) { mat.color.set(0x07090d); mat.shininess = 120; } } mat.needsUpdate = true; })));
  } else {
    root = (await new GLTFLoader().loadAsync(encodeURI(m.url))).scene;
  }
  const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  root.position.sub(c);
  const pivot = new THREE.Group(), outer = new THREE.Group();       // outer is what a Node moves and rotates
  pivot.add(root); outer.add(pivot);
  pivot.scale.setScalar(m.h / size.y);
  pivot.rotation.y = m.turn;
  return (loaded[name] = outer);
}
const preload = names => Promise.all(names.map(load));

/* ---------- Node: GSAP-friendly wrapper around one model instance ---------- */
class Node {
  constructor(obj, px, py, size = 1) {
    this.obj = obj; this.bx = px - W / 2; this.by = H / 2 - py; this.size = size;
    this.x = 0; this.y = 0; this.z = 0; this.rotation = 0; this.rotationX = 0; this.rotationY = 0; this.rotationZ = 0;
    this.scale = 1; this.opacity = 1; this.visible = true;
    obj.traverse(o => { if (o.material) {
      o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone();   // own materials: opacity per instance
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.userData.baseOpacity = m.opacity; m.userData.baseTransparent = m.transparent; });
    } });
    nodes.push(this);
  }
  apply() {
    const o = this.obj, r = THREE.MathUtils.degToRad, fade = this.opacity < 0.999;
    o.visible = this.visible && this.opacity > 0.003 && this.scale > 0.001;
    if (!o.visible) return;
    o.position.set(this.bx + this.x, this.by - this.y, this.z);
    o.rotation.set(r(this.rotationX), r(this.rotationY), r(this.rotationZ + this.rotation));
    o.scale.setScalar(this.size * this.scale);
    o.traverse(c => { if (c.material) (Array.isArray(c.material) ? c.material : [c.material]).forEach(m => {
      m.transparent = fade || m.userData.baseTransparent; m.opacity = m.userData.baseOpacity * this.opacity; }); });
  }
}
function render() { nodes.forEach(n => n.apply()); renderer.render(scene, camera); }

/* an instance of a loaded model at stage point (px, py), size = scale factor */
function place(name, px, py, size = 1) {
  const obj = loaded[name].clone(true);
  scene.add(obj);
  return new Node(obj, px, py, size);
}

window.K3D = { init, preload, place, render, MODELS, THREE, W, H };
