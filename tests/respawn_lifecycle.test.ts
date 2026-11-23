import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  createMonsterRig,
  createPlayerRig,
  disposeEntityResources,
} from '../src/game/entities.ts';
import { PoolGameEngine } from '../src/game/engine.ts';
import { getLevelById } from '../src/game/levels.ts';
import { LevelSpatialGrid } from '../src/game/spatialGrid.ts';
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

function createDeathRespawnEngineHarness(
  levelId: number,
  textures: TextureBundle,
  invertY = true,
  characterId: 'male' | 'female' = 'male'
) {
  const def = getLevelById(levelId);
  const eng = Object.create(PoolGameEngine.prototype) as any;

  eng.disposed = false;
  eng.suspended = false;
  eng.contextLost = false;
  eng.overlayOccluded = false;
  eng.pendingSync = false;
  eng.rafId = 1; // prevent scheduleNextTick/RAF calls in headless Node
  eng.timerId = 0;
  eng.phase = 'playing';
  eng.isSoftwareGl = false;
  eng.isLowEndGpu = false;
  eng.isTouchDevice = false;
  eng.activeQuality = 'smooth';
  eng.activeRenderDist = 88;
  eng.localCharacterId = characterId;
  eng.settings = {
    quality: 'smooth',
    mouseSensitivity: 1.0,
    invertY,
    masterVolume: 0.7,
    musicVolume: 0.5,
    sfxVolume: 0.8,
    muted: true,
  };

  eng.currentLevel = def;
  eng.spatialGrid = new LevelSpatialGrid(def, 12);
  eng.scene = new THREE.Scene();
  eng.baseFogColor = new THREE.Color(def.fogColor);
  eng.underwaterFogColor = new THREE.Color(0x0b2a32);
  eng.baseFogDensity = def.fogDensity;
  eng.scene.fog = new THREE.FogExp2(def.fogColor, def.fogDensity);
  eng.scene.background = new THREE.Color(def.fogColor);
  eng.camera = new THREE.PerspectiveCamera(68, 16 / 9, 0.1, 145);
  eng.renderer = {
    domElement: { releasePointerCapture: () => {} },
    toneMappingExposure: 1.14,
    getContext: () => null,
    render: () => {},
  };
  eng.textures = textures;
  eng.uCausticEnabled = { value: 0 };
  eng.baseCausticEnabled = 0;
  eng.horrorVisualActive = false;
  eng.horrorVisualBlend = 0;
  eng.horrorSpotLight = null;
  eng.horrorPass = null;
  eng.pointLightPool = [];
  eng.levelLights = [];
  eng.hemiLight = null;
  eng.rimLight = null;
  eng.keyLight = null;
  eng.baseHemiColor = new THREE.Color(def.ambientTint);
  eng.baseHemiIntensity = 0.72;
  eng.baseRimIntensity = 0.46;
  eng.baseKeyIntensity = 1.25;

  eng.sound = {
    unlock: () => {},
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
    playJump: () => {},
    playLand: () => {},
    playSplash: () => {},
    playStep: () => {},
    playPlatformWarn: () => {},
    playPush: () => {},
    updateAudio: () => {},
    setVolumes: () => {},
  };

  const eventLog = {
    phaseChanges: [] as string[],
  };
  eng._testEvents = eventLog;

  eng.callbacks = {
    onHudUpdate: () => {},
    onPhaseChange: (phase: string) => {
      eventLog.phaseChanges.push(phase);
    },
  };

  eng.playerRig = createPlayerRig(textures, 0x52e0b6, false, characterId);
  eng.scene.add(eng.playerRig.root);
  eng.playerPos = new THREE.Vector3(def.spawn[0], def.spawn[1], def.spawn[2]);
  eng.playerVel = new THREE.Vector3();
  eng.playerYaw = Math.PI;
  eng.activeSpawn = new THREE.Vector3(def.spawn[0], def.spawn[1], def.spawn[2]);
  eng.activeCheckpointIndex = 0;
  eng.checkpointNotice = null;
  eng.checkpointNoticeTimer = 0;
  eng.levelTimeRemaining = def.timeLimit;
  eng.levelTimeElapsed = 0;
  eng.simTime = 1.0;
  eng.platformTime = 0;

  eng.camYaw = 0;
  eng.camPitch = 0.25;
  eng.camDist = 5.0;
  eng.camShake = 0;
  eng.lastCamThirdPerson = invertY;
  eng.pendingLookDx = 0;
  eng.pendingLookDy = 0;
  eng.activeDragPointerId = null;
  eng.isDraggingLook = false;

  eng.inWater = false;
  eng.wasInWater = false;
  eng.waterJumpTimer = 0;
  eng.waterJumpCooldown = 0;
  eng.coyoteTimer = 0;
  eng.jumpBufferTimer = 0;
  eng.stamina = 100;
  eng.exhausted = false;
  eng.grounded = false;
  eng.stoodPlatform = null;

  eng.lastAnimState = 'idle';
  eng.lastHorizSpeed = 0;
  eng.spRespawning = false;

  eng.deathReason = null;
  eng.jumpscareMonster = null;
  eng.jumpscareTimer = 0;
  eng.eatingCamSide = 1;

  eng.monsters = [];
  eng.staticChunks = [];
  eng.dynamicPlatforms = [];
  eng.checkpoints = [];
  eng.splashPool = [];
  eng.splashMaxActive = 0;
  eng.spawnSplash = () => {};
  eng.updateVisibilityCulling = () => {};
  eng.syncAudioListener = () => {};
  eng.swimSplashTimer = 0;
  eng.stepTimer = 0;
  eng.lastJumpInputAt = 0;
  eng.isWatchedFreezeActive = false;
  eng.watchFreezeGraceTimer = 0;
  eng.watchAnchorX = def.spawn[0];
  eng.watchAnchorZ = def.spawn[2];
  eng.watchMoveAttempted = false;
  eng.playerInWaterSession = false;
  eng.playerWaterEpoch = 0;
  eng.pendingClimbIntimidation = false;
  eng.heldKeys = new Set();
  eng.virtualMove = { x: 0, y: 0 };
  eng.virtualRun = false;
  eng.virtualAutoRun = false;

  eng.fpsRing = new Float64Array(32);
  eng.fpsRingIdx = 0;
  eng.fpsRingCount = 0;
  eng.slowFrameCount = 0;
  eng.highFpsStreak = 0;
  eng.qualityEvalTimer = 0;
  eng.qualityCooldownTimer = 0;
  eng.currentFps = 60;
  eng.isPointerLocked = false;
  eng._lastCullCamZ = NaN;
  eng._lastLightCamX = NaN;

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
    isMultiplayer: false,
    mpPortalWaiting: false,
    mpPortalReadyCount: -1,
    mpPortalTotalCount: -1,
    pushCooldown: -1,
    canPushTarget: false,
  };

  eng.switchLevelForTest = (nextLevelId: number) => {
    const nextDef = getLevelById(nextLevelId);
    eng.currentLevel = nextDef;
    eng.spatialGrid = new LevelSpatialGrid(nextDef, 12);
    eng.baseFogColor = new THREE.Color(nextDef.fogColor);
    eng.baseFogDensity = nextDef.fogDensity;
    eng.scene.fog = new THREE.FogExp2(nextDef.fogColor, nextDef.fogDensity);
    eng.scene.background = new THREE.Color(nextDef.fogColor);
    eng.walls = nextDef.walls.map((w: any) => ({
      centerX: w.position[0],
      centerZ: w.position[2],
      boundRadiusXZ: Math.hypot(w.size[0] * 0.5, w.size[2] * 0.5),
      minX: w.position[0] - w.size[0] * 0.5,
      maxX: w.position[0] + w.size[0] * 0.5,
      minY: w.position[1] - w.size[1] * 0.5,
      maxY: w.position[1] + w.size[1] * 0.5,
      minZ: w.position[2] - w.size[2] * 0.5,
      maxZ: w.position[2] + w.size[2] * 0.5,
    }));
    eng.platforms = nextDef.platforms.map((p: any) => {
      const q = new THREE.Quaternion();
      if (p.rotationSpeed) {
        q.setFromEuler(new THREE.Euler(0, p.rotationPhase ?? 0.6, 0, 'YXZ'));
      }
      return {
        def: p,
        mesh: new THREE.Object3D(),
        material: new THREE.MeshStandardMaterial(),
        baseColorHex: 0xb9c7ca,
        boundRadiusXZ: Math.hypot(p.size[0] * 0.5, p.size[2] * 0.5),
        currentPos: new THREE.Vector3(p.position[0], p.position[1], p.position[2]),
        prevPos: new THREE.Vector3(p.position[0], p.position[1], p.position[2]),
        currentQuat: q.clone(),
        prevQuat: q.clone(),
        invQuat: q.clone().invert(),
        prevInvQuat: q.clone().invert(),
        isRotated: Boolean(p.rotationSpeed),
        state: 'solid',
        stateTimer: 0,
      };
    });
    eng.dynamicPlatforms = eng.platforms.filter(
      (p: any) => p.def.kind !== 'static' || Boolean(p.def.rotationSpeed)
    );
    eng.activeCheckpointIndex = 0;
    eng.activeSpawn.set(nextDef.spawn[0], nextDef.spawn[1], nextDef.spawn[2]);
    eng.playerPos.copy(eng.activeSpawn);
    eng.playerVel.set(0, 0, 0);
    eng.levelTimeRemaining = nextDef.timeLimit;
    eng.groundPlayerOnSpawnPlatform();
    eng.snapPlayCameraImmediate();
  };

  eng.switchLevelForTest(levelId);
  return eng;
}

