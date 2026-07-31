// render/environments.js
// Procedurally-placed biomes for the six regions of Aurea, surfaced with baked
// PBR textures (see tools/bake-biomes.mjs). Layout stays procedural/deterministic;
// materials now carry real albedo/normal/roughness maps so the world reads as
// textured terrain instead of flat-shaded polygons.
// ESM. Three r0.160 via import map. See web/game/CONTRACT.md.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { cloneWithMaterials } from "./assets.js";

/* ------------------------------------------------------------------ *
 * Baked prop models (tools/bake-props.mjs). Loaded once; cloned + tinted
 * per placement. main.js calls preloadProps() before the first biome.
 * ------------------------------------------------------------------ */
const PROP_BASE = "../assets/models/biomes/";
const PROP_NAMES = [
  "rock_spire", "ice_shard", "tree_trunk", "tree_canopy", "mushroom",
  "island", "windmill", "pillar", "pillar_cap", "arch",
];
const _propLoader = new GLTFLoader();
const _propCache = new Map();

export async function preloadProps() {
  await Promise.all(
    PROP_NAMES.map(async (n) => {
      try {
        const g = await _propLoader.loadAsync(`${PROP_BASE}${n}.glb`);
        _propCache.set(n, g.scene);
      } catch (e) {
        console.warn(`prop load failed: ${n}`, e);
      }
    })
  );
}

function makeProp(name) {
  const t = _propCache.get(name);
  return t ? cloneWithMaterials(t) : null;
}

/* ------------------------------------------------------------------ *
 * Shared environment texture library (loaded once, cached).
 * Paths resolve relative to the page (web/game/index.html).
 * ------------------------------------------------------------------ */
const ENV_TEX_BASE = "../assets/textures/env/";
const _texLoader = new THREE.TextureLoader();
const _texCache = new Map();

function envTex(name, { srgb = false, repeat = 4 } = {}) {
  const key = `${name}|${repeat}|${srgb}`;
  if (_texCache.has(key)) return _texCache.get(key);
  const t = _texLoader.load(`${ENV_TEX_BASE}${name}.png`);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  _texCache.set(key, t);
  return t;
}

// Attach albedo/normal/metallic-roughness maps of a family to a StandardMaterial.
// The material keeps its .color (used as a tint over the neutral albedo).
function applyPBR(mat, family, { repeat = 4, normalScale = 1 } = {}) {
  mat.map = envTex(`${family}_albedo`, { srgb: true, repeat });
  mat.normalMap = envTex(`${family}_normal`, { repeat });
  const mr = envTex(`${family}_mr`, { repeat });
  mat.roughnessMap = mr; // three reads roughness from G
  mat.metalnessMap = mr; // and metalness from B
  if (mat.metalness === 0) mat.metalness = 1; // let the map drive it
  if (mat.normalScale) mat.normalScale.set(normalScale, normalScale);
  mat.needsUpdate = true;
  return mat;
}

/* ------------------------------------------------------------------ *
 * REGION_THEMES
 * regionId -> { name, fog:{color,near,far}, sky:[topHex,botHex], ground, accent }
 * ------------------------------------------------------------------ */
export const REGION_THEMES = {
  emberfall_vale: {
    name: "Emberfall Vale",
    fog: { color: "#ff9d54", near: 10, far: 62 },
    sky: ["#3a275c", "#ffb865"], // dusky violet zenith -> molten gold horizon
    ground: "#5a3a24",
    accent: "#ff7a28",
  },
  tidalreach: {
    name: "Tidalreach",
    fog: { color: "#bfe8ef", near: 12, far: 70 },
    sky: ["#0b2a3a", "#a9e2ea"], // deep teal -> pale frozen sky
    ground: "#3f7178",
    accent: "#5fe4ee",
  },
  verdant_spire: {
    name: "The Verdant Spire",
    fog: { color: "#7fae54", near: 9, far: 56 },
    sky: ["#153a26", "#c6e88a"], // canopy shadow -> sun-shot green
    ground: "#2f4a22",
    accent: "#c8f06a",
  },
  galecrest: {
    name: "Galecrest",
    fog: { color: "#dbe9f2", near: 14, far: 78 },
    sky: ["#6f9ec4", "#eef5fa"], // windswept blue -> bright pale haze
    ground: "#8b9aa8",
    accent: "#d6ecfb",
  },
  sunken_cathedral: {
    name: "The Sunken Cathedral",
    fog: { color: "#2a1442", near: 7, far: 44 },
    sky: ["#080413", "#3c1c60"], // near-black -> bruised violet
    ground: "#241a32",
    accent: "#9a5ae8",
  },
  lumen_core: {
    name: "The Lumen Core",
    fog: { color: "#fff5d6", near: 12, far: 66 },
    sky: ["#e9d79a", "#fffef4"], // gold -> radiant white
    ground: "#d6c586",
    accent: "#ffe89a",
  },
};

