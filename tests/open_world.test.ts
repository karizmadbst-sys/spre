import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { createAppServer } from '../server.ts';
import { createPlayerRig, disposeEntityResources } from '../src/game/entities.ts';
import { PoolGameEngine } from '../src/game/engine.ts';
import {
  OPEN_WORLD_BOUNDS,
  OPEN_WORLD_REGION_COUNT,
  OPEN_WORLD_SPAWN,
  computeOpenWorldSpawnSlot,
  findReachableWorldCheckpoint,
  getAllWorldCheckpoints,
  getAllWorldConnectors,
  getConnectorIdsForRegions,
  getNearbyWorldRegionIds,
  getWorldCheckpointById,
  getWorldConnectorDef,
  getWorldRegionAtPos,
  getWorldRegionDef,
  getWorldRegionMeta,
  getWorldRegionMetas,
  isOpenWorldPlayerInWater,
  isOpenWorldPlayerOnPlatform,
  resolveOpenWorldCircleSolids3D,
} from '../src/game/openWorld.ts';
import type { TextureBundle } from '../src/game/textures.ts';
import type { HudSnapshot } from '../src/game/types.ts';

if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = { devicePixelRatio: 1 };
}
if (typeof (globalThis as any).document === 'undefined') {
  const mkGrad = () => ({ addColorStop: () => {} });
  const ctxProxy = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return mkGrad;
        if (prop === 'createPattern') return () => null;
        if (prop === 'getImageData') {
          return (_x: number, _y: number, w = 4, h = 4) => ({
            data: new Uint8ClampedArray(Math.max(1, w * h * 4)),
          });
        }
        if (prop === 'createImageData') {
          return (w = 4, h = 4) => ({
            data: new Uint8ClampedArray(Math.max(1, w * h * 4)),
          });
        }
        if (prop === 'measureText') return () => ({ width: 40 });
        return () => {};
      },
    }
  );
  (globalThis as any).document = {
    hidden: false,
    pointerLockElement: null,
    exitPointerLock: () => {},
    createElement: () => ({
      width: 256,
      height: 64,
      style: {},
      getContext: () => ctxProxy,
    }),
  };
}

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

