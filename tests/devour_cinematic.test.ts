import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import {
  animateMonsterRig,
  attachPreyToSerpentMouth,
  computeSerpentDevourAirborneLift,
  createMonsterRig,
  createPlayerRig,
  disposeEntityResources,
  resetPlayerRigPose,
  SERPENT_DEVOUR_AIR_END,
  SERPENT_DEVOUR_AIR_START,
} from '../src/game/entities.ts';
import type { TextureBundle } from '../src/game/textures.ts';
const EAT_DURATION_MS = 2300;

function createMockTextures(): TextureBundle {
  const mkTex = () => {
    const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    t.needsUpdate = true;
    return t as unknown as THREE.CanvasTexture;
  };
  return {
    tileAlbedo: mkTex(),
    tileBump: mkTex(),
    tileRoughness: mkTex(),
    wallAlbedo: mkTex(),
    wallBump: mkTex(),
    ceilingAlbedo: mkTex(),
    concreteAlbedo: mkTex(),
    concreteBump: mkTex(),
    metalAlbedo: mkTex(),
    metalBump: mkTex(),
    woodAlbedo: mkTex(),
    woodBump: mkTex(),
    woodRoughness: mkTex(),
    cautionAlbedo: mkTex(),
    waterNormal: mkTex(),
    monsterSkin: mkTex(),
    monsterBump: mkTex(),
    monsterNormal: mkTex(),
    monsterRoughness: mkTex(),
    monsterEmissive: mkTex(),
    monsterFinSkin: mkTex(),
    monsterFinEmissive: mkTex(),
    monsterEye: mkTex(),
    setAnisotropy: () => {},
    dispose: () => {},
  };
}

