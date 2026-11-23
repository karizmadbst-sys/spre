import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { PoolGameEngine } from '../src/game/engine.ts';
import { createMonsterRig, createPlayerRig, disposeEntityResources } from '../src/game/entities.ts';
import { getLevelById } from '../src/game/levels.ts';
import { LevelSpatialGrid } from '../src/game/spatialGrid.ts';
import type { TextureBundle } from '../src/game/textures.ts';
import { DEFAULT_SETTINGS, sanitizeGameSettings, type GameSettings } from '../src/game/types.ts';

function createMockTextures(): TextureBundle {
  const mkTex = () => {
    const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    t.needsUpdate = true;
    return t as unknown as THREE.CanvasTexture;
  };
  return {
    compact: false,
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
    markAllDirty: () => {},
    dispose: () => {},
  } as unknown as TextureBundle;
}

function createPerspectiveHarness(initialInvertY: boolean) {
  const textures = createMockTextures();
  const def = getLevelById(1);
  const eng = Object.create(PoolGameEngine.prototype) as any;

  eng.disposed = false;
  eng.suspended = false;
  eng.contextLost = false;
  eng.overlayOccluded = false;
  eng.phase = 'playing';
  eng.isSoftwareGl = true;
  eng.isTouchDevice = false;
  eng.activeQuality = 'standard';
  eng.activeRenderDist = 145;
  eng.dynamicResScale = 1.0;
  eng.autoDowngradeCount = 0;
  eng.slowFrameCount = 0;
  eng.highFpsStreak = 0;
  eng.qualityCooldownTimer = 0;
  eng.currentLevel = def;
  eng.spatialGrid = new LevelSpatialGrid(def, 12);
  eng.scene = new THREE.Scene();
  eng.camera = new THREE.PerspectiveCamera(68, 16 / 9, 0.1, 225);
  eng.textures = textures;
  eng.renderer = {
    getContext: () => null,
    render: () => {},
  };
  eng.sound = {
    unlock: () => {},
    setVolumes: () => {},
    playCheckpoint: () => {},
    playEatingStrike: () => {},
    playSwallowGulp: () => {},
    playCharacterEatingScream: () => {},
    playSnakeSwallowingAudio: () => {},
    playSnakeFinalGulpAudio: () => {},
    updateEatingScreamPosition: () => {},
    updateSnakeEatingAudioPosition: () => {},
    updateSnakeSwimmingAudio: () => {},
    pruneSnakeSwimmingAudio: () => {},
    stopSnakeSwimmingAudio: () => {},
    stopAttackEatingAudio: () => {},
    stopEatingScreams: () => {},
    playJumpscare: () => {},
    playSerpentEmerge: () => {},
    playVictory: () => {},
    updateAtmosphere: () => {},
    updateListener: () => {},
  };
  eng.callbacks = {
    onHudUpdate: () => {},
    onPhaseChange: () => {},
  };

  eng.settings = sanitizeGameSettings({ ...DEFAULT_SETTINGS, invertY: initialInvertY });
  eng.localCharacterId = 'male';
  eng.playerRig = createPlayerRig(textures, 0x52e0b6, false, 'male');
  eng.scene.add(eng.playerRig.root);
  eng.playerPos = new THREE.Vector3(def.spawn[0], def.spawn[1], def.spawn[2]);
  eng.playerVel = new THREE.Vector3();
  eng.playerYaw = Math.PI;
  eng.activeSpawn = new THREE.Vector3(def.spawn[0], def.spawn[1], def.spawn[2]);
  eng.camYaw = 0.35;
  eng.camPitch = 0.25;
  eng.camDist = 5.0;
  eng.lastCamThirdPerson = true;
  eng.camShake = 0;
  eng.pendingLookDx = 0;
  eng.pendingLookDy = 0;
  eng.inWater = false;
  eng.waterJumpTimer = 0;
  eng.simTime = 0;
  eng.monsters = [];
  eng.walls = [];
  eng.platforms = [];
  eng.dynamicPlatforms = [];
  eng.checkpoints = [];
  eng.cullEntries = [];
  eng.heldKeys = new Set();
  eng.virtualMove = { x: 0, y: 0 };
  eng.virtualRun = false;
  eng.virtualAutoRun = false;
  eng.jumpBufferTimer = 0;
  eng.rafId = 0;
  eng.timerId = 0;
  eng.pendingSync = null;
  eng.needsStaticRender = false;
  eng._lastCullCamZ = NaN;
  eng._lastCullPhase = '';
  eng._lastCullQuality = '';
  eng.lastHudSnap = {
    levelId: -1,
    timeRemaining: -1,
    timeElapsed: -1,
    stamina: -1,
    inWater: false,
    underwater: false,
    waterJumpCooldown: -1,
    monsterDist: -1,
    monsterAlert: '',
    checkpointIndex: -1,
    totalCheckpoints: -1,
    checkpointNotice: null,
    activeQuality: '',
    fps: -1,
    isPointerLocked: false,
    deathReason: null,
  };
  eng.releaseDragPointerCapture = () => {};
  eng.scheduleNextTick = () => {};
  eng.ensureLoopRunning = () => {};
  eng.updateVisibilityCulling = () => {};
  eng.emitHud = () => {};

  return {
    eng,
    textures,
    cleanup: () => {
      eng.playerRig.dispose();
      disposeEntityResources(textures);
      textures.dispose();
    },
  };
}