function testOpenWorldTopologyAndPhysics(): void {
  const metas = getWorldRegionMetas();
  assert.equal(OPEN_WORLD_REGION_COUNT, 100);
  assert.equal(metas.length, 100, 'Open World must contain all 100 regions');

  // Verify BFS graph connectivity from Region 1 covers every single region
  const visited = new Set<number>([1]);
  const queue = [1];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const meta = getWorldRegionMeta(cur);
    assert.ok(meta.doorways.length >= 1, `Region ${cur} must have at least one doorway`);
    assert.ok(
      meta.spawn[0] >= meta.bounds.minX &&
        meta.spawn[0] <= meta.bounds.maxX &&
        meta.spawn[2] >= meta.bounds.minZ &&
        meta.spawn[2] <= meta.bounds.maxZ,
      `Region ${cur} spawn must lie within region bounds`
    );
    for (const nextId of meta.connectedRegionIds) {
      const nextMeta = getWorldRegionMeta(nextId);
      assert.ok(
        nextMeta.connectedRegionIds.includes(cur),
        `Doorway link ${cur} -> ${nextId} must be bidirectional`
      );
      if (!visited.has(nextId)) {
        visited.add(nextId);
        queue.push(nextId);
      }
    }
  }
  assert.equal(visited.size, 100, 'All 100 Open World regions must form one connected graph');

  // Verify connectors & checkpoints
  const connectors = getAllWorldConnectors();
  assert.ok(connectors.length >= 99, `Expected >= 99 connectors, got ${connectors.length}`);
  for (const c of connectors) {
    assert.ok(getWorldConnectorDef(c.id) === c, `Connector ${c.id} lookup mismatch`);
    assert.ok(c.floorBoxes.length > 0, `Connector ${c.id} must have floor boxes`);
    assert.ok(c.platforms.length > 0, `Connector ${c.id} must have walkway/bridge platforms`);
  }

  const checkpoints = getAllWorldCheckpoints();
  assert.ok(checkpoints.length >= 100, `Expected >= 100 checkpoints, got ${checkpoints.length}`);
  for (const cp of checkpoints) {
    assert.equal(getWorldCheckpointById(cp.id)?.id, cp.id);
    assert.equal(findReachableWorldCheckpoint(cp.x, cp.y, cp.z)?.id, cp.id);
  }

  // Verify OPEN_WORLD_SPAWN & multi-slot spawns stand on solid ground & out of water
  const spawnMeta = getWorldRegionAtPos(OPEN_WORLD_SPAWN.x, OPEN_WORLD_SPAWN.z);
  assert.equal(spawnMeta.regionId, 1);
  assert.equal(
    isOpenWorldPlayerOnPlatform(OPEN_WORLD_SPAWN.x, OPEN_WORLD_SPAWN.y, OPEN_WORLD_SPAWN.z, 0, false),
    true,
    'OPEN_WORLD_SPAWN must be grounded on a platform'
  );
  assert.equal(
    isOpenWorldPlayerInWater(OPEN_WORLD_SPAWN.x, OPEN_WORLD_SPAWN.y, OPEN_WORLD_SPAWN.z, false, 0),
    false,
    'OPEN_WORLD_SPAWN must not be in water'
  );

  for (let i = 0; i < 4; i++) {
    const slot = computeOpenWorldSpawnSlot(i, 4);
    assert.equal(
      isOpenWorldPlayerOnPlatform(slot.x, slot.y, slot.z, 0, false),
      true,
      `Open World spawn slot ${i} must be grounded on a platform`
    );
  }

  // Verify 3D monster solid resolution keeps serpent inside global bounds
  const mSample = { x: OPEN_WORLD_SPAWN.x, y: -0.14, z: OPEN_WORLD_SPAWN.z, velX: 3, velZ: -3 };
  resolveOpenWorldCircleSolids3D(mSample, 0.85, -0.8, 0.6, 0, OPEN_WORLD_BOUNDS.waterY);
  assert.ok(Number.isFinite(mSample.x) && Number.isFinite(mSample.z));
  assert.ok(getNearbyWorldRegionIds(OPEN_WORLD_SPAWN.x, OPEN_WORLD_SPAWN.z, 180).includes(1));
  assert.ok(getConnectorIdsForRegions([1, 2]).length >= 1);

  console.log(
    `1. PASS: Open World topology verified (${metas.length} connected regions, ${connectors.length} connectors, ${checkpoints.length} checkpoints).`
  );
}