function testDevourSequenceForCharacter(
  textures: TextureBundle,
  characterId: 'male' | 'female',
  scale = 1.05,
  ceilingY = 14.0
): void {
  const serpent = createMonsterRig(textures, scale);
  const prey = createPlayerRig(textures, '#52e0b6', false, characterId);
  const waterY = 0;
  const monsterPos = new THREE.Vector3(0, waterY - 0.14, 0);
  const monsterYaw = 0.45;
  const startPos = new THREE.Vector3(
    monsterPos.x + Math.sin(monsterYaw) * 1.15 * scale,
    waterY + 0.1,
    monsterPos.z + Math.cos(monsterYaw) * 1.15 * scale
  );

  serpent.root.position.copy(monsterPos);

  const steps = 115; // ~50fps step granularity across 2.3s
  const dt = EAT_DURATION_MS / 1000 / steps;
  let simTime = 1.0;

  let apexY = -Infinity;
  let apexIdx = -1;
  const jawAngles: number[] = [];
  const preyScales: number[] = [];
  const hairWorldPointsFinite: boolean[] = [];

  const tmpComWorld = new THREE.Vector3();
  const tmpHeadWorld = new THREE.Vector3();
  const tmpHeadQuat = new THREE.Quaternion();
  const tmpHeadScale = new THREE.Vector3();
  const tmpHeadForward = new THREE.Vector3();
  const tmpDirToPrey = new THREE.Vector3();

  let minGazeAlignmentInFlight = Infinity;
  let maxPreCatchJaw = 0;
  let maxPeristalsisBoneScale = 1;
  let maxFrameStepDist = 0;
  let prevCom: THREE.Vector3 | null = null;
  let minCatchDist = Infinity;

  for (let i = 0; i <= steps; i++) {
    const eatU = i / steps;
    simTime += dt;

    animateMonsterRig(
      serpent,
      'chasing',
      startPos,
      monsterPos,
      monsterYaw,
      waterY,
      simTime,
      dt,
      1,
      eatU,
      null,
      -5,
      false,
      ceilingY
    );
    serpent.root.updateMatrixWorld(true);

    attachPreyToSerpentMouth(
      serpent,
      prey,
      eatU,
      simTime,
      dt,
      startPos,
      monsterYaw + Math.PI,
      true,
      ceilingY
    );
    prey.root.updateMatrixWorld(true);

    // Sample hips COM in world space
    prey.hips.getWorldPosition(tmpComWorld);
    serpent.headGroup.matrixWorld.decompose(tmpHeadWorld, tmpHeadQuat, tmpHeadScale);

    assert.ok(
      Number.isFinite(tmpComWorld.x) &&
        Number.isFinite(tmpComWorld.y) &&
        Number.isFinite(tmpComWorld.z),
      `${characterId}: prey COM position must remain finite at eatU=${eatU.toFixed(3)}`
    );
    assert.ok(
      Number.isFinite(prey.root.quaternion.w),
      `${characterId}: prey quaternion must remain finite at eatU=${eatU.toFixed(3)}`
    );
    assert.ok(
      tmpComWorld.y < ceilingY - 0.5,
      `${characterId}: prey must never clip through ceiling (${tmpComWorld.y.toFixed(2)} >= ${ceilingY})`
    );

    if (prevCom) {
      const stepDist = prevCom.distanceTo(tmpComWorld);
      if (stepDist > maxFrameStepDist) maxFrameStepDist = stepDist;
    }
    prevCom = tmpComWorld.clone();

    jawAngles.push(serpent.jaw.rotation.x);
    preyScales.push(prey.root.scale.x);

    if (tmpComWorld.y > apexY) {
      apexY = tmpComWorld.y;
      apexIdx = i;
    }

    // Track serpent head/eye alignment toward flying victim
    if (eatU > SERPENT_DEVOUR_AIR_START + 0.04 && eatU < SERPENT_DEVOUR_AIR_END - 0.02) {
      tmpHeadForward.set(0, 0, 1).applyQuaternion(tmpHeadQuat).normalize();
      tmpDirToPrey.copy(tmpComWorld).sub(tmpHeadWorld).normalize();
      const align = tmpHeadForward.dot(tmpDirToPrey);
      if (align < minGazeAlignmentInFlight) {
        minGazeAlignmentInFlight = align;
      }
      assert.ok(
        serpent.leftEye.rotation.x < 0.02 && serpent.rightEye.rotation.x < 0.02,
        `${characterId}: eyes should track skyward toward airborne prey at u=${eatU.toFixed(2)}`
      );
    }

    // Track wide open jaws anticipating mid-air catch
    if (eatU >= 0.34 && eatU <= SERPENT_DEVOUR_AIR_END) {
      maxPreCatchJaw = Math.max(maxPreCatchJaw, serpent.jaw.rotation.x);
    }

    // At catch moment (around AIR_END), verify prey meets mouth closely
    if (Math.abs(eatU - SERPENT_DEVOUR_AIR_END) <= 0.02) {
      const mouthCenter = new THREE.Vector3(0, -0.22, 0.4).applyMatrix4(serpent.headGroup.matrixWorld);
      minCatchDist = Math.min(minCatchDist, tmpComWorld.distanceTo(mouthCenter));
    }

    // Track peristalsis bulge across anterior spine bones
    if (eatU >= 0.56 && eatU <= 0.96) {
      for (let b = 0; b <= 7; b++) {
        maxPeristalsisBoneScale = Math.max(maxPeristalsisBoneScale, serpent.segments[b].bone.scale.x);
      }
    }

    // Validate female/male hair matrices stay finite
    for (const hn of prey.hairNodes) {
      const hp = new THREE.Vector3().setFromMatrixPosition(hn.group.matrixWorld);
      hairWorldPointsFinite.push(Number.isFinite(hp.x) && Number.isFinite(hp.y) && Number.isFinite(hp.z));
    }
  }

  // 1. Strong upward launch well clear above head & water
  assert.ok(apexY > waterY + 4.3 * scale, `${characterId}: airborne apex should soar high above serpent, got ${apexY.toFixed(2)}`);
  assert.ok(
    apexIdx > Math.floor(steps * SERPENT_DEVOUR_AIR_START) &&
      apexIdx < Math.ceil(steps * SERPENT_DEVOUR_AIR_END),
    `${characterId}: apex must occur mid-flight (idx=${apexIdx})`
  );

  // 2. Smooth continuous trajectory with zero frame teleports/pops
  assert.ok(
    maxFrameStepDist < 0.55 * scale,
    `${characterId}: trajectory must have zero teleport spikes (maxStep=${maxFrameStepDist.toFixed(3)})`
  );

  // 3. Continuous head/eye tracking toward flying character throughout airborne phase
  assert.ok(
    minGazeAlignmentInFlight >= 0.72,
    `${characterId}: serpent head must continuously track airborne prey (min dot=${minGazeAlignmentInFlight.toFixed(3)})`
  );

  // 4. Wide-open jaw & clean mid-air mouth interception
  assert.ok(
    maxPreCatchJaw >= 0.92,
    `${characterId}: jaws must open wide for mid-air catch (maxJaw=${maxPreCatchJaw.toFixed(3)})`
  );
  assert.ok(
    minCatchDist < 0.45 * scale,
    `${characterId}: prey must land accurately inside serpent mouth at catch (minCatchDist=${minCatchDist.toFixed(3)})`
  );

  // 5. Jaws close after catch, victim shrinks only inside throat, and throat peristalsis expands neck
  const jawAtLateSwallow = jawAngles[Math.floor(steps * 0.88)];
  assert.ok(jawAtLateSwallow < 0.32, `${characterId}: jaws must clamp closed during swallowing, got ${jawAtLateSwallow.toFixed(3)}`);
  const scaleBeforeCatchClose = preyScales[Math.floor(steps * 0.50)];
  const scaleNearEnd = preyScales[Math.floor(steps * 0.92)];
  assert.ok(scaleBeforeCatchClose >= 0.80, `${characterId}: prey must stay visible full/catch scale before throat entry (${scaleBeforeCatchClose.toFixed(2)})`);
  assert.ok(scaleNearEnd < 0.32, `${characterId}: prey must recede cleanly down closed throat (${scaleNearEnd.toFixed(2)})`);
  assert.ok(
    maxPeristalsisBoneScale > 1.08,
    `${characterId}: neck bones must show visible swallow peristalsis bulge (max=${maxPeristalsisBoneScale.toFixed(3)})`
  );
  assert.ok(hairWorldPointsFinite.every(Boolean), `${characterId}: all hair node matrices must stay finite`);

  // Verify clean reset after devouring finishes
  resetPlayerRigPose(prey);
  assert.equal(prey.root.scale.x, 1);
  assert.equal(prey.hips.visible, true);

  prey.dispose();
  serpent.dispose();
}

