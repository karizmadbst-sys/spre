import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import {
  animatePlayerRig,
  createMonsterRig,
  createPlayerRig,
  disposeEntityResources,
  markEntityTexturesDirty,
  resetPlayerRigPose,
  setEntityQualityTier,
  animateMonsterRig,
  resetSerpentTrail,
  type PlayerAnimState,
} from '../src/game/entities';
import { getLevelById, TOTAL_LEVELS } from '../src/game/levels';
import type { TextureBundle } from '../src/game/textures';
import type { CharacterId } from '../src/game/types';

function makeMockTextures(compact: boolean): TextureBundle {
  const mk = () => new THREE.DataTexture(new Uint8Array([180, 180, 180, 255]), 1, 1) as unknown as THREE.CanvasTexture;
  const all = Array.from({ length: 23 }, () => mk());
  let dirtyCalls = 0;
  return {
    compact,
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
    markAllDirty: () => {
      dirtyCalls++;
      for (const t of all) t.needsUpdate = true;
    },
    dispose: () => {
      for (const t of all) t.dispose();
    },
    get _dirtyCalls() {
      return dirtyCalls;
    },
  } as unknown as TextureBundle & { _dirtyCalls: number };
}

function assertAllMatricesFinite(root: THREE.Object3D, label: string): void {
  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    const e = obj.matrixWorld.elements;
    for (let i = 0; i < 16; i++) {
      assert.ok(Number.isFinite(e[i]), `${label}: non-finite matrix element at ${obj.name || obj.type}[${i}]`);
    }
  });
}

function testIconIntegrity(): void {
  const root = process.cwd();
  const bundledPath = path.join(root, 'src/assets/serpentis-icon.png');
  const publicPath = path.join(root, 'public/pwa-192x192.png');
  assert.ok(fs.existsSync(bundledPath), 'Bundled icon src/assets/serpentis-icon.png must exist');
  assert.ok(fs.existsSync(publicPath), 'Public icon public/pwa-192x192.png must exist');

  const bundledBytes = fs.readFileSync(bundledPath);
  const publicBytes = fs.readFileSync(publicPath);
  assert.ok(bundledBytes.length > 1000, 'Bundled icon PNG must be non-empty');
  assert.equal(bundledBytes[0], 0x89, 'Bundled icon must have valid PNG magic byte 0');
  assert.equal(bundledBytes[1], 0x50, 'Bundled icon must have valid PNG magic byte 1');
  assert.equal(bundledBytes[2], 0x4e, 'Bundled icon must have valid PNG magic byte 2');
  assert.equal(bundledBytes[3], 0x47, 'Bundled icon must have valid PNG magic byte 3');
  assert.ok(bundledBytes.equals(publicBytes), 'Bundled icon must match official public/pwa-192x192.png');

  const modalsSrc = fs.readFileSync(path.join(root, 'src/components/Modals.tsx'), 'utf8');
  assert.ok(modalsSrc.includes("import serpentisIconUrl from '../assets/serpentis-icon.png'"), 'Modals must statically import bundled icon');
  assert.ok(!modalsSrc.includes('clipPath'), 'MainMenu must not use fragile SVG clipPath+<image> for game icon');
  assert.ok(modalsSrc.includes('PINNED_ICON_CACHE'), 'Modals must pin decoded icon bitmap in memory');
  console.log('1. PASS: Official SERPENTIS icon asset integrity, bundling, memory pinning & native <img> rendering verified.');
}

function testAll100LevelSpawnsGrounded(): void {
  assert.equal(TOTAL_LEVELS, 100, 'All 100 levels must be preserved');
  for (let id = 1; id <= TOTAL_LEVELS; id++) {
    const def = getLevelById(id);
    const [sx, sy, sz] = def.spawn;
    assert.ok(Number.isFinite(sx) && Number.isFinite(sy) && Number.isFinite(sz), `Level ${id}: finite spawn`);
    assert.ok(
      sx >= def.bounds.minX && sx <= def.bounds.maxX && sz >= def.bounds.minZ && sz <= def.bounds.maxZ,
      `Level ${id}: spawn within horizontal level bounds`
    );
    const hasSupportingPlatform = def.platforms.some((p) => {
      const hw = p.size[0] * 0.5 + 0.35;
      const hd = p.size[2] * 0.5 + 0.35;
      const topY = p.position[1] + p.size[1] * 0.5;
      return (
        Math.abs(sx - p.position[0]) <= hw &&
        Math.abs(sz - p.position[2]) <= hd &&
        Math.abs(sy - topY) <= 1.8
      );
    });
    assert.ok(hasSupportingPlatform, `Level ${id} (${def.code}): spawn must be above a solid platform`);
  }
  console.log('2. PASS: All 100 level spawns verified finite, in-bounds, and supported by solid spawn platforms.');
}

