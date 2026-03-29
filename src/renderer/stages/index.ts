// src/renderer/stages/index.ts
// Stage environment builder dispatcher.

import * as THREE from 'three';
import { buildAetherPlateauEnvironment } from './aetherPlateau.js';
import { buildForgeEnvironment } from './forge.js';
import { buildCloudCitadelEnvironment } from './cloudCitadel.js';
import { buildAncientRuinEnvironment } from './ancientRuin.js';
import { buildDigitalGridEnvironment } from './digitalGrid.js';
import { buildCrystalCavernEnvironment } from './crystalCavern.js';
import { buildVoidRiftEnvironment } from './voidRift.js';
import { buildSolarPinnacleEnvironment } from './solarPinnacle.js';
import { buildWindyHeightsEnvironment } from './windyHeights.js';

export function buildStageEnvironment(scene: THREE.Scene, stageId: string): THREE.Group {
  switch (stageId) {
    case 'aetherPlateau':  return buildAetherPlateauEnvironment(scene);
    case 'forge':          return buildForgeEnvironment(scene);
    case 'cloudCitadel':   return buildCloudCitadelEnvironment(scene);
    case 'ancientRuin':    return buildAncientRuinEnvironment(scene);
    case 'digitalGrid':    return buildDigitalGridEnvironment(scene);
    case 'crystalCavern':  return buildCrystalCavernEnvironment(scene);
    case 'voidRift':       return buildVoidRiftEnvironment(scene);
    case 'solarPinnacle':  return buildSolarPinnacleEnvironment(scene);
    case 'windyHeights':   return buildWindyHeightsEnvironment(scene);
    default:               return buildAetherPlateauEnvironment(scene);
  }
}
