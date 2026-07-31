// render/effects.js
// Procedural, texture-free battle VFX for the monster-collecting game.
// Everything is built from Three.js primitives + Points particle systems.
// Soft round particles come from a single radial-gradient CanvasTexture that
// is created once and reused by every effect. All glow/particle materials use
// additive blending with depthWrite off so they read as emitted light.

import * as THREE from "three";

// ---------------------------------------------------------------------------
// Element palette
// ---------------------------------------------------------------------------
export const ELEMENT_COLORS = {
  ember: "#ff6b4a",
  tide: "#4aa8ff",
  verdant: "#5fce7a",
  gale: "#9fd0ff",
  stone: "#c9a06b",
  spark: "#ffd23f",
  frost: "#8ee7ff",
  umbra: "#9a7bd6",
  lumen: "#ffe59e",
};

// Status -> tint used by statusAura(). Falls back to element-ish colors.
const STATUS_COLORS = {
  Burn: "#ff7a3a",
  Chill: "#8ee7ff",
  Shock: "#ffd23f",
  Root: "#5fce7a",
  Dazed: "#9a7bd6",
};

const TWO_PI = Math.PI * 2;

// ---------------------------------------------------------------------------
// Vfx
// ---------------------------------------------------------------------------
export class Vfx {
  constructor(THREERef, scene) {
    // Prefer the injected THREE (matches CONTRACT signature) but fall back to
    // the imported module so the class works either way.
    this.THREE = THREERef || THREE;
    this.scene = scene;

    // Transient, one-shot effects (casts, impacts, launch glows).
    this.effects = [];
    // Persistent status auras attached to creature rigs.
    this.auras = [];

    this._softTexture = this._makeSoftTexture();
    this._ringTexture = this._makeRingTexture();
  }

