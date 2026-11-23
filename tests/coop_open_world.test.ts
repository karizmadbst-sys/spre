import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import WebSocket from 'ws';
import { createAppServer } from '../server.ts';
import { CoopClient } from '../src/coop/CoopClient.ts';
import { COOP_MAX_PLAYERS, type CoopPlayerSnapshot } from '../src/coop/types.ts';
import { PoolGameEngine } from '../src/game/engine.ts';
import { createPlayerRig, disposeEntityResources } from '../src/game/entities.ts';
import { getAllWorldCheckpoints, getWorldRegionDef, OPEN_WORLD_SPAWN } from '../src/game/openWorld.ts';
import type { TextureBundle } from '../src/game/textures.ts';
import type { HudSnapshot } from '../src/game/types.ts';

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
  timeoutMs = 5000,
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

function createHarnessEngine(textures: TextureBundle) {
  const eng = Object.create(PoolGameEngine.prototype) as any;
  eng.container = {};
  eng.disposed = false;
  eng.contextLost = false;
  eng.isSoftwareGl = true;
  eng.isLowEndGpu = true;
  eng.isTouchDevice = false;
  eng.activeQuality = 'smooth';
  eng.activeRenderDist = 96;
  eng.scene = new THREE.Scene();
  eng.levelGroup = new THREE.Group();
  eng.scene.add(eng.levelGroup);
  eng.camera = new THREE.PerspectiveCamera(68, 16 / 9, 0.1, 200);
  eng.textures = textures;
  eng.sound = {
    unlock: () => {},
    stopEatingScreams: () => {},
    stopSnakeSwimmingAudio: () => {},
    stopAttackEatingAudio: () => {},
    playCheckpoint: () => {},
    playStep: () => {},
    playSplash: () => {},
    playJump: () => {},
    playLand: () => {},
    playEatingStrike: () => {},
    playJumpscare: () => {},
    updateAtmosphere: () => {},
    prewarmAsync: async () => {},
  };
  eng.currentLevel = getWorldRegionDef(1);
  eng.activeWorldMode = 'open_world';
  eng.owChunks = new Map();
  eng.owMats = null;
  eng.owCheckpointMeta = new Map();
  eng.owActivatedCheckpointIds = new Set();
  eng.owCurrentRegionId = 1;
  eng.owCheckpointId = null;
  eng.owCheckpointRegionId = 1;
  eng.owCheckpointLabel = 'Region 01 Entry Dock';
  eng.owCheckpointYaw = Math.PI;
  eng.owLastStreamX = NaN;
  eng.owLastStreamZ = NaN;
  eng.owTargetAtmo = null;
  eng.platforms = [];
  eng.dynamicPlatforms = [];
  eng.staticChunks = [];
  eng.walls = [];
  eng.spatialGrid = null;
  eng.checkpoints = [];
  eng.monsters = [];
  eng.pointLightPool = [];
  eng.levelLights = [];
  eng.levelQualityMaterials = [];
  eng.levelShadowReceivers = [];
  eng.levelDisposables = [];
  eng.splashPool = [];
  eng.splashMaxActive = 0;
  eng.splashHasActive = false;
  eng.splashMesh = { userData: { hadActive: false }, count: 0, instanceMatrix: { needsUpdate: false } };
  eng.heldKeys = new Set();
  eng.virtualMove = { x: 0, y: 0 };
  eng.virtualRun = false;
  eng.virtualAutoRun = false;
  eng.localCharacterId = 'male';
  eng.playerRig = createPlayerRig(textures, 0x52e0b6, false, 'male');
  eng.scene.add(eng.playerRig.root);
  eng.playerPos = new THREE.Vector3(OPEN_WORLD_SPAWN.x, OPEN_WORLD_SPAWN.y, OPEN_WORLD_SPAWN.z);
  eng.playerVel = new THREE.Vector3();
  eng.playerYaw = Math.PI;
  eng.activeSpawn = new THREE.Vector3(OPEN_WORLD_SPAWN.x, OPEN_WORLD_SPAWN.y, OPEN_WORLD_SPAWN.z);
  eng.activeCheckpointIndex = 0;
  eng.simTime = 0;
  eng.platformTime = 0;
  eng.levelTimeRemaining = 0;
  eng.levelTimeElapsed = 0;
  eng.jumpscareTimer = 0;
  eng.jumpscareMonster = null;
  eng.deathReason = null;
  eng.phase = 'playing';
  eng.camYaw = 0;
  eng.camPitch = 0.24;
  eng.camDist = 5;
  eng.lastAnimState = 'idle';
  eng.lastHorizSpeed = 0;
  eng.settings = {
    mouseSensitivity: 1,
    invertY: false,
    masterVolume: 0.5,
    musicVolume: 0.5,
    sfxVolume: 0.5,
    muted: true,
    quality: 'smooth',
    touchControls: 'off',
  };
  eng.baseFogColor = new THREE.Color('#091318');
  eng.underwaterFogColor = new THREE.Color('#03090c');
  eng.baseHemiColor = new THREE.Color('#4f7284');
  eng.horrorVisualBlend = 0;
  eng.horrorVisualActive = false;
  eng.uCausticEnabled = { value: 0 };
  eng.uWaterQuality = { value: 0 };
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
  eng.callbacks = {
    onHudUpdate: (_s: HudSnapshot) => {},
    onPhaseChange: () => {},
  };
  eng.ensureLoopRunning = () => {};
  eng.prewarmSceneShaders = () => {};
  eng.applyQualityToRenderer = () => {};
  eng.snapPlayCameraImmediate = () => {};
  eng.updateEnvironmentFX = () => {};
  eng.spawnSplash = () => {};
  return eng;
}

