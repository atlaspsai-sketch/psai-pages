import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const DRACO_PATH = 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/libs/draco/gltf/';
const STAGE_NAMES = ['stage_1_slab', 'stage_2_walls', 'stage_3_glazing', 'stage_4_finishes', 'stage_5_fitout', 'stage_6_life'];

// Placeholder layout, metres, read off the official floor plan (origin: unit's left edge, balcony outer edge).
// Plan "up" is north-west; the balcony edge faces south-east.
export const PLAN = {
  outline: [[0, 10.1], [10.6, 10.1], [10.6, 11.5], [12.6, 11.5], [12.6, 1.65], [12.0, 1.65], [12.0, 0], [2.25, 0], [2.25, 1.65], [2.0, 1.65], [2.0, 5.8], [0, 5.8]],
  balconyLine: [[2.25, 1.65], [12.0, 1.65]],
  rooms: {
    room_living: { label: 'Living', w_mm: 4000, d_mm: 4850, x: 8.6, z: 1.65, w: 4.0, d: 4.85, open: true },
    room_dining: { label: 'Dining', w_mm: 3400, d_mm: 1900, x: 9.2, z: 6.5, w: 3.4, d: 1.9, open: true },
    room_kitchen: { label: 'Kitchen', w_mm: 3050, d_mm: 2850, x: 7.9, z: 8.4, w: 3.05, d: 1.7, open: true },
    room_bed1: { label: 'Bedroom 1', w_mm: 3600, d_mm: 4050, x: 0, z: 6.05, w: 3.75, d: 4.05 },
    room_bed2: { label: 'Bedroom 2', w_mm: 3750, d_mm: 3650, x: 2.25, z: 1.65, w: 3.75, d: 3.65 },
    room_bath1: { label: 'Bathroom 1', w_mm: 1800, d_mm: 2850, x: 4.5, z: 7.3, w: 1.8, d: 2.8 },
    room_bath2: { label: 'Bathroom 2', w_mm: 1900, d_mm: 2750, x: 6.6, z: 1.65, w: 1.9, d: 2.75 },
    room_toilet: { label: 'Guest toilet', w_mm: 1300, d_mm: 2850, x: 6.4, z: 7.3, w: 1.3, d: 2.8 },
    room_store: { label: 'Store', w_mm: 800, d_mm: 1200, x: 7.7, z: 4.6, w: 0.8, d: 1.2 },
    room_entry: { label: 'Entry', w_mm: 1500, d_mm: 1400, x: 10.9, z: 10.1, w: 1.7, d: 1.4, open: true },
    room_balcony: { label: 'Balcony', w_mm: 9750, d_mm: 1700, x: 2.25, z: 0, w: 9.75, d: 1.65, open: true },
  },
};
const CX = 6.3;
const CZ = 5.75;
const toWorld = (x, z) => new THREE.Vector3(x - CX, 0, CZ - z);

const COL = {
  slab: 0x3a312a, wall: 0xe6dccb, floor: 0xcbb9a2, floorWet: 0xd9d2c6, wood: 0x8a6a48,
  copper: 0xc88a55, glass: 0xf2be85, fabric: 0xd8cbb6, plant: 0x6f7a4a, dark: 0x2a241e,
};
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, ...extra });

function box(w, h, d, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  return m;
}
function rect(r, h, material, y, inset = 0) {
  const p = toWorld(r.x + r.w / 2, r.z + r.d / 2);
  return box(r.w - inset, h, r.d - inset, material, p.x, y, p.z);
}
function wallsAround(r, h, material, thick = 0.09) {
  const g = new THREE.Group();
  const p = toWorld(r.x + r.w / 2, r.z + r.d / 2);
  g.add(box(r.w + thick, h, thick, material, p.x, h / 2, p.z - r.d / 2));
  g.add(box(r.w + thick, h, thick, material, p.x, h / 2, p.z + r.d / 2));
  g.add(box(thick, h, r.d + thick, material, p.x - r.w / 2, h / 2, p.z));
  g.add(box(thick, h, r.d + thick, material, p.x + r.w / 2, h / 2, p.z));
  return g;
}