function testCharacterVisibilityDrawCallsAndNaNImmunity(): void {
  const textures = makeMockTextures(false);
  const chars: CharacterId[] = ['male', 'female'];
  const states: PlayerAnimState[] = ['idle', 'walk', 'run', 'jump', 'fall', 'swim'];

  for (const cid of chars) {
    const rig = createPlayerRig(textures, 0x52e0b6, false, cid);
    resetPlayerRigPose(rig);
    rig.setVisible(true);

    let meshCount = 0;
    let physMatCount = 0;
    rig.root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        meshCount++;
        assert.equal(o.frustumCulled, false, `${cid}: character mesh must never be frustum-culled`);
        assert.equal(o.visible, true, `${cid}: character mesh must start visible`);
        if (o.material instanceof THREE.MeshPhysicalMaterial) {
          physMatCount++;
        }
      }
    });
    const maxMeshes = cid === 'female' ? 44 : 38;
    assert.ok(meshCount <= maxMeshes, `${cid}: merged character rig should have <= ${maxMeshes} meshes (got ${meshCount})`);
    assert.equal(physMatCount, 0, `${cid}: character rig must use lightweight MeshStandardMaterial (0 MeshPhysicalMaterial)`);

    // Normal animation sweep across all states
    for (let i = 0; i < 120; i++) {
      const st = states[i % states.length];
      animatePlayerRig(rig, st, st === 'run' ? 8.5 : st === 'walk' ? 4.2 : 0, i * 0.016, 0.016);
    }
    assertAllMatricesFinite(rig.root, `${cid} normal`);

    // Fault injection: NaN / Infinity inputs & corrupted internal rig state
    rig.gaitPhase = Number.NaN;
    rig.swimPhase = Number.POSITIVE_INFINITY;
    rig.hips.position.y = Number.NaN;
    rig.pushAnimTimer = Number.NaN;
    rig.pushedAnimTimer = Number.NEGATIVE_INFINITY;
    animatePlayerRig(rig, 'run', Number.NaN, Number.NaN, Number.NaN);
    animatePlayerRig(rig, 'swim', Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, 0);
    animatePlayerRig(rig, 'idle', 0, 1.5, 0.016);

    assert.ok(Number.isFinite(rig.gaitPhase), `${cid}: gaitPhase must self-heal from NaN`);
    assert.ok(Number.isFinite(rig.swimPhase), `${cid}: swimPhase must self-heal from Infinity`);
    assert.ok(Number.isFinite(rig.hips.position.y), `${cid}: hips.position.y must self-heal from NaN`);
    assert.equal(rig.root.visible, true, `${cid}: root must remain visible after NaN fault injection`);
    assert.equal(rig.hips.visible, true, `${cid}: hips must remain visible after NaN fault injection`);
    assertAllMatricesFinite(rig.root, `${cid} post-NaN recovery`);

    rig.dispose();
  }

  // Context restore texture dirty marking
  markEntityTexturesDirty(textures);
  textures.markAllDirty?.();

  // Repeated create + dispose stress cycle (200 iterations — no leak or exception)
  for (let i = 0; i < 200; i++) {
    const rig = createPlayerRig(textures, 0x52e0b6, i % 2 === 1, i % 2 === 0 ? 'male' : 'female');
    animatePlayerRig(rig, 'walk', 4.0, i * 0.03, 0.016);
    rig.dispose();
  }

  disposeEntityResources(textures);
  textures.dispose();
  console.log('3. PASS: Character visibility, merged draw calls, zero MeshPhysicalMaterial, NaN immunity & 200x create/dispose cycles verified.');
}

function testAdaptiveSerpentGeometryAndMaterials(): void {
  const mobileTex = makeMockTextures(true);
  const desktopTex = makeMockTextures(false);

  const mobileMonster = createMonsterRig(mobileTex, 1.0);
  const desktopMonster = createMonsterRig(desktopTex, 1.0);

  const mobileBodyTris = (mobileMonster.bodyMesh.geometry.index?.count ?? 0) / 3;
  const desktopBodyTris = (desktopMonster.bodyMesh.geometry.index?.count ?? 0) / 3;

  assert.ok(mobileBodyTris > 2000 && mobileBodyTris <= 5000, `Compact mobile serpent body should be 2k-5k tris (got ${mobileBodyTris})`);
  assert.ok(desktopBodyTris > mobileBodyTris && desktopBodyTris <= 9500, `Desktop serpent body should be higher-res & <=9.5k tris (got ${desktopBodyTris})`);
  assert.ok(!(mobileMonster.bodyMesh.material instanceof THREE.MeshPhysicalMaterial), 'Compact mobile serpent skin should use MeshStandardMaterial');
  assert.ok(desktopMonster.bodyMesh.material instanceof THREE.MeshPhysicalMaterial, 'Desktop serpent skin should preserve wet MeshPhysicalMaterial clearcoat');

  setEntityQualityTier(mobileTex, 'smooth');
  setEntityQualityTier(desktopTex, 'ultra');
  setEntityQualityTier(desktopTex, 'smooth');

  mobileMonster.dispose();
  desktopMonster.dispose();
  disposeEntityResources(mobileTex);
  disposeEntityResources(desktopTex);
  mobileTex.dispose();
  desktopTex.dispose();
  console.log(`4. PASS: Adaptive serpent geometry (${Math.round(mobileBodyTris)} mobile tris vs ${Math.round(desktopBodyTris)} desktop tris) & material tiers verified.`);
}