test('Co-Op Open World server + client session, invites, movement, independent checkpoints, eaten/respawn, and reconnect restoration', async () => {
  const srv = await createAppServer({ attachVite: false });
  await new Promise<void>((resolve) => srv.server.listen(0, '127.0.0.1', () => resolve()));
  const addr = srv.server.address() as { port: number };
  const wsUrl = `ws://127.0.0.1:${addr.port}/ws/coop`;
  const httpUrl = `http://127.0.0.1:${addr.port}/api/health`;

  const hostEvents = {
    welcomes: 0,
    sessions: [] as string[],
    peerMoves: 0,
    eatenEvents: 0,
    respawns: [] as string[],
    peerCheckpoints: [] as string[],
  };
  const guestEvents = {
    welcomes: 0,
    invites: [] as string[],
    sessions: [] as string[],
    reconnectRestores: 0,
    confirmedCheckpoints: [] as string[],
    respawns: [] as { playerId: string; checkpointId: string | null }[],
  };

  const host = new CoopClient({
    playerId: 'coop_host_alpha',
    name: 'HostAlpha',
    characterId: 'male',
    platform: 'pc',
    wsUrl,
    webSocketFactory: (u) => new WebSocket(u) as unknown as globalThis.WebSocket,
    callbacks: {
      onWelcome: () => {
        hostEvents.welcomes += 1;
      },
      onSessionState: (session) => {
        hostEvents.sessions.push(session.sessionCode);
      },
      onPlayerMoved: () => {
        hostEvents.peerMoves += 1;
      },
      onPlayerCheckpoint: (info) => {
        hostEvents.peerCheckpoints.push(info.checkpointId);
      },
      onPlayerEaten: () => {
        hostEvents.eatenEvents += 1;
      },
      onPlayerRespawn: (r) => {
        hostEvents.respawns.push(r.playerId);
      },
    },
  });

  const guest = new CoopClient({
    playerId: 'coop_guest_beta',
    name: 'GuestBeta',
    characterId: 'female',
    platform: 'android',
    wsUrl,
    webSocketFactory: (u) => new WebSocket(u) as unknown as globalThis.WebSocket,
    callbacks: {
      onWelcome: () => {
        guestEvents.welcomes += 1;
      },
      onInviteReceived: (inv) => {
        guestEvents.invites.push(inv.inviteId);
      },
      onSessionState: (session, _you, reconnectRestore) => {
        guestEvents.sessions.push(session.sessionCode);
        if (reconnectRestore) {
          guestEvents.reconnectRestores += 1;
        }
      },
      onCheckpointConfirmed: (cp) => {
        guestEvents.confirmedCheckpoints.push(cp.checkpointId);
      },
      onPlayerRespawn: (r) => {
        guestEvents.respawns.push({ playerId: r.playerId, checkpointId: r.checkpointId });
      },
    },
  });

  try {
    // 1. Health endpoint reports coop capability
    const healthRes = await fetch(httpUrl);
    assert.equal(healthRes.status, 200);
    const healthJson = (await healthRes.json()) as { ok: boolean; coop?: boolean };
    assert.equal(healthJson.ok, true);
    assert.equal(healthJson.coop, true);

    // 2. Connect host & guest concurrently and verify presence
    host.connect();
    guest.connect();
    await waitFor(() => hostEvents.welcomes > 0 && guestEvents.welcomes > 0, 5000, 'both welcomes');
    await waitFor(
      () => host.onlineUsers.some((u) => u.playerId === guest.playerId),
      5000,
      'guest presence visible to host'
    );

    // 3. Host creates session and invites guest by Friend Code
    host.createSession();
    const session = await waitFor(() => host.session, 5000, 'host session created');
    assert.equal(session.maxPlayers, COOP_MAX_PLAYERS);
    assert.equal(session.players.length, 1);

    host.inviteFriend({ friendCode: guest.friendCode });
    const inviteId = await waitFor(() => guestEvents.invites[0], 5000, 'guest receives invite');
    guest.respondToInvite(inviteId, true);

    await waitFor(
      () => (host.session?.players.length ?? 0) === 2 && (guest.session?.players.length ?? 0) === 2,
      5000,
      'both players in session'
    );

    // 4. Guest movement sync reaches host
    guest.sendPlayerState({
      x: 4.5,
      y: 1.2,
      z: -12.0,
      yaw: 1.25,
      animState: 'run',
      horizSpeed: 8.2,
      regionId: 1,
      inWater: false,
    });
    await waitFor(() => hostEvents.peerMoves > 0, 5000, 'host receives guest movement');

    // 5. Independent checkpoints: guest activates Region 2 checkpoint while host stays at Entry Dock
    const allCps = getAllWorldCheckpoints();
    const r2Cp = allCps.find((c) => c.regionId === 2) ?? allCps[1];
    assert.ok(r2Cp, 'Region 2 checkpoint must exist');
    guest.sendActivateCheckpoint(r2Cp.id, r2Cp.x, r2Cp.y + 0.5, r2Cp.z);

    await waitFor(
      () =>
        guestEvents.confirmedCheckpoints.includes(r2Cp.id) &&
        hostEvents.peerCheckpoints.includes(r2Cp.id),
      5000,
      'independent checkpoint confirmed & broadcast'
    );
    const hostSelf = host.session!.players.find((p) => p.playerId === host.playerId);
    const guestSelf = guest.session!.players.find((p) => p.playerId === guest.playerId);
    assert.equal(hostSelf?.checkpointId, null, 'Host checkpoint must remain independent');
    assert.equal(guestSelf?.checkpointId, r2Cp.id, 'Guest checkpoint must update independently');

    // 6. Player eaten + authoritative server respawn at Guest's Region 2 checkpoint
    guest.sendPlayerEaten({
      deathSeq: 1,
      monsterId: 'ow_serpent_1',
      monsterX: r2Cp.x,
      monsterY: -0.2,
      monsterZ: r2Cp.z - 2,
      playerX: r2Cp.x,
      playerY: 0.4,
      playerZ: r2Cp.z,
      playerYaw: 0.4,
    });
    await waitFor(() => hostEvents.eatenEvents > 0, 5000, 'host receives eaten broadcast');

    guest.sendRequestRespawn(1);
    const guestRespawn = await waitFor(
      () => guestEvents.respawns.find((r) => r.playerId === guest.playerId),
      5000,
      'guest receives authoritative respawn'
    );
    assert.equal(guestRespawn.checkpointId, r2Cp.id);
    assert.ok(hostEvents.respawns.includes(guest.playerId));

    // 7. Reconnect preserves session & guest independent checkpoint
    guest.forceReconnect();
    await waitFor(() => guestEvents.reconnectRestores > 0, 5000, 'guest session restored after reconnect');
    const restoredGuest = guest.session!.players.find((p) => p.playerId === guest.playerId);
    assert.equal(restoredGuest?.checkpointId, r2Cp.id);
  } finally {
    host.disconnect(false);
    guest.disconnect(false);
    await srv.close();
  }
});

