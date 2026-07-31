// render/creatures.js
// Creature rig backed by a baked .glb model (see tools/bake-creatures.mjs).
// The model's node tree carries animation roles in userData (root/pivot/torso/
// head/tail/wing/spinner); this class binds those nodes and drives the same
// idle + attack/cast/hit/faint/victory state machine the procedural rig used.
//
// API (unchanged, see CONTRACT.md) — but construction now needs the preloaded
// scene from AssetLibrary:
//   new CreatureRig(THREE, species, visual, gltfScene)
//   createCreature(THREE, species, visual, gltfScene)

import * as THREE from "three";

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export class CreatureRig {
  constructor(THREE_, species, visual, scene) {
    const T = (this.THREE = THREE_ || THREE);
    this.species = species || {};
    this.visual = visual || {};

    if (!scene) throw new Error("CreatureRig requires a preloaded glTF scene");
    this.group = scene;

    // ---- bind nodes by role ----
    this._pivot = null;
    this._torso = null;
    this._head = null;
    this._tail = null;
    this._wings = []; // {pivot, sign, base}
    this._spinners = []; // {node, speed}
    this._mats = [];
    this._floatBase = 0;
    this._bobBig = false;
    this._baseScale = typeof this.visual.scale === "number" ? this.visual.scale : 1;
    this._headBase = 0;

    const matSet = new Set();
    scene.traverse((o) => {
      const role = o.userData && o.userData.role;
      if (role === "root") {
        if (o.userData.floatBase != null) this._floatBase = o.userData.floatBase;
        if (o.userData.bobBig != null) this._bobBig = o.userData.bobBig;
        if (o.userData.baseScale != null) this._baseScale = o.userData.baseScale;
      } else if (role === "pivot") this._pivot = o;
      else if (role === "torso") this._torso = o;
      else if (role === "head") this._head = o;
      else if (role === "tail") this._tail = o;
      else if (role === "wing")
        this._wings.push({ pivot: o, sign: o.userData.sign, base: o.userData.base });
      else if (role === "spinner")
        this._spinners.push({ node: o, speed: o.userData.speed || 0.6 });

      if (o.isMesh && o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => matSet.add(m));
      }
    });

    // Fallbacks so a malformed model still animates without crashing.
    if (!this._pivot) this._pivot = scene;
    if (!this._torso) this._torso = this._pivot;

    matSet.forEach((m) => {
      m._baseEmI = m.emissiveIntensity != null ? m.emissiveIntensity : 1;
      if (m.transparent) m._baseOp = m.opacity;
      this._mats.push(m);
    });

    // record resting local transforms we animate off of
    this._pivotBasePos = this._pivot.position.clone();
    this._headBase = this._head ? this._head.rotation.x : 0;

    // ---- state machine ----
    this._state = "idle";
    this._clock = ((this.species.dexNumber || 1) % 13) * 0.41;
    this._stateT = 0;
    this._emiBoost = 0;
    this._opacity = 1;
    this._onImpact = null;
    this._onRelease = null;
    this._impactFired = false;
    this._releaseFired = false;
    this._attackDur = 0.42;
    this._impactAt = 0.18;

    this.update(0);
  }

  get group() {
    return this._group;
  }
  set group(g) {
    this._group = g;
  }

  // ---------------------------- animation ---------------------------------
  _animParts(t, dt) {
    const damp = this._state === "faint" ? 0 : 1;
    let flapAmp = 0.55 * damp;
    if (this._state === "victory") flapAmp *= 1.7;
    else if (this._state === "attack") flapAmp *= 1.3;
    const flapSpeed = this._bobBig ? 6.5 : 3.2;
    for (let i = 0; i < this._wings.length; i++) {
      const w = this._wings[i];
      w.pivot.rotation.z = w.base + w.sign * Math.sin(t * flapSpeed) * flapAmp;
    }
    if (this._tail) this._tail.rotation.y = Math.sin(t * 2.4) * 0.35 * damp;
    if (this._head) this._head.rotation.x = this._headBase + Math.sin(t * 2.0) * 0.06 * damp;
    for (let i = 0; i < this._spinners.length; i++) {
      const sp = this._spinners[i];
      sp.node.rotation.y += dt * sp.speed * (0.4 + 0.6 * damp);
    }
  }

  update(dt) {
    if (!isFinite(dt)) dt = 0;
    dt = clamp(dt, 0, 0.05);
    this._clock += dt;
    const t = this._clock;
    const bs = this._baseScale;

    let px = 0, py = 0, pz = 0, rx = 0, rz = 0;
    let extraScale = 1;
    let breath = 1;
    this._emiBoost = 0;
    this._opacity = 1;

    const fainting = this._state === "faint";

    if (!fainting) {
      const amp = (this._bobBig ? 0.12 : 0.035) * bs;
      const spd = this._bobBig ? 1.8 : 2.2;
      py += this._floatBase * bs + Math.sin(t * spd) * amp;
      breath = 1 + Math.sin(t * spd * 1.1) * 0.028;
    }

    if (this._state === "attack") {
      this._stateT += dt;
      const d = this._attackDur;
      const imp = this._impactAt;
      let f;
      if (this._stateT < imp) f = this._stateT / imp;
      else f = Math.max(0, 1 - (this._stateT - imp) / (d - imp));
      f = f * f * (3 - 2 * f);
      pz += f * 0.95 * bs;
      py += Math.sin(f * Math.PI) * 0.12 * bs;
      rx += -f * 0.18;
      if (!this._impactFired && this._stateT >= imp) {
        this._impactFired = true;
        if (this._onImpact) { try { this._onImpact(); } catch (e) {} }
      }
      if (this._stateT >= d) this._toIdle();
    } else if (this._state === "cast") {
      this._stateT += dt;
      const d = 0.6, peak = 0.42;
      const p = clamp(this._stateT / d, 0, 1);
      const pulse = Math.sin(p * Math.PI);
      extraScale = 1 + pulse * 0.13;
      py += pulse * 0.1 * bs;
      this._emiBoost = pulse * 1.3;
      if (!this._releaseFired && this._stateT >= peak) {
        this._releaseFired = true;
        if (this._onRelease) { try { this._onRelease(); } catch (e) {} }
      }
      if (this._stateT >= d) this._toIdle();
    } else if (this._state === "hit") {
      this._stateT += dt;
      const d = 0.32;
      const p = this._stateT / d;
      const k = Math.exp(-p * 5) * Math.sin(p * 38);
      px += k * 0.06 * bs;
      rz += k * 0.12;
      pz += -Math.exp(-p * 8) * 0.12 * bs;
      this._emiBoost = Math.max(0, 1 - p * 3) * 1.6;
      if (this._stateT >= d) this._toIdle();
    } else if (this._state === "victory") {
      this._stateT += dt;
      const d = 1.25;
      const p = clamp(this._stateT / d, 0, 1);
      const hop = Math.abs(Math.sin(p * Math.PI * 3));
      py += hop * 0.22 * bs;
      rx += Math.sin(p * Math.PI * 6) * 0.08;
      extraScale = 1 + hop * 0.04;
      if (this._stateT >= d) this._toIdle();
    } else if (fainting) {
      this._stateT += dt;
      const d = 0.9;
      const p = clamp(this._stateT / d, 0, 1);
      const e = 1 - (1 - p) * (1 - p);
      rz += e * Math.PI * 0.55;
      rx += e * 0.15;
      py += -e * 0.45 * bs;
      this._opacity = 1 - e * 0.8;
    }

    // whole-body transform on pivot (relative to its resting local position)
    this._pivot.position.set(
      this._pivotBasePos.x + px,
      this._pivotBasePos.y + py,
      this._pivotBasePos.z + pz
    );
    this._pivot.rotation.set(rx, 0, rz);
    this._pivot.scale.setScalar(bs * extraScale);

    // breathing on torso only
    if (this._torso && this._torso !== this._pivot) {
      this._torso.scale.set(1 + (breath - 1) * 0.4, breath, 1 + (breath - 1) * 0.4);
    }

    this._animParts(t, dt);

    const boost = this._emiBoost;
    const op = this._opacity;
    for (let i = 0; i < this._mats.length; i++) {
      const m = this._mats[i];
      m.emissiveIntensity = m._baseEmI + boost;
      if (m._baseOp != null) m.opacity = m._baseOp * op;
      else if (op < 1) {
        m.transparent = true;
        m.opacity = op;
      }
    }
  }

  _toIdle() {
    this._state = "idle";
    this._stateT = 0;
    this._onImpact = null;
    this._onRelease = null;
    this._impactFired = false;
    this._releaseFired = false;
  }

  faceToward(worldPos) {
    if (!worldPos) return;
    const p = this._group.position;
    const dx = worldPos.x - p.x;
    const dz = worldPos.z - p.z;
    if (dx * dx + dz * dz < 1e-8) return;
    this._group.rotation.y = Math.atan2(dx, dz);
  }

  playAttack(worldTargetPos, onImpact) {
    if (worldTargetPos) this.faceToward(worldTargetPos);
    this._state = "attack";
    this._stateT = 0;
    this._onImpact = onImpact || null;
    this._impactFired = false;
    return this._attackDur;
  }
  playCast(onRelease) {
    this._state = "cast";
    this._stateT = 0;
    this._onRelease = onRelease || null;
    this._releaseFired = false;
    return 0.6;
  }
  playHit() {
    if (this._state === "faint") return 0;
    this._state = "hit";
    this._stateT = 0;
    return 0.32;
  }
  playFaint() {
    this._state = "faint";
    this._stateT = 0;
    return 0.9;
  }
  playVictory() {
    if (this._state === "faint") return 0;
    this._state = "victory";
    this._stateT = 0;
    return 1.25;
  }

  dispose() {
    const geos = new Set();
    const mats = new Set();
    this._group.traverse(function (obj) {
      if (obj.isMesh) {
        if (obj.geometry) geos.add(obj.geometry);
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => mats.add(m));
          else mats.add(obj.material);
        }
      }
    });
    // NOTE: geometry is shared with the AssetLibrary template — only dispose
    // per-instance materials here; geometry lives as long as the library does.
    mats.forEach((m) => m.dispose && m.dispose());
    if (this._group.parent) this._group.parent.remove(this._group);
    this._wings.length = 0;
    this._spinners.length = 0;
    this._mats.length = 0;
  }
}

export function createCreature(THREE_, species, visual, scene) {
  return new CreatureRig(THREE_, species, visual, scene);
}
