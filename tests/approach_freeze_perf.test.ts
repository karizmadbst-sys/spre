import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import {
  FEMALE_FEAR_SCREAM_URL,
  MALE_FEAR_SCREAM_URL,
  SNAKE_FINAL_GULP_URL,
  SNAKE_SWALLOW_SQUELCH_URL,
  SoundEngine,
} from '../src/game/audio';
import { PoolGameEngine } from '../src/game/engine';
import {
  animateMonsterRig,
  attachPreyToSerpentMouth,
  createMonsterRig,
  createPlayerRig,
  disposeEntityResources,
  resetSerpentTrail,
} from '../src/game/entities';
import { getLevelById } from '../src/game/levels';
import {
  CORE_AUDIO_PRELOAD_URLS,
  getPreloadedAudioAsset,
  preloadAudioAsset,
} from '../src/game/audioPreload';
import { SERPENT_WATCH_DURATION_SEC } from '../src/game/serpentNav';
import { LevelSpatialGrid } from '../src/game/spatialGrid';
import type { TextureBundle } from '../src/game/textures';

function makeMockTextures(): TextureBundle {
  const mk = () =>
    new THREE.DataTexture(new Uint8Array([200, 200, 200, 255]), 1, 1) as unknown as THREE.CanvasTexture;
  const all = Array.from({ length: 23 }, () => mk());
  return {
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
}

class FakeAudioParam {
  public value = 0;
  setValueAtTime(v: number) {
    this.value = v;
  }
  setTargetAtTime(v: number) {
    this.value = v;
  }
  linearRampToValueAtTime(v: number) {
    this.value = v;
  }
  exponentialRampToValueAtTime(v: number) {
    this.value = v;
  }
  cancelScheduledValues() {}
}

class FakeAudioNode {
  public connections: unknown[] = [];
  connect(dest: unknown) {
    this.connections.push(dest);
    return dest;
  }
  disconnect() {}
}

class FakeAudioContext {
  public state: AudioContextState = 'running';
  public currentTime = 0;
  public sampleRate = 48000;
  public destination = new FakeAudioNode();

  public counts = {
    panner: 0,
    biquad: 0,
    gain: 0,
    osc: 0,
    bufferSource: 0,
    pannerSetPos: 0,
    decodeCalls: 0,
    destinationWarmConnects: 0,
  };

  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
  close() {
    this.state = 'closed';
    return Promise.resolve();
  }
  createBuffer(_channels: number, length: number, sampleRate: number) {
    const ch = new Float32Array(length);
    return {
      duration: length / sampleRate,
      length,
      sampleRate,
      numberOfChannels: 1,
      getChannelData: () => ch,
    } as unknown as AudioBuffer;
  }
  decodeAudioData() {
    this.counts.decodeCalls++;
    return Promise.resolve(this.createBuffer(1, this.sampleRate * 2, this.sampleRate));
  }
  createGain() {
    this.counts.gain++;
    const base = new FakeAudioNode();
    const n = base as unknown as GainNode & { connections: unknown[]; gain: FakeAudioParam };
    (n as any).gain = new FakeAudioParam();
    const origConnect = base.connect.bind(base);
    n.connect = ((dest: unknown) => {
      if (dest === this.destination) this.counts.destinationWarmConnects++;
      return origConnect(dest);
    }) as any;
    return n;
  }
  createBiquadFilter() {
    this.counts.biquad++;
    const n = new FakeAudioNode() as unknown as BiquadFilterNode;
    (n as any).type = 'lowpass';
    (n as any).frequency = new FakeAudioParam();
    (n as any).Q = new FakeAudioParam();
    return n;
  }
  createOscillator() {
    this.counts.osc++;
    const n = new FakeAudioNode() as unknown as OscillatorNode;
    (n as any).type = 'sine';
    (n as any).frequency = new FakeAudioParam();
    (n as any).start = () => {};
    (n as any).stop = () => {};
    return n;
  }
  createBufferSource() {
    this.counts.bufferSource++;
    const n = new FakeAudioNode() as unknown as AudioBufferSourceNode;
    (n as any).buffer = null;
    (n as any).loop = false;
    (n as any).onended = null;
    (n as any).start = () => {};
    (n as any).stop = () => {};
    return n;
  }
  createPanner() {
    this.counts.panner++;
    const n = new FakeAudioNode() as unknown as PannerNode;
    const ctxRef = this;
    const makeTrackedPosParam = () => ({
      _v: 0,
      get value() {
        return this._v;
      },
      set value(nv: number) {
        this._v = nv;
        ctxRef.counts.pannerSetPos++;
      },
    });
    (n as any).panningModel = 'equalpower';
    (n as any).distanceModel = 'inverse';
    (n as any).refDistance = 1;
    (n as any).maxDistance = 100;
    (n as any).rolloffFactor = 1;
    (n as any).positionX = makeTrackedPosParam();
    (n as any).positionY = makeTrackedPosParam();
    (n as any).positionZ = makeTrackedPosParam();
    return n;
  }
  listener = {
    positionX: new FakeAudioParam(),
    positionY: new FakeAudioParam(),
    positionZ: new FakeAudioParam(),
    forwardX: new FakeAudioParam(),
    forwardY: new FakeAudioParam(),
    forwardZ: new FakeAudioParam(),
    upX: new FakeAudioParam(),
    upY: new FakeAudioParam(),
    upZ: new FakeAudioParam(),
  };
}

async function testPreloaderAudioBufferPinning(): Promise<void> {
  assert.ok(CORE_AUDIO_PRELOAD_URLS.includes(FEMALE_FEAR_SCREAM_URL));
  assert.ok(CORE_AUDIO_PRELOAD_URLS.includes(MALE_FEAR_SCREAM_URL));
  assert.ok(CORE_AUDIO_PRELOAD_URLS.includes(SNAKE_SWALLOW_SQUELCH_URL));
  assert.ok(CORE_AUDIO_PRELOAD_URLS.includes(SNAKE_FINAL_GULP_URL));

  const origFetch = globalThis.fetch;
  let fetchCalls = 0;
  (globalThis as any).fetch = async (url: string) => {
    fetchCalls++;
    return {
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
      url,
    };
  };

  try {
    const p1 = preloadAudioAsset(FEMALE_FEAR_SCREAM_URL);
    const p2 = preloadAudioAsset(FEMALE_FEAR_SCREAM_URL);
    assert.equal(p1, p2, 'preloadAudioAsset must deduplicate and pin in-flight buffer fetches');
    const ab = await p1;
    assert.ok(ab && ab.byteLength === 4);
    assert.equal(getPreloadedAudioAsset(FEMALE_FEAR_SCREAM_URL), p1);
    assert.equal(fetchCalls, 1);

    await Promise.all(CORE_AUDIO_PRELOAD_URLS.map((u) => preloadAudioAsset(u)));
    assert.equal(fetchCalls, 4, 'All 4 scream/devour audio URLs fetched once and pinned');
  } finally {
    (globalThis as any).fetch = origFetch;
  }
  console.log('1. PASS: Preloader audio ArrayBuffer pinning & deduplication verified.');
}

async function testSoundEngineHrtfWarmupAndRigPooling(): Promise<void> {
  const origWindow = (globalThis as any).window;
  const origNav = (globalThis as any).navigator;
  const fakeCtx = new FakeAudioContext();

  const origFetch = globalThis.fetch;
  (globalThis as any).fetch = async () => ({
    ok: true,
    arrayBuffer: async () => new Uint8Array(64).buffer,
  });

  (globalThis as any).window = {
    AudioContext: function MockAudioCtx() {
      return fakeCtx;
    },
    matchMedia: () => ({ matches: false }),
    setTimeout,
    clearTimeout,
  };
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { maxTouchPoints: 0, hardwareConcurrency: 8 },
  });

  try {
    await Promise.all(CORE_AUDIO_PRELOAD_URLS.map((u) => preloadAudioAsset(u)));
    const sound = new SoundEngine();
    sound.unlock();
    await sound.prewarmAsync();

    // Desktop with 8 cores should enable HRTF and perform genuine sink warmup
    assert.ok(fakeCtx.counts.destinationWarmConnects >= 2, 'unlock() must route masterGain + silent HRTF warmup to destination');
    assert.equal(fakeCtx.counts.decodeCalls, 4, 'prewarmAsync() must decode all 4 scream/swallow MP3s upfront');

    // Prewarm for 4 serpents upfront (behind loading screen)
    sound.prewarmMonsterSwimAudio(4);
    const baselinePanners = fakeCtx.counts.panner;
    const baselineBiquads = fakeCtx.counts.biquad;
    const baselineGains = fakeCtx.counts.gain;
    const baselineOscs = fakeCtx.counts.osc;

    // 4 serpents suddenly approach within 54m -> ZERO new AudioNode graph allocations!
    for (let i = 0; i < 4; i++) {
      sound.updateSnakeSwimmingAudio(`serpent_${i}`, {
        worldX: i * 5,
        worldY: -0.14,
        worldZ: -12,
        waterY: 0,
        speed: 14,
        swimPhase: 1.0,
        distToListener: 12 + i,
        isChasing: true,
        isEating: false,
        isSwimming: true,
        listenerUnderwater: false,
        scale: 1,
      });
    }
    assert.equal(fakeCtx.counts.panner, baselinePanners, 'Approaching serpents must allocate 0 new PannerNodes');
    assert.equal(fakeCtx.counts.biquad, baselineBiquads, 'Approaching serpents must allocate 0 new BiquadFilterNodes');
    assert.equal(fakeCtx.counts.gain, baselineGains, 'Approaching serpents must allocate 0 new GainNodes');
    assert.equal(fakeCtx.counts.osc, baselineOscs, 'Approaching serpents must allocate 0 new OscillatorNodes');

    // Stationary serpent updates (<0.02m displacement) must skip redundant Panner position writes
    const setPosBeforeStationary = fakeCtx.counts.pannerSetPos;
    sound.updateSnakeSwimmingAudio('serpent_0', {
      worldX: 0.002,
      worldY: -0.14,
      worldZ: -12.002,
      waterY: 0,
      speed: 14,
      swimPhase: 4.5, // triggers stroke splash
      distToListener: 12,
      isChasing: true,
      isEating: false,
      isSwimming: true,
      listenerUnderwater: false,
      scale: 1,
    });
    assert.equal(fakeCtx.counts.pannerSetPos, setPosBeforeStationary, 'Sub-2cm update skips redundant panner writes');
    assert.equal(fakeCtx.counts.biquad, baselineBiquads, 'Swim stroke splash reuses BiquadFilterNode');
    assert.equal(fakeCtx.counts.gain, baselineGains, 'Swim stroke splash reuses GainNode');

    // Park rigs when phase changes / level restarts, then re-approach -> STILL 0 new node graph allocations
    sound.stopSnakeSwimmingAudio(0.05);
    fakeCtx.currentTime += 1.0;
    for (let i = 0; i < 4; i++) {
      sound.updateSnakeSwimmingAudio(`serpent_next_${i}`, {
        worldX: i * 4,
        worldY: -0.14,
        worldZ: -10,
        waterY: 0,
        speed: 12,
        swimPhase: 2.0,
        distToListener: 10,
        isChasing: true,
        isEating: false,
        isSwimming: true,
        listenerUnderwater: false,
        scale: 1,
      });
    }
    assert.equal(fakeCtx.counts.panner, baselinePanners, 'Pooled swim rigs reuse cleanly after stop/restart');
    assert.equal(fakeCtx.counts.osc, baselineOscs, 'Pooled swim oscillators reuse cleanly without recreation');

    sound.dispose();
  } finally {
    (globalThis as any).window = origWindow;
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: origNav });
    (globalThis as any).fetch = origFetch;
  }
  console.log('2. PASS: SoundEngine silent HRTF warmup, async predecode, pooled swim rigs & zero splash node churn verified.');
}

