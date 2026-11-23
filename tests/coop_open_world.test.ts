import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import WebSocket from 'ws';
import { CoopHubDO } from '../cloudflare/src/index.ts';
import { createAppServer } from '../server.ts';
import {
  CoopClient,
  normalizeCoopWsUrl,
  type CoopPendingAction,
} from '../src/coop/CoopClient.ts';
import { COOP_MAX_PLAYERS, type CoopPlayerSnapshot } from '../src/coop/types.ts';
import { PoolGameEngine } from '../src/game/engine.ts';
import { createPlayerRig, disposeEntityResources } from '../src/game/entities.ts';
import {
  getAllWorldCheckpoints,
  getWorldRegionDef,
  getWorldRegionMeta,
  OPEN_WORLD_SPAWN,
} from '../src/game/openWorld.ts';
import type { TextureBundle } from '../src/game/textures.ts';
import type { CharacterId, HudSnapshot } from '../src/game/types.ts';

if (typeof (globalThis as { window?: unknown }).window === 'undefined') {
  (globalThis as { window?: unknown }).window = { devicePixelRatio: 1 };
}
if (typeof (globalThis as { document?: unknown }).document === 'undefined') {
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
  (globalThis as { document?: unknown }).document = {
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
    markAllDirty: () => {},
    dispose: () => {},
  };
}

async function waitFor<T>(
  predicate: () => T | null | undefined | false,
  timeoutMs = 7000,
  label = 'condition'
): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = predicate();
    if (res) return res;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error(`Timed out waiting for: ${label}`);
}

function createFullOpenWorldHarnessEngine(
  textures: TextureBundle,
  characterId: CharacterId = 'male'
) {
  const eng = Object.create(PoolGameEngine.prototype) as any;
  const hudHistory: HudSnapshot[] = [];

  eng.disposed = false;
  eng.suspended = false;
  eng.contextLost = false;
  eng.overlayOccluded = false;
  eng.pendingSync = false;
  eng.rafId = 1; // avoid browser RAF loops in Node
  eng.timerId = 0;
  eng.phase = 'menu';
  eng.isSoftwareGl = true;
  eng.isLowEndGpu = true;
  eng.isTouchDevice = false;
  eng.activeQuality = 'smooth';
  eng.activeRenderDist = 96;
  eng.activePointLightLimit = 2;
  eng.dynamicResScale = 1.0;
  eng.localCharacterId = characterId;
  eng.settings = {
    quality: 'smooth',
    mouseSensitivity: 1.0,
    invertY: true,
    touchControls: 'off',
    masterVolume: 0.7,
    musicVolume: 0.5,
    sfxVolume: 0.8,
    muted: true,
  };

  eng.scene = new THREE.Scene();
  eng.levelGroup = new THREE.Group();
  eng.scene.add(eng.levelGroup);
  eng.camera = new THREE.PerspectiveCamera(68, 16 / 9, 0.1, 200);
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
    compile: () => {},
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
  eng.underwaterFogColor = new THREE.Color('#0b2a32');
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
    prewarmAsync: async () => {},
  };

  eng.callbacks = {
    onHudUpdate: (snap: HudSnapshot) => {
      hudHistory.push(snap);
    },
    onPhaseChange: () => {},
  };
  eng._hudHistory = hudHistory;

  eng.playerRig = createPlayerRig(textures, 0x52e0b6, false, characterId);
  eng.scene.add(eng.playerRig.root);
  eng.playerPos = new THREE.Vector3();
  eng.playerVel = new THREE.Vector3();
  eng.playerYaw = Math.PI;
  eng.activeSpawn = new THREE.Vector3();
  eng.activeWorldMode = 'sector';
  eng.currentLevel = getWorldRegionDef(1);
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
  eng.coopMode = false;
  eng.coopLocalPlayerId = null;
  eng.coopDeathSeq = 0;
  eng.coopRespawnSentForSeq = 0;
  eng.coopRespawnAppliedForSeq = 0;
  eng.coopEmitTimer = 0;

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
  eng.splashMesh = {
    userData: { hadActive: false },
    count: 0,
    setMatrixAt: () => {},
    instanceMatrix: { needsUpdate: false },
  };
  eng.ensureLoopRunning = () => {};
  eng.prewarmSceneShaders = () => {};
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
  eng.jumpscareTimer = 0;
  eng.jumpscareMonster = null;
  eng.playerWaterEpoch = 0;
  eng.playerInWaterSession = false;
  eng.pendingClimbIntimidation = false;
  eng.isWatchedFreezeActive = false;
  eng.watchFreezeGraceTimer = 0;
  eng.watchMoveAttempted = false;
  eng.watchAnchorX = 0;
  eng.watchAnchorZ = 0;
  eng.lastHudSnap = {
    levelId: -1,
    worldMode: '',
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

  return eng;
}