function makeMonster(id: string, textures: TextureBundle, x: number, y: number, z: number) {
  const rig = createMonsterRig(textures, 1.0);
  return {
    id,
    rig,
    pos: new THREE.Vector3(x, y, z),
    yaw: 0,
    targetYaw: 0,
    targetUserId: null as string | null,
    waypoints: [[x, z]] as [number, number][],
    wpIndex: 0,
    patrolSpeed: 4,
    chaseSpeed: 8,
    detectionRadius: 15,
    waterDetectionRadius: 24,
    scale: 1,
    alert: 'calm' as 'calm' | 'searching' | 'chasing',
    searchTarget: new THREE.Vector3(x, y, z),
    searchTimer: 0,
    velX: 0,
    velZ: 0,
    avoidDir: 1 as const,
    avoidTimer: 0,
    stuckTimer: 0,
    navBestDist: Infinity,
    navStallTimer: 0,
    navAnchorX: x,
    navAnchorZ: z,
    navAnchorTimer: 0,
    navTurnAccum: 0,
    emerged: false,
    wakeSplashTimer: 0,
    diveTimer: 0,
    eatingUserId: null as string | null,
    eatingTimer: 0,
    eatingProgress: -1,
    eatingPreyStartPos: new THREE.Vector3(),
    eatingPreyStartYaw: 0,
    eatingGulpStage: 0,
    eatingSwallowAudioPlayed: false,
    safeEpoch: 0,
    intimidationPhase: 'none' as const,
    intimidationTimer: 0,
    intimidationDuration: 0,
    intimidationSpot: new THREE.Vector3(),
    intimidationPlatform: null,
    intimidationLocalOffset: new THREE.Vector3(),
    intimidationYaw: 0,
    visionState: 'none' as const,
    visionTimer: 0,
    watchingUserId: null as string | null,
    lookAway: false,
    lookAwayYaw: 0,
  };
}