function getRigMeshVisibility(rig: ReturnType<typeof createPlayerRig>): {
  totalMeshes: number;
  visibleMeshes: number;
} {
  let totalMeshes = 0;
  let visibleMeshes = 0;
  rig.root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      totalMeshes++;
      if (obj.visible) visibleMeshes++;
    }
  });
  return { totalMeshes, visibleMeshes };
}

function testMouseLookUnchangedAcrossBothModes(): void {
  const fp = createPerspectiveHarness(false);
  const tp = createPerspectiveHarness(true);
  try {
    fp.eng.camYaw = 0.2;
    fp.eng.camPitch = 0.1;
    tp.eng.camYaw = 0.2;
    tp.eng.camPitch = 0.1;

    fp.eng.rotateCameraByDelta(45, -30);
    tp.eng.rotateCameraByDelta(45, -30);

    assert.equal(fp.eng.camYaw, tp.eng.camYaw, 'Horizontal mouse look must match in First-Person and Third-Person');
    assert.equal(fp.eng.camPitch, tp.eng.camPitch, 'Vertical mouse look must NOT invert when Invert Look Y is ON');
    assert.ok(fp.eng.camPitch < 0.1, 'Negative mouse dy must decrease camPitch (look UP) without inversion');

    fp.eng.rotateCameraByDelta(-20, 50);
    tp.eng.rotateCameraByDelta(-20, 50);
    assert.equal(fp.eng.camYaw, tp.eng.camYaw);
    assert.equal(fp.eng.camPitch, tp.eng.camPitch);
    console.log('1. PASS: Mouse horizontal/vertical look directions & sensitivity identical in ON and OFF modes.');
  } finally {
    fp.cleanup();
    tp.cleanup();
  }
}

function testPerspectiveModesAndRigVisibility(): void {
  const { eng, cleanup } = createPerspectiveHarness(false);
  try {
    const target = new THREE.Vector3();
    const camPos = new THREE.Vector3();

    // OFF (invertY = false) -> First-Person View
    eng.ensureLocalPlayerVisible();
    eng.computePlayCameraGoals(target, camPos);

    const fpHorizOffset = Math.hypot(camPos.x - eng.playerPos.x, camPos.z - eng.playerPos.z);
    assert.ok(fpHorizOffset < 0.01, `First-Person camera must sit over player XZ, got offset=${fpHorizOffset}`);
    assert.ok(
      Math.abs(camPos.y - (eng.playerPos.y + 1.58)) < 0.05,
      `First-Person camera must be at eye height, got camPos.y=${camPos.y}`
    );

    const fwdX = -Math.sin(eng.camYaw) * Math.cos(eng.camPitch);
    const fwdY = -Math.sin(eng.camPitch);
    const fwdZ = -Math.cos(eng.camYaw) * Math.cos(eng.camPitch);
    const lookDir = target.clone().sub(camPos).normalize();
    assert.ok(Math.abs(lookDir.x - fwdX) < 1e-4, 'First-Person look X must align with camYaw');
    assert.ok(Math.abs(lookDir.y - fwdY) < 1e-4, 'First-Person look Y must align with camPitch');
    assert.ok(Math.abs(lookDir.z - fwdZ) < 1e-4, 'First-Person look Z must align with camYaw');

    const fpMeshes = getRigMeshVisibility(eng.playerRig);
    assert.ok(fpMeshes.totalMeshes > 0, 'Player rig must contain meshes');
    assert.equal(fpMeshes.visibleMeshes, 0, 'Local player meshes must be hidden in First-Person to avoid head clipping');
    assert.equal(eng.playerRig.root.visible, true, 'Player root must stay visible so headlamp illuminates First-Person view');
    assert.ok(eng.playerRig.headlamp.intensity > 0, 'Headlamp must remain active in First-Person view');

    // Toggle ON (invertY = true) -> Third-Person View immediately
    const onSettings: GameSettings = { ...eng.settings, invertY: true };
    eng.updateSettings(onSettings);

    const tpHorizOffset = Math.hypot(eng.camera.position.x - eng.playerPos.x, eng.camera.position.z - eng.playerPos.z);
    assert.ok(
      tpHorizOffset > 2.0,
      `Third-Person camera must immediately jump to orbit distance, got horiz=${tpHorizOffset}`
    );
    const tpMeshes = getRigMeshVisibility(eng.playerRig);
    assert.equal(
      tpMeshes.visibleMeshes,
      tpMeshes.totalMeshes,
      'Local player meshes must immediately reappear when switching to Third-Person'
    );

    // Pause mode immediate toggle check: Third-Person -> First-Person while paused
    eng.phase = 'paused';
    eng.updateSettings({ ...eng.settings, invertY: false });
    const pausedFpOffset = Math.hypot(eng.camera.position.x - eng.playerPos.x, eng.camera.position.z - eng.playerPos.z);
    assert.ok(
      pausedFpOffset < 0.01,
      `Toggling OFF while paused must immediately snap camera to First-Person, got offset=${pausedFpOffset}`
    );
    assert.equal(
      getRigMeshVisibility(eng.playerRig).visibleMeshes,
      0,
      'Toggling OFF while paused must hide local player meshes immediately'
    );

    // And back ON while paused
    eng.updateSettings({ ...eng.settings, invertY: true });
    const pausedTpOffset = Math.hypot(eng.camera.position.x - eng.playerPos.x, eng.camera.position.z - eng.playerPos.z);
    assert.ok(
      pausedTpOffset > 2.0,
      `Toggling ON while paused must immediately snap camera back to Third-Person, got offset=${pausedTpOffset}`
    );
    assert.equal(
      getRigMeshVisibility(eng.playerRig).visibleMeshes,
      tpMeshes.totalMeshes,
      'Toggling ON while paused must restore local player meshes immediately'
    );

    console.log('2. PASS: Invert Look Y OFF=First-Person / ON=Third-Person immediate switching (playing & paused) verified.');
  } finally {
    cleanup();
  }
}