function testPrewarmSceneShadersCompleteness(): void {
  const textures = makeMockTextures();
  const eng = Object.create(PoolGameEngine.prototype) as any;

  eng.isSoftwareGl = false;
  eng.activeQuality = 'ultra';
  eng.coreShadersWarmed = true; // Simulate second+ level / character swap where old early-return skipped work!
  eng.horrorShadowWarmed = true;
  eng.horrorComposerWarmed = true;
  eng.scene = new THREE.Scene();
  eng.camera = new THREE.PerspectiveCamera(68, 16 / 9, 0.1, 240);
  eng._prewarmScissor = new THREE.Vector4();
  eng._prewarmViewport = new THREE.Vector4();

  // First-person player rig with child meshes hidden initially (as ensureLocalPlayerVisible does when invertY=false)
  eng.playerRig = createPlayerRig(textures, 0x52e0b6, false, 'female');
  eng.scene.add(eng.playerRig.root);
  const hiddenBodyMeshes: THREE.Mesh[] = [];
  eng.playerRig.root.traverse((o: THREE.Object3D) => {
    if ((o as THREE.Mesh).isMesh) {
      o.visible = false;
      hiddenBodyMeshes.push(o as THREE.Mesh);
    }
  });
  eng.ensureLocalPlayerVisible = () => {
    for (const m of hiddenBodyMeshes) m.visible = false;
  };

  // Distant serpent with hidden jawTendons & wake rings
  const mRig = createMonsterRig(textures, 1.0);
  mRig.root.position.set(0, -0.14, -120);
  for (const td of mRig.jawTendons) td.visible = false;
  mRig.wakeRing.visible = false;
  mRig.bowWake.visible = false;
  eng.scene.add(mRig.root);
  eng.monsters = [{ rig: mRig }];

  // Directional keyLight with tight initial 42m shadow camera
  const kl = new THREE.DirectionalLight(0xffffff, 1);
  kl.castShadow = true;
  kl.shadow.camera.left = -42;
  kl.shadow.camera.right = 42;
  kl.shadow.camera.top = 42;
  kl.shadow.camera.bottom = -42;
  kl.shadow.camera.far = 135;
  eng.keyLight = kl;

  eng.horrorSpotLight = new THREE.SpotLight('#bcdce6', 0, 24, 0.42, 0.62, 1.55);
  eng.splashMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial(), 4);
  eng.splashMesh.count = 0;

  let compileCount = 0;
  let renderCount = 0;
  let composerRenderCount = 0;
  let observedBodyVisibleDuringRender = false;
  let observedTendonVisibleDuringRender = false;
  let observedSplashVisibleDuringRender = false;
  let observedWidenedShadowRight = 0;
  let observedWidenedShadowFar = 0;
  let observedSpotIntensity = 0;

  eng.renderer = {
    autoClear: true,
    compile: () => {
      compileCount++;
    },
    render: () => {
      renderCount++;
      observedBodyVisibleDuringRender = hiddenBodyMeshes.every((m) => m.visible);
      observedTendonVisibleDuringRender = mRig.jawTendons.every((td) => td.visible) && mRig.wakeRing.visible && mRig.bowWake.visible;
      observedSplashVisibleDuringRender = eng.splashMesh.count >= 1;
      observedWidenedShadowRight = kl.shadow.camera.right;
      observedWidenedShadowFar = kl.shadow.camera.far;
      observedSpotIntensity = eng.horrorSpotLight.intensity;
    },
    getScissorTest: () => false,
    setScissorTest: () => {},
    getScissor: () => {},
    setScissor: () => {},
    getViewport: () => {},
    setViewport: () => {},
    setRenderTarget: () => {},
  };
  eng.horrorPass = {
    uniforms: {
      uIntensity: { value: 0 },
      uMotionBlur: { value: 0 },
      uChroma: { value: 0 },
      uVignette: { value: 0 },
    },
  };
  eng.horrorComposer = {
    render: () => {
      composerRenderCount++;
    },
  };

  eng.prewarmSceneShaders();

  assert.equal(compileCount, 1, 'prewarmSceneShaders must always compile scene shaders even after first load');
  assert.equal(renderCount, 1, 'prewarmSceneShaders must perform 1x1 scissor render on every level load/character swap');
  assert.equal(composerRenderCount, 1, 'prewarmSceneShaders must warm EffectComposer when quality != smooth');
  assert.equal(observedBodyVisibleDuringRender, true, 'All First-Person hidden character meshes must become visible during prewarm');
  assert.equal(observedTendonVisibleDuringRender, true, 'All jawTendons & wake rings must become visible during prewarm');
  assert.equal(observedSplashVisibleDuringRender, true, 'splashMesh must render at least 1 instance during prewarm');
  assert.equal(observedWidenedShadowRight, 500, 'keyLight shadow camera must widen to include distant serpents during prewarm');
  assert.ok(observedWidenedShadowFar >= 600, 'keyLight shadow camera far must expand during prewarm');
  assert.equal(observedSpotIntensity, 0.01, 'horrorSpotLight must be non-zero during prewarm');

  // Verify complete state restoration
  assert.equal(hiddenBodyMeshes.every((m) => !m.visible), true, 'First-person body meshes must restore hidden state');
  assert.equal(mRig.jawTendons.every((td) => !td.visible), true, 'jawTendons must restore hidden state');
  assert.equal(mRig.wakeRing.visible, false, 'wakeRing must restore hidden state');
  assert.equal(eng.splashMesh.count, 0, 'splashMesh count must restore to 0');
  assert.equal(kl.shadow.camera.right, 42, 'keyLight shadow bounds must restore cleanly');
  assert.equal(kl.shadow.camera.far, 135, 'keyLight shadow far must restore cleanly');
  assert.equal(eng.horrorSpotLight.intensity, 0, 'horrorSpotLight intensity must restore to 0');

  eng.playerRig.dispose();
  mRig.dispose();
  disposeEntityResources(textures);
  textures.dispose();
  console.log('3. PASS: Complete shader/shadow/first-person/devour-tendon/composer prewarm & state restoration verified.');
}

