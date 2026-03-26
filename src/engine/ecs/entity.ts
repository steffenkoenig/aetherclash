// src/engine/ecs/entity.ts
// Entity management: each entity is a unique numeric ID

export type EntityId = number;

let nextId = 0;

export function createEntity(): EntityId {
  return nextId++;
}

export function resetEntityCounter(): void {
  nextId = 0;
}