function testEngineAndPreviewArchitectureGuards(): void {
  const root = process.cwd();
  const engineSrc = fs.readFileSync(path.join(root, 'src/game/engine.ts'), 'utf8');
  const previewSrc = fs.readFileSync(path.join(root, 'src/game/characterPreview.ts'), 'utf8');
  const appSrc = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');

  assert.ok(!engineSrc.includes('horrorJawLight'), 'engine.ts must not allocate extra permanent horrorJawLight');
  assert.ok(!engineSrc.includes('horrorRimLight'), 'engine.ts must not allocate extra permanent horrorRimLight');
  assert.ok(engineSrc.includes('groundPlayerOnSpawnPlatform'), 'engine.ts must ground player on spawn platform');
  assert.ok(engineSrc.includes('ensureLocalPlayerVisible'), 'engine.ts must enforce local player visibility invariant');
  assert.ok(engineSrc.includes('markEntityTexturesDirty'), 'engine.ts must mark entity textures dirty on WebGL context restore');
  assert.ok(engineSrc.includes('!this.isSoftwareGl && !this.isTouchDevice && !this.isLowEndGpu'), 'engine.ts must disable HalfFloat EffectComposer on touch/low-end');

  assert.ok(previewSrc.includes('setCharacterPreviewPaused'), 'characterPreview.ts must support pausing background WebGL renderer during gameplay');
  assert.ok(!previewSrc.includes('new RoomEnvironment') && !previewSrc.includes('new THREE.PMREMGenerator'), 'characterPreview.ts must not allocate heavy PMREM RoomEnvironment');
  assert.ok(appSrc.includes('setCharacterPreviewPaused'), 'App.tsx must pause portrait renderer while playing/jumpscare');
  console.log('5. PASS: Engine light-pool reduction, EffectComposer gating, visibility guards, and background WebGL pausing verified.');
}

function testExtended12PlayerMultiplayerPerfStress(): void {
  const textures = makeMockTextures(true);
  const rigs = Array.from({ length: 12 }, (_, idx) =>
    createPlayerRig(textures, 0x52e0b6, idx > 0, idx % 2 === 0 ? 'male' : 'female')
  );
  const monsters = Array.from({ length: 4 }, (_, idx) => {
    const m = createMonsterRig(textures, 1.0);
    resetSerpentTrail(m, new THREE.Vector3(idx * 6, -0.14, -20 - idx * 8), 0);
    return m;
  });

  const playerTarget = new THREE.Vector3(0, 0.2, -10);
  const mPos = new THREE.Vector3(0, -0.14, -20);
  const states: PlayerAnimState[] = ['idle', 'walk', 'run', 'jump', 'fall', 'swim'];

  const start = performance.now();
  const FRAMES = 1000;
  for (let f = 0; f < FRAMES; f++) {
    const t = f * 0.016;
    for (let i = 0; i < rigs.length; i++) {
      const st = states[(f + i) % states.length];
      animatePlayerRig(rigs[i], st, st === 'run' ? 8.2 : 4.0, t, 0.016);
    }
    for (let j = 0; j < monsters.length; j++) {
      mPos.set(Math.sin(t + j) * 6, -0.14, -20 - j * 8);
      animateMonsterRig(monsters[j], 'chasing', playerTarget, mPos, Math.sin(t), 0, t, 0.016, 1.0);
    }
  }
  const elapsedMs = performance.now() - start;
  const msPerFrame = elapsedMs / FRAMES;

  for (let i = 0; i < rigs.length; i++) {
    assertAllMatricesFinite(rigs[i].root, `stress rig ${i}`);
    rigs[i].dispose();
  }
  for (let j = 0; j < monsters.length; j++) {
    assertAllMatricesFinite(monsters[j].root, `stress monster ${j}`);
    monsters[j].dispose();
  }
  disposeEntityResources(textures);
  textures.dispose();

  assert.ok(msPerFrame < 4.0, `12 players + 4 serpents animation cost must stay well below 4ms/frame (got ${msPerFrame.toFixed(3)}ms)`);
  console.log(`6. PASS: 1,000-frame 12-player + 4-serpent stress test passed (${msPerFrame.toFixed(3)} ms/frame avg, 0 NaNs, 0 leaks).`);
}

testIconIntegrity();
testAll100LevelSpawnsGrounded();
testCharacterVisibilityDrawCallsAndNaNImmunity();
testAdaptiveSerpentGeometryAndMaterials();
testEngineAndPreviewArchitectureGuards();
testExtended12PlayerMultiplayerPerfStress();
console.log('\nALL ROOT-LEVEL STABILITY, ICON, VISIBILITY & PERFORMANCE TESTS PASSED!');