function testDevourRestoresMeshesFromFirstPerson(): void {
  const { eng, textures, cleanup } = createPerspectiveHarness(false);
  const mRig = createMonsterRig(textures, 1.0);
  eng.scene.add(mRig.root);
  const monster = {
    id: 'm1',
    rig: mRig,
    scale: 1.0,
    pos: new THREE.Vector3(0, 0, -2),
    yaw: 0,
    speed: 6,
    alert: 'chasing',
    patrolPoints: [{ x: 0, z: -2 }],
    patrolIdx: 0,
    patrolTimer: 0,
    intimidation: { phase: 'none', timer: 0, duration: 0, targetYaw: 0, cooldown: 0 },
    eatingUserId: null,
    eatingProgress: -1,
    eatingTimer: 0,
    eatingPreyStartPos: new THREE.Vector3(),
    eatingPreyStartYaw: 0,
    eatingGulpStage: 0,
    eatingSwallowAudioPlayed: false,
    emerged: false,
    targetUserId: null,
    nav: {
      stuckTimer: 0,
      progressTimer: 0,
      bestDist: Infinity,
      lastProgressDist: Infinity,
      avoidDir: 1,
      escapeTimer: 0,
    },
  };
  eng.monsters.push(monster);

  try {
    eng.ensureLocalPlayerVisible();
    assert.equal(getRigMeshVisibility(eng.playerRig).visibleMeshes, 0);

    eng.triggerDeath('caught', monster);
    const eatMeshes = getRigMeshVisibility(eng.playerRig);
    assert.equal(
      eatMeshes.visibleMeshes,
      eatMeshes.totalMeshes,
      'Catching player in First-Person must immediately restore player meshes for devouring scene'
    );
    console.log('3. PASS: Devouring cinematic restores local player meshes cleanly from First-Person.');
  } finally {
    mRig.dispose();
    cleanup();
  }
}

function testModalPreservesExistingInvertYLabel(): void {
  const modalsSrc = readFileSync('src/components/Modals.tsx', 'utf8');
  assert.ok(
    modalsSrc.includes('Invert Look Y'),
    'Modals.tsx must preserve the exact "Invert Look Y" setting label'
  );
  assert.ok(
    modalsSrc.includes("update('invertY', !settings.invertY)"),
    'Modals.tsx must preserve the existing invertY toggle button handler'
  );
  assert.ok(
    !modalsSrc.includes('First-Person') && !modalsSrc.includes('Third-Person'),
    'Modals.tsx must NOT add a duplicate camera perspective setting or change the label'
  );
  console.log('4. PASS: Existing "Invert Look Y" UI label and single toggle preserved.');
}

testMouseLookUnchangedAcrossBothModes();
testPerspectiveModesAndRigVisibility();
testDevourRestoresMeshesFromFirstPerson();
testModalPreservesExistingInvertYLabel();
console.log('ALL INVERT-Y CAMERA PERSPECTIVE TESTS PASSED!');