export function buildPlaceholder() {
  const root = new THREE.Group();
  root.name = 'unit409_placeholder';
  const H = 1.05;
  const mWall = mat(COL.wall, { roughness: 0.9 });
  const mSlab = mat(COL.slab, { roughness: 0.95 });
  const mFloor = mat(COL.floor);
  const mWet = mat(COL.floorWet, { roughness: 0.6 });
  const mWood = mat(COL.wood, { roughness: 0.7 });
  const mCopper = mat(COL.copper, { roughness: 0.35, metalness: 0.7 });
  const mGlass = new THREE.MeshStandardMaterial({ color: COL.glass, transparent: true, opacity: 0.22, roughness: 0.1, metalness: 0.2, depthWrite: false });
  const mFabric = mat(COL.fabric);
  const mPlant = mat(COL.plant);
  const mDark = mat(COL.dark, { roughness: 0.5, metalness: 0.3 });

  const stages = STAGE_NAMES.map((n) => { const g = new THREE.Group(); g.name = n; root.add(g); return g; });
  const [sSlab, sWalls, sGlaz, sFin, sFit, sLife] = stages;

  const shape = new THREE.Shape(PLAN.outline.map(([x, z]) => new THREE.Vector2(x - CX, -(CZ - z))));
  const slabGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: false });
  const slab = new THREE.Mesh(slabGeo, mSlab);
  slab.rotation.x = Math.PI / 2;
  slab.position.y = 0;
  sSlab.add(slab);
  const slabEdge = new THREE.LineSegments(new THREE.EdgesGeometry(slabGeo), new THREE.LineBasicMaterial({ color: COL.copper, transparent: true, opacity: 0.5 }));
  slabEdge.rotation.x = Math.PI / 2;
  sSlab.add(slabEdge);

  const outer = new THREE.Group();
  for (let i = 0; i < PLAN.outline.length; i++) {
    const a = PLAN.outline[i];
    const b = PLAN.outline[(i + 1) % PLAN.outline.length];
    const isBalconyFront = a[1] === 0 && b[1] === 0;
    if (isBalconyFront) continue;
    const pa = toWorld(a[0], a[1]);
    const pb = toWorld(b[0], b[1]);
    const len = pa.distanceTo(pb);
    const mid = pa.clone().add(pb).multiplyScalar(0.5);
    const isBalconySide = (a[1] <= 1.65 && b[1] <= 1.65);
    const h = isBalconySide ? 0.35 : H;
    const w = box(len + 0.09, h, 0.09, isBalconySide ? mGlass : mWall, mid.x, h / 2, mid.z);
    w.rotation.y = -Math.atan2(pb.z - pa.z, pb.x - pa.x);
    outer.add(w);
  }
  sWalls.add(outer);
  ['room_bed1', 'room_bed2', 'room_bath1', 'room_bath2', 'room_toilet', 'room_store'].forEach((k) => sWalls.add(wallsAround(PLAN.rooms[k], H, mWall)));
  const bl = PLAN.balconyLine;
  const bp = toWorld((bl[0][0] + bl[1][0]) / 2, 1.65);
  sWalls.add(box(bl[1][0] - bl[0][0], 0.12, 0.1, mWall, bp.x, 0.06, bp.z));

  sGlaz.add(box(bl[1][0] - bl[0][0], H - 0.12, 0.05, mGlass, bp.x, 0.12 + (H - 0.12) / 2, bp.z));
  const mullions = new THREE.Group();
  for (let i = 0; i <= 6; i++) {
    mullions.add(box(0.05, H, 0.06, mDark, bp.x - (bl[1][0] - bl[0][0]) / 2 + i * ((bl[1][0] - bl[0][0]) / 6), H / 2, bp.z));
  }
  sGlaz.add(mullions);
  const bal = PLAN.rooms.room_balcony;
  const balP = toWorld(bal.x + bal.w / 2, 0);
  sGlaz.add(box(bal.w, 0.02, 0.6, mCopper, balP.x, 0.36, balP.z));

  Object.entries(PLAN.rooms).forEach(([k, r]) => {
    const wet = k.includes('bath') || k === 'room_toilet' || k === 'room_kitchen';
    const f = rect(r, 0.02, wet ? mWet : (k === 'room_balcony' ? mSlab : mFloor), 0.17, 0.12);
    f.name = 'floor_' + k;
    sFin.add(f);
  });

  const kit = PLAN.rooms.room_kitchen;
  const kp = toWorld(kit.x + kit.w / 2, kit.z + kit.d - 0.32);
  sFit.add(box(kit.w - 0.2, 0.42, 0.62, mWood, kp.x, 0.16 + 0.21, kp.z));
  sFit.add(box(kit.w - 0.2, 0.02, 0.64, mCopper, kp.x, 0.16 + 0.43, kp.z));
  const b1 = PLAN.rooms.room_bed1;
  const w1 = toWorld(b1.x + b1.w + 0.35, b1.z + 3.0);
  sFit.add(box(0.6, 0.95, 1.8, mWood, w1.x, 0.16 + 0.475, w1.z));
  const b2 = PLAN.rooms.room_bed2;
  const w2 = toWorld(b2.x + b2.w + 0.3, b2.z + 2.2);
  sFit.add(box(0.6, 0.95, 2.4, mWood, w2.x, 0.16 + 0.475, w2.z));
  [['room_bath1', 0.6], ['room_bath2', 0.6], ['room_toilet', 0.5]].forEach(([k, s]) => {
    const r = PLAN.rooms[k];
    const p = toWorld(r.x + r.w / 2, r.z + r.d - 0.5);
    sFit.add(box(s, 0.3, 0.6, mWet, p.x, 0.16 + 0.15, p.z));
    const q = toWorld(r.x + r.w / 2, r.z + 0.5);
    sFit.add(box(s, 0.38, 0.4, mWet, q.x, 0.16 + 0.19, q.z));
  });

  const bed = (r, bw, bd, ox, oz) => {
    const p = toWorld(r.x + ox, r.z + oz);
    const g = new THREE.Group();
    g.add(box(bw, 0.22, bd, mFabric, p.x, 0.16 + 0.11, p.z));
    g.add(box(bw, 0.05, 0.3, mWood, p.x, 0.16 + 0.24, p.z - bd / 2 + 0.15));
    g.add(box(bw * 0.4, 0.18, 0.5, mFabric, p.x, 0.16 + 0.3, p.z - bd / 2 + 0.4));
    return g;
  };
  sLife.add(bed(b1, 1.8, 2.0, 1.4, 2.0));
  sLife.add(bed(b2, 1.8, 2.0, 1.4, 1.5));
  const liv = PLAN.rooms.room_living;
  const sp = toWorld(liv.x + liv.w - 0.6, liv.z + 2.4);
  sLife.add(box(0.9, 0.35, 2.4, mFabric, sp.x, 0.16 + 0.175, sp.z));
  const tp = toWorld(liv.x + 1.6, liv.z + 2.4);
  sLife.add(box(1.0, 0.04, 0.6, mGlass, tp.x, 0.16 + 0.34, tp.z));
  const din = PLAN.rooms.room_dining;
  const dp = toWorld(din.x + din.w / 2, din.z + din.d / 2);
  const table = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.05, 32), mWood);
  table.position.set(dp.x, 0.16 + 0.38, dp.z);
  sLife.add(table);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.36, 12), mWood);
  leg.position.set(dp.x, 0.16 + 0.18, dp.z);
  sLife.add(leg);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    sLife.add(box(0.4, 0.45, 0.4, mFabric, dp.x + Math.cos(a) * 0.95, 0.16 + 0.225, dp.z + Math.sin(a) * 0.95));
  }
  const c1 = toWorld(bal.x + bal.w / 2 - 0.6, 0.8);
  const c2 = toWorld(bal.x + bal.w / 2 + 0.6, 0.8);
  sLife.add(box(0.55, 0.4, 0.55, mFabric, c1.x, 0.16 + 0.2, c1.z));
  sLife.add(box(0.55, 0.4, 0.55, mFabric, c2.x, 0.16 + 0.2, c2.z));
  const plantAt = (x, z) => {
    const p = toWorld(x, z);
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.3, 12), mDark)).position.set(p.x, 0.16 + 0.15, p.z);
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), mPlant)).position.set(p.x, 0.16 + 0.55, p.z);
    return g;
  };
  sLife.add(plantAt(bal.x + 0.5, 0.8));
  sLife.add(plantAt(bal.x + bal.w - 0.5, 0.8));
  sLife.add(plantAt(liv.x + 0.5, liv.z + 4.4));
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xf2be85 }));
  const lp = toWorld(liv.x + 0.6, liv.z + 0.6);
  lamp.position.set(lp.x, 0.16 + 0.9, lp.z);
  sLife.add(lamp);

  const rooms = {};
  Object.entries(PLAN.rooms).forEach(([k, r]) => {
    rooms[k] = { label: r.label, w_mm: r.w_mm, d_mm: r.d_mm, center: toWorld(r.x + r.w / 2, r.z + r.d / 2).setY(0.3) };
  });
  return { root, rooms, stages, baked: false, north: 45, radius: 0.5 * Math.hypot(12.6, 11.5) };
}