test('TEST A–F: Live multi-client Co-Op Open World join-by-code, mutual visibility, multi-region streaming (R10/R20), independent checkpoints & auto-respawn, reconnect without duplicates, PC+Android, and Vite WS upgrade', async () => {
  const srv = await createAppServer({ attachVite: true });
  await new Promise<void>((resolve) => srv.server.listen(0, '127.0.0.1', () => resolve()));
  const addr = srv.server.address() as { port: number };
  const baseHttp = `http://127.0.0.1:${addr.port}`;
  const wsUrl = `ws://127.0.0.1:${addr.port}/ws/coop`;

  const textures = createMockTextures();
  const engA = createFullOpenWorldHarnessEngine(textures, 'male');
  const engB = createFullOpenWorldHarnessEngine(textures, 'female');

  const errorsA: string[] = [];
  const errorsB: string[] = [];
  const pendingHistoryA: CoopPendingAction[] = [];
  const reconnectRestoresB: number[] = [];

  const clientA = new CoopClient({
    playerId: 'pc_player_alpha',
    name: 'DiverAlpha',
    characterId: 'male',
    platform: 'pc',
    wsUrl,
    webSocketFactory: (u) => new WebSocket(u) as unknown as globalThis.WebSocket,
    callbacks: {
      onPendingActionChange: (act) => pendingHistoryA.push(act),
      onSessionState: (session) => {
        if (engA.isCoopMode()) {
          engA.syncCoopPlayers(session.players);
        }
      },
      onPlayerJoined: () => {
        if (clientA.session && engA.isCoopMode()) {
          engA.syncCoopPlayers(clientA.session.players);
        }
      },
      onPlayerLeft: () => {
        if (clientA.session && engA.isCoopMode()) {
          engA.syncCoopPlayers(clientA.session.players);
        }
      },
      onPlayerConnection: (playerId, connected) => {
        engA.applyCoopPlayerConnection(playerId, connected);
      },
      onPlayerMoved: (move) => {
        engA.updateCoopPlayerMove(move);
      },
      onPlayerEaten: (ev) => {
        engA.applyCoopPlayerEaten(ev);
      },
      onPlayerRespawn: (respawn) => {
        engA.applyCoopPlayerRespawn(respawn);
      },
      onError: (e) => errorsA.push(`${e.code}:${e.message}`),
    },
  });

  const clientB = new CoopClient({
    playerId: 'android_player_beta',
    name: 'DiverBeta',
    characterId: 'female',
    platform: 'android',
    wsUrl,
    webSocketFactory: (u) => new WebSocket(u) as unknown as globalThis.WebSocket,
    callbacks: {
      onSessionState: (session, you, reconnectRestore) => {
        if (reconnectRestore) {
          reconnectRestoresB.push(session.players.length);
          engB.setCoopMode(true, you.playerId);
          engB.syncCoopPlayers(session.players);
        }
      },
      onPlayerJoined: () => {
        if (clientB.session && engB.isCoopMode()) {
          engB.syncCoopPlayers(clientB.session.players);
        }
      },
      onPlayerLeft: () => {
        if (clientB.session && engB.isCoopMode()) {
          engB.syncCoopPlayers(clientB.session.players);
        }
      },
      onPlayerConnection: (playerId, connected) => {
        engB.applyCoopPlayerConnection(playerId, connected);
      },
      onPlayerMoved: (move) => {
        engB.updateCoopPlayerMove(move);
      },
      onPlayerEaten: (ev) => {
        engB.applyCoopPlayerEaten(ev);
      },
      onPlayerRespawn: (respawn) => {
        engB.applyCoopPlayerRespawn(respawn);
      },
      onError: (e) => errorsB.push(`${e.code}:${e.message}`),
    },
  });

  const extraClients: CoopClient[] = [];

  try {
    // Verify live HTTP endpoints alongside Vite middleware
    const healthRes = await fetch(`${baseHttp}/api/health`);
    assert.equal(healthRes.status, 200);
    const health = (await healthRes.json()) as { ok: boolean; coop: boolean };
    assert.equal(health.ok, true);
    assert.equal(health.coop, true);

    const missingCodeRes = await fetch(`${baseHttp}/api/coop/session/NOPE99`);
    assert.equal(missingCodeRes.status, 404);

    // ------------------------------------------------------------------
    // TEST A: Client A creates session -> Client B joins using Join Code
    // ------------------------------------------------------------------
    clientA.createSession(null);
    const createdA = await waitFor(() => clientA.session, 5000, 'Client A creates session');
    assert.ok(createdA.sessionId.length >= 4);
    assert.ok(createdA.sessionCode.length >= 6);
    assert.equal(createdA.players.length, 1);
    assert.ok(pendingHistoryA.includes('create'));
    assert.equal(clientA.pendingAction, null);

    // Confirm REST session lookup returns valid room metadata
    const lookupRes = await fetch(`${baseHttp}/api/coop/session/${createdA.sessionCode}`);
    assert.equal(lookupRes.status, 200);
    const lookupJson = (await lookupRes.json()) as {
      exists: boolean;
      sessionId: string;
      sessionCode: string;
      playerCount: number;
    };
    assert.equal(lookupJson.exists, true);
    assert.equal(lookupJson.sessionId, createdA.sessionId);
    assert.equal(lookupJson.sessionCode, createdA.sessionCode);
    assert.equal(lookupJson.playerCount, 1);

    // Client B joins using lowercase / padded join code
    clientB.joinSession({
      sessionCode: ` ${createdA.sessionCode.toLowerCase()} `,
      savedCheckpointId: null,
    });

    await waitFor(
      () =>
        clientA.session?.players.length === 2 && clientB.session?.players.length === 2
          ? true
          : false,
      5000,
      'TEST A: both clients see 2 players in same session'
    );

    assert.equal(clientB.session!.sessionId, createdA.sessionId);
    assert.equal(clientB.session!.sessionCode, createdA.sessionCode);
    assert.notEqual(clientA.playerId, clientB.playerId);
    assert.equal(clientB.pendingAction, null);

    // ------------------------------------------------------------------
    // TEST B: Both players enter Open World, see each other & sync moves
    // ------------------------------------------------------------------
    const snapA = clientA.session!.players.find((p) => p.playerId === clientA.playerId)!;
    const snapB = clientB.session!.players.find((p) => p.playerId === clientB.playerId)!;
    assert.equal(snapA.platform, 'pc');
    assert.equal(snapB.platform, 'android');

    engA.startCoopOpenWorld(snapA, clientA.session!.players);
    engB.startCoopOpenWorld(snapB, clientB.session!.players);

    const peerBonA = engA.coopPlayers.get(clientB.playerId);
    const peerAonB = engB.coopPlayers.get(clientA.playerId);
    assert.ok(peerBonA, 'Player A must have Player B character rig spawned');
    assert.ok(peerAonB, 'Player B must have Player A character rig spawned');
    assert.equal(peerBonA.rig.root.parent, engA.scene);
    assert.equal(peerAonB.rig.root.parent, engB.scene);
    assert.equal(peerBonA.rig.root.visible, true);
    assert.equal(peerAonB.rig.root.visible, true);

    // Move both players near Region 01 and verify live interpolation sync
    const startAx = peerAonB.pos.x;
    const startBx = peerBonA.pos.x;
    clientA.sendPlayerState({
      x: startAx + 3.6,
      y: 1.2,
      z: -6.5,
      yaw: 0.75,
      animState: 'run',
      horizSpeed: 8.4,
      regionId: 1,
      inWater: false,
    });
    clientB.sendPlayerState({
      x: startBx - 4.1,
      y: 1.2,
      z: -9.2,
      yaw: -1.1,
      animState: 'swim',
      horizSpeed: 5.5,
      regionId: 1,
      inWater: true,
    });

    await waitFor(
      () =>
        Math.abs(peerAonB.targetPos.x - (startAx + 3.6)) < 0.01 &&
        Math.abs(peerBonA.targetPos.x - (startBx - 4.1)) < 0.01,
      5000,
      'TEST B: bidirectional movement telemetry arrives'
    );

    engA.updateRemoteCoopPlayers(0.05);
    engB.updateRemoteCoopPlayers(0.05);
    assert.notEqual(peerBonA.pos.x, startBx, 'Remote character B moves in Player A engine');
    assert.notEqual(peerAonB.pos.x, startAx, 'Remote character A moves in Player B engine');

    // ------------------------------------------------------------------
    // TEST C: Simultaneous exploration of Region 10 and Region 20
    // ------------------------------------------------------------------
    const region10Meta = getWorldRegionMeta(10);
    const region20Meta = getWorldRegionMeta(20);

    engA.playerPos.set(region10Meta.spawn[0], region10Meta.spawn[1], region10Meta.spawn[2]);
    engA.updateOpenWorldStreaming(true);
    assert.ok(engA.owChunks.has('r_10'), 'Engine A streams Region 10 geometry');

    engB.playerPos.set(region20Meta.spawn[0], region20Meta.spawn[1], region20Meta.spawn[2]);
    engB.updateOpenWorldStreaming(true);
    assert.ok(engB.owChunks.has('r_20'), 'Engine B streams Region 20 geometry');

    clientA.sendPlayerState({
      x: region10Meta.spawn[0],
      y: region10Meta.spawn[1],
      z: region10Meta.spawn[2],
      yaw: 0.2,
      animState: 'walk',
      horizSpeed: 4.1,
      regionId: 10,
      inWater: false,
    });
    clientB.sendPlayerState({
      x: region20Meta.spawn[0],
      y: region20Meta.spawn[1],
      z: region20Meta.spawn[2],
      yaw: 1.8,
      animState: 'run',
      horizSpeed: 8.6,
      regionId: 20,
      inWater: false,
    });

    await waitFor(
      () =>
        peerAonB.regionId === 10 &&
        peerBonA.regionId === 20 &&
        Math.hypot(peerAonB.targetPos.x - region10Meta.spawn[0], peerAonB.targetPos.z - region10Meta.spawn[2]) < 1 &&
        Math.hypot(peerBonA.targetPos.x - region20Meta.spawn[0], peerBonA.targetPos.z - region20Meta.spawn[2]) < 1,
      5000,
      'TEST C: both players see R10 & R20 positions inside the same session'
    );
    assert.equal(clientA.session!.sessionId, clientB.session!.sessionId);

    // ------------------------------------------------------------------
    // TEST D: Independent checkpoints (R10 vs R20) & snake-eaten respawn
    // ------------------------------------------------------------------
    const allCps = getAllWorldCheckpoints();
    const cp10 = allCps.find((c) => c.regionId === 10);
    const cp20 = allCps.find((c) => c.regionId === 20);
    assert.ok(cp10 && cp20, 'Region 10 and Region 20 checkpoints must exist');

    clientA.sendActivateCheckpoint(cp10.id, cp10.x, cp10.y + 0.5, cp10.z);
    clientB.sendActivateCheckpoint(cp20.id, cp20.x, cp20.y + 0.5, cp20.z);

    await waitFor(() => {
      const aA = clientA.session?.players.find((p) => p.playerId === clientA.playerId);
      const bA = clientA.session?.players.find((p) => p.playerId === clientB.playerId);
      const aB = clientB.session?.players.find((p) => p.playerId === clientA.playerId);
      const bB = clientB.session?.players.find((p) => p.playerId === clientB.playerId);
      return (
        aA?.checkpointId === cp10.id &&
        bA?.checkpointId === cp20.id &&
        aB?.checkpointId === cp10.id &&
        bB?.checkpointId === cp20.id
      );
    }, 5000, 'TEST D: independent R10 and R20 checkpoints synchronized');

    // Simulate both players eaten by serpents
    engA.phase = 'jumpscare';
    engA.deathReason = 'caught';
    engA.coopDeathSeq = 1;
    clientA.sendPlayerEaten({
      deathSeq: 1,
      monsterId: 'serpent_r10',
      monsterX: cp10.x,
      monsterY: -0.2,
      monsterZ: cp10.z - 2,
      playerX: cp10.x + 2,
      playerY: 0.4,
      playerZ: cp10.z,
      playerYaw: 0,
    });

    engB.phase = 'jumpscare';
    engB.deathReason = 'caught';
    engB.coopDeathSeq = 1;
    clientB.sendPlayerEaten({
      deathSeq: 1,
      monsterId: 'serpent_r20',
      monsterX: cp20.x,
      monsterY: -0.2,
      monsterZ: cp20.z - 2,
      playerX: cp20.x - 2,
      playerY: 0.4,
      playerZ: cp20.z,
      playerYaw: 1.2,
    });

    await waitFor(
      () => peerAonB.alive === false && peerBonA.alive === false,
      5000,
      'TEST D: both clients observe teammate eaten states'
    );

    clientA.sendRequestRespawn(1);
    clientB.sendRequestRespawn(1);

    await waitFor(
      () =>
        engA.phase === 'playing' &&
        engB.phase === 'playing' &&
        engA.owCheckpointId === cp10.id &&
        engB.owCheckpointId === cp20.id,
      5000,
      'TEST D: both engines automatically respawn at independent checkpoints'
    );

    assert.equal(engA.owCheckpointRegionId, 10);
    assert.equal(engB.owCheckpointRegionId, 20);
    assert.ok(Math.hypot(engA.playerPos.x - cp10.x, engA.playerPos.z - cp10.z) < 0.1);
    assert.ok(Math.hypot(engB.playerPos.x - cp20.x, engB.playerPos.z - cp20.z) < 0.1);
    assert.equal(engA.playerRig.root.visible, true);
    assert.equal(engB.playerRig.root.visible, true);
    assert.equal(clientA.session!.sessionId, createdA.sessionId);
    assert.equal(clientB.session!.sessionId, createdA.sessionId);

    // ------------------------------------------------------------------
    // TEST E: Temporary disconnect & duplicate-free reconnect
    // ------------------------------------------------------------------
    clientB.forceReconnect();

    await waitFor(
      () =>
        clientA.session?.players.find((p) => p.playerId === clientB.playerId)?.connected === false,
      5000,
      'TEST E: Client A stays in active room while Client B drops temporarily'
    );
    assert.equal(clientA.status, 'connected');
    assert.equal(clientA.session!.sessionId, createdA.sessionId);

    await waitFor(
      () =>
        reconnectRestoresB.length > 0 &&
        clientA.session?.players.find((p) => p.playerId === clientB.playerId)?.connected === true,
      6000,
      'TEST E: Client B reconnects seamlessly to exact same room'
    );
    assert.equal(clientB.session!.sessionId, createdA.sessionId);
    assert.equal(clientA.session!.players.length, 2, 'No duplicate player after reconnect on Client A');
    assert.equal(clientB.session!.players.length, 2, 'No duplicate player after reconnect on Client B');
    assert.equal(engA.coopPlayers.size, 1, 'Engine A has exactly 1 remote rig (no duplicate)');
    assert.equal(engB.coopPlayers.size, 1, 'Engine B has exactly 1 remote rig (no duplicate)');
    assert.equal(
      clientB.session!.players.find((p) => p.playerId === clientB.playerId)?.checkpointId,
      cp20.id,
      'Client B checkpoint preserved across reconnect'
    );

    // ------------------------------------------------------------------
    // TEST F: Capacity enforcement (max 6 players -> 7th gets SESSION_FULL),
    //         URL normalization & explicit error handling (invalid code),
    //         and host-transfer when 1 player explicitly leaves
    // ------------------------------------------------------------------
    for (let slot = 3; slot <= COOP_MAX_PLAYERS; slot += 1) {
      const extra = new CoopClient({
        playerId: `squad_extra_${slot}`,
        name: `Squad${slot}`,
        characterId: slot % 2 === 0 ? 'female' : 'male',
        platform: slot % 2 === 0 ? 'android' : 'pc',
        wsUrl,
        webSocketFactory: (u) => new WebSocket(u) as unknown as globalThis.WebSocket,
      });
      extraClients.push(extra);
      extra.joinSession({ sessionCode: createdA.sessionCode, savedCheckpointId: null });
      await waitFor(() => extra.session, 5000, `extra player ${slot} joined`);
    }
    assert.equal(clientA.session!.players.length, COOP_MAX_PLAYERS);

    // 7th player must be rejected cleanly with SESSION_FULL (no crash / hang)
    let seventhErr = '';
    const seventh = new CoopClient({
      playerId: 'squad_seventh_overflow',
      name: 'Overflow',
      characterId: 'male',
      platform: 'pc',
      wsUrl,
      webSocketFactory: (u) => new WebSocket(u) as unknown as globalThis.WebSocket,
      callbacks: {
        onError: (e) => {
          seventhErr = e.code;
        },
      },
    });
    extraClients.push(seventh);
    seventh.joinSession({ sessionCode: createdA.sessionCode, savedCheckpointId: null });
    await waitFor(() => seventhErr, 5000, '7th player receives SESSION_FULL');
    assert.equal(seventhErr, 'SESSION_FULL');
    assert.equal(seventh.pendingAction, null);

    // Invalid Join Code emits SESSION_NOT_FOUND cleanly
    let badCodeErr = '';
    const badCodeClient = new CoopClient({
      playerId: 'bad_code_tester',
      name: 'BadCode',
      characterId: 'male',
      platform: 'pc',
      wsUrl,
      webSocketFactory: (u) => new WebSocket(u) as unknown as globalThis.WebSocket,
      callbacks: {
        onError: (e) => {
          badCodeErr = e.code;
        },
      },
    });
    extraClients.push(badCodeClient);
    badCodeClient.joinSession({ sessionCode: 'ZZZZ99', savedCheckpointId: null });
    await waitFor(() => badCodeErr, 5000, 'invalid code error');
    assert.equal(badCodeErr, 'SESSION_NOT_FOUND');
    assert.equal(badCodeClient.pendingAction, null);

    // Host leaves explicitly -> session stays alive with remaining players and transfers hostId
    clientA.leaveSession();
    await waitFor(
      () => clientB.session && clientB.session.hostId !== clientA.playerId,
      5000,
      'Host transfer on explicit leave without terminating room'
    );
    assert.equal(clientB.session!.sessionId, createdA.sessionId);

    assert.deepEqual(errorsA, []);
    assert.deepEqual(errorsB, []);
  } finally {
    clientA.disconnect(false);
    clientB.disconnect(false);
    for (const ec of extraClients) ec.disconnect(false);
    engA.clearCoopState();
    engB.clearCoopState();
    engA.playerRig.dispose();
    engB.playerRig.dispose();
    disposeEntityResources(textures);
    textures.dispose();
    await srv.close();
  }
});

