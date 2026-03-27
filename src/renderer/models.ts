// src/renderer/models.ts
// Three.js glTF/GLB model loader.
// Tries to load the real asset; falls back to a procedural placeholder if not found.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export interface GltfModel {
  url: string;
  root: THREE.Group | null;          // null = not yet loaded or load failed
  clips: THREE.AnimationClip[];
  loaded: boolean;   // true once the load attempt has settled (success or failure)
  failed: boolean;   // true if the fetch returned an error
}

const modelCache   = new Map<string, GltfModel>();
/** Cache of in-flight (or settled) Promises so every caller for the same URL
 *  always receives the same Promise and resolves only after the load settles. */
const promiseCache = new Map<string, Promise<GltfModel>>();
const loader = new GLTFLoader();

export function loadGLTF(url: string): Promise<GltfModel> {
  const inflight = promiseCache.get(url);
  if (inflight) return inflight;

  const model: GltfModel = { url, root: null, clips: [], loaded: false, failed: false };
  modelCache.set(url, model);

  const promise = new Promise<GltfModel>((resolve) => {
    loader.load(
      url,
      (gltf) => {
        model.root   = gltf.scene;
        model.clips  = gltf.animations ?? [];
        model.loaded = true;
        resolve(model);
      },
      undefined,
      (_err) => {
        // Not found or parse error — mark as failed and resolve (don't reject)
        // so the caller can fall back to procedural geometry.
        model.failed = true;
        model.loaded = true;
        resolve(model);
      },
    );
  });

  promiseCache.set(url, promise);
  return promise;
}

export function clearModelCache(): void {
  modelCache.clear();
  promiseCache.clear();
}