  // -------------------------------------------------------------------------
  // Shared textures (built once, reused everywhere)
  // -------------------------------------------------------------------------
  _makeSoftTexture() {
    const T = this.THREE;
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    const g = ctx.createRadialGradient(
      size / 2, size / 2, 0,
      size / 2, size / 2, size / 2
    );
    g.addColorStop(0.0, "rgba(255,255,255,1)");
    g.addColorStop(0.35, "rgba(255,255,255,0.55)");
    g.addColorStop(1.0, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new T.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  _makeRingTexture() {
    const T = this.THREE;
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    const g = ctx.createRadialGradient(
      size / 2, size / 2, 0,
      size / 2, size / 2, size / 2
    );
    // A hollow soft ring: transparent center, bright rim, soft outer falloff.
    g.addColorStop(0.0, "rgba(255,255,255,0)");
    g.addColorStop(0.55, "rgba(255,255,255,0)");
    g.addColorStop(0.78, "rgba(255,255,255,1)");
    g.addColorStop(1.0, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new T.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  // -------------------------------------------------------------------------
  // Material helpers
  // -------------------------------------------------------------------------
  _pointsMaterial(size) {
    const T = this.THREE;
    return new T.PointsMaterial({
      size: size,
      map: this._softTexture,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: T.AdditiveBlending,
      sizeAttenuation: true,
    });
  }

  _glowMaterial(color, opacity) {
    const T = this.THREE;
    return new T.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: opacity == null ? 1 : opacity,
      depthWrite: false,
      blending: T.AdditiveBlending,
    });
  }

  _spriteMaterial(color, texture) {
    const T = this.THREE;
    return new T.SpriteMaterial({
      map: texture,
      color: color,
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
    });
  }

  _add(effect) {
    this.effects.push(effect);
    return effect;
  }

  // -------------------------------------------------------------------------
  // cast(): a travelling effect from -> to, tinted by element.
  //   physical => fast melee slash streak arc
  //   special  => projectile orb with particle trail
  //   status   => soft aura pulse that travels
  // isArt => bigger/brighter, extra particles + a launch glow sphere.
  // onImpact() fires (once) when the effect reaches `to`.
  // Returns duration in seconds.
  // -------------------------------------------------------------------------
  cast(opts, onImpact) {
    const T = this.THREE;
    const element = opts.element;
    const from = opts.from.clone();
    const to = opts.to.clone();
    const isArt = !!opts.isArt;
    const category = opts.category || "physical";
    const color = new T.Color(ELEMENT_COLORS[element] || "#ffffff");

    const duration = isArt ? 0.7 : 0.35;

    if (category === "physical") {
      this._castPhysical(from, to, color, isArt, duration, onImpact);
    } else if (category === "status") {
      this._castStatus(from, to, color, isArt, duration, onImpact);
    } else {
      // "special" and any unknown category -> projectile orb
      this._castSpecial(from, to, color, isArt, duration, onImpact);
    }

    if (isArt) this._launchGlow(from, color);

    return duration;
  }

  // Fast melee slash: a stretched glowing streak + a curved slash arc that
  // sweeps as it crosses the gap, trailing a few sparks.
  _castPhysical(from, to, color, isArt, duration, onImpact) {
    const T = this.THREE;
    const group = new T.Group();
    this.scene.add(group);

    const dir = new T.Vector3().subVectors(to, from);
    const len = dir.length();
    dir.normalize();

    // Streak: a thin elongated glow oriented along the travel direction.
    const streakLen = (isArt ? 1.4 : 0.9);
    const streakGeo = new T.PlaneGeometry(streakLen, isArt ? 0.28 : 0.16);
    const streakMat = this._glowMaterial(color, 0.9);
    streakMat.side = T.DoubleSide;
    const streak = new T.Mesh(streakGeo, streakMat);
    group.add(streak);

    // Slash arc: a partial torus that reads as a sword swipe.
    const arcGeo = new T.TorusGeometry(
      isArt ? 0.55 : 0.38, isArt ? 0.06 : 0.04, 8, 24, Math.PI * 0.75
    );
    const arcMat = this._glowMaterial(color, 0.85);
    const arc = new T.Mesh(arcGeo, arcMat);
    group.add(arc);

    // Trail sparks pool.
    const trail = this._makeTrail(isArt ? 26 : 16, color, isArt ? 0.22 : 0.14);
    this.scene.add(trail.points);

    const quat = new T.Quaternion().setFromUnitVectors(
      new T.Vector3(1, 0, 0), dir
    );
    streak.quaternion.copy(quat);
    arc.quaternion.copy(quat);

    let elapsed = 0;
    let fired = false;
    const self = this;
    const pos = new T.Vector3();

    this._add({
      update(dt) {
        elapsed += dt;
        const t = Math.min(elapsed / duration, 1);
        pos.copy(from).addScaledVector(new T.Vector3().subVectors(to, from), t);
        group.position.copy(pos);
        // Spin the slash arc for a swipe feel.
        arc.rotation.z += dt * 18;
        const fade = 1 - Math.abs(t - 0.5) * 1.4;
        streakMat.opacity = Math.max(0, fade) * 0.9;
        arcMat.opacity = Math.max(0, fade) * 0.85;

        trail.emit(pos, dt);
        trail.update(dt);

        if (!fired && t >= 1) {
          fired = true;
          if (onImpact) onImpact();
        }
        // Keep the trail alive briefly after arrival, then finish.
        return t < 1 || trail.alive();
      },
      dispose() {
        self.scene.remove(group);
        self.scene.remove(trail.points);
        streakGeo.dispose();
        streakMat.dispose();
        arcGeo.dispose();
        arcMat.dispose();
        trail.dispose();
      },
    });
    // silence unused ref warning path
    void len;
  }

  // Projectile orb with a glowing core, a soft halo and a fading particle trail.
  _castSpecial(from, to, color, isArt, duration, onImpact) {
    const T = this.THREE;
    const group = new T.Group();
    this.scene.add(group);

    const coreR = isArt ? 0.28 : 0.18;
    const coreGeo = new T.SphereGeometry(coreR, 16, 12);
    const coreMat = this._glowMaterial(color, 0.95);
    const core = new T.Mesh(coreGeo, coreMat);
    group.add(core);

    // Halo sprite for a soft outer glow.
    const halo = new T.Sprite(this._spriteMaterial(color, this._softTexture));
    halo.scale.setScalar(isArt ? 1.4 : 0.9);
    group.add(halo);

    // Orbiting sparkle particles around the orb.
    const orbitCount = isArt ? 22 : 12;
    const orbit = this._makeStaticPoints(orbitCount, color, isArt ? 0.14 : 0.09);
    group.add(orbit.points);
    const orbitPhase = new Float32Array(orbitCount);
    for (let i = 0; i < orbitCount; i++) orbitPhase[i] = Math.random() * TWO_PI;

    const trail = this._makeTrail(isArt ? 60 : 36, color, isArt ? 0.2 : 0.13);
    this.scene.add(trail.points);

    let elapsed = 0;
    let fired = false;
    const self = this;
    const pos = new T.Vector3();
    const delta = new T.Vector3().subVectors(to, from);

    this._add({
      update(dt) {
        elapsed += dt;
        const t = Math.min(elapsed / duration, 1);
        pos.copy(from).addScaledVector(delta, t);
        group.position.copy(pos);

        // Animate orbiting particles.
        const attr = orbit.points.geometry.getAttribute("position");
        const r = coreR * 1.8;
        for (let i = 0; i < orbitCount; i++) {
          orbitPhase[i] += dt * (2 + (i % 5));
          const a = orbitPhase[i];
          attr.setXYZ(
            i,
            Math.cos(a) * r,
            Math.sin(a * 1.3) * r * 0.6,
            Math.sin(a) * r
          );
        }
        attr.needsUpdate = true;

        trail.emit(pos, dt);
        trail.update(dt);

        if (!fired && t >= 1) {
          fired = true;
          coreMat.opacity = 0;
          halo.material.opacity = 0;
          orbit.points.visible = false;
          if (onImpact) onImpact();
        }
        return t < 1 || trail.alive();
      },
      dispose() {
        self.scene.remove(group);
        self.scene.remove(trail.points);
        coreGeo.dispose();
        coreMat.dispose();
        halo.material.dispose();
        orbit.dispose();
        trail.dispose();
      },
    });
  }

  // Soft aura pulse that drifts across to the target: a pulsing translucent
  // sphere wrapped in gentle motes.
  _castStatus(from, to, color, isArt, duration, onImpact) {
    const T = this.THREE;
    const group = new T.Group();
    this.scene.add(group);

    const baseR = isArt ? 0.6 : 0.4;
    const auraGeo = new T.SphereGeometry(baseR, 18, 14);
    const auraMat = this._glowMaterial(color, 0.35);
    const aura = new T.Mesh(auraGeo, auraMat);
    group.add(aura);

    const moteCount = isArt ? 28 : 16;
    const motes = this._makeStaticPoints(moteCount, color, isArt ? 0.16 : 0.11);
    group.add(motes.points);
    const moteBase = new Float32Array(moteCount * 3);
    const attr0 = motes.points.geometry.getAttribute("position");
    for (let i = 0; i < moteCount; i++) {
      const a = Math.random() * TWO_PI;
      const b = Math.acos(2 * Math.random() - 1);
      const rr = baseR * (0.8 + Math.random() * 0.5);
      const x = Math.sin(b) * Math.cos(a) * rr;
      const y = Math.cos(b) * rr;
      const z = Math.sin(b) * Math.sin(a) * rr;
      moteBase[i * 3] = x;
      moteBase[i * 3 + 1] = y;
      moteBase[i * 3 + 2] = z;
      attr0.setXYZ(i, x, y, z);
    }
    attr0.needsUpdate = true;

    let elapsed = 0;
    let fired = false;
    const self = this;
    const pos = new T.Vector3();
    const delta = new T.Vector3().subVectors(to, from);

    this._add({
      update(dt) {
        elapsed += dt;
        const t = Math.min(elapsed / duration, 1);
        pos.copy(from).addScaledVector(delta, t);
        group.position.copy(pos);

        const pulse = 1 + Math.sin(elapsed * 12) * 0.15;
        aura.scale.setScalar(pulse);
        auraMat.opacity = 0.35 * (1 - Math.abs(t - 0.5) * 0.6);

        // Slowly rotate the motes.
        motes.points.rotation.y += dt * 1.5;
        motes.points.rotation.x += dt * 0.7;

        if (!fired && t >= 1) {
          fired = true;
          if (onImpact) onImpact();
        }
        return t < 1;
      },
      dispose() {
        self.scene.remove(group);
        auraGeo.dispose();
        auraMat.dispose();
        motes.dispose();
      },
    });
  }

  // Brief expanding glow sphere at the launch point (for Arts).
  _launchGlow(at, color) {
    const T = this.THREE;
    const geo = new T.SphereGeometry(0.3, 16, 12);
    const mat = this._glowMaterial(color, 0.9);
    const mesh = new T.Mesh(geo, mat);
    mesh.position.copy(at);
    this.scene.add(mesh);

    const dur = 0.35;
    let elapsed = 0;
    const self = this;
    this._add({
      update(dt) {
        elapsed += dt;
        const t = Math.min(elapsed / dur, 1);
        mesh.scale.setScalar(1 + t * 3);
        mat.opacity = 0.9 * (1 - t);
        return t < 1;
      },
      dispose() {
        self.scene.remove(mesh);
        geo.dispose();
        mat.dispose();
      },
    });
  }

  // -------------------------------------------------------------------------
  // impact(): expanding ring + a spray of fading Points particles.
  //   crit => larger burst + a white flash sphere that scales up and fades.
  // -------------------------------------------------------------------------
  impact(opts) {
    const T = this.THREE;
    const element = opts.element;
    const at = opts.at.clone();
    const crit = !!opts.crit;
    const color = new T.Color(ELEMENT_COLORS[element] || "#ffffff");

    // Expanding ring (billboard sprite so it reads from any camera angle).
    const ring = new T.Sprite(this._spriteMaterial(color, this._ringTexture));
    ring.position.copy(at);
    ring.scale.setScalar(0.3);
    this.scene.add(ring);

    // Particle spray.
    const count = crit
      ? 30 + Math.floor(Math.random() * 12)
      : 20 + Math.floor(Math.random() * 12);
    const geo = new T.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const vel = [];
    const life = new Float32Array(count);
    const maxLife = new Float32Array(count);
    const base = crit ? 5.5 : 4.0;
    for (let i = 0; i < count; i++) {
      positions[i * 3] = at.x;
      positions[i * 3 + 1] = at.y;
      positions[i * 3 + 2] = at.z;
      const dir = new T.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1
      ).normalize();
      const speed = base * (0.4 + Math.random() * 0.9);
      vel.push(dir.multiplyScalar(speed));
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
      maxLife[i] = 0.4 + Math.random() * 0.35;
      life[i] = maxLife[i];
    }
    geo.setAttribute("position", new T.BufferAttribute(positions, 3));
    geo.setAttribute("color", new T.BufferAttribute(colors, 3));
    const mat = this._pointsMaterial(crit ? 0.28 : 0.2);
    const points = new T.Points(geo, mat);
    this.scene.add(points);

    // Optional crit white flash sphere.
    let flash = null;
    let flashGeo = null;
    let flashMat = null;
    if (crit) {
      flashGeo = new T.SphereGeometry(0.4, 18, 14);
      flashMat = this._glowMaterial(new T.Color(0xffffff), 1);
      flash = new T.Mesh(flashGeo, flashMat);
      flash.position.copy(at);
      this.scene.add(flash);
    }

    const ringDur = crit ? 0.5 : 0.38;
    const ringMax = crit ? 5.0 : 3.0;
    let elapsed = 0;
    const self = this;
    const posAttr = geo.getAttribute("position");
    const colAttr = geo.getAttribute("color");

    this._add({
      update(dt) {
        elapsed += dt;

        // Ring expand + fade.
        const rt = Math.min(elapsed / ringDur, 1);
        ring.scale.setScalar(0.3 + rt * ringMax);
        ring.material.opacity = 1 - rt;

        // Crit flash.
        if (flash) {
          const ft = Math.min(elapsed / 0.25, 1);
          flash.scale.setScalar(1 + ft * 4);
          flashMat.opacity = 1 - ft;
        }

        // Particles.
        let anyAlive = false;
        for (let i = 0; i < count; i++) {
          if (life[i] <= 0) continue;
          life[i] -= dt;
          const v = vel[i];
          v.y -= 4.5 * dt; // gentle gravity
          posAttr.array[i * 3] += v.x * dt;
          posAttr.array[i * 3 + 1] += v.y * dt;
          posAttr.array[i * 3 + 2] += v.z * dt;
          const f = Math.max(0, life[i] / maxLife[i]);
          // Fade via color (additive: color*0 => invisible).
          colAttr.array[i * 3] = color.r * f;
          colAttr.array[i * 3 + 1] = color.g * f;
          colAttr.array[i * 3 + 2] = color.b * f;
          if (life[i] > 0) anyAlive = true;
        }
        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;

        return anyAlive || rt < 1;
      },
      dispose() {
        self.scene.remove(ring);
        self.scene.remove(points);
        ring.material.dispose();
        geo.dispose();
        mat.dispose();
        if (flash) {
          self.scene.remove(flash);
          flashGeo.dispose();
          flashMat.dispose();
        }
      },
    });
  }

  // -------------------------------------------------------------------------
  // statusAura(): ongoing subtle effect attached to a rig's group.
  // Returns a handle (with stop()). update() animates it every frame.
  // -------------------------------------------------------------------------
  statusAura(rig, status) {
    const T = this.THREE;
    const parent = rig && rig.group ? rig.group : null;
    const color = new T.Color(STATUS_COLORS[status] || "#ffffff");

    const group = new T.Group();
    if (parent) parent.add(group);
    else this.scene.add(group);
    group.position.y = 1.0; // roughly torso height

    // Behaviour presets per status.
    const presets = {
      Burn: { count: 20, size: 0.14, spin: 0.4, rise: 1.2, radius: 0.7, spread: 0.9 },
      Chill: { count: 16, size: 0.16, spin: 0.2, rise: -0.1, radius: 0.8, spread: 0.7 },
      Shock: { count: 22, size: 0.1, spin: 3.0, rise: 0.2, radius: 0.75, spread: 1.1 },
      Root: { count: 18, size: 0.12, spin: 0.6, rise: -0.3, radius: 0.6, spread: 0.6 },
      Dazed: { count: 8, size: 0.18, spin: 2.2, rise: 0.0, radius: 0.9, spread: 0.2 },
    };
    const p = presets[status] || presets.Burn;

    const cloud = this._makeStaticPoints(p.count, color, p.size);
    group.add(cloud.points);

    const count = p.count;
    const seed = new Float32Array(count * 3); // base pos
    const phase = new Float32Array(count);
    const attr = cloud.points.geometry.getAttribute("position");
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TWO_PI;
      // Dazed => tight orbit ring of "stars"; others => diffuse cloud.
      const rr =
        status === "Dazed"
          ? p.radius
          : p.radius * (0.4 + Math.random() * 0.9);
      const x = Math.cos(a) * rr;
      const z = Math.sin(a) * rr;
      const y = (Math.random() - 0.5) * p.spread;
      seed[i * 3] = x;
      seed[i * 3 + 1] = y;
      seed[i * 3 + 2] = z;
      phase[i] = Math.random() * TWO_PI;
      attr.setXYZ(i, x, y, z);
    }
    attr.needsUpdate = true;

    let t = 0;
    let stopped = false;
    const self = this;

    const handle = {
      status,
      group,
      stop() {
        if (stopped) return;
        stopped = true;
        if (group.parent) group.parent.remove(group);
        cloud.dispose();
        const idx = self.auras.indexOf(this);
        if (idx >= 0) self.auras.splice(idx, 1);
      },
      remove() {
        this.stop();
      },
      _update(dt) {
        if (stopped) return false;
        t += dt;
        const posA = cloud.points.geometry.getAttribute("position");
        for (let i = 0; i < count; i++) {
          const ph = phase[i] + t;
          if (status === "Dazed") {
            // Orbiting stars circling the head.
            const a = (i / count) * TWO_PI + t * p.spin;
            posA.setXYZ(
              i,
              Math.cos(a) * p.radius,
              Math.sin(t * 3 + i) * 0.15 + 0.4,
              Math.sin(a) * p.radius
            );
          } else {
            const bx = seed[i * 3];
            let by = seed[i * 3 + 1];
            const bz = seed[i * 3 + 2];
            // Rising/sinking loop for embers/motes, jitter for sparks.
            const cycle = ((by + p.rise * t) % 1.4 + 1.4) % 1.4 - 0.7;
            const jitter = status === "Shock" ? Math.sin(ph * 9) * 0.08 : 0;
            posA.setXYZ(
              i,
              bx + Math.sin(ph) * 0.08 + jitter,
              cycle,
              bz + Math.cos(ph) * 0.08
            );
          }
        }
        posA.needsUpdate = true;
        cloud.points.rotation.y += dt * p.spin * 0.3;
        // Gentle brightness pulse.
        cloud.points.material.opacity = 0.7 + Math.sin(t * 4) * 0.2;
        return true;
      },
    };

    this.auras.push(handle);
    return handle;
  }