test('CoopClient URL normalization, invalid code validation, and unreachable server timeout/error recovery', async () => {
  assert.equal(
    normalizeCoopWsUrl('https://coop.serpentis.workers.dev'),
    'wss://coop.serpentis.workers.dev/ws/coop'
  );
  assert.equal(
    normalizeCoopWsUrl('https://coop.serpentis.workers.dev/ws'),
    'wss://coop.serpentis.workers.dev/ws/coop'
  );
  assert.equal(
    normalizeCoopWsUrl('wss://coop.serpentis.workers.dev/ws/coop/'),
    'wss://coop.serpentis.workers.dev/ws/coop'
  );
  assert.equal(
    normalizeCoopWsUrl('http://192.168.1.50:3000'),
    'ws://192.168.1.50:3000/ws/coop'
  );

  const receivedErrors: { code: string; message: string }[] = [];
  const deadClient = new CoopClient({
    playerId: 'unreachable_tester',
    name: 'DeadTest',
    characterId: 'male',
    platform: 'android',
    wsUrl: 'ws://127.0.0.1:1/ws/coop',
    connectTimeoutMs: 1500,
    actionTimeoutMs: 2000,
    webSocketFactory: (u) => new WebSocket(u) as unknown as globalThis.WebSocket,
    callbacks: {
      onError: (err) => receivedErrors.push(err),
    },
  });

  // Short code caught client-side immediately without hanging
  deadClient.joinSession({ sessionCode: 'ab', savedCheckpointId: null });
  assert.equal(receivedErrors[0]?.code, 'INVALID_CODE');

  // Unreachable endpoint fires CONNECTION_FAILED / CONNECTION_TIMEOUT and clears pendingAction
  deadClient.createSession(null);
  await waitFor(() => receivedErrors.length >= 2, 4000, 'unreachable server emits failure error');
  assert.ok(
    receivedErrors[1].code === 'CONNECTION_FAILED' ||
      receivedErrors[1].code === 'CONNECTION_TIMEOUT' ||
      receivedErrors[1].code === 'REQUEST_TIMEOUT'
  );
  assert.equal(deadClient.pendingAction, null);
  deadClient.disconnect(false);
});

