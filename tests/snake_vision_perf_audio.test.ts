import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import {
  computeSerpentLookAwayYaw,
  getSerpentWatchStandoffDist,
  isSerpentLookingAtTarget,
  SERPENT_WATCH_CONE_RAD,
  SERPENT_WATCH_DURATION_SEC,
  shortestAngleDiffNav,
} from '../src/game/serpentNav.ts';
import {
  createMonsterRig,
  createPlayerRig,
  disposeEntityResources,
  setEntityQualityTier,
} from '../src/game/entities';
import type { TextureBundle } from '../src/game/textures';
import { FEMALE_FEAR_SCREAM_URL, MALE_FEAR_SCREAM_URL } from '../src/game/audio.ts';

function testSerpentVisionMathHelpers(): void {
  assert.ok(SERPENT_WATCH_CONE_RAD > 0.3 && SERPENT_WATCH_CONE_RAD < 0.8);
  assert.equal(SERPENT_WATCH_DURATION_SEC, 5.0, 'Platform watch duration must be fixed at 5.0 seconds');
  assert.ok(getSerpentWatchStandoffDist(1.0) >= 3.5);

  // Looking straight along +Z toward target at (0, 6)
  assert.equal(isSerpentLookingAtTarget(0, 0, 0, 0, 6, 12), true);
  // Outside range
  assert.equal(isSerpentLookingAtTarget(0, 0, 0, 0, 15, 12), false);
  // Turned away (~90 deg right)
  assert.equal(isSerpentLookingAtTarget(0, 0, Math.PI * 0.5, 0, 6, 12), false);
  // Wall occlusion blocks vision
  assert.equal(
    isSerpentLookingAtTarget(0, 0, 0, 0, 6, 12, () => true),
    false
  );

  const toTarget = Math.atan2(0, 6);
  const awayPos = computeSerpentLookAwayYaw(0, 0, 0, 6, 1);
  const awayNeg = computeSerpentLookAwayYaw(0, 0, 0, 6, -1);
  assert.ok(Math.abs(shortestAngleDiffNav(toTarget, awayPos)) > 1.8, 'Look-away yaw (+1) must face well away from player');
  assert.ok(Math.abs(shortestAngleDiffNav(toTarget, awayNeg)) > 1.8, 'Look-away yaw (-1) must face well away from player');
  console.log('1. PASS: Serpent gaze cone, fixed 5s watch duration, range, wall occlusion, and look-away yaw helpers verified.');
}


function testShaderRecompileEliminationAndAudioPreservation(): void {
  const mk = () => new THREE.DataTexture(new Uint8Array([180, 180, 180, 255]), 1, 1) as unknown as THREE.CanvasTexture;
  const all = Array.from({ length: 23 }, () => mk());
  const tex: TextureBundle = {
    compact: false,
    tileAlbedo: all[0],
    tileBump: all[1],
    tileRoughness: all[2],
    wallAlbedo: all[3],
    wallBump: all[4],
    concreteAlbedo: all[5],
    concreteBump: all[6],
    metalAlbedo: all[7],
    metalBump: all[8],
    cautionAlbedo: all[9],
    woodAlbedo: all[10],
    woodBump: all[11],
    woodRoughness: all[12],
    ceilingAlbedo: all[13],
    waterNormal: all[14],
    monsterSkin: all[15],
    monsterBump: all[16],
    monsterNormal: all[17],
    monsterRoughness: all[18],
    monsterEmissive: all[19],
    monsterFinSkin: all[20],
    monsterFinEmissive: all[21],
    monsterEye: all[22],
    setAnisotropy: () => {},
    markAllDirty: () => {},
    dispose: () => {
      for (const t of all) t.dispose();
    },
  };

  const monster = createMonsterRig(tex, 1.0);
  const skinMat = monster.bodyMesh.material as THREE.MeshStandardMaterial;
  const initialNormalMap = skinMat.normalMap;
  assert.ok(initialNormalMap, 'Monster skin must bind normalMap initially');

  setEntityQualityTier(tex, 'smooth');
  assert.equal(skinMat.normalMap, initialNormalMap, 'Monster normalMap must stay bound in smooth tier to avoid shader stalls');
  assert.ok(skinMat.normalScale.x > 0 && skinMat.normalScale.x < 1.0, 'Smooth tier modulates normalScale without dropping map');

  setEntityQualityTier(tex, 'ultra');
  assert.equal(skinMat.normalMap, initialNormalMap);
  assert.ok(skinMat.normalScale.x >= 1.85);

  const rig = createPlayerRig(tex, 0x52e0b6, false, 'female');
  setEntityQualityTier(tex, 'smooth');
  let foundSkinMat: THREE.MeshStandardMaterial | null = null;
  rig.root.traverse((o) => {
    if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial && o.material.bumpMap) {
      foundSkinMat = o.material;
    }
  });
  assert.ok(foundSkinMat, 'Character materials keep bumpMap permanently bound in smooth tier');

  rig.dispose();
  monster.dispose();
  disposeEntityResources(tex);
  tex.dispose();

  // Verify original scream MP3s, trimming & timing are untouched, while peak gains are moderately boosted
  const audioSrc = fs.readFileSync(path.join(process.cwd(), 'src/game/audio.ts'), 'utf8');
  assert.equal(FEMALE_FEAR_SCREAM_URL, '/assets/aistudio/1795113025845_20261119_183259_dda4ed84.mp3');
  assert.equal(MALE_FEAR_SCREAM_URL, '/assets/aistudio/1795113054247_20261119_183222_15cf3533.mp3');
  assert.ok(audioSrc.includes('leadTrimSec: 0,') && audioSrc.includes('maxDurationSec: 2.25,'), 'Female scream timing preserved');
  assert.ok(audioSrc.includes('leadTrimSec: 0.09,') && audioSrc.includes('maxDurationSec: 2.28,'), 'Male scream timing preserved');
  assert.ok(audioSrc.includes('localPeakGain: 1.72') && audioSrc.includes('localPeakGain: 1.12'), 'Scream volume slightly increased');
  console.log('2. PASS: Zero shader-recompile quality tiering & original scream MP3/timing preservation verified.');
}

(async () => {
  testSerpentVisionMathHelpers();
  testShaderRecompileEliminationAndAudioPreservation();
  console.log('\nALL SNAKE VISION, PERFORMANCE & AUDIO VERIFICATION TESTS PASSED!');
  process.exit(0);
})().catch((err) => {
  console.error('\nTEST FAILED:', err);
  process.exit(1);
});