  // -------------------------------------------------------------------------
  // Particle helpers
  // -------------------------------------------------------------------------

  // A fixed pool of trail particles. emit() drops a fresh particle at `pos`;
  // update() fades all particles by dimming their (additive) color.
  _makeTrail(count, color, size) {
    const T = this.THREE;
    const geo = new T.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const life = new Float32Array(count);
    geo.setAttribute("position", new T.BufferAttribute(positions, 3));
    geo.setAttribute("color", new T.BufferAttribute(colors, 3));
    const mat = this._pointsMaterial(size);
    const points = new T.Points(geo, mat);
    points.frustumCulled = false;

    let head = 0;
    let accum = 0;
    const maxLife = 0.35;
    const posAttr = geo.getAttribute("position");
    const colAttr = geo.getAttribute("color");

    return {
      points,
      emit(pos, dt) {
        // Emit at a steady rate independent of frame time.
        accum += dt;
        const step = 0.012;
        while (accum >= step) {
          accum -= step;
          const i = head % count;
          posAttr.array[i * 3] = pos.x + (Math.random() - 0.5) * 0.06;
          posAttr.array[i * 3 + 1] = pos.y + (Math.random() - 0.5) * 0.06;
          posAttr.array[i * 3 + 2] = pos.z + (Math.random() - 0.5) * 0.06;
          life[i] = maxLife;
          head++;
        }
      },
      update(dt) {
        for (let i = 0; i < count; i++) {
          if (life[i] <= 0) {
            colAttr.array[i * 3] = 0;
            colAttr.array[i * 3 + 1] = 0;
            colAttr.array[i * 3 + 2] = 0;
            continue;
          }
          life[i] -= dt;
          const f = Math.max(0, life[i] / maxLife);
          colAttr.array[i * 3] = color.r * f;
          colAttr.array[i * 3 + 1] = color.g * f;
          colAttr.array[i * 3 + 2] = color.b * f;
        }
        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
      },
      alive() {
        for (let i = 0; i < count; i++) if (life[i] > 0) return true;
        return false;
      },
      dispose() {
        geo.dispose();
        mat.dispose();
      },
    };
  }