test('Cloudflare Worker CoopHubDO parity: HTTP health/lookup and two-client create/join flow', async () => {
  // Minimal two-ended WebSocketPair shim so CoopHubDO can run directly in Node tests
  type Listener = (ev: { data?: string }) => void;
  class MemSocket {
    public readyState = 0;
    public peer!: MemSocket;
    private listeners = new Map<string, Listener[]>();
    public accept(): void {}
    public addEventListener(type: string, cb: Listener): void {
      const list = this.listeners.get(type) ?? [];
      list.push(cb);
      this.listeners.set(type, list);
    }
    public send(data: string): void {
      if (this.readyState !== 1) return;
      queueMicrotask(() => {
        for (const cb of this.peer.listeners.get('message') ?? []) {
          cb({ data });
        }
      });
    }
    public close(): void {
      if (this.readyState === 3) return;
      this.readyState = 3;
      this.peer.readyState = 3;
      queueMicrotask(() => {
        for (const cb of this.listeners.get('close') ?? []) cb({});
        for (const cb of this.peer.listeners.get('close') ?? []) cb({});
      });
    }
  }
  const OrigResponse = globalThis.Response;
  const origWsPair = (globalThis as { WebSocketPair?: unknown }).WebSocketPair;
  let lastClientSocket: MemSocket | null = null;
  (globalThis as { Response: unknown }).Response = class extends OrigResponse {
    constructor(body?: BodyInit | null, init?: ResponseInit & { webSocket?: unknown }) {
      if (init?.status === 101 && init.webSocket) {
        super(null, { status: 200 });
        Object.defineProperty(this, 'status', { value: 101 });
        Object.defineProperty(this, 'webSocket', { value: init.webSocket });
        return;
      }
      super(body, init);
    }
  };
  (globalThis as { WebSocketPair?: unknown }).WebSocketPair = class {
    public 0: MemSocket;
    public 1: MemSocket;
    constructor() {
      const a = new MemSocket();
      const b = new MemSocket();
      a.peer = b;
      b.peer = a;
      this[0] = a;
      this[1] = b;
      lastClientSocket = a;
    }
  };

  let hub: CoopHubDO | null = null;
  try {
    hub = new CoopHubDO();

    const makeHubClient = (playerId: string, name: string, platform: 'pc' | 'android') =>
      new CoopClient({
        playerId,
        name,
        characterId: platform === 'android' ? 'female' : 'male',
        platform,
        wsUrl: 'wss://edge.example.com/ws/coop',
        webSocketFactory: () => {
          void hub!.fetch(
            new Request('https://edge.example.com/ws/coop', {
              headers: { Upgrade: 'websocket' },
            })
          );
          const clientSock = lastClientSocket!;
          queueMicrotask(() => {
            clientSock.readyState = 1;
            clientSock.peer.readyState = 1;
            for (const cb of (clientSock as unknown as { listeners: Map<string, Listener[]> }).listeners.get('open') ?? []) {
              cb({});
            }
          });
          return clientSock as unknown as globalThis.WebSocket;
        },
      });

    const cA = makeHubClient('cf_pc_1', 'EdgePC', 'pc');
    const cB = makeHubClient('cf_mob_2', 'EdgeAndroid', 'android');

    cA.createSession(null);
    const sA = await waitFor(() => cA.session, 4000, 'CF Worker session created');

    const healthRes = await hub.fetch(new Request('https://edge.example.com/api/health'));
    assert.equal(healthRes.status, 200);
    const healthJson = (await healthRes.json()) as { runtime: string; activeSessions: number };
    assert.equal(healthJson.runtime, 'cloudflare-durable-object');
    assert.equal(healthJson.activeSessions, 1);

    const lookupRes = await hub.fetch(
      new Request(`https://edge.example.com/api/coop/session/${sA.sessionCode}`)
    );
    assert.equal(lookupRes.status, 200);

    cB.joinSession({ sessionCode: sA.sessionCode, savedCheckpointId: null });
    await waitFor(
      () => cA.session?.players.length === 2 && cB.session?.players.length === 2,
      4000,
      'CF Worker join-by-code matches room'
    );
    assert.equal(cB.session!.sessionId, sA.sessionId);

    cA.disconnect(false);
    cB.disconnect(false);
  } finally {
    hub?.destroy();
    (globalThis as { Response: unknown }).Response = OrigResponse;
    if (origWsPair === undefined) {
      delete (globalThis as { WebSocketPair?: unknown }).WebSocketPair;
    } else {
      (globalThis as { WebSocketPair?: unknown }).WebSocketPair = origWsPair;
    }
  }
});