function collectFromGltf(gltf, meta) {
  const root = gltf.scene;
  const rooms = {};
  const stages = [];
  let wallsCut = null;
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (o.name.startsWith('room_')) {
      const ex = o.userData || {};
      const p = new THREE.Vector3();
      o.getWorldPosition(p);
      rooms[o.name] = { label: ex.label || o.name.replace('room_', ''), w_mm: Number(ex.w_mm) || 0, d_mm: Number(ex.d_mm) || 0, center: p };
    }
    if (o.name === 'walls_cut') wallsCut = o;
    if (o.isMesh) {
      const m = o.material;
      if (m && !m.isMeshBasicMaterial && meta.baked !== false) {
        const basic = new THREE.MeshBasicMaterial({ color: m.color ? m.color.clone() : 0xffffff, map: m.map || null, transparent: !!m.transparent, opacity: m.opacity ?? 1, side: m.side });
        if (basic.map) basic.map.colorSpace = THREE.SRGBColorSpace;
        o.material = basic;
      }
    }
  });
  root.traverse((o) => { const m = /^stage_(\d)/.exec(o.name); if (m) stages[Number(m[1]) - 1] = o; });
  if (wallsCut) wallsCut.visible = false;
  if (Array.isArray(meta.rooms)) {
    meta.rooms.forEach((r) => {
      if (!rooms[r.id]) rooms[r.id] = { label: r.label, w_mm: r.w_mm, d_mm: r.d_mm, center: new THREE.Vector3(r.x || 0, 0.3, r.z || 0) };
    });
  }
  const north = typeof meta.north === 'number' ? meta.north : (meta.north && meta.north.bearing_deg_clockwise_from_plan_up) ?? 45;
  const cam = meta.camera_default || meta.camera || null;
  const camera = cam && cam.position ? { position: cam.position, target: cam.target || cam.look_at || cam.lookAt || [0, 0.3, 0] } : null;
  const bb = new THREE.Box3().setFromObject(root);
  const c = bb.getCenter(new THREE.Vector3());
  root.position.sub(new THREE.Vector3(c.x, bb.min.y, c.z));
  Object.values(rooms).forEach((r) => r.center.sub(new THREE.Vector3(c.x, bb.min.y, c.z)));
  const size = bb.getSize(new THREE.Vector3());
  return { root, rooms, stages: stages.filter(Boolean), baked: meta.baked !== false, north, radius: 0.5 * Math.hypot(size.x, size.z), camera };
}