  // A simple constant-color Points cloud (positions animated by caller).
  _makeStaticPoints(count, color, size) {
    const T = this.THREE;
    const geo = new T.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    geo.setAttribute("position", new T.BufferAttribute(positions, 3));
    geo.setAttribute("color", new T.BufferAttribute(colors, 3));
    const mat = this._pointsMaterial(size);
    mat.opacity = 0.85;
    const points = new T.Points(geo, mat);
    points.frustumCulled = false;
    return {
      points,
      dispose() {
        geo.dispose();
        mat.dispose();
      },
    };
  }

  // -------------------------------------------------------------------------
  // update(): advance everything; dispose finished one-shot effects.
  // -------------------------------------------------------------------------
  update(dt) {
    // Transient effects.
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const fx = this.effects[i];
      let alive = true;
      try {
        alive = fx.update(dt);
      } catch (e) {
        alive = false;
      }
      if (!alive) {
        fx.dispose();
        this.effects.splice(i, 1);
      }
    }
    // Persistent status auras (removed only via handle.stop()).
    for (let i = this.auras.length - 1; i >= 0; i--) {
      const aura = this.auras[i];
      const keep = aura._update(dt);
      if (!keep && this.auras[i] === aura) {
        this.auras.splice(i, 1);
      }
    }
  }

  // Free shared resources.
  dispose() {
    for (const fx of this.effects) fx.dispose();
    this.effects.length = 0;
    for (const aura of this.auras.slice()) aura.stop();
    this.auras.length = 0;
    if (this._softTexture) this._softTexture.dispose();
    if (this._ringTexture) this._ringTexture.dispose();
  }
}