function testLowCeilingSafetyAndAudioInvariance(textures: TextureBundle): void {
  // Low ceiling clamp must constrain airborne arc safely below ceilingY
  const lowCeil = 6.2;
  const arcAtApex = computeSerpentDevourAirborneLift(0.30, 1.0, 0, lowCeil);
  assert.ok(
    2.25 + arcAtApex.verticalOffset <= lowCeil - 1.2,
    `Low ceiling must clamp apex safely (${(2.25 + arcAtApex.verticalOffset).toFixed(2)} <= ${(lowCeil - 1.2).toFixed(2)})`
  );

  // Verify audio subsystem invariance
  assert.equal(EAT_DURATION_MS, 2300, 'EAT_DURATION_MS must remain untouched for audio sync');
  const engineSrc = readFileSync('src/game/engine.ts', 'utf8');
  assert.ok(
    engineSrc.includes('eatU >= 0.24 && eatU < 0.94') &&
      engineSrc.includes('eatU >= 0.38 && m.eatingGulpStage < 1') &&
      engineSrc.includes('eatU >= 0.66 && m.eatingGulpStage < 2'),
    'Audio swallowing & gulp triggers in engine.ts must remain untouched'
  );

  void textures;
}

function run(): void {
  const prevDoc = (globalThis as { document?: unknown }).document;
  if (typeof prevDoc === 'undefined') {
    (globalThis as { document?: unknown }).document = {
      createElement: () => ({
        width: 256,
        height: 64,
        getContext: () => null,
      }),
    };
  }
  const textures = createMockTextures();
  try {
    testDevourSequenceForCharacter(textures, 'male', 1.0, 14.0);
    testDevourSequenceForCharacter(textures, 'female', 1.15, 16.0);
    testLowCeilingSafetyAndAudioInvariance(textures);
    console.log('ALL CINEMATIC SNAKE DEVOURING TESTS PASSED (MALE & FEMALE)');
  } finally {
    disposeEntityResources(textures);
    if (typeof prevDoc === 'undefined') {
      delete (globalThis as { document?: unknown }).document;
    }
  }
}

run();
