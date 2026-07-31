// The 3D stage: renderer, over-the-shoulder camera, post-processing (bloom +
// ACES tone mapping), biome mounting, and creature-rig slots. Consumes
// environments.js. main.js drives it.

import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { buildBiome } from "./environments.js";

export const SLOTS = {
  player: new THREE.Vector3(1.6, 0, 3.0),
  enemy: new THREE.Vector3(-1.6, 0, -3.0),
};

export class Stage {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 400);

    // Image-based lighting so PBR metal/roughness surfaces get real reflections
    // and ambient bounce (baked models look flat/black-metal without this).
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this._envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this._envRT.texture;
    pmrem.dispose();

    this.biome = null;
    this.rigs = { player: null, enemy: null };
    this._shake = 0;
    this._camBase = new THREE.Vector3();
    this._camTarget = new THREE.Vector3();
    this._t = 0;

    this._composer = new EffectComposer(this.renderer);
    this._composer.addPass(new RenderPass(this.scene, this.camera));
    this._bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.75, 0.85);
    this._composer.addPass(this._bloom);
    this._composer.addPass(new OutputPass());

    this.frameCamera("player", "enemy");
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  setBiome(regionId) {
    if (this.biome) {
      this.scene.remove(this.biome.group);
      (this.biome.lights || []).forEach(l => { this.scene.remove(l); if (l.target) this.scene.remove(l.target); });
      this.biome.dispose?.();
    }
    const b = buildBiome(THREE, regionId);
    this.biome = b;
    this.scene.add(b.group);
    this.scene.background = b.background || new THREE.Color(0x0b0e14);
    this.scene.fog = b.fog || null;
    (b.lights || []).forEach(l => { this.scene.add(l); if (l.target) this.scene.add(l.target); });
  }

  slotPosition(slot) { return SLOTS[slot].clone(); }

  mountRig(rig, slot) {
    this.clearRig(slot);
    rig.group.position.copy(SLOTS[slot]);
    rig.faceToward?.(SLOTS[slot === "player" ? "enemy" : "player"]);
    this.scene.add(rig.group);
    this.rigs[slot] = rig;
  }

  clearRig(slot) {
    const r = this.rigs[slot];
    if (r) { this.scene.remove(r.group); r.dispose?.(); this.rigs[slot] = null; }
  }

  clearRigs() { this.clearRig("player"); this.clearRig("enemy"); }

  // Camera behind & above the player slot, framing the enemy slot.
  frameCamera(behindSlot, lookSlot) {
    const back = SLOTS[behindSlot].clone().sub(SLOTS[lookSlot]).normalize();
    this._camBase.copy(SLOTS[behindSlot]).addScaledVector(back, 3.4).add(new THREE.Vector3(0.6, 2.7, 0));
    this._camTarget.copy(SLOTS[lookSlot]).add(new THREE.Vector3(0, 1.2, 0));
    this.camera.position.copy(this._camBase);
    this.camera.lookAt(this._camTarget);
  }

  shake(intensity = 0.4) { this._shake = Math.min(1.2, this._shake + intensity); }

  update(dt) {
    this._t += dt;
    this.biome?.update?.(dt);
    this.rigs.player?.update(dt);
    this.rigs.enemy?.update(dt);

    // Gentle idle sway + decaying shake.
    const sway = new THREE.Vector3(Math.sin(this._t * 0.4) * 0.05, Math.cos(this._t * 0.33) * 0.04, 0);
    const shakeOff = this._shake > 0.001
      ? new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5) * 0.4).multiplyScalar(this._shake * 0.35)
      : new THREE.Vector3();
    this.camera.position.copy(this._camBase).add(sway).add(shakeOff);
    this.camera.lookAt(this._camTarget);
    this._shake *= Math.pow(0.0025, dt); // fast decay
  }

  render() { this._composer.render(); }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this._composer.setSize(w, h);
    this._bloom.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