function assertPlayerRestoredAndPlayable(eng: any, label: string, invertY: boolean): void {
  const def = eng.currentLevel;
  assert.equal(eng.phase, 'playing', `${label}: phase must be 'playing' (never gameover/spectator)`);
  assert.equal(eng.deathReason, null, `${label}: deathReason must be cleared`);
  assert.equal(eng.jumpscareMonster, null, `${label}: jumpscareMonster must be cleared`);
  assert.equal(eng.spRespawning, false, `${label}: spRespawning lock must be released`);

  // Position & physics at level spawn
  assert.ok(
    Math.hypot(eng.playerPos.x - def.spawn[0], eng.playerPos.z - def.spawn[2]) < 0.85,
    `${label}: player must respawn at level ${def.id} spawn (${def.spawn[0]}, ${def.spawn[2]}), got (${eng.playerPos.x.toFixed(2)}, ${eng.playerPos.z.toFixed(2)})`
  );
  assert.ok(Number.isFinite(eng.playerPos.y), `${label}: playerPos.y must be finite`);
  assert.equal(eng.grounded, true, `${label}: player must be grounded on spawn deck`);
  assert.equal(eng.inWater, false, `${label}: respawned player must not be in water`);
  assert.equal(eng.isWatchedFreezeActive, false, `${label}: freeze flag must be cleared`);

  // Rig visibility & transform restoration
  assert.equal(eng.playerRig.root.parent, eng.scene, `${label}: playerRig.root must remain attached to scene`);
  assert.equal(eng.playerRig.root.visible, true, `${label}: playerRig.root.visible must be true`);
  assert.equal(eng.playerRig.hips.visible, true, `${label}: playerRig.hips.visible must be true`);
  assert.ok(
    Math.abs(eng.playerRig.root.scale.x - 1) < 1e-4 &&
      Math.abs(eng.playerRig.root.scale.y - 1) < 1e-4 &&
      Math.abs(eng.playerRig.root.scale.z - 1) < 1e-4,
    `${label}: playerRig scale must reset to 1, got ${eng.playerRig.root.scale.x}`
  );
  // Upright orientation (zero residual pitch/roll tilt from serpent jaws)
  const upVec = new THREE.Vector3(0, 1, 0).applyQuaternion(eng.playerRig.root.quaternion);
  assert.ok(upVec.y > 0.999, `${label}: playerRig must be upright after respawn, got up.y=${upVec.y}`);

  let visibleMeshCount = 0;
  let totalMeshCount = 0;
  eng.playerRig.root.traverse((obj: THREE.Object3D) => {
    if ((obj as THREE.Mesh).isMesh) {
      totalMeshCount++;
      if (obj.visible) visibleMeshCount++;
    }
  });
  assert.ok(totalMeshCount >= 35, `${label}: full player rig meshes must exist`);
  if (invertY) {
    assert.equal(visibleMeshCount, totalMeshCount, `${label}: all player meshes must be visible in 3P`);
  } else {
    assert.equal(visibleMeshCount, 0, `${label}: local meshes stay hidden for 1P camera`);
  }

  // Camera reconnected cleanly to newly spawned player
  assert.ok(Math.abs(eng.camera.up.y - 1) < 1e-4 && Math.abs(eng.camera.up.x) < 1e-4, `${label}: camera.up reset`);
  assert.equal(eng.camera.fov, 68, `${label}: camera.fov restored to 68`);
  const camToPlayer = Math.hypot(
    eng.camera.position.x - eng.playerPos.x,
    eng.camera.position.z - eng.playerPos.z
  );
  const maxCamDist = invertY ? 6.5 : 0.6;
  assert.ok(
    camToPlayer <= maxCamDist,
    `${label}: camera must follow newly spawned player (dist=${camToPlayer.toFixed(2)} <= ${maxCamDist})`
  );

  // Camera rotation + immediate player movement verification
  const camYawBefore = eng.camYaw;
  eng.rotateCameraByDelta(120, 40);
  assert.notEqual(eng.camYaw, camYawBefore, `${label}: camera rotation input must respond immediately`);

  const startX = eng.playerPos.x;
  const startZ = eng.playerPos.z;
  const camStartZ = eng.camera.position.z;
  eng.heldKeys.add('KeyW');
  for (let i = 0; i < 6; i++) {
    eng.simTime += 0.03;
    eng.updatePlayer(0.03);
    eng.updatePlayCamera(0.03);
  }
  eng.heldKeys.clear();
  const movedDist = Math.hypot(eng.playerPos.x - startX, eng.playerPos.z - startZ);
  assert.ok(movedDist > 0.35, `${label}: player must move immediately on KeyW after respawn (moved=${movedDist.toFixed(3)})`);
  const camMovedDist = Math.hypot(eng.camera.position.z - camStartZ, eng.camera.position.x - startX);
  assert.ok(camMovedDist > 0.25, `${label}: camera must follow player motion immediately`);
}