function testChaseApproachWatchAndDevourSmoothPerf(): void {
  const textures = makeMockTextures();
  const def = getLevelById(50);
  const eng = Object.create(PoolGameEngine.prototype) as any;
  eng.disposed = false;
  eng.phase = 'playing';
  eng.currentLevel = def;
  eng.scene = new THREE.Scene();
  eng.camera = new THREE.PerspectiveCamera(68, 16 / 9, 0.1, 240);
  eng.spatialGrid = new LevelSpatialGrid(def, 12);
  eng.simTime = 10;
  eng.renderFrameIdx = 0;
  eng.isMultiplayer = false;
  eng.playerWaterEpoch = 0;
  eng.playerInWaterSession = false;
  eng.pendingClimbIntimidation = false;
  eng.isWatchedFreezeActive = false;
  eng.watchFreezeGraceTimer = 0;
  eng.watchMoveAttempted = false;
  eng.watchAnchorX = 0;
  eng.watchAnchorZ = 0;
  eng.grounded = false;
  eng.stoodPlatform = null;
  eng.inWater = true;
  eng.wasInWater = true;
  eng.waterJumpTimer = 0;
  eng.waterJumpCooldown = 0;
  eng.coyoteTimer = 0;
  eng.jumpBufferTimer = 0;
  eng.pushStaggerTimer = 0;
  eng.pushRecoveryTimer = 0;
  eng.lastJumpInputAt = 0;
  eng.heldKeys = new Set();
  eng.virtualMove = { x: 0, y: 0 };
  eng.virtualRun = false;
  eng.virtualAutoRun = false;
  eng.playerRig = createPlayerRig(textures, 0x52e0b6, false, 'female');
  eng.playerPos = new THREE.Vector3(0, def.bounds.waterY - 0.3, -15);
  eng.playerVel = new THREE.Vector3();
  eng.playerYaw = Math.PI;
  eng.activeSpawn = new THREE.Vector3(def.spawn[0], def.spawn[1], def.spawn[2]);
  eng.camYaw = 0;
  eng.camPitch = 0.2;
  eng.camShake = 0;
  eng.spawnSplash = () => {};
  eng.syncAudioListener = () => {};
  eng.syncAllMonstersSwimmingAudio = () => {};
  eng.sound = {
    playSerpentEmerge: () => {},
    playSplash: () => {},
    playJump: () => {},
    playLand: () => {},
    playStep: () => {},
    updateAtmosphere: () => {},
    updateSnakeSwimmingAudio: () => {},
    pruneSnakeSwimmingAudio: () => {},
    stopSnakeSwimmingAudio: () => {},
  };

  let triggerDeathCalls = 0;
  eng.triggerDeath = () => {
    triggerDeathCalls++;
  };

  eng.walls = def.walls.map((w) => ({
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
  eng.platforms = def.platforms.map((p) => {
    const q = new THREE.Quaternion();
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
      isRotated: false,
      state: 'solid',
      stateTimer: 0,
    };
  });

  // Mirror PoolGameEngine's spatialGrid obstacle lookup in checkMonsterBlockedFn
  eng._cbMobX = 0;
  eng._cbMobZ = 0;
  eng._cbMobNearR = 0;
  eng._cbMobBotY = 0;
  eng._cbMobTopY = 0;
  const _tPlatIdx: number[] = [];
  const _tWallIdx: number[] = [];
  const _tPlats: any[] = [];
  const _tWalls: any[] = [];
  eng.checkMonsterBlockedFn = (cx: number, cz: number, cr: number) => {
    _tPlats.length = 0;
    _tWalls.length = 0;
    eng.spatialGrid.queryRadius(cx, cz, cr + 0.5, _tPlatIdx, _tWallIdx);
    for (let i = 0; i < _tPlatIdx.length; i++) {
      const p = eng.platforms[_tPlatIdx[i]];
      if (p && p.state !== 'gone') _tPlats.push(p);
    }
    for (let i = 0; i < _tWallIdx.length; i++) {
      const w = eng.walls[_tWallIdx[i]];
      if (w) _tWalls.push(w);
    }
    return eng.isCircleBlocked(cx, cz, cr, eng._cbMobBotY, eng._cbMobTopY, _tPlats, _tWalls);
  };

  const monsterRigs = def.monsters.map((mc) => {
    const rig = createMonsterRig(textures, mc.scale || 1);
    const wp = mc.waypoints[0] || [0, -30];
    const pos = new THREE.Vector3(wp[0], def.bounds.waterY - 0.14, wp[1]);
    resetSerpentTrail(rig, pos, 0);
    return {
      id: mc.id,
      rig,
      pos,
      yaw: 0,
      targetYaw: 0,
      targetUserId: null,
      waypoints: mc.waypoints,
      wpIndex: 1 % Math.max(1, mc.waypoints.length),
      patrolSpeed: mc.patrolSpeed,
      chaseSpeed: mc.chaseSpeed,
      detectionRadius: mc.detectionRadius,
      waterDetectionRadius: mc.waterDetectionRadius,
      scale: mc.scale || 1,
      alert: 'calm' as const,
      searchTarget: pos.clone(),
      searchTimer: 0,
      velX: 0,
      velZ: 0,
      avoidDir: 1 as const,
      avoidTimer: 0,
      stuckTimer: 0,
      navBestDist: Infinity,
      navStallTimer: 0,
      navAnchorX: pos.x,
      navAnchorZ: pos.z,
      navAnchorTimer: 0,
      navTurnAccum: 0,
      emerged: false,
      wakeSplashTimer: 0,
      eatingUserId: null,
      eatingTimer: 0,
      eatingProgress: -1,
      eatingPreyStartPos: pos.clone(),
      eatingPreyStartYaw: 0,
      eatingGulpStage: 0,
      eatingSwallowAudioPlayed: false,
      safeEpoch: 0,
      intimidationPhase: 'none' as const,
      intimidationTimer: 0,
      intimidationDuration: 0,
      intimidationSpot: pos.clone(),
      intimidationPlatform: null,
      intimidationLocalOffset: new THREE.Vector3(),
      intimidationYaw: 0,
      diveTimer: 0,
      visionState: 'none' as const,
      visionTimer: 0,
      watchingUserId: null,
      lookAway: false,
      lookAwayYaw: 0,
      lastEdgeSpotTime: -1,
      lastEdgeSpotPlayerX: NaN,
      lastEdgeSpotPlayerZ: NaN,
    };
  });
  eng.monsters = monsterRigs;

  // Warmup 50 ticks exercising active close-approach chase + devour animation path
  for (let i = 0; i < 50; i++) {
    eng.renderFrameIdx++;
    eng.simTime += 0.016;
    eng.playerPos.set(Math.sin(i * 0.05) * 2.5, def.bounds.waterY - 0.2, monsterRigs[0].pos.z + 2.6);
    eng.updateMonsters(0.016, true);
    const u = (i % 50) / 50;
    animateMonsterRig(monsterRigs[0].rig, 'chasing', eng.playerPos, monsterRigs[0].pos, monsterRigs[0].yaw, 0, eng.simTime, 0.016, 1.0, u);
    attachPreyToSerpentMouth(monsterRigs[0].rig, eng.playerRig, u, eng.simTime, 0.016, eng.playerPos, monsterRigs[0].yaw);
  }

  let maxFrameMs = 0;
  let totalFrameMs = 0;
  const frameTimes: number[] = [];
  const FRAMES = 600;
  for (let f = 0; f < FRAMES; f++) {
    eng.renderFrameIdx++;
    eng.simTime += 0.016;
    // Oscillate distance including tight close-approach (<3.4m) to exercise 6x substep fast-steer
    eng.playerPos.set(Math.sin(f * 0.04) * 3.0, def.bounds.waterY - 0.2, monsterRigs[0].pos.z + 2.6);
    triggerDeathCalls = 0;

    const t0 = performance.now();
    eng.updateMonsters(0.016, true);
    const u = (f % 100) / 100;
    animateMonsterRig(monsterRigs[0].rig, 'chasing', eng.playerPos, monsterRigs[0].pos, monsterRigs[0].yaw, 0, eng.simTime, 0.016, 1.0, u);
    attachPreyToSerpentMouth(monsterRigs[0].rig, eng.playerRig, u, eng.simTime, 0.016, eng.playerPos, monsterRigs[0].yaw);
    const dtMs = performance.now() - t0;

    totalFrameMs += dtMs;
    frameTimes.push(dtMs);
    if (dtMs > maxFrameMs) maxFrameMs = dtMs;
  }

  frameTimes.sort((a, b) => a - b);
  const avgMs = totalFrameMs / FRAMES;
  const p95Ms = frameTimes[Math.floor(FRAMES * 0.95)];
  const p99Ms = frameTimes[Math.floor(FRAMES * 0.99)];
  assert.ok(avgMs < 1.0, `Average chase+approach+devour frame time must stay <1ms (got ${avgMs.toFixed(3)}ms)`);
  assert.ok(p95Ms < 1.5, `P95 chase+approach+devour frame time must stay <1.5ms (got ${p95Ms.toFixed(3)}ms)`);
  assert.ok(p99Ms < 3.0, `P99 chase+approach+devour frame time must stay <3.0ms (got ${p99Ms.toFixed(3)}ms)`);
  assert.equal(SERPENT_WATCH_DURATION_SEC, 5.0, '5-second watch mechanic constant must remain untouched');

  // Verify engine source architectural guards
  const engineSrc = fs.readFileSync(path.join(process.cwd(), 'src/game/engine.ts'), 'utf8');
  assert.ok(engineSrc.includes('_fallbackPlatforms'), 'checkMonsterBlockedFn must use spatialGrid fallback instead of full-level O(N) scans');
  assert.ok(engineSrc.includes('kl.shadow.camera.right = 500'), 'prewarmSceneShaders must expand shadow frustum to compile distant serpents upfront');
  assert.ok(engineSrc.includes('this.sound.prewarmMonsterSwimAudio'), 'loadLevel must prewarm serpent swim audio rigs');
  assert.ok(engineSrc.includes('this.prewarmSceneShaders()'), 'setCharacter must re-prewarm new character shaders/textures');

  eng.playerRig.dispose();
  for (const m of monsterRigs) m.rig.dispose();
  disposeEntityResources(textures);
  textures.dispose();
  console.log(
    `4. PASS: Close-approach/attack/devour perf verified (avg ${avgMs.toFixed(3)}ms, p99 ${p99Ms.toFixed(3)}ms, peak ${maxFrameMs.toFixed(3)}ms, watch=${SERPENT_WATCH_DURATION_SEC}s).`
  );
}

(async () => {
  await testPreloaderAudioBufferPinning();
  await testSoundEngineHrtfWarmupAndRigPooling();
  testPrewarmSceneShadersCompleteness();
  testChaseApproachWatchAndDevourSmoothPerf();
  console.log('\nALL APPROACH FREEZE FIXES, ASSET PREWARMING & MAIN-THREAD PERF TESTS PASSED!');
  process.exit(0);
})().catch((err) => {
  console.error('\nTEST FAILED:', err);
  process.exit(1);
});