/* ------------------------------------------------------------------ *
 * Small deterministic PRNG (mulberry32) + string hash.
 * Deterministic across loads: no live Math.random for layout.
 * ------------------------------------------------------------------ */
function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GOLDEN = Math.PI * (3 - Math.sqrt(5)); // golden angle for even spread

/* ------------------------------------------------------------------ *
 * buildBiome(THREE, regionId)
 * ------------------------------------------------------------------ */
export function buildBiome(THREE, regionId) {
  const theme = REGION_THEMES[regionId] || REGION_THEMES.emberfall_vale;
  const rng = makeRng(hashStr(regionId));

  const group = new THREE.Group();
  group.name = `biome:${regionId}`;

  const cSkyTop = new THREE.Color(theme.sky[0]);
  const cSkyBot = new THREE.Color(theme.sky[1]);
  const cGround = new THREE.Color(theme.ground);
  const cAccent = new THREE.Color(theme.accent);
  const cFog = new THREE.Color(theme.fog.color);

  // Animated registries (closed over by update()).
  const spinners = []; // { obj, speed }
  const bobbers = []; // { obj, baseY, amp, speed, phase }
  const pulsers = []; // { mat, base, amp, speed, phase }

  /* ---------------- Sky: large inverted gradient sphere ---------------- */
  const skyGeo = new THREE.SphereGeometry(200, 32, 20);
  {
    const pos = skyGeo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 200; // -1..1
      const t = THREE.MathUtils.clamp((y + 1) / 2, 0, 1);
      // ease so the horizon band reads richer
      const e = Math.pow(t, 0.7);
      c.copy(cSkyBot).lerp(cSkyTop, e);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    skyGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  }
  const skyMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.name = "sky";
  group.add(sky);

  /* ---------------- Ground disc ---------------- */
  const groundGeo = new THREE.CircleGeometry(60, 64);
  const groundMat = new THREE.MeshStandardMaterial({
    color: cGround,
    roughness: 0.95,
    metalness: 0.02,
  });
  applyPBR(groundMat, "ground", { repeat: 14, normalScale: 1.2 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = "ground";
  group.add(ground);

  // A subtly raised inner platform so the arena reads as a stage.
  const platGeo = new THREE.CylinderGeometry(7.2, 7.8, 0.35, 48);
  const platMat = new THREE.MeshStandardMaterial({
    color: cGround.clone().offsetHSL(0, 0.02, 0.06),
    roughness: 0.9,
    metalness: 0.05,
  });
  applyPBR(platMat, "rock", { repeat: 5 });
  const platform = new THREE.Mesh(platGeo, platMat);
  platform.position.y = 0.0;
  platform.receiveShadow = true;
  platform.name = "platform";
  group.add(platform);

  /* ---------------- Arena ring ---------------- */
  const ringGeo = new THREE.TorusGeometry(6.4, 0.16, 12, 96);
  const ringMat = new THREE.MeshStandardMaterial({
    color: cAccent,
    emissive: cAccent,
    emissiveIntensity: 0.6,
    roughness: 0.4,
    metalness: 0.2,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.19;
  ring.name = "arenaRing";
  group.add(ring);
  pulsers.push({ mat: ringMat, base: 0.6, amp: 0.35, speed: 1.4, phase: 0 });

  /* ---------------- Themed props ---------------- */
  buildProps(regionId);

  /* ---------------- Drifting particles ---------------- */
  const particles = buildParticles(regionId);
  group.add(particles.points);

  /* ---------------- Lights ---------------- */
  const lights = buildLights(regionId);

  /* ---------------- Fog & background ---------------- */
  const fog = new THREE.Fog(cFog.getHex(), theme.fog.near, theme.fog.far);
  const background = cSkyBot.clone(); // main sets scene.background

  /* ================= internal builders ================= */

  function track(mesh, opts) {
    opts = opts || {};
    mesh.castShadow = opts.cast !== false;
    mesh.receiveShadow = opts.receive === true;
    group.add(mesh);
    return mesh;
  }

  // Instantiate a baked prop model: clone, place, tint, shadow-flag, and
  // auto-register any spinner sub-node. Returns the root (or null if the model
  // isn't loaded, so callers can fall back to primitive geometry).
  function instProp(name, opts = {}) {
    const o = makeProp(name);
    if (!o) return null;
    o.position.set(opts.x || 0, opts.y || 0, opts.z || 0);
    if (opts.scale != null) {
      if (typeof opts.scale === "number") o.scale.setScalar(opts.scale);
      else o.scale.set(opts.scale[0], opts.scale[1], opts.scale[2]);
    }
    if (opts.rotY) o.rotation.y = opts.rotY;
    if (opts.rotZ) o.rotation.z = opts.rotZ;
    const tint = opts.tint ? new THREE.Color(opts.tint) : null;
    o.traverse((m) => {
      if (m.isMesh) {
        m.castShadow = opts.cast !== false;
        m.receiveShadow = opts.receive === true;
        if (tint && m.material) {
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          mats.forEach((mat) => mat.color && mat.color.copy(tint));
        }
      }
      if (m.userData && m.userData.role === "spinner") {
        spinners.push({ obj: m, speed: m.userData.speed || 1 });
      }
    });
    group.add(o);
    return o;
  }

  // Place `count` props on a ring around the arena, evenly + jittered.
  function ringLayout(count, rMin, rMax) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const a = i * GOLDEN + rng() * 0.4;
      const r = rMin + (rMax - rMin) * ((i + 0.5) / count) + (rng() - 0.5) * 1.5;
      out.push({
        x: Math.cos(a) * r,
        z: Math.sin(a) * r,
        a,
        i,
        r,
        s: 0.7 + rng() * 0.9, // scale factor
      });
    }
    return out;
  }

  function buildProps(id) {
    switch (id) {
      case "emberfall_vale":
        return propsEmberfall();
      case "tidalreach":
        return propsTidalreach();
      case "verdant_spire":
        return propsVerdant();
      case "galecrest":
        return propsGalecrest();
      case "sunken_cathedral":
        return propsSunken();
      case "lumen_core":
        return propsLumen();
      default:
        return propsEmberfall();
    }
  }

  // --- Emberfall: warm rock spires + glowing lanterns ---
  function propsEmberfall() {
    const rockMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#7a4326"),
      roughness: 1.0,
      metalness: 0.05,
    });
    applyPBR(rockMat, "rock", { repeat: 2, normalScale: 1.4 });
    const layout = ringLayout(9, 10, 20);
    for (const p of layout) {
      const h = 3.5 + p.s * 4.5;
      const rx = 0.9 + p.s * 0.7;
      const rz = (rng() - 0.5) * 0.12;
      const inst = instProp("rock_spire", { x: p.x, y: h / 2, z: p.z, scale: [rx, h / 6, rx], tint: "#7a4326", rotY: p.a, rotZ: rz });
      if (!inst) {
        const m = new THREE.Mesh(new THREE.ConeGeometry(rx, h, 6), rockMat);
        m.position.set(p.x, h / 2, p.z);
        m.rotation.y = p.a;
        m.rotation.z = rz;
        track(m);
      }
    }
    // Warm hovering lanterns near the arena.
    const lanternMat = new THREE.MeshStandardMaterial({
      color: cAccent,
      emissive: cAccent,
      emissiveIntensity: 1.4,
      roughness: 0.3,
    });
    const lan = ringLayout(6, 7.5, 9.5);
    for (const p of lan) {
      const geo = new THREE.OctahedronGeometry(0.32 + p.s * 0.12, 0);
      const m = new THREE.Mesh(geo, lanternMat);
      const y = 1.6 + p.s * 1.4;
      m.position.set(p.x, y, p.z);
      track(m, { cast: false });
      bobbers.push({ obj: m, baseY: y, amp: 0.35, speed: 0.8 + rng() * 0.5, phase: p.i });
      pulsers.push({ mat: lanternMat, base: 1.4, amp: 0.4, speed: 1.6, phase: 0 });
    }
  }

  // --- Tidalreach: jagged ice shards + frozen crest ---
  function propsTidalreach() {
    const iceMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#bfeef5"),
      emissive: cAccent,
      emissiveIntensity: 0.18,
      roughness: 0.15,
      metalness: 0.1,
      transparent: true,
      opacity: 0.85,
    });
    applyPBR(iceMat, "ice", { repeat: 2, normalScale: 0.8 });
    const layout = ringLayout(11, 9, 21);
    for (const p of layout) {
      const h = 2.5 + p.s * 5.0;
      const rx = (0.5 + p.s * 0.7) / 0.7;
      const rz = (rng() - 0.5) * 0.25;
      const inst = instProp("ice_shard", { x: p.x, y: h / 2, z: p.z, scale: [rx, h / 6, rx], tint: "#bfeef5", rotY: p.a, rotZ: rz });
      if (!inst) {
        const m = new THREE.Mesh(new THREE.ConeGeometry(0.5 + p.s * 0.7, h, 4), iceMat);
        m.position.set(p.x, h / 2, p.z);
        m.rotation.y = p.a;
        m.rotation.z = rz;
        track(m);
      }
    }
    // A low frozen swell (torus) hinting at the halted tide.
    const swellGeo = new THREE.TorusGeometry(15, 1.1, 8, 48);
    const swellMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#8fd8e0"),
      roughness: 0.25,
      metalness: 0.1,
      transparent: true,
      opacity: 0.6,
    });
    const swell = new THREE.Mesh(swellGeo, swellMat);
    swell.rotation.x = -Math.PI / 2;
    swell.position.y = 0.4;
    track(swell, { cast: false, receive: true });
  }

  // --- Verdant Spire: giant tree trunks + stylized mushrooms + light shafts ---
  function propsVerdant() {
    const barkMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#4a3a24"),
      roughness: 0.95,
    });
    applyPBR(barkMat, "bark", { repeat: 3, normalScale: 1.3 });
    const canopyMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#3f7a2e"),
      roughness: 0.9,
    });
    applyPBR(canopyMat, "foliage", { repeat: 3 });
    const trees = ringLayout(6, 12, 22);
    for (const p of trees) {
      const h = 9 + p.s * 8;
      const trunkXZ = 1 + p.s * 0.55;
      const canopyS = (2.6 + p.s * 1.8) / 2.6;
      const bobSpeed = 0.5 + rng() * 0.3;
      const trunk = instProp("tree_trunk", { x: p.x, y: h / 2, z: p.z, scale: [trunkXZ, h / 10, trunkXZ], tint: "#5a4428" });
      if (!trunk) {
        const t = new THREE.Mesh(new THREE.CylinderGeometry(0.7 + p.s * 0.4, 1.2 + p.s * 0.6, h, 8), barkMat);
        t.position.set(p.x, h / 2, p.z); track(t);
      }
      const canopy = instProp("tree_canopy", { x: p.x, y: h + 1.2, z: p.z, scale: canopyS, tint: "#3f7a2e" });
      if (canopy) {
        bobbers.push({ obj: canopy, baseY: h + 1.2, amp: 0.25, speed: bobSpeed, phase: p.i });
      } else {
        const c = new THREE.Mesh(new THREE.IcosahedronGeometry(2.6 + p.s * 1.8, 1), canopyMat);
        c.position.set(p.x, h + 1.2, p.z); c.scale.y = 0.8; track(c);
        bobbers.push({ obj: c, baseY: h + 1.2, amp: 0.25, speed: bobSpeed, phase: p.i });
      }
    }
    // Stylized mushrooms close in.
    const stemMat = new THREE.MeshStandardMaterial({ color: new THREE.Color("#e8e0c8"), roughness: 0.85 });
    const capMat = new THREE.MeshStandardMaterial({
      color: cAccent,
      emissive: cAccent,
      emissiveIntensity: 0.25,
      roughness: 0.6,
    });
    const shrooms = ringLayout(7, 8, 12);
    for (const p of shrooms) {
      const sh = 0.6 + p.s * 0.9;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, sh, 8), stemMat);
      stem.position.set(p.x, sh / 2, p.z);
      track(stem);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.45 + p.s * 0.3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
      cap.position.set(p.x, sh, p.z);
      track(cap);
    }
    // Soft "light shafts": translucent cones descending from the canopy.
    const shaftMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#e8f5b0"),
      transparent: true,
      opacity: 0.06,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
      blending: THREE.AdditiveBlending,
    });
    const shafts = ringLayout(4, 4, 9);
    for (const p of shafts) {
      const geo = new THREE.ConeGeometry(1.6 + p.s, 16, 12, 1, true);
      const m = new THREE.Mesh(geo, shaftMat);
      m.position.set(p.x * 0.6, 8, p.z * 0.6);
      track(m, { cast: false });
    }
  }

  // --- Galecrest: floating rock platforms + windmill primitives ---
  function propsGalecrest() {
    const rockMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#7d8a97"),
      roughness: 0.9,
    });
    applyPBR(rockMat, "rock", { repeat: 2 });
    const platGeoBase = ringLayout(7, 10, 22);
    for (const p of platGeoBase) {
      const y = 2.5 + p.s * 6;
      const w = 1.8 + p.s * 2.2;
      const spd = 0.35 + rng() * 0.3;
      const isl = instProp("island", { x: p.x, y, z: p.z, scale: w / 1.9, tint: "#8b9aa8" });
      if (isl) {
        bobbers.push({ obj: isl, baseY: y, amp: 0.5, speed: spd, phase: p.i });
      } else {
        const top = new THREE.Mesh(new THREE.CylinderGeometry(w, w * 0.9, 0.7, 7), rockMat);
        const base = new THREE.Mesh(new THREE.ConeGeometry(w * 0.9, 2.5 + p.s * 2, 7), rockMat);
        top.position.set(p.x, y, p.z);
        base.position.set(p.x, y - 1.6, p.z); base.rotation.x = Math.PI;
        track(top); track(base, { cast: false });
        bobbers.push({ obj: top, baseY: y, amp: 0.5, speed: spd, phase: p.i });
        bobbers.push({ obj: base, baseY: y - 1.6, amp: 0.5, speed: spd, phase: p.i });
      }
    }
    // Sky-mills: a post + a spinning cross of blades.
    const postMat = new THREE.MeshStandardMaterial({ color: new THREE.Color("#5f6b78"), roughness: 0.85 });
    const bladeMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#e8f0f6"),
      roughness: 0.6,
      side: THREE.DoubleSide,
    });
    const mills = ringLayout(4, 8, 14);
    for (const p of mills) {
      const ph = 4 + p.s * 3;
      const spd = 0.8 + rng() * 0.6;
      const mill = instProp("windmill", { x: p.x, y: ph / 2, z: p.z, scale: ph / 6, rotY: p.a, tint: "#9aa6b3" });
      if (mill) {
        // retune the auto-registered blade spinner speed for variety
        const s = spinners[spinners.length - 1];
        if (s && s.obj.userData.role === "spinner") s.speed = spd;
      } else {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, ph, 8), postMat);
        post.position.set(p.x, ph / 2, p.z); track(post);
        const hub = new THREE.Group();
        hub.position.set(p.x, ph, p.z); hub.rotation.y = p.a;
        for (let b = 0; b < 4; b++) {
          const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8 + p.s, 0.5), bladeMat);
          blade.position.y = 0.9 + p.s * 0.5;
          const holder = new THREE.Group();
          holder.rotation.z = (b / 4) * Math.PI * 2; holder.add(blade); hub.add(holder);
        }
        group.add(hub);
        spinners.push({ obj: hub, speed: spd });
      }
    }
  }

  // --- Sunken Cathedral: broken pillars + arches in violet gloom ---
  function propsSunken() {
    const stoneMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#4a3d5c"),
      roughness: 0.95,
      metalness: 0.05,
    });
    applyPBR(stoneMat, "rock", { repeat: 2, normalScale: 1.2 });
    const glowMat = new THREE.MeshStandardMaterial({
      color: cAccent,
      emissive: cAccent,
      emissiveIntensity: 1.2,
      roughness: 0.4,
    });
    const pillars = ringLayout(10, 9, 20);
    for (const p of pillars) {
      const full = 6 + p.s * 6;
      const broken = full * (0.35 + rng() * 0.6); // shattered heights
      const lean = (rng() - 0.5) * 0.06;
      const col = instProp("pillar", { x: p.x, y: broken / 2, z: p.z, scale: [1, broken / 6, 1], rotZ: lean, tint: "#4a3d5c" });
      if (!col) {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, broken, 10), stoneMat);
        c.position.set(p.x, broken / 2, p.z); c.rotation.z = lean; track(c);
      }
      const cap = instProp("pillar_cap", { x: p.x, y: broken + 0.25, z: p.z, rotY: p.a, tint: "#4a3d5c" });
      if (!cap) {
        const cp = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 1.8), stoneMat);
        cp.position.set(p.x, broken + 0.25, p.z); cp.rotation.y = p.a; track(cp);
      }
    }
    // A ruined arch spanning behind the arena (torus arc).
    const archGeo = new THREE.TorusGeometry(5, 0.6, 8, 24, Math.PI);
    const arch = new THREE.Mesh(archGeo, stoneMat);
    arch.position.set(0, 0, -14);
    arch.rotation.z = 0;
    track(arch);
    // Floating violet motes-as-orbs (glow markers).
    const orbs = ringLayout(5, 6, 10);
    for (const p of orbs) {
      const geo = new THREE.SphereGeometry(0.22 + p.s * 0.1, 12, 8);
      const m = new THREE.Mesh(geo, glowMat);
      const y = 2 + p.s * 2.5;
      m.position.set(p.x, y, p.z);
      track(m, { cast: false });
      bobbers.push({ obj: m, baseY: y, amp: 0.5, speed: 0.5 + rng() * 0.4, phase: p.i });
      pulsers.push({ mat: glowMat, base: 1.2, amp: 0.6, speed: 1.1, phase: 0 });
    }
  }

  // --- Lumen Core: radiant glowing monoliths ---
  function propsLumen() {
    const monoMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#fff4cf"),
      emissive: cAccent,
      emissiveIntensity: 1.0,
      roughness: 0.3,
      metalness: 0.15,
    });
    applyPBR(monoMat, "crystal", { repeat: 2 });
    monoMat.metalness = 0.15; // keep monoliths mostly dielectric despite the map
    const layout = ringLayout(8, 10, 20);
    for (const p of layout) {
      const h = 5 + p.s * 7;
      const geo = new THREE.BoxGeometry(0.9 + p.s * 0.5, h, 0.9 + p.s * 0.5);
      const m = new THREE.Mesh(geo, monoMat);
      m.position.set(p.x, h / 2, p.z);
      m.rotation.y = p.a;
      track(m);
      pulsers.push({ mat: monoMat, base: 1.0, amp: 0.45, speed: 0.7 + rng() * 0.6, phase: p.i });
    }
    // A luminous core halo hovering above the arena.
    const haloGeo = new THREE.TorusGeometry(3.2, 0.18, 10, 64);
    const haloMat = new THREE.MeshStandardMaterial({
      color: cAccent,
      emissive: cAccent,
      emissiveIntensity: 1.8,
      roughness: 0.2,
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.position.y = 7;
    halo.rotation.x = Math.PI / 2.4;
    track(halo, { cast: false });
    spinners.push({ obj: halo, speed: 0.3 });
    pulsers.push({ mat: haloMat, base: 1.8, amp: 0.6, speed: 1.0, phase: 0 });

    const orbGeo = new THREE.IcosahedronGeometry(1.1, 1);
    const orb = new THREE.Mesh(orbGeo, haloMat);
    orb.position.y = 7;
    track(orb, { cast: false });
    bobbers.push({ obj: orb, baseY: 7, amp: 0.4, speed: 0.6, phase: 0 });
  }

  /* ---------------- Particle systems ---------------- */
  function buildParticles(id) {
    // behavior: rise | fall | float | drift | spark | glint
    const cfg = {
      emberfall_vale: { n: 220, behavior: "rise", color: "#ff8a3a", size: 0.22, add: true },
      tidalreach: { n: 260, behavior: "fall", color: "#eafaff", size: 0.28, add: false },
      verdant_spire: { n: 200, behavior: "float", color: "#d8f08a", size: 0.24, add: true },
      galecrest: { n: 200, behavior: "drift", color: "#eef6fc", size: 0.18, add: false },
      sunken_cathedral: { n: 180, behavior: "spark", color: "#a86af0", size: 0.2, add: true },
      lumen_core: { n: 220, behavior: "glint", color: "#ffe79a", size: 0.22, add: true },
    }[id] || { n: 200, behavior: "float", color: "#ffffff", size: 0.2, add: true };

    const n = cfg.n;
    const R = 24; // field half-extent (x/z)
    const H = 20; // field height
    const positions = new Float32Array(n * 3);
    const velocities = new Float32Array(n * 3);
    const phases = new Float32Array(n);

    for (let i = 0; i < n; i++) {
      const x = (rng() - 0.5) * 2 * R;
      const y = rng() * H;
      const z = (rng() - 0.5) * 2 * R;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      phases[i] = rng() * Math.PI * 2;

      switch (cfg.behavior) {
        case "rise":
          velocities[i * 3] = (rng() - 0.5) * 0.3;
          velocities[i * 3 + 1] = 0.8 + rng() * 1.2;
          velocities[i * 3 + 2] = (rng() - 0.5) * 0.3;
          break;
        case "fall":
          velocities[i * 3] = (rng() - 0.5) * 0.3;
          velocities[i * 3 + 1] = -(0.8 + rng() * 1.0);
          velocities[i * 3 + 2] = (rng() - 0.5) * 0.3;
          break;
        case "drift":
          velocities[i * 3] = 1.2 + rng() * 1.6;
          velocities[i * 3 + 1] = (rng() - 0.5) * 0.4;
          velocities[i * 3 + 2] = (rng() - 0.5) * 0.6;
          break;
        case "spark":
          velocities[i * 3] = (rng() - 0.5) * 0.2;
          velocities[i * 3 + 1] = 0.3 + rng() * 0.5;
          velocities[i * 3 + 2] = (rng() - 0.5) * 0.2;
          break;
        case "glint":
        case "float":
        default:
          velocities[i * 3] = (rng() - 0.5) * 0.4;
          velocities[i * 3 + 1] = (rng() - 0.5) * 0.3;
          velocities[i * 3 + 2] = (rng() - 0.5) * 0.4;
          break;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: new THREE.Color(cfg.color),
      size: cfg.size,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      fog: true,
      blending: cfg.add ? THREE.AdditiveBlending : THREE.NormalBlending,
    });

    const points = new THREE.Points(geo, mat);
    points.name = "particles";
    points.frustumCulled = false;

    return { points, positions, velocities, phases, behavior: cfg.behavior, n, R, H };
  }

  /* ---------------- Lights ---------------- */
  function buildLights(id) {
    // Key directional light — mood-tinted, casts shadows.
    const keyColor = cAccent.clone().lerp(new THREE.Color("#ffffff"), 0.4);
    const key = new THREE.DirectionalLight(keyColor.getHex(), 1.15);
    key.position.set(12, 20, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    const sc = key.shadow.camera;
    sc.near = 1;
    sc.far = 60;
    sc.left = -18;
    sc.right = 18;
    sc.top = 18;
    sc.bottom = -18;
    key.shadow.bias = -0.0006;

    // Colored fill directional from the opposite side — no shadow.
    const fill = new THREE.DirectionalLight(cSkyTop.clone().lerp(cAccent, 0.5).getHex(), 0.45);
    fill.position.set(-10, 8, -12);

    // Subtle ambient via HemisphereLight (sky over ground).
    const ambient = new THREE.HemisphereLight(cSkyBot.getHex(), cGround.getHex(), 0.55);
    ambient.position.set(0, 30, 0);

    // Per-region intensity tuning.
    const tune = {
      sunken_cathedral: { key: 0.7, fill: 0.35, amb: 0.4 },
      lumen_core: { key: 1.5, fill: 0.7, amb: 0.85 },
      tidalreach: { key: 1.1, fill: 0.55, amb: 0.7 },
      galecrest: { key: 1.25, fill: 0.5, amb: 0.75 },
      verdant_spire: { key: 1.0, fill: 0.45, amb: 0.55 },
      emberfall_vale: { key: 1.15, fill: 0.5, amb: 0.55 },
    }[id];
    if (tune) {
      key.intensity = tune.key;
      fill.intensity = tune.fill;
      ambient.intensity = tune.amb;
    }

    return [key, fill, ambient];
  }

  /* ================= update / dispose ================= */
  let time = 0;

  function update(dt) {
    if (!(dt > 0)) dt = 0.016;
    time += dt;

    // Particles.
    const { positions, velocities, phases, behavior, n, R, H } = particles;
    for (let i = 0; i < n; i++) {
      const ix = i * 3;
      positions[ix] += velocities[ix] * dt;
      positions[ix + 1] += velocities[ix + 1] * dt;
      positions[ix + 2] += velocities[ix + 2] * dt;

      // Gentle lateral sway for airborne motes.
      if (behavior === "float" || behavior === "glint" || behavior === "spark") {
        positions[ix] += Math.sin(time * 0.6 + phases[i]) * dt * 0.25;
        positions[ix + 2] += Math.cos(time * 0.5 + phases[i]) * dt * 0.25;
      }

      // Wrap within the field so the system never empties.
      if (positions[ix + 1] > H) positions[ix + 1] = 0;
      else if (positions[ix + 1] < 0) positions[ix + 1] = H;
      if (positions[ix] > R) positions[ix] = -R;
      else if (positions[ix] < -R) positions[ix] = R;
      if (positions[ix + 2] > R) positions[ix + 2] = -R;
      else if (positions[ix + 2] < -R) positions[ix + 2] = R;
    }
    particles.points.geometry.attributes.position.needsUpdate = true;

    // Spinners (windmills, halos).
    for (const s of spinners) s.obj.rotation.y += s.speed * dt;

    // Bobbers (lanterns, islands, canopies, orbs).
    for (const b of bobbers) {
      b.obj.position.y = b.baseY + Math.sin(time * b.speed + b.phase) * b.amp;
    }

    // Pulsers (emissive breathing).
    for (const p of pulsers) {
      p.mat.emissiveIntensity = p.base + Math.sin(time * p.speed + p.phase) * p.amp;
    }
  }

  function dispose() {
    const geos = new Set();
    const mats = new Set();
    group.traverse((o) => {
      if (o.geometry) geos.add(o.geometry);
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m) => mats.add(m));
        else mats.add(o.material);
      }
    });
    geos.forEach((g) => g.dispose && g.dispose());
    mats.forEach((m) => {
      if (m.map) m.map.dispose();
      m.dispose && m.dispose();
    });
  }

  return { group, background, fog, lights, update, dispose };
}

export default { REGION_THEMES, buildBiome };
