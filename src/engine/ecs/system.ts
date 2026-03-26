// src/engine/ecs/system.ts
// System registry: systems are functions called once per physics step

export type World = Record<string, never>; // opaque world token for now

export type SystemFn = () => void;

const systems: SystemFn[] = [];

export function addSystem(fn: SystemFn): void {
  systems.push(fn);
}

export function runSystems(): void {
  for (const fn of systems) {
    fn();
  }
}

export function clearSystems(): void {
  systems.length = 0;
}