function createOpenWorldEngineHarness(textures: TextureBundle) {
  const eng = Object.create(PoolGameEngine.prototype) as any;
  const hudHistory: HudSnapshot[] = [];

  eng.disposed = false;
  eng.suspended = false;
  eng.contextLost = false;
  eng.overlayOccluded = false;
  eng.pendingSync = false;
  eng.rafId = 1;
  eng.timerId = 0;
  eng.phase = 'playing';
  eng.isSoftwareGl = true;
  eng.isLowEndGpu = false;
  eng.isTouchDevice = false;
  eng.activeQuality = 'smooth';
  eng.activeRenderDist = 96;
  eng.activePointLightLimit = 2;
  eng.dynamicResScale = 1.0;
  eng.localCharacterId = 'male';
  eng.settings = {
    quality: 'smooth',
    mouseSensitivity: 1.0,
    invertY: true,
    touchControls: 'auto',
    masterVolume: 0.7,
    musicVolume: 0.5,
    sfxVolume: 0.8,
    muted: true,
    voiceEnabled: false,
    voiceVolume: 0.8,
  };

  eng.scene = new THREE.Scene();
  eng.levelGroup = new THREE.Group();
  eng.scene.add(eng.levelGroup);
  eng.camera = new THREE.PerspectiveCamera(68, 16 / 9, 0.1, 155);
  eng.renderer = {
    domElement: {
      clientWidth: 1280,
      clientHeight: 720,
      releasePointerCapture: () => {},
    },
    shadowMap: { enabled: false, autoUpdate: false, type: THREE.PCFShadowMap },
    capabilities: { getMaxAnisotropy: () => 4 },
    setPixelRatio: () => {},
    getPixelRatio: () => 1,
    setSize: () => {},
    toneMappingExposure: 1.14,
    getContext: () => null,
    render: () => {},
  };
  eng.composer = null;
  eng.horrorPass = null;
  eng.textures = textures;
  eng.uCausticEnabled = { value: 0 };
  eng.uCausticRangeSq = { value: 40 * 40 };
  eng.uCausticTime = { value: 0 };
  eng.uMistTime = { value: 0 };
  eng.uWaterQuality = { value: 0 };
  eng.uTexelSize = { value: new THREE.Vector2(1 / 1280, 1 / 720) };
  eng.uVignette = { value: 0 };
  eng.dustPoints = null;
  eng.dustMat = null;
  eng.baseCausticEnabled = 0;
  eng.horrorVisualActive = false;
  eng.horrorVisualBlend = 0;
  eng.horrorSpotLight = null;
  eng.baseFogColor = new THREE.Color('#0c1e24');
  eng.underwaterFogColor = new THREE.Color(0x0b2a32);
  eng.baseFogDensity = 0.015;
  eng.baseHemiColor = new THREE.Color('#5a808a');
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

  const savedCheckpoints: string[] = [];
  eng.callbacks = {
    onHudUpdate: (snap: HudSnapshot) => {
      hudHistory.push(snap);
    },
    onPhaseChange: () => {},
    onOpenWorldCheckpoint: (cpId: string) => {
      savedCheckpoints.push(cpId);
    },
  };
  eng._hudHistory = hudHistory;
  eng._savedCheckpoints = savedCheckpoints;

  eng.playerRig = createPlayerRig(textures, 0x52e0b6, false, 'male');
  eng.scene.add(eng.playerRig.root);
  eng.playerPos = new THREE.Vector3();
  eng.playerVel = new THREE.Vector3();
  eng.playerYaw = Math.PI;
  eng.activeSpawn = new THREE.Vector3();
  eng.activeWorldMode = 'sector';
  eng.owChunks = new Map();
  eng.owMaterials = null;
  eng.owCheckpointMeta = new Map();
  eng.owActivatedCheckpointIds = new Set();
  eng.owCurrentRegionId = 1;
  eng.owCheckpointId = null;
  eng.owCheckpointRegionId = 1;
  eng.owCheckpointLabel = null;
  eng.owCheckpointYaw = Math.PI;
  eng.owLastStreamX = NaN;
  eng.owLastStreamZ = NaN;
  eng.owTargetAtmo = null;

  eng.activeCheckpointIndex = 0;
  eng.checkpointNotice = null;
  eng.checkpointNoticeTimer = 0;
  eng.levelTimeRemaining = 0;
  eng.levelTimeElapsed = 0;
  eng.simTime = 0;
  eng.platformTime = 0;
  eng.camYaw = 0;
  eng.camPitch = 0.25;
  eng.camDist = 5.0;
  eng.camShake = 0;
  eng.lastCamThirdPerson = true;
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
  eng.heldKeys = new Set();
  eng.virtualMove = { x: 0, y: 0 };
  eng.virtualRun = false;
  eng.virtualAutoRun = false;
  eng.monsters = [];
  eng.platforms = [];
  eng.dynamicPlatforms = [];
  eng.walls = [];
  eng.staticChunks = [];
  eng.checkpoints = [];
  eng.levelLights = [];
  eng.pointLightPool = [];
  eng.levelDisposables = [];
  eng.levelShadowReceivers = [];
  eng.levelQualityMaterials = [];
  eng.splashPool = [];
  eng.splashMaxActive = 0;
  eng.exitPortal = null;
  eng.waterMesh = null;
  eng.waterMat = null;
  eng.hemiLight = null;
  eng.rimLight = null;
  eng.keyLight = null;
  eng._lastCullCamX = NaN;
  eng._lastCullCamZ = NaN;
  eng._lastLightCamX = NaN;
  eng._lastLightCamZ = NaN;
  eng.currentFps = 60;
  eng.isPointerLocked = false;
  eng.deathReason = null;
  eng.lastHudSnap = {
    levelId: -1,
    worldMode: undefined,
    regionId: -1,
    wingIndex: -1,
    wingTitle: '',
    checkpointId: null,
    checkpointRegionId: -1,
    checkpointLabel: null,
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
  eng.waterOrigNormalMap = null;
  eng._appliedPixelRatio = 0;
  eng._appliedViewportW = 0;
  eng._appliedViewportH = 0;
  eng._appliedShadowEnabled = null;
  eng._appliedShadowType = null;
  return eng;
}

function testEngineOpenWorldLifecycleAndStreaming(): void {
  const textures = createMockTextures();
  const eng = createOpenWorldEngineHarness(textures);

  eng.loadOpenWorld('playing', true);
  assert.equal(eng.activeWorldMode, 'open_world');
  assert.equal(eng.getActiveBounds(), OPEN_WORLD_BOUNDS);
  assert.ok(eng.owChunks.has('r_1'), 'Region 1 chunk must mount on initial load');
  assert.ok(eng.owChunks.has('r_2'), 'Neighboring Region 2 chunk must mount on initial load');
  assert.ok(eng.waterMesh, 'Open World water mesh must exist');
  assert.equal(Math.abs(eng.waterMesh.position.x % 85), 0, 'Water mesh X must snap to 85m UV period');
  assert.equal(Math.abs(eng.waterMesh.position.z % 85), 0, 'Water mesh Z must snap to 85m UV period');

  // Initial HUD check
  const initHud = eng._hudHistory[eng._hudHistory.length - 1] as HudSnapshot;
  assert.equal(initHud.worldMode, 'open_world');
  assert.equal(initHud.regionId, 1);

  // checkExit must be a safe no-op in Open World
  eng.checkExit();
  assert.equal(eng.phase, 'playing');

  // Activate a Region 2 checkpoint
  const r2Def = getWorldRegionDef(2);
  const r2Cp = r2Def.worldCheckpoints[0];
  assert.ok(r2Cp, 'Region 2 must have a world checkpoint');
  eng.playerPos.set(r2Cp.x, r2Cp.y, r2Cp.z);
  eng.updateOpenWorldStreaming(false);
  eng.updateCheckpoints(0.05);

  assert.equal(eng.owCheckpointId, r2Cp.id);
  assert.equal(eng.owCheckpointRegionId, r2Cp.regionId);
  assert.equal(eng.owCheckpointLabel, r2Cp.label);
  assert.equal(eng.owActivatedCheckpointIds.has(r2Cp.id), true);

  const cpHud = eng._hudHistory[eng._hudHistory.length - 1] as HudSnapshot;
  assert.equal(cpHud.checkpointId, r2Cp.id);
  assert.equal(cpHud.checkpointLabel, r2Cp.label);

  // Move far away to Region 50 -> verify far Region 1 unmounts & Region 50 mounts & water snaps
  const r50Meta = getWorldRegionMeta(50);
  eng.playerPos.set(r50Meta.spawn[0], r50Meta.spawn[1], r50Meta.spawn[2]);
  eng.camera.position.set(r50Meta.spawn[0], r50Meta.spawn[1] + 2, r50Meta.spawn[2] + 5);
  eng.updateOpenWorldStreaming(false);
  eng.updateEnvironmentFX(0.05);

  assert.equal(eng.owCurrentRegionId, 50);
  assert.equal(eng.owChunks.has('r_50'), true, 'Region 50 chunk must mount on travel');
  assert.equal(eng.owChunks.has('r_1'), false, 'Far Region 1 chunk must unmount on travel');
  assert.equal(Math.abs(eng.waterMesh.position.x % 85), 0);
  assert.equal(Math.abs(eng.waterMesh.position.z % 85), 0);
  assert.ok(Math.abs(eng.waterMesh.position.x - eng.camera.position.x) <= 43);
  assert.ok(Math.abs(eng.waterMesh.position.z - eng.camera.position.z) <= 43);

  // Single-player respawn after death must return to the activated Region 2 checkpoint, not Region 1
  eng.respawnSinglePlayerAtLevelStart('caught');
  assert.equal(eng.phase, 'playing');
  assert.ok(
    Math.hypot(eng.playerPos.x - r2Cp.x, eng.playerPos.z - r2Cp.z) < 0.1,
    'Open World SP respawn must place player at latest activated checkpoint'
  );
  assert.equal(eng.owChunks.has('r_2'), true, 'Region 2 must be re-mounted after respawn');
  assert.equal(eng.owActivatedCheckpointIds.has(r2Cp.id), true, 'Activated checkpoint set must persist');
  assert.ok(eng._savedCheckpoints.includes(r2Cp.id), 'onOpenWorldCheckpoint callback must fire for Region 2 checkpoint');

  // Restoring from savedCheckpointId on a fresh Single-Player Open World session must spawn directly at Region 2 checkpoint
  eng.loadOpenWorld('playing', true, undefined, r2Cp.id);
  assert.equal(eng.owCheckpointId, r2Cp.id, 'Saved Open World checkpoint must restore on load');
  assert.equal(eng.owCurrentRegionId, r2Cp.regionId);
  assert.ok(
    Math.hypot(eng.playerPos.x - r2Cp.x, eng.playerPos.z - r2Cp.z) < 0.1,
    'Restoring Open World from saved checkpoint must spawn player at saved checkpoint coordinates'
  );
  assert.equal(eng.owChunks.has(`r_${r2Cp.regionId}`), true, 'Target region chunk must stream immediately on checkpoint restore');

  // Fresh restart must reset back to Region 01 Entry Dock
  eng.loadOpenWorld('playing', true);
  assert.equal(eng.owCheckpointId, null);
  assert.equal(eng.owCurrentRegionId, 1);

  eng.clearLevel();
  eng.playerRig.dispose();
  disposeEntityResources(textures);
  textures.dispose();
  console.log('2. PASS: Engine Open World loading, chunk mount/unmount, water UV snapping, HUD & checkpoint persistence/respawn verified.');
}

async function testSinglePlayerOpenWorldUIAndServer(): Promise<void> {
  const root = process.cwd();
  const modalsSrc = fs.readFileSync(path.join(root, 'src/components/Modals.tsx'), 'utf8');
  const appSrc = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
  const hudSrc = fs.readFileSync(path.join(root, 'src/components/GameHud.tsx'), 'utf8');
  const touchSrc = fs.readFileSync(path.join(root, 'src/components/TouchControls.tsx'), 'utf8');

  // Main Menu must keep Open World button and completely remove Multiplayer
  const mainMenuBlock = modalsSrc.slice(modalsSrc.indexOf('export const MainMenu'), modalsSrc.indexOf('LEVEL SELECT MODAL'));
  assert.ok(mainMenuBlock.includes('onPlayOpenWorld'), 'MainMenu must accept onPlayOpenWorld prop');
  assert.ok(/\bOpen World\b/i.test(mainMenuBlock), 'MainMenu must display the Open World button');
  assert.equal(/\bMultiplayer\b/i.test(mainMenuBlock), false, 'MainMenu must NOT show Multiplayer');
  assert.equal(/\bVoice\b/i.test(modalsSrc), false, 'Modals must NOT contain Voice Chat controls');
  assert.equal(appSrc.includes('MultiplayerModal'), false, 'App must NOT import MultiplayerModal');
  assert.equal(appSrc.includes('MultiplayerClient'), false, 'App must NOT import MultiplayerClient');
  assert.equal(appSrc.includes('handleStartOpenWorld'), true, 'App must support Single-Player Open World launch');
  assert.equal(hudSrc.includes('onTriggerPush'), false, 'GameHud must NOT contain multiplayer push controls');
  assert.equal(touchSrc.includes("emitAction('push'"), false, 'TouchControls must NOT expose multiplayer push');
  assert.equal(fs.existsSync(path.join(root, 'src/multiplayer')), false, 'src/multiplayer directory must be removed');
  assert.equal(fs.existsSync(path.join(root, 'src/components/MultiplayerModal.tsx')), false, 'MultiplayerModal.tsx must be removed');
  assert.equal(fs.existsSync(path.join(root, 'server')), false, 'multiplayer server directory must be removed');

  // Single-Player server starts cleanly with /api/health and zero multiplayer dependencies
  const srv = await createAppServer({ attachVite: false });
  await new Promise<void>((resolve) => srv.server.listen(0, '127.0.0.1', () => resolve()));
  const addr = srv.server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;
  try {
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    const body = (await healthRes.json()) as { ok: boolean };
    assert.equal(body.ok, true);
  } finally {
    await srv.close();
  }
  console.log('3. PASS: Single-Player Open World MainMenu, offline architecture & server health verified.');
}

(async () => {
  testOpenWorldTopologyAndPhysics();
  testEngineOpenWorldLifecycleAndStreaming();
  await testSinglePlayerOpenWorldUIAndServer();
  console.log('\nALL SINGLE-PLAYER OPEN WORLD TOPOLOGY, STREAMING, CHECKPOINT & UI TESTS PASSED!');
  process.exit(0);
})().catch((err) => {
  console.error('\nOPEN WORLD TEST FAILED:', err);
  process.exit(1);
});
