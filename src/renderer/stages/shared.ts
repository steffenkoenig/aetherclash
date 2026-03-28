// src/renderer/stages/shared.ts
// Shared material helpers and utility functions for all stage environment builders.

import * as THREE from 'three';

export function stdMat(color: number, opts: {
  emissive?: number; emissiveIntensity?: number;
  metalness?: number; roughness?: number;
  transparent?: boolean; opacity?: number;
  side?: THREE.Side;
} = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    emissive:          opts.emissive          ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    metalness:         opts.metalness         ?? 0,
    roughness:         opts.roughness         ?? 0.8,
    transparent:       opts.transparent       ?? false,
    opacity:           opts.opacity           ?? 1.0,
    side:              opts.side              ?? THREE.FrontSide,
  });
}

export function toonMat(color: number, side?: THREE.Side): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color, side: side ?? THREE.FrontSide });
}

export function basicMat(color: number, opts: {
  transparent?: boolean; opacity?: number; side?: THREE.Side; wireframe?: boolean;
} = {}): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: opts.transparent ?? false,
    opacity:     opts.opacity     ?? 1.0,
    side:        opts.side        ?? THREE.FrontSide,
    wireframe:   opts.wireframe   ?? false,
  });
}

/** Add a point light as a child of the group (cleaned up with the stage). */
export function addPointLight(
  group: THREE.Group, color: number, intensity: number,
  x: number, y: number, z: number, distance = 800,
): void {
  const light = new THREE.PointLight(color, intensity, distance);
  light.position.set(x, y, z);
  group.add(light);
}

/** Add a simple mesh to the group. */
export function addMesh(
  group: THREE.Group,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x: number, y: number, z: number,
  rx = 0, ry = 0, rz = 0,
  sx = 1, sy = 1, sz = 1,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.scale.set(sx, sy, sz);
  group.add(mesh);
  return mesh;
}