test('PoolGameEngine Co-Op rig lifecycle: spawn peers, interpolate movement, eaten/respawn & clean disposal', () => {
  const textures = createMockTextures();
  const eng = createHarnessEngine(textures);

  const peer1: CoopPlayerSnapshot = {
    playerId: 'peer_1',
    friendCode: 'SRP-111111',
    name: 'DiverOne',
    characterId: 'female',
    platform: 'pc',
    connected: true,
    alive: true,
    deathSeq: 0,
    slotIndex: 1,
    colorHex: '#6cb8ff',
    x: 4,
    y: 1.2,
    z: -8,
    yaw: 0.5,
    animState: 'walk',
    horizSpeed: 4.2,
    regionId: 1,
    inWater: false,
    checkpointId: null,
    checkpointRegionId: 1,
    checkpointLabel: 'Region 01 Entry Dock',
    checkpointX: 4,
    checkpointY: 1.2,
    checkpointZ: -8,
    checkpointYaw: Math.PI,
  };

  eng.setCoopMode(true, 'local_player');
  eng.syncCoopPlayers([peer1]);

  assert.equal(eng.coopPlayers.size, 1);
  const remote = eng.coopPlayers.get('peer_1');
  assert.ok(remote);
  assert.equal(remote.rig.root.parent, eng.scene);
  assert.ok(remote.nameplate instanceof THREE.Sprite);

  eng.updateCoopPlayerMove({
    playerId: 'peer_1',
    x: 8,
    y: 1.5,
    z: -14,
    yaw: 1.4,
    animState: 'run',
    horizSpeed: 8.5,
    regionId: 1,
    inWater: false,
    alive: true,
  });
  assert.equal(remote.targetPos.x, 8);
  assert.equal(remote.targetPos.z, -14);
  assert.equal(remote.animState, 'run');

  eng.updateRemoteCoopPlayers(0.05);
  assert.ok(remote.pos.x > 4, 'Remote position must interpolate toward target');

  eng.applyCoopPlayerEaten({
    playerId: 'peer_1',
    deathSeq: 1,
    monsterId: 'm1',
    monsterX: 8,
    monsterY: -0.2,
    monsterZ: -15,
    playerX: 8,
    playerY: 1.2,
    playerZ: -14,
    playerYaw: 1.4,
  });
  assert.equal(remote.alive, false);

  eng.applyCoopPlayerRespawn({
    playerId: 'peer_1',
    deathSeq: 1,
    checkpointId: null,
    checkpointRegionId: 1,
    checkpointLabel: 'Region 01 Entry Dock',
    x: 2,
    y: 1.2,
    z: -4,
    yaw: Math.PI,
    regionId: 1,
  });
  assert.equal(remote.alive, true);
  assert.equal(remote.pos.x, 2);
  assert.equal(remote.pos.z, -4);

  eng.clearCoopState();
  assert.equal(eng.coopPlayers.size, 0);
  assert.equal(remote.rig.root.parent, null, 'Remote rig must be detached from scene on clear');

  eng.playerRig.dispose();
  disposeEntityResources(textures);
  textures.dispose();
});
