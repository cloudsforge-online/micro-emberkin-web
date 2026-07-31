// render/assets.js
// Runtime asset library: preloads baked .glb models (GLTFLoader) + their shared
// textures, caches the parsed scenes, and hands out per-instance clones (with
// cloned materials so per-creature emissive/opacity animation doesn't bleed
// between instances of the same species).
//
//   const lib = new AssetLibrary(THREE);
//   await lib.preloadCreatures(["cindercub", ...], "./assets/models/creatures/");
//   const scene = lib.getCreatureScene("cindercub");   // THREE.Group clone

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export class AssetLibrary {
  constructor(THREE_) {
    this.THREE = THREE_ || THREE;
    this.loader = new GLTFLoader();
    this._creatures = new Map(); // id -> THREE.Group (template scene)
    this._biomes = new Map(); // regionId -> THREE.Group
  }

  async preloadCreatures(ids, baseUrl) {
    const uniq = [...new Set(ids)];
    await Promise.all(
      uniq.map(async (id) => {
        try {
          const gltf = await this.loader.loadAsync(`${baseUrl}${id}.glb`);
          gltf.scene.traverse((o) => {
            if (o.isMesh) {
              o.castShadow = true;
              o.receiveShadow = true;
            }
          });
          this._creatures.set(id, gltf.scene);
        } catch (e) {
          console.warn(`asset load failed: ${id}`, e);
        }
      })
    );
    return this;
  }

  async preloadBiomes(regionIds, baseUrl) {
    const uniq = [...new Set(regionIds)];
    await Promise.all(
      uniq.map(async (id) => {
        try {
          const gltf = await this.loader.loadAsync(`${baseUrl}${id}.glb`);
          this._biomes.set(id, gltf.scene);
        } catch (e) {
          console.warn(`biome asset load failed: ${id}`, e);
        }
      })
    );
    return this;
  }

  hasCreature(id) {
    return this._creatures.has(id);
  }

  // A fresh clone with independent materials (safe to animate per-instance).
  getCreatureScene(id) {
    const tmpl = this._creatures.get(id);
    if (!tmpl) return null;
    return cloneWithMaterials(tmpl);
  }

  getBiomeScene(id) {
    const tmpl = this._biomes.get(id);
    if (!tmpl) return null;
    return cloneWithMaterials(tmpl);
  }
}

// Object3D.clone() shares geometry + material refs. We keep geometry shared
// (cheap) but clone materials so runtime tweaks are per-instance.
export function cloneWithMaterials(root) {
  const clone = root.clone(true);
  clone.traverse((o) => {
    if (o.isMesh && o.material) {
      if (Array.isArray(o.material)) o.material = o.material.map((m) => m.clone());
      else o.material = o.material.clone();
    }
  });
  return clone;
}