function testSinglePlayerRepeatedDeathsAcrossLevels(textures: TextureBundle): void {
  for (const invertY of [true, false]) {
    const modeLabel = invertY ? 'SP-3P' : 'SP-1P';
    const eng = createDeathRespawnEngineHarness(1, textures, invertY, invertY ? 'male' : 'female');
    const waterY = eng.currentLevel.bounds.waterY;
    const m1 = makeMonster('sp-m1', textures, 12, waterY - 0.14, -45);
    eng.monsters = [m1];

    // Repeat 3 deaths on Level 1 (simulating moving far away into water & activating a checkpoint before dying)
    for (let kill = 1; kill <= 3; kill++) {
      eng.activeCheckpointIndex = 1;
      eng.activeSpawn.set(8, 1.5, -60);
      eng.playerPos.set(14, waterY - 0.3, -72);
      eng.inWater = true;
      eng.grounded = false;
      eng.stoodPlatform = null;
      m1.pos.set(12, waterY - 0.14, -70);

      eng.triggerDeath('caught', m1);
      assert.equal(eng.phase, 'jumpscare', `${modeLabel} kill#${kill}: entered jumpscare`);
      // Duplicate triggerDeath while already in jumpscare must be ignored
      eng.triggerDeath('caught', m1);
      assert.equal(m1.eatingUserId, '__local__');

      // Step through full devouring sequence
      const stepDt = 0.05;
      const totalSteps = Math.ceil((EAT_DURATION_MS / 1000) / stepDt) + 2;
      for (let s = 0; s < totalSteps && eng.phase === 'jumpscare'; s++) {
        eng.simTime += stepDt;
        eng.updateJumpscare(stepDt);
      }

      assert.equal(m1.eatingUserId, null, `${modeLabel} kill#${kill}: monster released eatingUserId`);
      assert.equal(eng.activeCheckpointIndex, 0, `${modeLabel} kill#${kill}: checkpoint reset to 0`);
      assertPlayerRestoredAndPlayable(eng, `${modeLabel} L1 kill#${kill}`, invertY);
    }

    // Also verify timeout death auto-respawns cleanly
    eng.playerPos.set(10, waterY - 0.25, -45);
    eng.triggerDeath('timeout', null);
    assert.equal(eng.phase, 'jumpscare');
    for (let s = 0; s < 30 && eng.phase === 'jumpscare'; s++) {
      eng.simTime += 0.05;
      eng.updateJumpscare(0.05);
    }
    assertPlayerRestoredAndPlayable(eng, `${modeLabel} L1 timeout`, invertY);

    // Advance to later levels (Level 2 and Level 5) and kill the player twice on each!
    for (const laterLevelId of [2, 5]) {
      eng.switchLevelForTest(laterLevelId);
      const wy = eng.currentLevel.bounds.waterY;
      m1.pos.set(6, wy - 0.14, -55);
      for (let kill = 1; kill <= 2; kill++) {
        eng.playerPos.set(6, wy - 0.3, -58);
        eng.inWater = true;
        eng.grounded = false;
        eng.triggerDeath('caught', m1);
        assert.equal(eng.phase, 'jumpscare');
        for (let s = 0; s < 60 && eng.phase === 'jumpscare'; s++) {
          eng.simTime += 0.05;
          eng.updateJumpscare(0.05);
        }
        assertPlayerRestoredAndPlayable(eng, `${modeLabel} L${laterLevelId} kill#${kill}`, invertY);
      }
    }

    m1.rig.dispose();
    eng.playerRig.dispose();
  }
}

function run(): void {
  const prevDoc = (globalThis as { document?: unknown }).document;
  if (typeof prevDoc === 'undefined') {
    (globalThis as { document?: unknown }).document = {
      pointerLockElement: null,
      exitPointerLock: () => {},
      createElement: () => ({
        width: 256,
        height: 64,
        getContext: () => null,
      }),
    };
  }
  const textures = createMockTextures();
  try {
    testSinglePlayerRepeatedDeathsAcrossLevels(textures);
    console.log('ALL SINGLE-PLAYER DEATH-TO-RESPAWN LIFECYCLE TESTS PASSED!');
  } finally {
    disposeEntityResources(textures);
    if (typeof prevDoc === 'undefined') {
      delete (globalThis as { document?: unknown }).document;
    }
  }
}

run();