let unitPromise = null;
export function loadUnit() {
  if (unitPromise) return unitPromise;
  unitPromise = (async () => {
    let meta = {};
    try {
      const r = await fetch('model/unit409.json', { cache: 'no-cache' });
      if (r.ok) meta = await r.json();
    } catch (e) { /* placeholder path */ }
    try {
      const draco = new DRACOLoader().setDecoderPath(DRACO_PATH);
      const loader = new GLTFLoader().setDRACOLoader(draco);
      const gltf = await loader.loadAsync('model/unit409.glb');
      return collectFromGltf(gltf, meta);
    } catch (e) {
      return buildPlaceholder();
    }
  })();
  return unitPromise;
}

const ease = (t) => 1 - Math.pow(1 - t, 3);

export class UnitViewer {
  constructor(el, unit, opts = {}) {
    this.el = el;
    this.unit = unit;
    this.opts = opts;
    this.reduced = !!opts.reduced;
    this.canvas = el.querySelector('canvas.viewer__canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = unit.baked ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
    this.target = unit.camera && unit.camera.target ? new THREE.Vector3().fromArray(unit.camera.target).setY(0.3) : new THREE.Vector3(0, 0.3, 0);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minPolarAngle = 0.12;
    this.controls.maxPolarAngle = 1.32;
    this.controls.rotateSpeed = 0.7;
    this.controls.target.copy(this.target);
    this.controls.addEventListener('start', () => { this.autorotate = false; this.wake(); });
    this.controls.addEventListener('change', () => this.wake());

    this.root = opts.cloneMaterials ? this.cloneWithMaterials(unit.root) : unit.root.clone(true);
    this.scene.add(this.root);
    this.stages = [];
    this.root.traverse((o) => { const m = /^stage_(\d)/.exec(o.name); if (m) this.stages[Number(m[1]) - 1] = o; });
    this.stages = this.stages.filter(Boolean);
    if (!unit.baked) {
      this.scene.add(new THREE.HemisphereLight(0xf3ece0, 0x14110f, 0.9));
      const sun = new THREE.DirectionalLight(0xf2be85, 1.6);
      sun.position.set(6, 9, 8);
      this.scene.add(sun);
      const fill = new THREE.DirectionalLight(0xc9bfaf, 0.35);
      fill.position.set(-8, 5, -6);
      this.scene.add(fill);
    }
    const ground = new THREE.Mesh(new THREE.CircleGeometry(unit.radius * 1.9, 64), new THREE.MeshBasicMaterial({ color: 0x1b1713, transparent: true, opacity: 0.55 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    this.scene.add(ground);

    this.autorotate = !!opts.autorotate && !this.reduced;
    this.tween = null;
    this.raf = 0;
    this.visible = true;
    this.lastT = performance.now();
    this.azimuthListeners = [];

    this.viewDir = unit.camera && unit.camera.position ? new THREE.Vector3().fromArray(unit.camera.position).sub(this.target).normalize() : new THREE.Vector3(0.42, 0.78, 1.0).normalize();
    this.userMoved = false;
    this.controls.addEventListener('start', () => { this.userMoved = true; });
    this.resize(true);
    if (opts.intro && !this.reduced) {
      this.camera.position.set(0.001, this.fitDistance() * 1.15, 0.4);
      this.flyTo(this.defaultCam, this.target, 1900);
    } else {
      this.camera.position.copy(this.defaultCam);
    }
    this.camera.lookAt(this.target);

    this.ro = new ResizeObserver(() => this.resize(false));
    this.ro.observe(el);
    this.io = new IntersectionObserver((entries) => {
      this.visible = entries[0].isIntersecting;
      if (this.visible) this.wake();
    }, { threshold: 0.05 });
    this.io.observe(el);
    this.wake();
    el.classList.add('is-live');
  }

  cloneWithMaterials(root) {
    const c = root.clone(true);
    c.traverse((o) => {
      if (o.isMesh) {
        o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
      }
      if (o.isLineSegments) o.material = o.material.clone();
    });
    return c;
  }

  fitDistance() {
    const v = THREE.MathUtils.degToRad(this.camera.fov) / 2;
    const hfov = Math.atan(Math.tan(v) * this.camera.aspect);
    return (this.unit.radius * 0.94) / Math.sin(Math.min(v, hfov)) * 1.03;
  }

  resize(initial) {
    const w = this.el.clientWidth;
    const h = this.el.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const d = this.fitDistance();
    this.defaultCam = this.target.clone().add(this.viewDir.clone().multiplyScalar(d));
    this.controls.minDistance = d * 0.28;
    this.controls.maxDistance = d * 1.7;
    if (!initial && !this.userMoved && !this.tween) {
      const cur = this.camera.position.clone().sub(this.controls.target);
      this.camera.position.copy(this.controls.target).add(cur.normalize().multiplyScalar(d));
    }
    this.wake();
  }

  onAzimuth(fn) { this.azimuthListeners.push(fn); }

  wake() {
    if (this.raf) return;
    this.lastT = performance.now();
    this.idleFrames = 0;
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  frame(t) {
    this.raf = 0;
    if (!this.visible) return;
    const dt = Math.min(0.05, (t - this.lastT) / 1000);
    this.lastT = t;
    let active = false;
    if (this.tween) {
      const k = Math.min(1, (t - this.tween.t0) / this.tween.dur);
      const e = ease(k);
      this.camera.position.lerpVectors(this.tween.p0, this.tween.p1, e);
      this.controls.target.lerpVectors(this.tween.q0, this.tween.q1, e);
      if (k >= 1) this.tween = null;
      active = true;
    } else if (this.autorotate) {
      const off = this.camera.position.clone().sub(this.controls.target);
      off.applyAxisAngle(new THREE.Vector3(0, 1, 0), dt * 0.12);
      this.camera.position.copy(this.controls.target).add(off);
      active = true;
    }
    if (this.controls.update()) active = true;
    this.renderer.render(this.scene, this.camera);
    const az = this.controls.getAzimuthalAngle();
    if (this.lastAz !== az) { this.lastAz = az; this.azimuthListeners.forEach((f) => f(az)); }
    this.idleFrames = active ? 0 : (this.idleFrames || 0) + 1;
    if (active || this.idleFrames < 3) this.raf = requestAnimationFrame((tt) => this.frame(tt));
  }

  flyTo(pos, target, dur = 1100) {
    if (this.reduced) {
      this.camera.position.copy(pos);
      this.controls.target.copy(target);
      this.wake();
      return;
    }
    this.tween = { t0: performance.now(), dur, p0: this.camera.position.clone(), p1: pos.clone(), q0: this.controls.target.clone(), q1: target.clone() };
    this.wake();
  }

  goToRoom(name) {
    const r = this.unit.rooms[name];
    if (!r) return null;
    this.autorotate = false;
    const c = r.center.clone();
    const span = Math.max(r.w_mm, r.d_mm) / 1000 || 3;
    const dist = Math.max(this.fitDistance() * 0.42, span * 1.15 + 1.8);
    const dir = new THREE.Vector3(0.35, 1.05, 0.9).normalize();
    this.flyTo(c.clone().add(dir.multiplyScalar(dist)), c.clone().setY(0.2));
    return r;
  }

  goHome() {
    this.flyTo(this.defaultCam, this.target, 1300);
  }

  setBuild(progress) {
    const p = Math.max(0, Math.min(1, progress));
    this.stages.forEach((g, i) => {
      const f = i === 0 ? 1 : Math.max(0, Math.min(1, p * 5 - (i - 1)));
      g.visible = f > 0.001;
      g.traverse((o) => {
        if (o.isMesh || o.isLineSegments) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => {
            if (m.userData.baseOpacity === undefined) m.userData.baseOpacity = m.opacity ?? 1;
            m.transparent = f < 1 || m.userData.baseOpacity < 1;
            m.opacity = m.userData.baseOpacity * f;
          });
        }
      });
    });
    this.wake();
  }
}

export function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
}
