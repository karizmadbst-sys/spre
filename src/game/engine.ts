import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SoundEngine } from './audio';
import { setCharacterTextureAnisotropy } from './characters';
import {
  animateMonsterRig,
  animatePlayerDeath,
  animatePlayerRig,
  attachPreyToSerpentMouth,
  CheckpointVisual,
  computeSerpentDevourAirborneLift,
  createCheckpointVisual,
  createExitGateMesh,
  createMonsterRig,
  createNameplateSprite,
  createPlayerRig,
  disposeEntityResources,
  markEntityTexturesDirty,
  MonsterRig,
  PlayerAnimState,
  PlayerRig,
  resetPlayerRigPose,
  resetSerpentTrail,
  SerpentIntimidationAnim,
  SerpentIntimidationPhase,
  setEntityQualityTier,
  syncSerpentBones,
} from './entities';
import { getLevelById, TOTAL_LEVELS } from './levels';
import {
  computeOpenWorldSpawnSlot,
  findReachableWorldCheckpoint,
  getConnectorIdsForRegions,
  getNearbyWorldRegionIds,
  getWorldCheckpointById,
  getWorldConnectorDef,
  getWorldRegionAtPos,
  getWorldRegionDef,
  getWorldRegionMeta,
  OPEN_WORLD_BOUNDS,
  OPEN_WORLD_SPAWN,
  type WorldConnectorDef,
  type WorldRegionRuntimeDef,
} from './openWorld';
import {
  computeSerpentSteerAngle,
  normalizeAngle,
  resetSerpentNavProgress,
  resolvePatrolTarget,
  selectClosestPatrolWaypoint,
  SERPENT_INTIMIDATION_LOWER_SEC,
  SERPENT_INTIMIDATION_RISE_SEC,
  SERPENT_WATCH_DURATION_SEC,
  SERPENT_WATCH_FREEZE_GRACE_SEC,
  type SerpentNavState,
  shortestAngleDiffNav,
  updateSerpentProgressAndYaw,
} from './serpentNav';
import { LevelSpatialGrid } from './spatialGrid';
import { createProceduralTextures, TextureBundle } from './textures';
import { preloadCoreAssets, waitAnimationFrames } from './preloader';
import {
  ActiveQualityTier,
  CharacterId,
  GamePhase,
  GameSettings,
  HudSnapshot,
  LevelDef,
  MonsterConfig,
  normalizeCharacterId,
  normalizeQualityPreset,
  PlatformDef,
  sanitizeGameSettings,
  WallDef,
  WorldMode,
} from './types';
import type {
  CoopPlayerEatenBroadcast,
  CoopPlayerMoveBroadcast,
  CoopPlayerSnapshot,
  CoopRespawnPayload,
} from '../coop/types';

const EAT_DURATION_MS = 2300;

function isPlayerAtExitPortal(
  def: LevelDef,
  x: number,
  y: number,
  z: number,
  generous = false
): boolean {
  const ex = def.exit.position;
  const sz = def.exit.size;
  const padXZ = generous ? 1.45 : 0;
  const padY = generous ? 1.0 : 0;
  const halfX = sz[0] * 0.65 + padXZ;
  const halfZ = Math.max(1.5, sz[2]) + padXZ;
  const halfY = 2.5 + padY;
  return (
    Math.abs(x - ex[0]) < halfX &&
    Math.abs(z - ex[2]) < halfZ &&
    Math.abs(y - ex[1]) < halfY
  );
}

// Reusable module-scope math objects for zero per-frame GC
const _vForward = new THREE.Vector3();
const _vRight = new THREE.Vector3();
const _vMove = new THREE.Vector3();
const _vCamTarget = new THREE.Vector3();
const _vCamPos = new THREE.Vector3();
const _vPlayerPos = new THREE.Vector3();
const _vDelta = new THREE.Vector3();
const _vSegWorld = new THREE.Vector3();
const _vPrevFeet = new THREE.Vector3();
const _vLocal = new THREE.Vector3();
const _vLocalPrev = new THREE.Vector3();
const _vAxisX = new THREE.Vector3();
const _vAxisY = new THREE.Vector3();
const _vAxisZ = new THREE.Vector3();
const _vBestNormal = new THREE.Vector3();
const _vCandNormal = new THREE.Vector3();
const _qTmp = new THREE.Quaternion();
const _eTmp = new THREE.Euler(0, 0, 0, 'YXZ');
const _mSplash = new THREE.Matrix4();
const _vSplashScale = new THREE.Vector3();
const _qIdentity = new THREE.Quaternion();
const _pickedLights: number[] = [];
const _pickedLightSet = new Set<number>();
const _nearPlatforms: RuntimePlatform[] = [];
const _nearWalls: RuntimeWall[] = [];
const _emptyPlatforms: RuntimePlatform[] = [];
const _emptyWalls: RuntimeWall[] = [];
const _vMonsterVel = new THREE.Vector3();
const _vLookAhead = new THREE.Vector3();
const _vEatHeadPos = new THREE.Vector3();
const _vSwimHeadPos = new THREE.Vector3();
const _vHorrorJawPos = new THREE.Vector3();
const _vListenerFwd = new THREE.Vector3();
const _vListenerUp = new THREE.Vector3();
const _activeSwimIds = new Set<string>();
const _horrorAbyssColor = new THREE.Color('#030608');
const _horrorHemiSky = new THREE.Color('#132128');
const _horrorBaseHemiSky = new THREE.Color('#9fc4d1');

const HorrorDevourShader = {
  uniforms: {
    tDiffuse: { value: null },
    uIntensity: { value: 0 },
    uMotionBlur: { value: 0 },
    uChroma: { value: 0 },
    uVignette: { value: 0 },
    uGrain: { value: 0.042 },
    uTime: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uIntensity;
    uniform float uMotionBlur;
    uniform float uChroma;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uTime;
    varying vec2 vUv;

    float hash12(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    void main() {
      vec2 center = vec2(0.5, 0.48);
      vec2 dir = vUv - center;
      float dist = length(dir);

      vec3 col;
      if (uMotionBlur > 0.001) {
        vec3 accum = vec3(0.0);
        float totalW = 0.0;
        float blurAmt = uMotionBlur * (0.35 + dist * 1.18);
        for (int i = 0; i < 5; i++) {
          float fi = (float(i) * 0.25) - 0.5;
          vec2 sampleUv = clamp(vUv - dir * (fi * blurAmt), 0.001, 0.999);
          float w = 1.0 - abs(fi) * 0.72;
          accum += texture2D(tDiffuse, sampleUv).rgb * w;
          totalW += w;
        }
        col = accum / totalW;
      } else {
        col = texture2D(tDiffuse, vUv).rgb;
      }

      if (uChroma > 0.0001) {
        vec2 chromaOff = dir * uChroma * (0.4 + dist * 1.65);
        float r = texture2D(tDiffuse, clamp(vUv - chromaOff, 0.001, 0.999)).r;
        float b = texture2D(tDiffuse, clamp(vUv + chromaOff, 0.001, 0.999)).b;
        col.r = mix(col.r, r, 0.65);
        col.b = mix(col.b, b, 0.65);
      }

      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      float redDom = clamp((col.r - max(col.g, col.b)) * 2.2, 0.0, 1.0);
      vec3 coldShadow = mix(col, vec3(luma) * vec3(0.80, 0.90, 0.98), 0.44 * uIntensity * (1.0 - redDom));
      float shadowCrush = smoothstep(0.0, 0.28, luma);
      vec3 crushed = coldShadow * mix(0.40, 1.14, shadowCrush);
      vec3 graded = mix(col, crushed, 0.74 * uIntensity);
      graded = mix(graded, col * vec3(1.18, 0.86, 0.83), redDom * 0.45 * uIntensity);

      float vig = smoothstep(0.24, 1.08, dist * (0.94 + 0.36 * uVignette));
      graded *= mix(1.0, 0.12, clamp(vig * uVignette, 0.0, 0.94));
      graded += vec3(0.08, 0.004, 0.004) * vig * uVignette * 0.55;

      float g = (hash12(vUv * 512.0 + fract(uTime * 17.3) * 100.0) - 0.5) * uGrain * uIntensity;
      graded = max(vec3(0.0), graded + g);

      gl_FragColor = vec4(graded, 1.0);
    }
  `,
};
const _nearPlatIdx: number[] = [];
const _nearWallIdx: number[] = [];
const _fallbackPlatIdx: number[] = [];
const _fallbackWallIdx: number[] = [];
const _fallbackPlatforms: RuntimePlatform[] = [];
const _fallbackWalls: RuntimeWall[] = [];
const _camPlatIdx: number[] = [];
const _camWallIdx: number[] = [];
const _vCamLocalOrig = new THREE.Vector3();
const _vCamLocalDir = new THREE.Vector3();
const _mBake = new THREE.Matrix4();
const _qBake = new THREE.Quaternion();
const _sBake = new THREE.Vector3(1, 1, 1);
const _pBake = new THREE.Vector3();
const _eBake = new THREE.Euler(0, 0, 0, 'YXZ');
const _monsterNavScratch: SerpentNavState = {
  x: 0,
  z: 0,
  yaw: 0,
  velX: 0,
  velZ: 0,
  wpIndex: 0,
  waypoints: [],
  avoidDir: 1,
  avoidTimer: 0,
  stuckTimer: 0,
  navBestDist: Infinity,
  navStallTimer: 0,
  navAnchorX: 0,
  navAnchorZ: 0,
  navAnchorTimer: 0,
  navTurnAccum: 0,
};
const _escRadii = [0.25, 0.5, 0.85, 1.25];
const _camCandOffsets = [0.65, -0.65, 1.15, -1.15, 1.65, -1.65, Math.PI];
const _retreatOffsets = [0, 0.45, -0.45, 0.9, -0.9, 1.35, -1.35, Math.PI];
const _retreatDists = [3.5, 7.0, 11.5, 16.0];
const _edgeCandX = new Float64Array(9);
const _edgeCandZ = new Float64Array(9);
const _intimAnimScratch: SerpentIntimidationAnim = {
  phase: 'none',
  phaseProgress: 0,
  stareElapsed: 0,
};
const _swimAudioScratch = {
  worldX: 0,
  worldY: 0,
  worldZ: 0,
  waterY: 0,
  speed: 0,
  swimPhase: 0,
  distToListener: 0,
  isChasing: false,
  isEating: false,
  isSwimming: false,
  listenerUnderwater: false,
  scale: 1,
};
const EAT_DURATION_SEC = EAT_DURATION_MS / 1000;
const CHUNK_Z_SPAN = 36;

interface RuntimePlatform {
  def: PlatformDef;
  mesh: THREE.Object3D;
  material: THREE.MeshStandardMaterial;
  baseColorHex: number;
  boundRadiusXZ: number;
  currentPos: THREE.Vector3;
  prevPos: THREE.Vector3;
  currentQuat: THREE.Quaternion;
  prevQuat: THREE.Quaternion;
  invQuat: THREE.Quaternion;
  prevInvQuat: THREE.Quaternion;
  isRotated: boolean;
  state: 'solid' | 'warning' | 'gone';
  stateTimer: number;
}

interface RuntimeWall {
  centerX: number;
  centerZ: number;
  boundRadiusXZ: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

interface RuntimeMonster {
  id: string;
  rig: MonsterRig;
  pos: THREE.Vector3;
  yaw: number;
  targetYaw: number;
  targetUserId: string | null;
  waypoints: [number, number][];
  wpIndex: number;
  patrolSpeed: number;
  chaseSpeed: number;
  detectionRadius: number;
  waterDetectionRadius: number;
  scale: number;
  alert: 'calm' | 'searching' | 'chasing';
  searchTarget: THREE.Vector3;
  searchTimer: number;
  velX: number;
  velZ: number;
  avoidDir: -1 | 1;
  avoidTimer: number;
  stuckTimer: number;
  navBestDist: number;
  navStallTimer: number;
  navAnchorX: number;
  navAnchorZ: number;
  navAnchorTimer: number;
  navTurnAccum: number;
  emerged: boolean;
  wakeSplashTimer: number;
  eatingUserId: string | null;
  eatingTimer: number;
  eatingProgress: number;
  eatingPreyStartPos: THREE.Vector3;
  eatingPreyStartYaw: number;
  eatingGulpStage: number;
  eatingSwallowAudioPlayed: boolean;
  safeEpoch: number;
  intimidationPhase: SerpentIntimidationPhase;
  intimidationTimer: number;
  intimidationDuration: number;
  intimidationSpot: THREE.Vector3;
  intimidationPlatform: RuntimePlatform | null;
  intimidationLocalOffset: THREE.Vector3;
  intimidationYaw: number;
  diveTimer: number;
  visionState: 'none' | 'approaching' | 'watching' | 'look_away' | 'lunging';
  visionTimer: number;
  watchingUserId: string | null;
  lookAway: boolean;
  lookAwayYaw: number;
  lastEdgeSpotTime?: number;
  lastEdgeSpotPlayerX?: number;
  lastEdgeSpotPlayerZ?: number;
}

interface SplashParticle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

export interface EngineCallbacks {
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onPhaseChange: (phase: GamePhase, extra?: { deathReason?: 'caught' | 'timeout'; elapsed?: number }) => void;
  onOpenWorldCheckpoint?: (
    checkpointId: string,
    regionId: number,
    label: string,
    x?: number,
    y?: number,
    z?: number
  ) => void;
  onCoopStateEmit?: (state: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    animState: PlayerAnimState;
    horizSpeed: number;
    regionId: number;
    inWater: boolean;
  }) => void;
  onCoopPlayerEaten?: (event: {
    deathSeq: number;
    monsterId: string;
    monsterX: number;
    monsterY: number;
    monsterZ: number;
    playerX: number;
    playerY: number;
    playerZ: number;
    playerYaw: number;
  }) => void;
  onCoopRequestRespawn?: (deathSeq: number) => void;
}

interface RemoteCoopPlayer {
  playerId: string;
  name: string;
  characterId: CharacterId;
  colorHex: string;
  rig: PlayerRig;
  nameplate: THREE.Sprite;
  pos: THREE.Vector3;
  targetPos: THREE.Vector3;
  yaw: number;
  targetYaw: number;
  animState: PlayerAnimState;
  horizSpeed: number;
  regionId: number;
  inWater: boolean;
  connected: boolean;
  alive: boolean;
  eatTimer: number;
  deathSeq: number;
}

interface StaticChunkEntry {
  mesh: THREE.Mesh;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  castShadow: boolean;
  owChunkKey?: string;
}

interface OpenWorldCheckpointMeta {
  id: string;
  regionId: number;
  label: string;
  yaw: number;
}

interface OpenWorldMaterialPalette {
  floorMat: THREE.MeshStandardMaterial;
  ceilMat: THREE.MeshStandardMaterial;
  wallMat: THREE.MeshStandardMaterial;
  pillarMat: THREE.MeshStandardMaterial;
  collarMat: THREE.MeshStandardMaterial;
  beamMat: THREE.MeshStandardMaterial;
  steelMat: THREE.MeshStandardMaterial;
  rustMat: THREE.MeshStandardMaterial;
  rubbleMat: THREE.MeshStandardMaterial;
  dropMat: THREE.MeshStandardMaterial;
  deadMat: THREE.MeshStandardMaterial;
  litMat: THREE.MeshStandardMaterial;
  glassMat: THREE.MeshStandardMaterial;
  bulbMat: THREE.MeshStandardMaterial;
  subFrameMat: THREE.MeshStandardMaterial;
  curbSteelMat: THREE.MeshStandardMaterial;
  woodWetMat: THREE.MeshStandardMaterial;
  woodTrimMat: THREE.MeshStandardMaterial;
  woodIronMat: THREE.MeshStandardMaterial;
  accentMats: Map<string, THREE.MeshStandardMaterial>;
  panelGeo: THREE.BoxGeometry;
  bollardProto: THREE.CylinderGeometry;
  grateMat: THREE.MeshStandardMaterial;
  warnMat: THREE.MeshStandardMaterial;
}

interface OpenWorldChunk {
  key: string;
  bounds: LevelDef['bounds'];
  group: THREE.Group;
  platforms: RuntimePlatform[];
  walls: RuntimeWall[];
  checkpoints: CheckpointVisual[];
  lights: Array<{
    x: number;
    y: number;
    z: number;
    color: THREE.Color;
    baseIntensity: number;
    flickering: boolean;
    seed: number;
    checkpointRef?: CheckpointVisual;
  }>;
  monsters: RuntimeMonster[];
  staticChunkRefs: StaticChunkEntry[];
  disposables: Array<{ dispose: () => void }>;
  shadowReceivers: THREE.Mesh[];
  qualityMaterials: Array<{
    mat: THREE.MeshStandardMaterial;
    origBumpScale: number;
    origEnvIntensity: number;
  }>;
}

function probeGraphicsCapabilities(): { isSoftwareGl: boolean; isLowEndGpu: boolean } {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return { isSoftwareGl: true, isLowEndGpu: true };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    const isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    const isLowEndGpu =
      isSoftwareGl ||
      /Mali-(4\d\d|T[678]\d\d|G31|G51|G52|G57|G68)|Adreno\s*\(TM\)\s*(3\d\d|4\d\d|50\d|51\d|530|61\d)|PowerVR|Intel\(R\)\s*(HD|UHD)\s*Graphics\s*(3000|4000|4\d\d|5\d\d|600|605|610|615|620)|Apple A(9|10|11)\b/i.test(
        gpu
      );
    return { isSoftwareGl, isLowEndGpu };
  } catch {
    return { isSoftwareGl: false, isLowEndGpu: false };
  }
}

function shortestAngleDiff(current: number, target: number): number {
  let diff = (target - current) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

export class PoolGameEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  public sound: SoundEngine;

  private isSoftwareGl: boolean;
  private isLowEndGpu: boolean;
  private isTouchDevice: boolean;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private textures: TextureBundle;
  private envRT: THREE.WebGLRenderTarget | null = null;

  private levelGroup: THREE.Group;
  private currentLevel: LevelDef = getLevelById(1);
  private activeWorldMode: WorldMode = 'sector';
  private owChunks = new Map<string, OpenWorldChunk>();
  private owMats: OpenWorldMaterialPalette | null = null;
  private owCheckpointMeta = new Map<CheckpointVisual, OpenWorldCheckpointMeta>();
  private owActivatedCheckpointIds = new Set<string>();
  private owCurrentRegionId = 1;
  private owCheckpointId: string | null = null;
  private owCheckpointRegionId = 1;
  private owCheckpointLabel: string | null = null;
  private owCheckpointYaw = Math.PI;
  private owLastStreamX = NaN;
  private owLastStreamZ = NaN;
  private owTargetAtmo: ReturnType<PoolGameEngine['computeHorrorAtmosphere']> | null = null;
  private phase: GamePhase = 'menu';
  private settings: GameSettings;

  // Dynamic level objects
  private platforms: RuntimePlatform[] = [];
  private dynamicPlatforms: RuntimePlatform[] = [];
  private staticChunks: StaticChunkEntry[] = [];
  private walls: RuntimeWall[] = [];
  private spatialGrid: LevelSpatialGrid | null = null;
  private checkpoints: CheckpointVisual[] = [];
  private monsters: RuntimeMonster[] = [];
  private hemiLight: THREE.HemisphereLight | null = null;
  private rimLight: THREE.DirectionalLight | null = null;
  private keyLight: THREE.DirectionalLight | null = null;
  private horrorSpotLight: THREE.SpotLight | null = null;
  private horrorComposer: EffectComposer | null = null;
  private horrorPass: ShaderPass | null = null;
  private horrorVisualBlend = 0;
  private horrorVisualActive = false;
  private pointLightPool: THREE.PointLight[] = [];
  private activePointLightLimit = 4;
  private levelLights: Array<{
    x: number;
    y: number;
    z: number;
    color: THREE.Color;
    baseIntensity: number;
    flickering: boolean;
    seed: number;
    checkpointIdx?: number;
    checkpointRef?: CheckpointVisual;
  }> = [];
  private waterMesh: THREE.Mesh | null = null;
  private waterMat: THREE.MeshStandardMaterial | null = null;
  private waterOrigNormalMap: THREE.Texture | null = null;
  private uWaterQuality = { value: 1.0 };
  private uCausticTime = { value: 0 };
  private uCausticEnabled = { value: 1.0 };
  private baseCausticEnabled = 1.0;
  private uCausticRangeSq = { value: 55 * 55 };
  private uMistTime = { value: 0 };
  private levelQualityMaterials: Array<{
    mat: THREE.MeshStandardMaterial;
    origBumpScale: number;
    origEnvIntensity: number;
  }> = [];
  private levelShadowReceivers: THREE.Mesh[] = [];
  private _prewarmScissor = new THREE.Vector4();
  private _prewarmViewport = new THREE.Vector4();
  private baseFogColor = new THREE.Color('#091318');
  private underwaterFogColor = new THREE.Color('#03090c');
  private baseFogDensity = 0.022;
  private baseHemiColor = new THREE.Color('#4f7284');
  private baseHemiIntensity = 0.24;
  private baseRimIntensity = 0.28;
  private baseKeyIntensity = 1.08;
  private exitGroup: THREE.Group | null = null;
  private mistMesh: THREE.InstancedMesh | null = null;
  private mistTex: THREE.CanvasTexture | null = null;
  private coneMesh: THREE.InstancedMesh | null = null;
  private moonShaftMesh: THREE.InstancedMesh | null = null;
  private dustPoints: THREE.Points | null = null;
  private dustMat: THREE.ShaderMaterial | null = null;
  private shaftTex: THREE.CanvasTexture | null = null;
  private grateDecalTex: THREE.CanvasTexture | null = null;
  private warningDecalTex: THREE.CanvasTexture | null = null;
  private levelDisposables: Array<{ dispose: () => void }> = [];

  // Instanced splash particle pool (1 draw call for up to 420 droplets)
  private splashPool: SplashParticle[] = [];
  private splashMaxActive = 240;
  private splashHasActive = false;
  private splashGeo: THREE.SphereGeometry;
  private splashMat: THREE.MeshBasicMaterial;
  private splashMesh: THREE.InstancedMesh;

  // Player state
  private localCharacterId: CharacterId = 'male';
  private suspended = false;
  private overlayOccluded = false;
  private needsStaticRender = true;
  private menuFrameAccum = 0;
  private playerRig: PlayerRig;
  private playerPos = new THREE.Vector3(0, 1.2, 3);
  private playerVel = new THREE.Vector3(0, 0, 0);
  private playerYaw = Math.PI;
  private grounded = false;
  private stoodPlatform: RuntimePlatform | null = null;
  private inWater = false;
  private wasInWater = false;
  private playerWaterEpoch = 0;
  private playerInWaterSession = false;
  private pendingClimbIntimidation = false;
  private isWatchedFreezeActive = false;
  private watchFreezeGraceTimer = 0;
  private watchMoveAttempted = false;
  private watchAnchorX = 0;
  private watchAnchorZ = 0;
  private waterJumpTimer = 0;
  private waterJumpCooldown = 0;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private stamina = 100;
  private exhausted = false;
  private stepTimer = 0;
  private swimSplashTimer = 0;
  private activeSpawn = new THREE.Vector3(0, 1.2, 3);
  private activeCheckpointIndex = 0;
  private checkpointNotice: string | null = null;
  private checkpointNoticeTimer = 0;

  // Camera state
  private camYaw = 0; // 0 looks toward -Z
  private camPitch = 0.24;
  private camDist = 5.0;
  private lastCamThirdPerson = true;
  private camShake = 0;
  private pendingLookDx = 0;
  private pendingLookDy = 0;
  private isDraggingLook = false;
  private activeDragPointerId: number | null = null;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private isPointerLocked = false;
  private pointerLockAcquiredAt = 0;

  // Input state (continuous held + mobile virtual joystick)
  private heldKeys = new Set<string>();
  private virtualMove = { x: 0, y: 0 }; // x: -1..1, y: -1..1 (+y = forward)
  private virtualRun = false;
  private virtualAutoRun = false;

  // Timing & game loop
  private rafId = 0;
  private timerId = 0;
  private pendingSync: WebGLSync | null = null;
  private disposed = false;
  private contextLost = false;
  private resizeObserver: ResizeObserver | null = null;
  private lastTimeMs = 0;
  private simTime = 0;
  private platformTime = 0;
  private levelTimeRemaining = 75;
  private levelTimeElapsed = 0;
  private jumpscareTimer = 0;
  private jumpscareMonster: RuntimeMonster | null = null;
  private deathReason: 'caught' | 'timeout' | null = null;
  private eatingCamSide: 1 | -1 = 1;
  private spRespawning = false;
  private coopMode = false;
  private coopLocalPlayerId: string | null = null;
  private coopPlayers: Map<string, RemoteCoopPlayer> = new Map();
  private coopEmitTimer = 0;
  private coopDeathSeq = 0;
  private coopRespawnSentForSeq = 0;

  // Adaptive performance tracking
  private activeQuality: ActiveQualityTier = 'standard';
  private activeRenderDist = 145;
  private coreShadersWarmed = false;
  private horrorShadowWarmed = false;
  private horrorComposerWarmed = false;
  private _lastLightCamX = NaN;
  private _lastLightCamZ = NaN;
  private _lightPickFrame = 0;
  private _lastCullCamX = NaN;
  private _lastCullCamZ = NaN;
  private _lastCullPhase: GamePhase | '' = '';
  private _lastCullQuality: ActiveQualityTier | '' = '';
  private fpsRing = new Float32Array(24);
  private fpsRingIdx = 0;
  private fpsRingCount = 0;
  private currentFps = 60;
  private qualityEvalTimer = 0;
  private qualityCooldownTimer = 0;
  private slowFrameCount = 0;
  private highFpsStreak = 0;
  private autoDowngradeCount = 0;
  private dynamicResScale = 1.0;
  private renderFrameIdx = 0;
  private _appliedPixelRatio = -1;
  private _appliedViewportW = 0;
  private _appliedViewportH = 0;
  private _appliedShadowEnabled: boolean | null = null;
  private _appliedShadowType: THREE.ShadowMapType | null = null;
  private _appliedAniso = -1;
  private _appliedQualityTier: ActiveQualityTier | '' = '';
  private hudEmitTimer = 0;
  private lastHudSnap = {
    levelId: -1,
    worldMode: '' as WorldMode | '',
    regionId: -1,
    wingIndex: -1,
    wingTitle: '',
    checkpointId: null as string | null,
    checkpointRegionId: -1,
    checkpointLabel: null as string | null,
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
    checkpointNotice: null as string | null,
    activeQuality: '',
    fps: -1,
    isPointerLocked: false,
    deathReason: null as string | null,
  };

  // Player animation cache
  private lastAnimState: PlayerAnimState = 'idle';
  private lastHorizSpeed = 0;
  private _cbMobX = 0;
  private _cbMobZ = 0;
  private _cbMobNearR = 0;
  private _cbMobBotY = 0;
  private _cbMobTopY = 0;
  private readonly checkMonsterBlockedFn = (cx: number, cz: number, cr: number): boolean => {
    if (Math.hypot(cx - this._cbMobX, cz - this._cbMobZ) + cr <= this._cbMobNearR - 1) {
      return this.isCircleBlocked(cx, cz, cr, this._cbMobBotY, this._cbMobTopY, _nearPlatforms, _nearWalls);
    }
    if (this.spatialGrid) {
      _fallbackPlatforms.length = 0;
      _fallbackWalls.length = 0;
      this.spatialGrid.queryRadius(cx, cz, cr + 0.5, _fallbackPlatIdx, _fallbackWallIdx);
      for (let i = 0; i < _fallbackPlatIdx.length; i++) {
        const p = this.platforms[_fallbackPlatIdx[i]];
        if (p && p.state !== 'gone') {
          _fallbackPlatforms.push(p);
        }
      }
      for (let i = 0; i < _fallbackWallIdx.length; i++) {
        const w = this.walls[_fallbackWallIdx[i]];
        if (w) {
          _fallbackWalls.push(w);
        }
      }
      return this.isCircleBlocked(cx, cz, cr, this._cbMobBotY, this._cbMobTopY, _fallbackPlatforms, _fallbackWalls);
    }
    return this.isCircleBlocked(cx, cz, cr, this._cbMobBotY, this._cbMobTopY, this.platforms, this.walls);
  };

  constructor(
    container: HTMLElement,
    settings: GameSettings,
    callbacks: EngineCallbacks,
    initialCharacter: CharacterId = 'male'
  ) {
    this.container = container;
    const cleanSettings = sanitizeGameSettings(settings);
    this.localCharacterId = normalizeCharacterId(initialCharacter);
    this.settings = cleanSettings;
    this.callbacks = callbacks;
    this.sound = new SoundEngine();
    this.sound.setVolumes(cleanSettings.masterVolume, cleanSettings.musicVolume, cleanSettings.sfxVolume, cleanSettings.muted);

    const gpuProbe = probeGraphicsCapabilities();
    this.isSoftwareGl = gpuProbe.isSoftwareGl;
    this.isLowEndGpu = gpuProbe.isLowEndGpu;
    this.isTouchDevice =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      Boolean(window.matchMedia?.('(pointer: coarse)')?.matches);
    this.activeQuality =
      this.settings.quality === 'auto'
        ? this.detectInitialQuality()
        : this.isSoftwareGl
          ? 'smooth'
          : this.settings.quality;

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl && !this.isTouchDevice && !this.isLowEndGpu && this.activeQuality !== 'smooth',
      powerPreference: 'high-performance',
    });
    this.renderer.debug.checkShaderErrors = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;

    const initVp = this.getViewportSize();
    this.renderer.setSize(initVp.w, initVp.h);
    this._appliedViewportW = initVp.w;
    this._appliedViewportH = initVp.h;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(68, initVp.w / initVp.h, 0.1, 240);

    // Procedural dark moonlit poolroom PMREM environment (wet dark tiles, skylight glare, faint emergency slit)
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    const horrorEnv = this.createHorrorEnvironmentScene();
    this.envRT = pmremGenerator.fromScene(horrorEnv.scene, 0.055);
    this.scene.environment = this.envRT.texture;
    horrorEnv.dispose();
    pmremGenerator.dispose();

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const devMem = (navigator as { deviceMemory?: number }).deviceMemory ?? 6;
    const useCompactTextures = this.isSoftwareGl || this.isLowEndGpu || (this.isTouchDevice && devMem <= 3);
    this.textures = createProceduralTextures(
      maxAniso,
      useCompactTextures
    );

    this.levelGroup = new THREE.Group();
    this.scene.add(this.levelGroup);

    this.playerRig = createPlayerRig(this.textures, 0x52e0b6, false, this.localCharacterId);
    this.scene.add(this.playerRig.root);

    // Pre-allocate high-capacity instanced splash pool (1 draw call instead of 420 meshes)
    this.splashGeo = new THREE.SphereGeometry(0.095, 6, 5);
    this.splashMat = new THREE.MeshBasicMaterial({
      color: 0xd6eef4,
      transparent: true,
      opacity: 0.82,
    });
    this.splashMesh = new THREE.InstancedMesh(this.splashGeo, this.splashMat, 420);
    this.splashMesh.count = 0;
    this.splashMesh.frustumCulled = false;
    this.scene.add(this.splashMesh);
    for (let i = 0; i < 420; i++) {
      this.splashPool.push({
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 0.5,
      });
    }

    // Pre-allocated devouring horror spotlight (intensity=0 outside jumpscare; jaw/rim reuse pointLightPool[0..1])
    this.horrorSpotLight = new THREE.SpotLight('#bcdce6', 0, 24, 0.42, 0.62, 1.55);
    this.horrorSpotLight.castShadow = false;
    this.horrorSpotLight.shadow.mapSize.set(1024, 1024);
    this.horrorSpotLight.shadow.camera.near = 0.8;
    this.horrorSpotLight.shadow.camera.far = 20;
    this.horrorSpotLight.shadow.bias = -0.0004;
    this.horrorSpotLight.shadow.normalBias = 0.025;
    this.scene.add(this.horrorSpotLight);
    this.scene.add(this.horrorSpotLight.target);

    if (!this.isSoftwareGl && !this.isTouchDevice && !this.isLowEndGpu) {
      const composerRT = new THREE.WebGLRenderTarget(initVp.w, initVp.h, {
        type: THREE.HalfFloatType,
        samples: 0,
      });
      const composer = new EffectComposer(this.renderer, composerRT);
      composer.addPass(new RenderPass(this.scene, this.camera));
      const horrorPass = new ShaderPass(HorrorDevourShader);
      composer.addPass(horrorPass);
      composer.addPass(new OutputPass());
      this.horrorComposer = composer;
      this.horrorPass = horrorPass;
    }

    this.bindEvents();
    this.applyQualityToRenderer();
    this.loadLevel(1, 'menu');
    this.lastTimeMs = performance.now();
    this.scheduleNextTick(true);
  }

  private getViewportSize(): { w: number; h: number } {
    const winW = typeof window !== 'undefined' ? window.innerWidth : 0;
    const winH = typeof window !== 'undefined' ? window.innerHeight : 0;
    const rawW = this.container?.clientWidth || winW || 1280;
    const rawH = this.container?.clientHeight || winH || 720;
    return {
      w: Math.max(1, Number.isFinite(rawW) ? rawW : 1280),
      h: Math.max(1, Number.isFinite(rawH) ? rawH : 720),
    };
  }

  private syncLocalPlayerRigTransform(animState: PlayerAnimState = 'idle', horizSpeed = 0): void {
    if (
      !Number.isFinite(this.playerPos.x) ||
      !Number.isFinite(this.playerPos.y) ||
      !Number.isFinite(this.playerPos.z)
    ) {
      if (
        Number.isFinite(this.activeSpawn.x) &&
        Number.isFinite(this.activeSpawn.y) &&
        Number.isFinite(this.activeSpawn.z)
      ) {
        this.playerPos.copy(this.activeSpawn);
      } else {
        this.playerPos.set(
          this.currentLevel.spawn[0],
          this.currentLevel.spawn[1],
          this.currentLevel.spawn[2]
        );
      }
      this.playerVel.set(0, 0, 0);
    }
    if (!Number.isFinite(this.playerYaw)) {
      this.playerYaw = Math.PI;
    }
    this.playerRig.root.scale.setScalar(1);
    this.playerRig.root.position.copy(this.playerPos);
    this.playerRig.root.rotation.set(0, this.playerYaw, 0);
    animatePlayerRig(this.playerRig, animState, horizSpeed, this.simTime, 0.016);
    this.playerRig.root.updateMatrixWorld(true);
  }

  private getActiveBounds(): LevelDef['bounds'] {
    return this.activeWorldMode === 'open_world' ? OPEN_WORLD_BOUNDS : this.currentLevel.bounds;
  }

  private groundPlayerOnSpawnPlatform(): void {
    const b = this.getActiveBounds();
    if (
      !Number.isFinite(this.playerPos.x) ||
      !Number.isFinite(this.playerPos.y) ||
      !Number.isFinite(this.playerPos.z) ||
      this.playerPos.y < b.floorY - 0.5 ||
      this.playerPos.y > b.ceilingY + 0.5
    ) {
      if (
        Number.isFinite(this.activeSpawn.x) &&
        Number.isFinite(this.activeSpawn.y) &&
        Number.isFinite(this.activeSpawn.z)
      ) {
        this.playerPos.copy(this.activeSpawn);
      } else {
        this.playerPos.set(
          this.currentLevel.spawn[0],
          this.currentLevel.spawn[1],
          this.currentLevel.spawn[2]
        );
      }
      this.playerVel.set(0, 0, 0);
    }

    if (this.platforms.length === 0) return;

    let bestPlat: RuntimePlatform | null = null;
    let bestTopY = 0;
    let bestDelta = Infinity;
    for (let i = 0; i < this.platforms.length; i++) {
      const p = this.platforms[i];
      if (p.state === 'gone') continue;
      const hw = p.def.size[0] * 0.5 + 0.35;
      const hd = p.def.size[2] * 0.5 + 0.35;
      if (
        Math.abs(this.playerPos.x - p.currentPos.x) <= hw &&
        Math.abs(this.playerPos.z - p.currentPos.z) <= hd
      ) {
        const topY = p.currentPos.y + p.def.size[1] * 0.5;
        const delta = Math.abs(this.playerPos.y - topY);
        if (delta <= 1.8 && delta < bestDelta) {
          bestDelta = delta;
          bestTopY = topY;
          bestPlat = p;
        }
      }
    }

    if (bestPlat) {
      this.playerPos.y = bestTopY;
      this.playerVel.y = 0;
      this.grounded = true;
      this.stoodPlatform = bestPlat;
      this.inWater = false;
      this.wasInWater = false;
    }
  }

  private isThirdPersonView(): boolean {
    return this.settings ? Boolean(this.settings.invertY) : true;
  }

  private isLocalFirstPersonActive(): boolean {
    return (
      !this.isThirdPersonView() &&
      (this.phase === 'playing' || this.phase === 'paused')
    );
  }

  private syncFirstPersonHeadlamp(): void {
    if (!this.isLocalFirstPersonActive()) return;
    const yaw = Number.isFinite(this.camYaw) ? this.camYaw : 0;
    const pitch = Number.isFinite(this.camPitch) ? this.camPitch : 0.25;
    const bodyYaw = Number.isFinite(this.playerYaw) ? this.playerYaw : Math.PI;
    const eyeOffset = this.inWater ? 1.52 : 1.58;
    this.playerRig.lampAnchor.position.set(0, eyeOffset, 0);
    _eTmp.set(pitch, yaw + Math.PI - bodyYaw, 0, 'YXZ');
    this.playerRig.lampAnchor.quaternion.setFromEuler(_eTmp);
    this.playerRig.lampAnchor.updateMatrixWorld(true);
  }

  private restoreLocalPlayerMeshes(): void {
    this.playerRig.root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        obj.visible = true;
        obj.frustumCulled = false;
      }
    });
  }

  private ensureLocalPlayerVisible(): void {
    const shouldBeVisible = this.phase === 'playing' || this.phase === 'paused';
    if (!shouldBeVisible) return;

    if (this.playerRig.root.parent !== this.scene) {
      this.scene.add(this.playerRig.root);
    }
    if (
      !Number.isFinite(this.playerPos.x) ||
      !Number.isFinite(this.playerPos.y) ||
      !Number.isFinite(this.playerPos.z)
    ) {
      if (
        Number.isFinite(this.activeSpawn.x) &&
        Number.isFinite(this.activeSpawn.y) &&
        Number.isFinite(this.activeSpawn.z)
      ) {
        this.playerPos.copy(this.activeSpawn);
      } else {
        this.playerPos.set(
          this.currentLevel.spawn[0],
          this.currentLevel.spawn[1],
          this.currentLevel.spawn[2]
        );
      }
      this.playerVel.set(0, 0, 0);
    }
    if (!Number.isFinite(this.playerYaw)) {
      this.playerYaw = Math.PI;
    }
    const hp = this.playerRig.hips.position;
    if (!Number.isFinite(hp.x) || !Number.isFinite(hp.y) || !Number.isFinite(hp.z)) {
      resetPlayerRigPose(this.playerRig);
    }
    this.playerRig.root.scale.setScalar(1);
    this.playerRig.setVisible(true);
    const hideLocalMeshes = this.isLocalFirstPersonActive();
    this.playerRig.root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        obj.visible = !hideLocalMeshes;
        obj.frustumCulled = false;
      }
    });
    if (hideLocalMeshes) {
      this.syncFirstPersonHeadlamp();
    }
  }

  private detectInitialQuality(): ActiveQualityTier {
    if (this.isSoftwareGl || this.isLowEndGpu) return 'smooth';
    const mem = (navigator as { deviceMemory?: number }).deviceMemory ?? 8;
    const cores = navigator.hardwareConcurrency ?? 8;
    if (this.isTouchDevice) {
      return cores <= 4 || mem <= 3 ? 'smooth' : mem >= 6 && cores >= 8 ? 'standard' : 'standard';
    }
    return cores <= 4 || mem <= 4 ? 'standard' : 'ultra';
  }

  private resetFpsTracker(): void {
    this.fpsRingIdx = 0;
    this.fpsRingCount = 0;
    this.slowFrameCount = 0;
    this.highFpsStreak = 0;
    this.qualityEvalTimer = 0;
  }

  private ensureLoopRunning(): void {
    if (this.disposed || this.suspended || this.contextLost) return;
    if (this.rafId === 0 && this.timerId === 0 && !this.pendingSync) {
      this.lastTimeMs = performance.now();
      this.scheduleNextTick(true);
    }
  }

  public setOverlayOccluded(occluded: boolean): void {
    if (this.overlayOccluded === occluded) return;
    this.overlayOccluded = occluded;
    if (!occluded) {
      this.needsStaticRender = true;
      this.menuFrameAccum = 0;
      this.ensureLoopRunning();
    }
  }

  private registerLevelMaterial(mat: THREE.MeshStandardMaterial): void {
    this.levelQualityMaterials.push({
      mat,
      origBumpScale: mat.bumpScale ?? 0.025,
      origEnvIntensity: mat.envMapIntensity,
    });
  }

  private registerShadowReceiver(mesh: THREE.Mesh): void {
    this.levelShadowReceivers.push(mesh);
  }

  private applyQualityToRenderer(): void {
    const q: ActiveQualityTier = this.isSoftwareGl ? 'smooth' : this.activeQuality;
    const dpr = window.devicePixelRatio || 1;
    let targetPixelRatio = 1;
    let shadowEnabled = false;
    let shadowType: THREE.ShadowMapType = THREE.PCFShadowMap;
    let farPlane = 145;
    let aniso = 4;
    let waterEnv = 0.96;

    const compactLights = this.isSoftwareGl || this.isLowEndGpu || this.isTouchDevice;
    if (q === 'ultra') {
      this.dynamicResScale = 1.0;
      targetPixelRatio = Math.min(dpr, this.isTouchDevice ? 1.65 : 1.85);
      shadowEnabled = !this.isSoftwareGl;
      shadowType = this.isTouchDevice ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
      farPlane = 360;
      this.activeRenderDist = 260;
      this.splashMaxActive = 420;
      this.uCausticEnabled.value = 1;
      this.uCausticRangeSq.value = 90 * 90;
      this.activePointLightLimit = compactLights ? 2 : 4;
      aniso = 16;
      waterEnv = 1.8;
    } else if (q === 'standard') {
      this.dynamicResScale = 1.0;
      targetPixelRatio = Math.min(dpr, this.isTouchDevice ? 1.3 : 1.45);
      shadowEnabled = !this.isSoftwareGl;
      shadowType = THREE.PCFShadowMap;
      farPlane = 225;
      this.activeRenderDist = 145;
      this.splashMaxActive = 240;
      this.uCausticEnabled.value = 1;
      this.uCausticRangeSq.value = 55 * 55;
      this.activePointLightLimit = compactLights ? 2 : 4;
      aniso = 8;
      waterEnv = 1.54;
    } else {
      const baseSmoothDpr = Math.min(dpr, this.isTouchDevice || this.isLowEndGpu ? 1.0 : 1.1);
      targetPixelRatio = Math.max(0.82, baseSmoothDpr * this.dynamicResScale);
      shadowEnabled = false;
      farPlane = 155;
      this.activeRenderDist = 96;
      this.splashMaxActive = 120;
      this.uCausticEnabled.value = 0;
      this.activePointLightLimit = 2;
      aniso = 4;
      waterEnv = 1.05;
    }

    if (this.isSoftwareGl) {
      targetPixelRatio = 1;
      shadowEnabled = false;
      this.activeRenderDist = 88;
      this.uCausticEnabled.value = 0;
      aniso = 1;
    }
    this.baseCausticEnabled = this.uCausticEnabled.value;
    this.uWaterQuality.value = q === 'ultra' ? 2.0 : q === 'standard' ? 1.0 : 0.0;
    this._lastLightCamX = NaN;
    this._lastCullCamZ = NaN;
    this.needsStaticRender = true;

    const vp = this.getViewportSize();
    const prChanged = Math.abs(targetPixelRatio - this._appliedPixelRatio) > 1e-4;
    const sizeChanged = vp.w !== this._appliedViewportW || vp.h !== this._appliedViewportH;

    if (prChanged) {
      this.renderer.setPixelRatio(targetPixelRatio);
      this._appliedPixelRatio = targetPixelRatio;
    }
    if (this._appliedShadowEnabled !== shadowEnabled) {
      this.renderer.shadowMap.enabled = shadowEnabled;
      this.renderer.shadowMap.autoUpdate = shadowEnabled;
      this._appliedShadowEnabled = shadowEnabled;
    } else {
      this.renderer.shadowMap.autoUpdate = shadowEnabled;
    }
    if (shadowEnabled && this._appliedShadowType !== shadowType) {
      this.renderer.shadowMap.type = shadowType;
      this._appliedShadowType = shadowType;
    }
    if (sizeChanged || prChanged) {
      this.renderer.setSize(vp.w, vp.h);
      this._appliedViewportW = vp.w;
      this._appliedViewportH = vp.h;
      if (this.horrorComposer) {
        const composerDpr = Math.min(targetPixelRatio, this.isTouchDevice ? 0.85 : 1.25);
        this.horrorComposer.setPixelRatio(composerDpr);
        this.horrorComposer.setSize(vp.w, vp.h);
      }
    }

    if (this.camera) {
      const nextAspect = vp.w / vp.h;
      if (this.camera.far !== farPlane || Math.abs(this.camera.aspect - nextAspect) > 1e-4) {
        this.camera.aspect = nextAspect;
        this.camera.far = farPlane;
        this.camera.updateProjectionMatrix();
      }
    }
    if (this.textures) {
      const clampedAniso = Math.min(aniso, Math.max(1, this.renderer.capabilities.getMaxAnisotropy()));
      if (this._appliedAniso !== clampedAniso) {
        this.textures.setAnisotropy(clampedAniso);
        setCharacterTextureAnisotropy(this.textures, clampedAniso);
        this._appliedAniso = clampedAniso;
      }
      if (this._appliedQualityTier !== q) {
        setEntityQualityTier(this.textures, q);
        this._appliedQualityTier = q;
      }
    }
    if (this.playerRig) {
      this.playerRig.setShadowDetail(q);
    }
    if (this.coopPlayers) {
      for (const remote of this.coopPlayers.values()) {
        remote.rig.setShadowDetail(q);
      }
    }
    for (const m of this.monsters) {
      m.rig.setShadowDetail(q);
    }
    // Zero-recompile uniform modulation across quality tiers (prevents WebGL shader stalls on Android)
    const bumpMul = q === 'ultra' ? 1.15 : q === 'standard' ? 1.0 : 0.0;
    const envScale = q === 'ultra' ? 1.15 : q === 'standard' ? 1.04 : 0.85;
    for (let i = 0; i < this.levelQualityMaterials.length; i++) {
      const entry = this.levelQualityMaterials[i];
      entry.mat.bumpScale = entry.origBumpScale * bumpMul;
      entry.mat.envMapIntensity = entry.origEnvIntensity * envScale;
    }
    for (let i = 0; i < this.levelShadowReceivers.length; i++) {
      this.levelShadowReceivers[i].receiveShadow = shadowEnabled;
    }
    if (this.waterMat) {
      const waterNormalScale = q === 'ultra' ? 1.15 : q === 'standard' ? 1.0 : 0.45;
      this.waterMat.normalScale.set(waterNormalScale, waterNormalScale);
      this.waterMat.roughness = q === 'ultra' ? 0.04 : q === 'standard' ? 0.08 : 0.14;
      this.waterMat.envMapIntensity = waterEnv;
      if ('clearcoat' in this.waterMat) {
        (this.waterMat as THREE.MeshPhysicalMaterial).clearcoat = q === 'ultra' ? 1.0 : 0.0;
      }
    }
    if (this.waterMesh) {
      this.waterMesh.receiveShadow = shadowEnabled && !this.isTouchDevice && q !== 'smooth';
    }
    const enableAtmosphericFX = q !== 'smooth' && !this.isSoftwareGl;
    if (this.mistMesh) {
      this.mistMesh.visible = enableAtmosphericFX;
    }
    if (this.coneMesh) {
      this.coneMesh.visible = enableAtmosphericFX;
    }
    if (this.moonShaftMesh) {
      this.moonShaftMesh.visible = enableAtmosphericFX;
    }
    if (this.dustPoints) {
      this.dustPoints.visible = enableAtmosphericFX;
      if (this.dustMat) {
        this.dustMat.uniforms.uPixelRatio.value = targetPixelRatio;
      }
    }
    if (this.keyLight) {
      const wantShadow = shadowEnabled;
      this.keyLight.castShadow = wantShadow;
      if (wantShadow) {
        this.keyLight.shadow.radius = q === 'ultra' && !this.isTouchDevice ? 3.0 : 1.8;
        const sMap = q === 'ultra' ? (this.isTouchDevice ? 1024 : 2048) : this.isTouchDevice ? 768 : 1024;
        const d = q === 'ultra' ? 52 : this.isTouchDevice ? 32 : 38;
        if (this.keyLight.shadow.mapSize.width !== sMap) {
          this.keyLight.shadow.mapSize.set(sMap, sMap);
          this.keyLight.shadow.map?.dispose();
          this.keyLight.shadow.map = null;
        }
        if (this.keyLight.shadow.camera.right !== d) {
          this.keyLight.shadow.camera.left = -d;
          this.keyLight.shadow.camera.right = d;
          this.keyLight.shadow.camera.top = d;
          this.keyLight.shadow.camera.bottom = -d;
          this.keyLight.shadow.camera.updateProjectionMatrix();
        }
      }
    }
    this.updateVisibilityCulling(true);
  }

  public updateSettings(next: GameSettings): void {
    const sanitized = sanitizeGameSettings(next);
    const prevPreset = this.settings.quality;
    const prevInvertY = this.settings.invertY;
    this.settings = sanitized;
    this.sound.setVolumes(sanitized.masterVolume, sanitized.musicVolume, sanitized.sfxVolume, sanitized.muted);
    if (!this.isSoftwareGl) {
      const target = sanitized.quality === 'auto' ? this.detectInitialQuality() : sanitized.quality;
      const wasScaled = Math.abs(this.dynamicResScale - 1.0) > 1e-4;
      this.dynamicResScale = 1.0;
      this.autoDowngradeCount = 0;
      this.slowFrameCount = 0;
      this.highFpsStreak = 0;
      this.qualityCooldownTimer = 0;
      if (target !== this.activeQuality || sanitized.quality !== prevPreset || wasScaled) {
        this.activeQuality = target;
        this.applyQualityToRenderer();
        if (target !== 'smooth' && !this.horrorComposerWarmed) {
          this.prewarmSceneShaders();
        }
        this.emitHud(true);
      }
    }
    if (sanitized.invertY !== prevInvertY) {
      if (sanitized.invertY) {
        this.camDist = this.inWater || this.waterJumpTimer > 0 ? 4.4 : 5.0;
      }
      this.ensureLocalPlayerVisible();
      if (this.phase === 'playing' || this.phase === 'paused') {
        if (sanitized.invertY) {
          this.syncLocalPlayerRigTransform(this.lastAnimState, this.lastHorizSpeed);
        }
        this.snapPlayCameraImmediate();
        if (this.phase === 'paused' && !this.disposed && !this.contextLost) {
          this.updateVisibilityCulling(true);
          const gl = this.renderer.getContext?.() as WebGL2RenderingContext | null;
          if (!gl || !gl.isContextLost?.()) {
            try {
              this.renderer.render(this.scene, this.camera);
            } catch {
              // ignore if renderer context is unavailable in headless harnesses
            }
          }
        }
      }
    }
    this.needsStaticRender = true;
    this.ensureLoopRunning();
  }

  public setCharacter(characterId: CharacterId): void {
    const next = normalizeCharacterId(characterId);
    if (next === this.localCharacterId) return;
    this.localCharacterId = next;
    const prevRig = this.playerRig;
    const wasVisible = prevRig.root.visible && prevRig.hips.visible;
    const shouldBeVisible = this.phase === 'playing' ? true : wasVisible;
    const pos = prevRig.root.position.clone();
    const rot = prevRig.root.rotation.clone();

    const nextRig = createPlayerRig(this.textures, 0x52e0b6, false, next);
    nextRig.setShadowDetail(this.activeQuality);
    resetPlayerRigPose(nextRig);
    nextRig.root.position.copy(pos);
    nextRig.root.rotation.copy(rot);
    nextRig.root.scale.setScalar(1);
    nextRig.setVisible(shouldBeVisible);
    if (this.phase === 'playing') {
      animatePlayerRig(nextRig, this.lastAnimState, this.lastHorizSpeed, this.simTime, 0.016);
    }
    nextRig.root.updateMatrixWorld(true);

    this.scene.remove(prevRig.root);
    prevRig.dispose();
    this.playerRig = nextRig;
    this.scene.add(nextRig.root);
    this.ensureLocalPlayerVisible();
    this.prewarmSceneShaders();
    this.needsStaticRender = true;
    this.ensureLoopRunning();
  }

  public setVirtualInput(moveX: number, moveY: number, running: boolean): void {
    this.virtualMove.x = THREE.MathUtils.clamp(moveX, -1, 1);
    this.virtualMove.y = THREE.MathUtils.clamp(moveY, -1, 1);
    this.virtualRun = running;
  }

  public setVirtualAutoRun(enabled: boolean): void {
    this.virtualAutoRun = enabled;
  }

  public triggerJump(): void {
    this.sound.unlock();
    if (this.phase !== 'playing') return;
    this.jumpBufferTimer = 0.14;
  }

  public rotateCameraByDelta(dx: number, dy: number): void {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    if (dx === 0 && dy === 0) return;
    const sens = 0.0042 * this.settings.mouseSensitivity;
    let nextYaw = this.camYaw - dx * sens;
    if (nextYaw > Math.PI || nextYaw < -Math.PI) {
      nextYaw = Math.atan2(Math.sin(nextYaw), Math.cos(nextYaw));
    }
    this.camYaw = nextYaw;
    this.camPitch = THREE.MathUtils.clamp(this.camPitch + dy * sens, -0.55, 1.18);
  }

  private flushPendingLookInput(): void {
    const dx = this.pendingLookDx;
    const dy = this.pendingLookDy;
    this.pendingLookDx = 0;
    this.pendingLookDy = 0;
    if (dx !== 0 || dy !== 0) {
      this.rotateCameraByDelta(dx, dy);
    }
  }

  private releaseDragPointerCapture(): void {
    if (this.activeDragPointerId !== null) {
      try {
        this.renderer.domElement.releasePointerCapture?.(this.activeDragPointerId);
      } catch {
        // ignore if pointer capture was already released
      }
      this.activeDragPointerId = null;
    }
    this.isDraggingLook = false;
  }

  public getPhase(): GamePhase {
    return this.phase;
  }

  public setPhase(phase: GamePhase): void {
    this.phase = phase;
    this.needsStaticRender = true;
    this._lastCullCamZ = NaN;
    this.pendingLookDx = 0;
    this.pendingLookDy = 0;
    if (phase !== 'jumpscare') {
      this.resetHorrorVisualState();
    }
    if (phase === 'playing') {
      this.resetFpsTracker();
      this.lastTimeMs = performance.now();
      this.ensureLocalPlayerVisible();
      this.syncLocalPlayerRigTransform(this.lastAnimState, this.lastHorizSpeed);
    } else if (phase === 'paused' || phase === 'menu' || phase === 'gameover' || phase === 'victory') {
      this.sound.stopSnakeSwimmingAudio(0.12);
      this.heldKeys.clear();
      this.virtualMove.x = 0;
      this.virtualMove.y = 0;
      this.virtualRun = false;
      this.virtualAutoRun = false;
      this.releaseDragPointerCapture();
      if (document.pointerLockElement === this.renderer.domElement) {
        document.exitPointerLock();
      }
    }
    this.ensureLoopRunning();
    this.emitHud(true);
  }

  public renderImmediateReadyFrame(): void {
    if (this.disposed || this.contextLost) return;
    if (this.phase === 'playing') {
      this.overlayOccluded = false;
      this.playerRig.setVisible(true);
      this.ensureLocalPlayerVisible();
      this.syncLocalPlayerRigTransform(this.lastAnimState, this.lastHorizSpeed);
      this.snapPlayCameraImmediate();
    } else if (this.phase === 'menu') {
      this.updateMenuCamera();
    }
    this.updateEnvironmentFX(0);
    this.updateVisibilityCulling(true);
    this.scene.updateMatrixWorld(true);
    this.camera.updateMatrixWorld(true);
    const gl = this.renderer.getContext() as WebGL2RenderingContext | null;
    if (!gl || !gl.isContextLost?.()) {
      try {
        this.renderer.render(this.scene, this.camera);
      } catch {
        // ignore if WebGL context is temporarily unavailable
      }
    }
    this.lastTimeMs = performance.now();
    this.ensureLoopRunning();
    this.emitHud(true);
  }

  public startLevel(levelId: number): void {
    this.sound.unlock();
    this.overlayOccluded = false;
    this.spRespawning = false;
    this.isWatchedFreezeActive = false;
    this.watchFreezeGraceTimer = 0;
    this.watchMoveAttempted = false;
    this.playerWaterEpoch = 0;
    this.lastAnimState = 'idle';
    this.lastHorizSpeed = 0;
    resetPlayerRigPose(this.playerRig);
    this.playerRig.setVisible(true);
    this.virtualMove.x = 0;
    this.virtualMove.y = 0;
    this.virtualRun = false;
    this.virtualAutoRun = false;
    this.loadLevel(levelId, 'playing');
    this.renderImmediateReadyFrame();
  }

  public async prepareLevelAsync(
    levelId: number,
    onProgress?: (pct: number, label: string) => void
  ): Promise<void> {
    if (this.disposed) return;
    this.sound.unlock();
    onProgress?.(25, 'BUILDING POOL ARCHITECTURE...');
    const preloadTask = Promise.all([
      preloadCoreAssets().catch(() => undefined),
      this.sound.prewarmAsync(),
    ]);
    await waitAnimationFrames(1);
    if (this.disposed) return;
    onProgress?.(50, 'PRELOADING AUDIO & ASSETS...');
    await preloadTask;
    if (this.disposed) return;
    onProgress?.(68, 'LOADING TEXTURES & SHADERS...');
    this.startLevel(levelId);
    onProgress?.(90, 'RENDERING FIRST FRAME...');
    await waitAnimationFrames(1);
    if (this.disposed) return;
    this.lastTimeMs = performance.now();
    onProgress?.(100, 'READY');
  }

  public startOpenWorld(savedCheckpointId?: string | null): void {
    this.sound.unlock();
    this.overlayOccluded = false;
    this.spRespawning = false;
    this.isWatchedFreezeActive = false;
    this.watchFreezeGraceTimer = 0;
    this.watchMoveAttempted = false;
    this.playerWaterEpoch = 0;
    this.lastAnimState = 'idle';
    this.lastHorizSpeed = 0;
    resetPlayerRigPose(this.playerRig);
    this.playerRig.setVisible(true);
    this.virtualMove.x = 0;
    this.virtualMove.y = 0;
    this.virtualRun = false;
    this.virtualAutoRun = false;
    this.loadOpenWorld('playing', false, undefined, savedCheckpointId);
    this.renderImmediateReadyFrame();
  }

  public async prepareOpenWorldAsync(
    onProgress?: (pct: number, label: string) => void,
    savedCheckpointId?: string | null
  ): Promise<void> {
    if (this.disposed) return;
    this.sound.unlock();
    onProgress?.(22, 'CONNECTING 100 WORLD REGIONS...');
    const preloadTask = Promise.all([
      preloadCoreAssets().catch(() => undefined),
      this.sound.prewarmAsync(),
    ]);
    await waitAnimationFrames(1);
    if (this.disposed) return;
    onProgress?.(48, 'PRELOADING AUDIO & ASSETS...');
    await preloadTask;
    if (this.disposed) return;
    onProgress?.(72, 'STREAMING STARTING AQUEDUCT...');
    this.startOpenWorld(savedCheckpointId);
    onProgress?.(92, 'RENDERING OPEN WORLD...');
    await waitAnimationFrames(1);
    if (this.disposed) return;
    this.lastTimeMs = performance.now();
    onProgress?.(100, 'READY');
  }

  public restartOpenWorld(): void {
    this.sound.unlock();
    this.overlayOccluded = false;
    this.virtualMove.x = 0;
    this.virtualMove.y = 0;
    this.virtualRun = false;
    this.virtualAutoRun = false;
    this.loadOpenWorld('playing', false);
    this.renderImmediateReadyFrame();
  }

  public async restartOpenWorldAsync(
    onProgress?: (pct: number, label: string) => void
  ): Promise<void> {
    if (this.disposed) return;
    onProgress?.(30, 'RESETTING OPEN WORLD...');
    await waitAnimationFrames(1);
    if (this.disposed) return;
    onProgress?.(68, 'REBUILDING AQUEDUCT NETWORK...');
    this.restartOpenWorld();
    await waitAnimationFrames(1);
    if (this.disposed) return;
    this.lastTimeMs = performance.now();
    onProgress?.(100, 'READY');
  }

  private getCoopPlayersMap(): Map<string, RemoteCoopPlayer> {
    if (!this.coopPlayers) {
      this.coopPlayers = new Map();
    }
    return this.coopPlayers;
  }

  private disposeRemoteCoopPlayer(remote: RemoteCoopPlayer): void {
    if (remote.nameplate) {
      remote.nameplate.removeFromParent();
      const mat = remote.nameplate.material;
      if (mat instanceof THREE.SpriteMaterial) {
        mat.map?.dispose();
        mat.dispose();
      }
    }
    remote.rig.root.removeFromParent();
    remote.rig.dispose();
  }

  public isCoopMode(): boolean {
    return Boolean(this.coopMode);
  }

  public setCoopMode(enabled: boolean, localPlayerId?: string | null): void {
    this.coopMode = enabled;
    this.coopLocalPlayerId = localPlayerId ?? null;
    this.coopEmitTimer = 0;
    if (!enabled) {
      this.clearCoopState();
    }
  }

  public clearCoopState(): void {
    const map = this.getCoopPlayersMap();
    for (const remote of map.values()) {
      this.disposeRemoteCoopPlayer(remote);
    }
    map.clear();
  }

  public async prepareCoopOpenWorldAsync(
    you: CoopPlayerSnapshot,
    peers: CoopPlayerSnapshot[],
    onProgress?: (pct: number, label: string) => void
  ): Promise<void> {
    if (this.disposed) return;
    this.sound.unlock();
    onProgress?.(22, 'SYNCHRONIZING CO-OP SQUAD...');
    const preloadTask = Promise.all([
      preloadCoreAssets().catch(() => undefined),
      this.sound.prewarmAsync(),
    ]);
    await waitAnimationFrames(1);
    if (this.disposed) return;
    onProgress?.(50, 'PRELOADING AUDIO & ASSETS...');
    await preloadTask;
    if (this.disposed) return;
    onProgress?.(74, 'STREAMING CO-OP OPEN WORLD...');
    this.startCoopOpenWorld(you, peers);
    onProgress?.(92, 'RENDERING CO-OP SESSION...');
    await waitAnimationFrames(1);
    if (this.disposed) return;
    this.lastTimeMs = performance.now();
    onProgress?.(100, 'READY');
  }

  public startCoopOpenWorld(you: CoopPlayerSnapshot, peers: CoopPlayerSnapshot[]): void {
    this.sound.unlock();
    this.overlayOccluded = false;
    this.spRespawning = false;
    this.isWatchedFreezeActive = false;
    this.watchFreezeGraceTimer = 0;
    this.watchMoveAttempted = false;
    this.playerWaterEpoch = 0;
    this.lastAnimState = 'idle';
    this.lastHorizSpeed = 0;
    this.coopDeathSeq = Math.max(this.coopDeathSeq || 0, you.deathSeq || 0);
    this.coopRespawnSentForSeq = 0;
    resetPlayerRigPose(this.playerRig);
    this.playerRig.setVisible(true);
    this.virtualMove.x = 0;
    this.virtualMove.y = 0;
    this.virtualRun = false;
    this.virtualAutoRun = false;

    this.coopMode = true;
    this.coopLocalPlayerId = you.playerId;
    this.loadOpenWorld(
      'playing',
      false,
      { x: you.x, y: you.y, z: you.z, yaw: you.yaw },
      you.checkpointId
    );
    if (!you.checkpointId) {
      this.activeSpawn.set(you.checkpointX ?? you.x, you.checkpointY ?? you.y, you.checkpointZ ?? you.z);
      this.owCheckpointYaw = you.checkpointYaw ?? you.yaw;
      this.owCheckpointLabel = you.checkpointLabel || 'Region 01 Entry Dock';
    }
    this.coopMode = true;
    this.coopLocalPlayerId = you.playerId;
    this.syncCoopPlayers(peers);
    this.renderImmediateReadyFrame();
  }

  public syncCoopPlayers(players: CoopPlayerSnapshot[]): void {
    const map = this.getCoopPlayersMap();
    const keepIds = new Set<string>();

    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!p || p.playerId === this.coopLocalPlayerId) continue;
      keepIds.add(p.playerId);

      const existing = map.get(p.playerId);
      const charId = normalizeCharacterId(p.characterId);
      const colorHex = p.colorHex || '#52e0b6';

      if (existing && existing.characterId === charId && existing.colorHex === colorHex) {
        if (existing.name !== p.name) {
          existing.name = p.name;
          existing.nameplate.removeFromParent();
          const oldMat = existing.nameplate.material;
          if (oldMat instanceof THREE.SpriteMaterial) {
            oldMat.map?.dispose();
            oldMat.dispose();
          }
          const nextSprite = createNameplateSprite(p.name, colorHex);
          existing.rig.root.add(nextSprite);
          existing.nameplate = nextSprite;
        }
        existing.targetPos.set(p.x, p.y, p.z);
        if (Math.hypot(existing.pos.x - p.x, existing.pos.z - p.z) > 12) {
          existing.pos.set(p.x, p.y, p.z);
        }
        existing.targetYaw = p.yaw;
        existing.animState = p.animState;
        existing.horizSpeed = p.horizSpeed;
        existing.regionId = p.regionId;
        existing.inWater = p.inWater;
        existing.connected = p.connected;
        if (!existing.alive && p.alive) {
          resetPlayerRigPose(existing.rig);
          existing.pos.set(p.x, p.y, p.z);
          existing.yaw = p.yaw;
        }
        existing.alive = p.alive;
        existing.deathSeq = Math.max(existing.deathSeq, p.deathSeq || 0);
        if (!p.alive) {
          existing.rig.setVisible(false);
        }
        continue;
      }

      if (existing) {
        this.disposeRemoteCoopPlayer(existing);
        map.delete(p.playerId);
      }

      const rig = createPlayerRig(this.textures, colorHex, true, charId);
      rig.setShadowDetail(this.activeQuality);
      resetPlayerRigPose(rig);
      const nameplate = createNameplateSprite(p.name, colorHex);
      rig.root.add(nameplate);
      rig.root.position.set(p.x, p.y, p.z);
      rig.root.rotation.set(0, p.yaw, 0);
      rig.setVisible(Boolean(p.connected && p.alive));
      this.scene.add(rig.root);

      map.set(p.playerId, {
        playerId: p.playerId,
        name: p.name,
        characterId: charId,
        colorHex,
        rig,
        nameplate,
        pos: new THREE.Vector3(p.x, p.y, p.z),
        targetPos: new THREE.Vector3(p.x, p.y, p.z),
        yaw: p.yaw,
        targetYaw: p.yaw,
        animState: p.animState,
        horizSpeed: p.horizSpeed,
        regionId: p.regionId,
        inWater: p.inWater,
        connected: p.connected,
        alive: p.alive,
        eatTimer: 0,
        deathSeq: p.deathSeq || 0,
      });
    }

    for (const [id, remote] of map.entries()) {
      if (!keepIds.has(id)) {
        this.disposeRemoteCoopPlayer(remote);
        map.delete(id);
      }
    }
  }

  public updateCoopPlayerMove(move: CoopPlayerMoveBroadcast): void {
    if (!move || move.playerId === this.coopLocalPlayerId) return;
    const remote = this.getCoopPlayersMap().get(move.playerId);
    if (!remote) return;
    remote.targetPos.set(move.x, move.y, move.z);
    if (Math.hypot(remote.pos.x - move.x, remote.pos.z - move.z) > 16) {
      remote.pos.set(move.x, move.y, move.z);
    }
    remote.targetYaw = move.yaw;
    remote.animState = move.animState;
    remote.horizSpeed = move.horizSpeed;
    remote.regionId = move.regionId;
    remote.inWater = move.inWater;
    if (!remote.alive && move.alive) {
      resetPlayerRigPose(remote.rig);
    }
    remote.alive = move.alive;
    if (!move.alive) {
      remote.rig.setVisible(false);
    }
  }

  public applyCoopPlayerConnection(playerId: string, connected: boolean): void {
    const remote = this.getCoopPlayersMap().get(playerId);
    if (!remote) return;
    remote.connected = connected;
    if (!connected) {
      remote.rig.setVisible(false);
    }
  }

  public applyCoopPlayerEaten(event: CoopPlayerEatenBroadcast): void {
    if (!event || event.playerId === this.coopLocalPlayerId) return;
    const remote = this.getCoopPlayersMap().get(event.playerId);
    if (!remote) return;
    if (event.deathSeq <= remote.deathSeq && !remote.alive) return;
    remote.deathSeq = Math.max(remote.deathSeq, event.deathSeq);
    remote.alive = false;
    remote.eatTimer = 0.72;
    remote.pos.set(event.playerX, event.playerY, event.playerZ);
    remote.targetPos.copy(remote.pos);
    remote.yaw = event.playerYaw;
    remote.targetYaw = event.playerYaw;
    remote.rig.root.position.copy(remote.pos);
    remote.rig.root.rotation.set(0, remote.yaw, 0);
    if (Math.hypot(remote.pos.x - this.playerPos.x, remote.pos.z - this.playerPos.z) < 42) {
      this.spawnSplash(remote.pos, 10, 1.15);
    }
  }

  public applyCoopPlayerRespawn(respawn: CoopRespawnPayload): void {
    if (!respawn) return;
    if (respawn.playerId === this.coopLocalPlayerId) {
      if (respawn.checkpointId) {
        this.owCheckpointId = respawn.checkpointId;
        this.owCheckpointRegionId = respawn.checkpointRegionId;
        this.owCheckpointLabel = respawn.checkpointLabel;
        this.owCheckpointYaw = respawn.yaw;
        this.owActivatedCheckpointIds.add(respawn.checkpointId);
      } else {
        this.owCheckpointId = null;
        this.owCheckpointRegionId = respawn.checkpointRegionId;
        this.owCheckpointLabel = respawn.checkpointLabel || 'Region 01 Entry Dock';
        this.owCheckpointYaw = respawn.yaw;
      }
      this.activeSpawn.set(respawn.x, respawn.y, respawn.z);
      if (this.phase === 'jumpscare') {
        this.jumpscareTimer = 0;
        if (this.jumpscareMonster?.eatingUserId) {
          this.sound.stopAttackEatingAudio(
            `${this.jumpscareMonster.id}:${this.jumpscareMonster.eatingUserId}`,
            0.08
          );
          this.jumpscareMonster.eatingUserId = null;
          this.jumpscareMonster.eatingProgress = -1;
        }
        this.respawnSinglePlayerAtLevelStart(this.deathReason || 'caught');
      } else if (
        this.phase === 'playing' &&
        Math.hypot(this.playerPos.x - respawn.x, this.playerPos.z - respawn.z) > 2.5 &&
        respawn.deathSeq >= this.coopDeathSeq
      ) {
        this.playerPos.set(respawn.x, respawn.y, respawn.z);
        this.playerVel.set(0, 0, 0);
        this.playerYaw = respawn.yaw;
        this.updateOpenWorldStreaming(true);
        this.syncLocalPlayerRigTransform('idle', 0);
        this.snapPlayCameraImmediate();
      }
      return;
    }

    const remote = this.getCoopPlayersMap().get(respawn.playerId);
    if (!remote) return;
    remote.alive = true;
    remote.eatTimer = 0;
    remote.deathSeq = Math.max(remote.deathSeq, respawn.deathSeq);
    remote.regionId = respawn.regionId;
    remote.animState = 'idle';
    remote.horizSpeed = 0;
    remote.pos.set(respawn.x, respawn.y, respawn.z);
    remote.targetPos.copy(remote.pos);
    remote.yaw = respawn.yaw;
    remote.targetYaw = respawn.yaw;
    resetPlayerRigPose(remote.rig);
    remote.rig.root.position.copy(remote.pos);
    remote.rig.root.rotation.set(0, remote.yaw, 0);
  }

  private updateRemoteCoopPlayers(dt: number): void {
    const map = this.coopPlayers;
    if (!map || map.size === 0) return;

    const blend = 1 - Math.exp(-14 * Math.min(0.05, dt));
    const camX = this.camera.position.x;
    const camZ = this.camera.position.z;
    const maxDistSq = (this.activeRenderDist + 16) * (this.activeRenderDist + 16);

    for (const remote of map.values()) {
      if (!remote.connected) {
        remote.rig.setVisible(false);
        continue;
      }

      if (!remote.alive) {
        if (remote.eatTimer > 0) {
          remote.eatTimer = Math.max(0, remote.eatTimer - dt);
          const progress = THREE.MathUtils.clamp(1 - remote.eatTimer / 0.72, 0, 1);
          const dx = remote.pos.x - camX;
          const dz = remote.pos.z - camZ;
          const withinRange = dx * dx + dz * dz <= maxDistSq;
          remote.rig.setVisible(withinRange && remote.eatTimer > 0.04);
          if (withinRange && remote.eatTimer > 0.04) {
            animatePlayerDeath(remote.rig, progress, this.simTime, dt);
          }
        } else {
          remote.rig.setVisible(false);
        }
        continue;
      }

      remote.pos.lerp(remote.targetPos, blend);
      const yawDiff = shortestAngleDiff(remote.yaw, remote.targetYaw);
      remote.yaw += yawDiff * blend;

      const dx = remote.pos.x - camX;
      const dz = remote.pos.z - camZ;
      const visible = dx * dx + dz * dz <= maxDistSq;
      remote.rig.setVisible(visible);
      if (!visible) continue;

      remote.rig.root.position.copy(remote.pos);
      remote.rig.root.rotation.set(0, remote.yaw, 0);
      animatePlayerRig(remote.rig, remote.animState, remote.horizSpeed, this.simTime, dt);
    }
  }


  private chooseEatingCamSide(m: RuntimeMonster): 1 | -1 {
    const b = this.getActiveBounds();
    const waterY = b.waterY;
    const headX = m.pos.x + Math.sin(m.yaw) * 0.8 * m.scale;
    const headZ = m.pos.z + Math.cos(m.yaw) * 0.8 * m.scale;
    const headY = waterY + 1.55 * m.scale;
    const testSide = (side: 1 | -1): number => {
      const ang = m.yaw + side * 0.92;
      const dist = 5.0 * m.scale;
      const cx = THREE.MathUtils.clamp(headX + Math.sin(ang) * dist, b.minX + 0.45, b.maxX - 0.45);
      const cz = THREE.MathUtils.clamp(headZ + Math.cos(ang) * dist, b.minZ + 0.45, b.maxZ - 0.45);
      const cy = THREE.MathUtils.clamp(waterY + 2.4 * m.scale, b.floorY + 0.45, b.ceilingY - 0.45);
      const occ = this.computeCameraWallOcclusion(headX, headY, headZ, cx, cy, cz, 0.3);
      return occ * Math.hypot(cx - headX, cz - headZ);
    };
    return testSide(1) >= testSide(-1) ? 1 : -1;
  }

  private beginMonsterEatingSequence(
    m: RuntimeMonster,
    userId: string,
    preyX: number,
    preyY: number,
    preyZ: number,
    preyYaw: number,
    initialProgress = 0
  ): void {
    const waterY = this.getActiveBounds().waterY;
    const wasAlreadyEatingThis = m.eatingUserId === userId;
    m.alert = 'chasing';
    m.emerged = true;
    m.targetUserId = userId === '__local__' ? null : userId;
    m.eatingUserId = userId;
    this.sound.stopSnakeSwimmingAudio(0.08, m.id);

    if (!wasAlreadyEatingThis) {
      m.eatingProgress = THREE.MathUtils.clamp(initialProgress, 0, 0.98);
      m.eatingTimer = m.eatingProgress * EAT_DURATION_SEC;
      m.eatingPreyStartPos.set(preyX, preyY, preyZ);
      m.eatingPreyStartYaw = preyYaw;
      m.eatingGulpStage = m.eatingProgress >= 0.66 ? 2 : m.eatingProgress >= 0.38 ? 1 : 0;
      m.eatingSwallowAudioPlayed = m.eatingProgress >= 0.94;

      // Orient & place serpent smoothly at bite strike range facing victim
      const dxFace = preyX - m.pos.x;
      const dzFace = preyZ - m.pos.z;
      const dist = Math.hypot(dxFace, dzFace);
      if (dist > 0.05) {
        m.yaw = Math.atan2(dxFace, dzFace);
      }
      const idealDist = 1.05 * m.scale;
      const r = 0.88 * m.scale;
      if (dist > idealDist + 0.15) {
        const nx = Math.sin(m.yaw);
        const nz = Math.cos(m.yaw);
        m.pos.x = preyX - nx * idealDist;
        m.pos.z = preyZ - nz * idealDist;
        this.populateNearbyObstacles(m.pos.x, m.pos.z, r + 4);
        this.resolveCircleSolids(
          m.pos,
          r,
          waterY - 1.5,
          waterY + 4.2 * m.scale,
          r + 0.15,
          true,
          undefined,
          -Infinity,
          null,
          _nearPlatforms,
          _nearWalls
        );
      }
      if (m.pos.y < waterY - 0.85 * m.scale) {
        m.pos.y = waterY - 0.45 * m.scale;
      }
      m.diveTimer = 0;
      m.velX = 0;
      m.velZ = 0;

      const victimCharacter: CharacterId = this.localCharacterId;
      if (m.eatingProgress < 0.25) {
        this.syncAudioListener();
        const mouthX = m.pos.x + Math.sin(m.yaw) * 0.86 * m.scale;
        const mouthY = waterY + 1.5 * m.scale;
        const mouthZ = m.pos.z + Math.cos(m.yaw) * 0.86 * m.scale;
        this.sound.playCharacterEatingScream(
          victimCharacter,
          `${m.id}:${userId}`,
          mouthX,
          mouthY,
          mouthZ,
          m.eatingProgress * EAT_DURATION_SEC,
          true
        );
      }
    }
  }

  public restartLevel(): void {
    if (this.activeWorldMode === 'open_world') {
      this.restartOpenWorld();
      return;
    }
    this.sound.unlock();
    this.overlayOccluded = false;
    this.virtualMove.x = 0;
    this.virtualMove.y = 0;
    this.virtualRun = false;
    this.virtualAutoRun = false;
    this.loadLevel(this.currentLevel.id, 'playing');
    this.renderImmediateReadyFrame();
  }

  public async restartLevelAsync(
    onProgress?: (pct: number, label: string) => void
  ): Promise<void> {
    if (this.activeWorldMode === 'open_world') {
      return this.restartOpenWorldAsync(onProgress);
    }
    if (this.disposed) return;
    onProgress?.(30, 'RESETTING SECTOR...');
    await new Promise<void>((resolve) => {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => resolve());
      } else {
        resolve();
      }
    });
    if (this.disposed) return;
    onProgress?.(68, 'REBUILDING SCENE...');
    this.restartLevel();
    await new Promise<void>((resolve) => {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => resolve());
      } else {
        resolve();
      }
    });
    if (this.disposed) return;
    this.lastTimeMs = performance.now();
    onProgress?.(100, 'READY');
  }

  public respawnAtCheckpoint(): void {
    this.sound.unlock();
    this.virtualMove.x = 0;
    this.virtualMove.y = 0;
    this.virtualRun = false;
    this.virtualAutoRun = false;
    for (const p of this.platforms) {
      if (p.def.kind === 'disappearing') {
        p.state = 'solid';
        p.stateTimer = 0;
        p.mesh.visible = true;
        p.currentPos.set(p.def.position[0], p.def.position[1], p.def.position[2]);
        p.prevPos.copy(p.currentPos);
        p.mesh.position.copy(p.currentPos);
        p.material.color.setHex(p.baseColorHex);
        p.material.emissive.setHex(0x000000);
        p.material.emissiveIntensity = 0;
      }
    }
    this.deathReason = null;
    this.jumpscareMonster = null;
    for (const m of this.monsters) {
      m.alert = 'calm';
      m.emerged = false;
      m.searchTimer = 0;
      m.stuckTimer = 0;
      m.avoidTimer = 0;
      m.velX = 0;
      m.velZ = 0;
      m.navBestDist = Infinity;
      m.navStallTimer = 0;
      m.navAnchorX = m.pos.x;
      m.navAnchorZ = m.pos.z;
      m.navAnchorTimer = 0;
      m.navTurnAccum = 0;
      m.eatingUserId = null;
      m.eatingTimer = 0;
      m.eatingProgress = -1;
      m.eatingGulpStage = 0;
      m.eatingSwallowAudioPlayed = false;
      m.safeEpoch = 0;
      m.intimidationPhase = 'none';
      m.intimidationTimer = 0;
      m.intimidationDuration = 0;
      m.intimidationPlatform = null;
      m.diveTimer = 0;
      m.visionState = 'none';
      m.visionTimer = 0;
      m.watchingUserId = null;
      m.lookAway = false;
      m.lookAwayYaw = m.yaw;
      m.pos.y = this.getActiveBounds().waterY - 0.14;
      m.rig.root.position.copy(m.pos);
      m.rig.root.rotation.y = 0;
      resetSerpentTrail(m.rig, m.pos, m.yaw);
    }
    this.playerWaterEpoch = 0;
    this.playerInWaterSession = false;
    this.pendingClimbIntimidation = false;
    this.isWatchedFreezeActive = false;
    this.watchFreezeGraceTimer = 0;
    this.watchMoveAttempted = false;
    this.phase = 'playing';
    this.needsStaticRender = true;
    this.resetFpsTracker();
    if (this.activeWorldMode === 'open_world') {
      this.playerPos.copy(this.activeSpawn);
      this.updateOpenWorldStreaming(true);
      this.syncOpenWorldCheckpointVisuals();
      this.respawnAtActiveCheckpoint(true);
      this.playerYaw = this.owCheckpointYaw;
      this.groundPlayerOnSpawnPlatform();
    } else {
      this.respawnAtActiveCheckpoint(true);
    }
    this.ensureLoopRunning();
    this.emitHud(true);
  }

  public showMenuBackdrop(levelId = 1): void {
    this.loadLevel(levelId, 'menu');
  }

  private clearLevel(): void {
    this.sound.stopEatingScreams(0.08);
    this.sound.stopSnakeSwimmingAudio(0.08);
    if (this.coopPlayers && this.coopPlayers.size > 0) {
      this.clearCoopState();
    }
    if (this.owChunks.size > 0) {
      for (const chunk of this.owChunks.values()) {
        this.unmountOpenWorldChunk(chunk, false);
      }
      this.owChunks.clear();
    }
    this.disposeOpenWorldMaterials();
    this.owCheckpointMeta.clear();
    this.owActivatedCheckpointIds.clear();
    this.owCurrentRegionId = 1;
    this.owCheckpointId = null;
    this.owCheckpointRegionId = 1;
    this.owCheckpointLabel = null;
    this.owCheckpointYaw = Math.PI;
    this.owLastStreamX = NaN;
    this.owLastStreamZ = NaN;
    this.owTargetAtmo = null;
    this._lastCullCamX = NaN;

    for (const cp of this.checkpoints) {
      cp.group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          if (!obj.geometry.userData?.sharedPool) {
            obj.geometry.dispose();
          }
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => {
              if (!m.userData?.sharedPool) m.dispose();
            });
          } else if (!obj.material.userData?.sharedPool) {
            obj.material.dispose();
          }
        }
      });
    }
    if (this.exitGroup) {
      this.exitGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          if (!obj.geometry.userData?.sharedPool) {
            obj.geometry.dispose();
          }
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => {
              if (!m.userData?.sharedPool) m.dispose();
            });
          } else if (!obj.material.userData?.sharedPool) {
            obj.material.dispose();
          }
        }
      });
    }

    this.platforms = [];
    this.dynamicPlatforms = [];
    this.staticChunks = [];
    this.walls = [];
    this.spatialGrid = null;
    this.checkpoints = [];
    this.stoodPlatform = null;
    this.playerWaterEpoch = 0;
    this.playerInWaterSession = false;
    this.pendingClimbIntimidation = false;
    this.isWatchedFreezeActive = false;
    this.watchFreezeGraceTimer = 0;
    this.watchMoveAttempted = false;
    this.monsters.forEach((m) => m.rig.dispose());
    this.monsters = [];
    this.resetHorrorVisualState();
    // Dispose InstancedMesh GPU buffers & Light shadow maps before clearing levelGroup
    this.levelGroup.traverse((obj) => {
      if (obj instanceof THREE.InstancedMesh) {
        obj.dispose();
      } else if (obj instanceof THREE.DirectionalLight || obj instanceof THREE.SpotLight) {
        obj.shadow.map?.dispose();
        obj.shadow.map = null;
        obj.dispose();
      } else if (obj instanceof THREE.Light) {
        obj.dispose();
      }
    });

    this.hemiLight = null;
    this.rimLight = null;
    this.keyLight = null;
    this.pointLightPool = [];
    this.levelLights = [];
    this._lastLightCamX = NaN;
    this._lastLightCamZ = NaN;
    this._lightPickFrame = 0;
    this._lastCullCamX = NaN;
    this._lastCullCamZ = NaN;
    _pickedLights.length = 0;
    this.waterMesh = null;
    this.waterMat = null;
    this.waterOrigNormalMap = null;
    this.levelQualityMaterials = [];
    this.levelShadowReceivers = [];
    this.exitGroup = null;
    this.mistMesh = null;
    this.coneMesh = null;
    this.moonShaftMesh = null;
    this.dustPoints = null;
    this.dustMat = null;

    while (this.levelGroup.children.length > 0) {
      this.levelGroup.remove(this.levelGroup.children[0]);
    }
    this.levelDisposables.forEach((d) => d.dispose());
    this.levelDisposables = [];
  }

  private ensureOpenWorldMaterials(waterY: number): OpenWorldMaterialPalette {
    if (this.owMats) return this.owMats;
    const markShared = <T extends THREE.Material | THREE.BufferGeometry>(obj: T): T => {
      obj.userData.sharedPool = true;
      return obj;
    };
    const floorMat = markShared(
      new THREE.MeshStandardMaterial({
        map: this.textures.tileAlbedo,
        bumpMap: this.textures.tileBump,
        bumpScale: 0.028,
        roughnessMap: this.textures.tileRoughness,
        color: 0x8ea4a9,
        roughness: 0.34,
        metalness: 0.08,
      })
    );
    this.injectUnderwaterCaustics(floorMat, waterY, true);
    this.registerLevelMaterial(floorMat);

    const ceilMat = markShared(
      new THREE.MeshStandardMaterial({
        map: this.textures.ceilingAlbedo,
        color: 0x849396,
        roughness: 0.88,
        metalness: 0.08,
      })
    );
    const wallMat = markShared(
      new THREE.MeshStandardMaterial({
        map: this.textures.wallAlbedo,
        bumpMap: this.textures.wallBump,
        bumpScale: 0.03,
        color: 0xa8b6ba,
        roughness: 0.46,
        metalness: 0.06,
      })
    );
    this.injectUnderwaterCaustics(wallMat, waterY, false);
    this.registerLevelMaterial(wallMat);

    const pillarMat = markShared(
      new THREE.MeshStandardMaterial({
        map: this.textures.concreteAlbedo,
        bumpMap: this.textures.concreteBump,
        bumpScale: 0.028,
        color: 0x9ca7ab,
        roughness: 0.78,
        metalness: 0.06,
      })
    );
    this.injectUnderwaterCaustics(pillarMat, waterY, false);
    this.registerLevelMaterial(pillarMat);

    const collarMat = markShared(
      new THREE.MeshStandardMaterial({
        map: this.textures.concreteAlbedo,
        bumpMap: this.textures.concreteBump,
        bumpScale: 0.028,
        color: 0x7d8a8e,
        roughness: 0.84,
        metalness: 0.1,
      })
    );
    this.registerLevelMaterial(collarMat);

    const beamMat = markShared(
      new THREE.MeshStandardMaterial({
        map: this.textures.concreteAlbedo,
        bumpMap: this.textures.concreteBump,
        bumpScale: 0.028,
        color: 0x808d91,
        roughness: 0.84,
        metalness: 0.1,
      })
    );
    this.registerLevelMaterial(beamMat);

    const steelMat = markShared(
      new THREE.MeshStandardMaterial({
        map: this.textures.metalAlbedo,
        bumpMap: this.textures.metalBump,
        bumpScale: 0.018,
        color: 0x9aa8ad,
        roughness: 0.38,
        metalness: 0.82,
      })
    );
    this.registerLevelMaterial(steelMat);

    const rustMat = markShared(
      new THREE.MeshStandardMaterial({
        map: this.textures.metalAlbedo,
        bumpMap: this.textures.metalBump,
        bumpScale: 0.024,
        color: 0x785c4e,
        roughness: 0.72,
        metalness: 0.65,
      })
    );
    this.registerLevelMaterial(rustMat);

    const rubbleMat = markShared(
      new THREE.MeshStandardMaterial({
        map: this.textures.concreteAlbedo,
        bumpMap: this.textures.concreteBump,
        bumpScale: 0.03,
        color: 0x6b777a,
        roughness: 0.9,
        metalness: 0.08,
      })
    );
    this.registerLevelMaterial(rubbleMat);

    const dropMat = markShared(
      new THREE.MeshStandardMaterial({
        color: 0x525e63,
        roughness: 0.92,
        metalness: 0.12,
      })
    );

    const deadMat = markShared(
      new THREE.MeshStandardMaterial({
        color: 0x3b484d,
        roughness: 0.72,
        metalness: 0.32,
      })
    );

    const litMat = markShared(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: '#ffffff',
        emissiveIntensity: 1.48,
        roughness: 0.24,
      })
    );
    litMat.customProgramCacheKey = () => 'horror_fixture_emissive_v1';
    litMat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `
        #include <emissivemap_fragment>
        #ifdef USE_INSTANCING_COLOR
          totalEmissiveRadiance *= vColor;
        #endif
        `
      );
    };

    const glassMat = markShared(
      new THREE.MeshStandardMaterial({
        color: 0x4b6e8f,
        emissive: '#c4d8eb',
        emissiveIntensity: 0.72,
        roughness: 0.2,
        metalness: 0.4,
      })
    );

    const bulbMat = markShared(
      new THREE.MeshStandardMaterial({
        color: 0xff281c,
        emissive: 0xd91a12,
        emissiveIntensity: 2.2,
        roughness: 0.2,
      })
    );

    const subFrameMat = markShared(
      new THREE.MeshStandardMaterial({
        map: this.textures.concreteAlbedo,
        bumpMap: this.textures.concreteBump,
        bumpScale: 0.022,
        color: 0x5d6b70,
        roughness: 0.86,
        metalness: 0.14,
      })
    );
    this.registerLevelMaterial(subFrameMat);

    const curbSteelMat = markShared(
      new THREE.MeshStandardMaterial({
        map: this.textures.metalAlbedo,
        bumpMap: this.textures.metalBump,
        bumpScale: 0.018,
        color: 0x9aa8ad,
        roughness: 0.36,
        metalness: 0.82,
      })
    );
    this.registerLevelMaterial(curbSteelMat);

    const woodWetMat = markShared(
      new THREE.MeshStandardMaterial({
        map: this.textures.woodAlbedo,
        bumpMap: this.textures.woodBump,
        bumpScale: 0.03,
        color: 0x8a694c,
        roughness: 0.38,
        metalness: 0.05,
      })
    );
    this.registerLevelMaterial(woodWetMat);

    const woodTrimMat = markShared(
      new THREE.MeshStandardMaterial({
        map: this.textures.woodAlbedo,
        bumpMap: this.textures.woodBump,
        bumpScale: 0.028,
        color: 0xa6815e,
        roughness: 0.74,
        metalness: 0.04,
      })
    );
    this.registerLevelMaterial(woodTrimMat);

    const woodIronMat = markShared(
      new THREE.MeshStandardMaterial({
        map: this.textures.metalAlbedo,
        bumpMap: this.textures.metalBump,
        bumpScale: 0.02,
        color: 0x667075,
        roughness: 0.58,
        metalness: 0.72,
      })
    );
    this.registerLevelMaterial(woodIronMat);

    const decals = this.ensureHorrorDecalTextures();
    const grateMat = markShared(
      new THREE.MeshStandardMaterial({
        map: decals.grate,
        transparent: true,
        alphaTest: 0.12,
        roughness: 0.9,
        metalness: 0.15,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      })
    );
    const warnMat = markShared(
      new THREE.MeshStandardMaterial({
        map: decals.warning,
        transparent: true,
        alphaTest: 0.15,
        roughness: 0.85,
        metalness: 0.1,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      })
    );

    const panelGeo = markShared(new THREE.BoxGeometry(3.8, 0.14, 1.35));
    const bollardProto = markShared(new THREE.CylinderGeometry(0.085, 0.1, 0.34, 8));

    this.owMats = {
      floorMat,
      ceilMat,
      wallMat,
      pillarMat,
      collarMat,
      beamMat,
      steelMat,
      rustMat,
      rubbleMat,
      dropMat,
      deadMat,
      litMat,
      glassMat,
      bulbMat,
      subFrameMat,
      curbSteelMat,
      woodWetMat,
      woodTrimMat,
      woodIronMat,
      accentMats: new Map<string, THREE.MeshStandardMaterial>(),
      panelGeo,
      bollardProto,
      grateMat,
      warnMat,
    };
    return this.owMats;
  }

  private disposeOpenWorldMaterials(): void {
    const m = this.owMats;
    if (!m) return;
    m.floorMat.dispose();
    m.ceilMat.dispose();
    m.wallMat.dispose();
    m.pillarMat.dispose();
    m.collarMat.dispose();
    m.beamMat.dispose();
    m.steelMat.dispose();
    m.rustMat.dispose();
    m.rubbleMat.dispose();
    m.dropMat.dispose();
    m.deadMat.dispose();
    m.litMat.dispose();
    m.glassMat.dispose();
    m.bulbMat.dispose();
    m.subFrameMat.dispose();
    m.curbSteelMat.dispose();
    m.woodWetMat.dispose();
    m.woodTrimMat.dispose();
    m.woodIronMat.dispose();
    m.accentMats.forEach((am) => am.dispose());
    m.accentMats.clear();
    m.panelGeo.dispose();
    m.bollardProto.dispose();
    m.grateMat.dispose();
    m.warnMat.dispose();
    this.owMats = null;
  }

  private spawnMonsterFromConfig(
    mc: MonsterConfig,
    idx: number,
    waterY: number,
    parentGroup: THREE.Group = this.levelGroup
  ): RuntimeMonster {
    const rig = createMonsterRig(this.textures, mc.scale || 1);
    rig.setShadowDetail(this.activeQuality);
    const startWp = mc.waypoints[0] || [0, -25];
    const nextWp = mc.waypoints[1] || startWp;
    const scale = mc.scale || 1;
    const pos = new THREE.Vector3(startWp[0], waterY - 0.14, startWp[1]);
    const monsterRadius = 0.9 * scale;
    this.resolveCircleSolids(
      pos,
      monsterRadius,
      waterY - 1.5,
      waterY + 4.2 * scale,
      monsterRadius + 0.15,
      true
    );
    const initYaw = Math.atan2(nextWp[0] - pos.x, nextWp[1] - pos.z) || 0;
    rig.root.position.copy(pos);
    rig.root.rotation.y = 0;
    resetSerpentTrail(rig, pos, initYaw);
    parentGroup.add(rig.root);

    return {
      id: mc.id,
      rig,
      pos,
      yaw: initYaw,
      targetYaw: initYaw,
      targetUserId: null,
      waypoints: mc.waypoints,
      wpIndex: 1 % Math.max(1, mc.waypoints.length),
      patrolSpeed: mc.patrolSpeed,
      chaseSpeed: mc.chaseSpeed,
      detectionRadius: mc.detectionRadius,
      waterDetectionRadius: mc.waterDetectionRadius,
      scale,
      alert: 'calm',
      searchTarget: pos.clone(),
      searchTimer: 0,
      velX: 0,
      velZ: 0,
      avoidDir: idx % 2 === 0 ? 1 : -1,
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
      eatingPreyStartYaw: initYaw,
      eatingGulpStage: 0,
      eatingSwallowAudioPlayed: false,
      safeEpoch: 0,
      intimidationPhase: 'none',
      intimidationTimer: 0,
      intimidationDuration: 0,
      intimidationSpot: pos.clone(),
      intimidationPlatform: null,
      intimidationLocalOffset: new THREE.Vector3(),
      intimidationYaw: initYaw,
      diveTimer: 0,
      visionState: 'none',
      visionTimer: 0,
      watchingUserId: null,
      lookAway: false,
      lookAwayYaw: initYaw,
      lastEdgeSpotTime: -1,
      lastEdgeSpotPlayerX: NaN,
      lastEdgeSpotPlayerZ: NaN,
    };
  }

  private loadOpenWorld(
    nextPhase: GamePhase,
    skipPrewarm = false,
    customSpawn?: { x: number; y: number; z: number; yaw: number },
    savedCheckpointId?: string | null
  ): void {
    this.clearLevel();
    this.activeWorldMode = 'open_world';

    const restoredCp = savedCheckpointId ? getWorldCheckpointById(savedCheckpointId) : null;
    const spawnPos = customSpawn
      ? customSpawn
      : restoredCp
        ? { x: restoredCp.x, y: restoredCp.y + 0.5, z: restoredCp.z, yaw: restoredCp.yaw }
        : OPEN_WORLD_SPAWN;
    const startMeta = getWorldRegionAtPos(spawnPos.x, spawnPos.z);
    const def = getWorldRegionDef(startMeta.regionId);
    this.owCurrentRegionId = startMeta.regionId;
    this.currentLevel = def;
    this.phase = nextPhase;
    this.needsStaticRender = true;
    this.menuFrameAccum = 0;
    this.deathReason = null;
    this.jumpscareMonster = null;
    this.jumpscareTimer = 0;
    this.resetFpsTracker();
    this.ensureLoopRunning();

    this.platformTime = 0;
    this.levelTimeRemaining = 0;
    this.levelTimeElapsed = 0;
    if (restoredCp && customSpawn) {
      this.activeSpawn.set(restoredCp.x, restoredCp.y + 0.5, restoredCp.z);
    } else {
      this.activeSpawn.set(spawnPos.x, spawnPos.y, spawnPos.z);
    }
    this.playerPos.set(spawnPos.x, spawnPos.y, spawnPos.z);
    this.playerYaw = spawnPos.yaw;
    this.owActivatedCheckpointIds.clear();
    if (restoredCp) {
      this.owCheckpointId = restoredCp.id;
      this.owCheckpointRegionId = restoredCp.regionId;
      this.owCheckpointLabel = restoredCp.label;
      this.owCheckpointYaw = restoredCp.yaw;
      this.owActivatedCheckpointIds.add(restoredCp.id);
      this.activeCheckpointIndex = 1;
    } else {
      this.owCheckpointId = null;
      this.owCheckpointRegionId = startMeta.regionId;
      this.owCheckpointLabel = 'Region 01 Entry Dock';
      this.owCheckpointYaw = spawnPos.yaw;
      this.activeCheckpointIndex = 0;
    }
    this.checkpointNotice = null;
    this.checkpointNoticeTimer = 0;

    const atmo = this.computeHorrorAtmosphere(def);
    this.owTargetAtmo = atmo;
    this.baseFogColor.copy(atmo.fogColor);
    this.underwaterFogColor.copy(atmo.underwaterFogColor);
    this.baseFogDensity = atmo.fogDensity;
    this.baseHemiColor.copy(atmo.hemiSky);
    this.baseHemiIntensity = atmo.hemiIntensity;
    this.baseRimIntensity = atmo.rimIntensity;
    this.baseKeyIntensity = atmo.moonIntensity;

    this.scene.background = this.baseFogColor.clone();
    this.scene.fog = new THREE.FogExp2(this.baseFogColor, this.baseFogDensity);

    const hemi = new THREE.HemisphereLight(atmo.hemiSky, atmo.hemiGround, atmo.hemiIntensity);
    this.levelGroup.add(hemi);
    this.hemiLight = hemi;

    const rimLight = new THREE.DirectionalLight(atmo.rimColor, atmo.rimIntensity);
    rimLight.position.set(spawnPos.x - 22, 20, spawnPos.z - 55);
    this.levelGroup.add(rimLight);
    this.rimLight = rimLight;

    const keyLight = new THREE.DirectionalLight(atmo.moonColor, atmo.moonIntensity);
    keyLight.position.set(spawnPos.x + 18, 34, spawnPos.z + 14);
    keyLight.target.position.set(spawnPos.x, 0, spawnPos.z);
    const wantShadow = !this.isSoftwareGl && this.activeQuality !== 'smooth';
    keyLight.castShadow = wantShadow;
    const sMap = this.activeQuality === 'ultra' ? (this.isTouchDevice ? 1024 : 2048) : this.isTouchDevice ? 768 : 1024;
    keyLight.shadow.mapSize.set(sMap, sMap);
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 135;
    const d = this.activeQuality === 'ultra' ? 52 : this.isTouchDevice ? 32 : 38;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.00045;
    keyLight.shadow.normalBias = 0.022;
    keyLight.shadow.radius = this.activeQuality === 'ultra' && !this.isTouchDevice ? 3.0 : 1.8;
    this.levelGroup.add(keyLight);
    this.levelGroup.add(keyLight.target);
    this.keyLight = keyLight;

    const compactLights = this.isSoftwareGl || this.isLowEndGpu || this.isTouchDevice;
    const poolCount = compactLights ? 2 : 4;
    for (let i = 0; i < poolCount; i++) {
      const pLight = new THREE.PointLight('#b4d0cc', i === 0 ? 1.25 : 0, 50, 1.35);
      this.levelGroup.add(pLight);
      this.pointLightPool.push(pLight);
    }

    this.ensureOpenWorldMaterials(OPEN_WORLD_BOUNDS.waterY);
    this.buildAtmosphericParticles(def, atmo);
    this.buildWater(def);
    this.updateOpenWorldStreaming(true);
    this.syncOpenWorldCheckpointVisuals();

    this.respawnAtActiveCheckpoint(false);
    this.playerYaw = spawnPos.yaw;
    this.camYaw = this.playerYaw - Math.PI;
    const shouldShowLocal = nextPhase !== 'menu';
    resetPlayerRigPose(this.playerRig);
    this.playerRig.setVisible(shouldShowLocal);
    this.ensureLocalPlayerVisible();
    this.syncLocalPlayerRigTransform('idle', 0);
    this.applyQualityToRenderer();
    if (nextPhase !== 'menu') {
      this.snapPlayCameraImmediate();
    }
    if (!skipPrewarm) {
      this.prewarmSceneShaders();
      this.lastTimeMs = performance.now();
    }
    this.emitHud(true);
  }

  private mountOpenWorldRegion(regionId: number): OpenWorldChunk | null {
    const key = `r_${regionId}`;
    const existing = this.owChunks.get(key);
    if (existing) return existing;

    const def: WorldRegionRuntimeDef = getWorldRegionDef(regionId);
    const mats = this.ensureOpenWorldMaterials(def.bounds.waterY);
    const atmo = this.computeHorrorAtmosphere(def);
    const { minX, maxX, minZ, maxZ, floorY, waterY, ceilingY } = def.bounds;
    const width = maxX - minX;
    const depth = maxZ - minZ;
    const height = ceilingY - floorY;
    const cx = (minX + maxX) * 0.5;
    const cz = (minZ + maxZ) * 0.5;

    const group = new THREE.Group();
    const chunk: OpenWorldChunk = {
      key,
      bounds: { ...def.bounds },
      group,
      platforms: [],
      walls: [],
      checkpoints: [],
      lights: [],
      monsters: [],
      staticChunkRefs: [],
      disposables: [],
      shadowReceivers: [],
      qualityMaterials: [],
    };
    this.levelGroup.add(group);
    this.owChunks.set(key, chunk);

    const isBlockedByDoorway = (side: 'w' | 'e', zCoord: number, pad = 1.6): boolean => {
      for (let i = 0; i < def.doorways.length; i++) {
        const d = def.doorways[i];
        if (d.side === side && Math.abs(zCoord - d.center) <= d.halfWidth + pad) {
          return true;
        }
      }
      return false;
    };

    // Floor & ceiling slabs (perimeter walls are generated with exact doorway cutouts inside def.walls)
    const floorGeo = new THREE.PlaneGeometry(width, depth);
    this.scalePlaneUVs(floorGeo, width / 3.2, depth / 3.2);
    const floorMesh = new THREE.Mesh(floorGeo, mats.floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(cx, floorY, cz);
    floorMesh.receiveShadow = true;
    this.registerShadowReceiver(floorMesh);
    chunk.shadowReceivers.push(floorMesh);
    group.add(floorMesh);
    chunk.disposables.push(floorGeo);

    const ceilGeo = new THREE.PlaneGeometry(width, depth);
    this.scalePlaneUVs(ceilGeo, Math.max(2, width / 12), Math.max(4, depth / 12));
    const ceilMesh = new THREE.Mesh(ceilGeo, mats.ceilMat);
    ceilMesh.rotation.x = Math.PI / 2;
    ceilMesh.position.set(cx, ceilingY, cz);
    group.add(ceilMesh);
    chunk.disposables.push(ceilGeo);

    const dummy = new THREE.Object3D();

    // Ceiling beams, pilasters, ladders & bulkheads
    const ribSpacing = 16;
    const ribZs: number[] = [];
    for (let z = maxZ - 8; z >= minZ + 8; z -= ribSpacing) ribZs.push(z);
    if (ribZs.length > 0) {
      const beamGeo = new THREE.BoxGeometry(width, 0.72, 0.85);
      const beamInst = new THREE.InstancedMesh(beamGeo, mats.beamMat, ribZs.length);
      ribZs.forEach((z, idx) => {
        dummy.position.set(cx, ceilingY - 0.36, z);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        beamInst.setMatrixAt(idx, dummy.matrix);
      });
      beamInst.instanceMatrix.needsUpdate = true;
      beamInst.computeBoundingSphere();
      group.add(beamInst);
      chunk.disposables.push(beamGeo);

      const pilPlacements: Array<{ x: number; z: number }> = [];
      ribZs.forEach((z) => {
        if (!isBlockedByDoorway('w', z, 1.8)) pilPlacements.push({ x: minX + 0.25, z });
        if (!isBlockedByDoorway('e', z, 1.8)) pilPlacements.push({ x: maxX - 0.25, z });
      });
      if (pilPlacements.length > 0) {
        const pilGeo = new THREE.BoxGeometry(0.55, height, 0.95);
        const pilInst = new THREE.InstancedMesh(pilGeo, mats.beamMat, pilPlacements.length);
        pilPlacements.forEach((p, idx) => {
          dummy.position.set(p.x, floorY + height * 0.5, p.z);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          pilInst.setMatrixAt(idx, dummy.matrix);
        });
        pilInst.instanceMatrix.needsUpdate = true;
        pilInst.computeBoundingSphere();
        group.add(pilInst);
        chunk.disposables.push(pilGeo);
      }

      const ladderZs = ribZs.filter((_, i) => i % 2 === 0);
      const railMats: THREE.Matrix4[] = [];
      ladderZs.forEach((z, lIdx) => {
        for (const side of [-1, 1] as const) {
          const cardSide = side < 0 ? 'w' : 'e';
          if (isBlockedByDoorway(cardSide, z, 2.0)) continue;
          const wx = side < 0 ? minX + 0.28 : maxX - 0.28;
          const crooked = (lIdx + (side > 0 ? 1 : 0)) % 3 === 0 ? 0.055 * side : 0;
          for (const dz of [-0.32, 0.32]) {
            dummy.position.set(wx, waterY + 0.25, z + dz);
            dummy.rotation.set(crooked, 0, crooked * 0.6);
            dummy.updateMatrix();
            railMats.push(dummy.matrix.clone());
          }
        }
      });
      dummy.rotation.set(0, 0, 0);
      if (railMats.length > 0) {
        const railGeo = new THREE.CylinderGeometry(0.032, 0.032, 3.2, 8);
        const railInst = new THREE.InstancedMesh(railGeo, mats.steelMat, railMats.length);
        railMats.forEach((mtx, i) => railInst.setMatrixAt(i, mtx));
        railInst.instanceMatrix.needsUpdate = true;
        railInst.computeBoundingSphere();
        group.add(railInst);
        chunk.disposables.push(railGeo);
      }

      const bulkheadZs = ribZs.filter((_, i) => i % 2 === 1);
      if (bulkheadZs.length > 0) {
        const dropH = Math.max(1.4, (ceilingY - waterY) * 0.22);
        const dropGeo = new THREE.BoxGeometry(width * 0.72, dropH, 0.55);
        const dropInst = new THREE.InstancedMesh(dropGeo, mats.dropMat, bulkheadZs.length);
        bulkheadZs.forEach((z, idx) => {
          dummy.position.set(cx, ceilingY - dropH * 0.5 - 0.2, z);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          dropInst.setMatrixAt(idx, dummy.matrix);
        });
        dropInst.instanceMatrix.needsUpdate = true;
        dropInst.computeBoundingSphere();
        group.add(dropInst);
        chunk.disposables.push(dropGeo);
      }
    }

    // Ceiling fixture panels & lights
    if (def.lights.length > 0) {
      const deadIndices: number[] = [];
      const litFixtures: Array<{ idx: number; color: THREE.Color; intensity: number; flickering: boolean }> = [];
      def.lights.forEach((l, idx) => {
        const hash = Math.abs(Math.sin((def.id * 71.3 + idx * 19.7) * 43758.5453) % 1);
        if (hash < atmo.deadFixtureChance && def.lights.length > 2) {
          deadIndices.push(idx);
          return;
        }
        const isEmergency = hash < atmo.deadFixtureChance + atmo.emergencyChance;
        const fxColor = isEmergency
          ? new THREE.Color(hash % 0.08 < 0.045 ? '#cf382b' : '#cf7028')
          : atmo.tubeTint.clone();
        const fxIntensity = isEmergency ? (l.intensity ?? 1.4) * 1.1 : (l.intensity ?? 1.4) * 0.96;
        const isFlickering = Boolean(l.flickering) || hash > 0.68;
        litFixtures.push({ idx, color: fxColor, intensity: fxIntensity, flickering: isFlickering });
      });

      if (deadIndices.length > 0) {
        const deadInst = new THREE.InstancedMesh(mats.panelGeo, mats.deadMat, deadIndices.length);
        deadIndices.forEach((origIdx, i) => {
          const l = def.lights[origIdx];
          dummy.position.set(l.position[0], ceilingY - 0.12, l.position[2]);
          dummy.rotation.set(0, 0, origIdx % 3 === 0 ? 0.04 : 0);
          dummy.updateMatrix();
          deadInst.setMatrixAt(i, dummy.matrix);
        });
        deadInst.instanceMatrix.needsUpdate = true;
        deadInst.computeBoundingSphere();
        group.add(deadInst);
      }

      if (litFixtures.length > 0) {
        const litInst = new THREE.InstancedMesh(mats.panelGeo, mats.litMat, litFixtures.length);
        litFixtures.forEach((f, i) => {
          const l = def.lights[f.idx];
          dummy.position.set(l.position[0], ceilingY - 0.12, l.position[2]);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          litInst.setMatrixAt(i, dummy.matrix);
          litInst.setColorAt(i, f.color);
          const lEntry = {
            x: l.position[0],
            y: l.position[1],
            z: l.position[2],
            color: f.color,
            baseIntensity: f.intensity,
            flickering: f.flickering,
            seed: f.idx * 7.13 + def.id * 1.37,
          };
          chunk.lights.push(lEntry);
          this.levelLights.push(lEntry);
        });
        litInst.instanceMatrix.needsUpdate = true;
        if (litInst.instanceColor) litInst.instanceColor.needsUpdate = true;
        litInst.computeBoundingSphere();
        group.add(litInst);
      }
    }

    // Broken skylights, grates, quarantine signs & underwater rubble slabs
    const skylightZs: number[] = [];
    for (let z = maxZ - 24; z >= minZ + 22; z -= 30) skylightZs.push(z);
    if (skylightZs.length > 0) {
      const frameGeo = new THREE.BoxGeometry(Math.min(7.2, width * 0.34), 0.24, 4.6);
      const glassGeo = new THREE.PlaneGeometry(Math.min(6.4, width * 0.3), 3.9);
      const frameInst = new THREE.InstancedMesh(frameGeo, mats.rustMat, skylightZs.length);
      const glassInst = new THREE.InstancedMesh(glassGeo, mats.glassMat, skylightZs.length);
      skylightZs.forEach((z, idx) => {
        const sx = cx + Math.sin(def.id * 3.1 + idx * 2.3) * Math.min(2.8, width * 0.08);
        dummy.position.set(sx, ceilingY - 0.14, z);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        frameInst.setMatrixAt(idx, dummy.matrix);
        dummy.position.set(sx, ceilingY - 0.28, z);
        dummy.rotation.set(Math.PI / 2, 0, 0);
        dummy.updateMatrix();
        glassInst.setMatrixAt(idx, dummy.matrix);
      });
      frameInst.instanceMatrix.needsUpdate = true;
      glassInst.instanceMatrix.needsUpdate = true;
      frameInst.computeBoundingSphere();
      glassInst.computeBoundingSphere();
      group.add(frameInst, glassInst);
      chunk.disposables.push(frameGeo, glassGeo);
    }

    const grateMats: THREE.Matrix4[] = [];
    for (let z = maxZ - 14; z >= minZ + 14; z -= 24) {
      if (!isBlockedByDoorway('w', z, 2.0)) {
        dummy.position.set(minX + 0.03, waterY + 0.88, z);
        dummy.rotation.set(0, Math.PI / 2, 0);
        dummy.updateMatrix();
        grateMats.push(dummy.matrix.clone());
      }
      if (!isBlockedByDoorway('e', z, 2.0)) {
        dummy.position.set(maxX - 0.03, waterY + 0.88, z);
        dummy.rotation.set(0, -Math.PI / 2, 0);
        dummy.updateMatrix();
        grateMats.push(dummy.matrix.clone());
      }
    }
    if (grateMats.length > 0) {
      const grateGeo = new THREE.PlaneGeometry(2.1, 2.1);
      const grateInst = new THREE.InstancedMesh(grateGeo, mats.grateMat, grateMats.length);
      grateMats.forEach((mtx, i) => grateInst.setMatrixAt(i, mtx));
      grateInst.instanceMatrix.needsUpdate = true;
      grateInst.computeBoundingSphere();
      group.add(grateInst);
      chunk.disposables.push(grateGeo);
    }

    if (waterY - floorY >= 1.5) {
      const slabGeo = new THREE.BoxGeometry(2.6, 0.32, 1.5);
      const rubbleCount = Math.min(18, Math.max(6, Math.floor(depth / 18)));
      const slabInst = new THREE.InstancedMesh(slabGeo, mats.rubbleMat, rubbleCount);
      for (let i = 0; i < rubbleCount; i++) {
        const h1 = Math.abs(Math.sin((def.id * 31.7 + i * 17.3) * 1234.5) % 1);
        const h2 = Math.abs(Math.cos((def.id * 19.3 + i * 43.1) * 2345.6) % 1);
        const rx = minX + 3.5 + h1 * Math.max(4, width - 7);
        const rz = minZ + 6 + (i / rubbleCount) * Math.max(8, depth - 12);
        dummy.position.set(rx, floorY + 0.14, rz);
        dummy.rotation.set((h1 - 0.5) * 0.18, h2 * Math.PI, (h2 - 0.5) * 0.16);
        dummy.updateMatrix();
        slabInst.setMatrixAt(i, dummy.matrix);
      }
      slabInst.instanceMatrix.needsUpdate = true;
      slabInst.computeBoundingSphere();
      group.add(slabInst);
      chunk.disposables.push(slabGeo);
    }

    // Platforms & Walls (static parts chunk-merged + dynamic platforms tracked individually)
    const platBuckets = new Map<number, Map<THREE.Material, { cast: THREE.BufferGeometry[]; noCast: THREE.BufferGeometry[] }>>();
    this.buildPlatformsInto(
      def.platforms,
      def.bounds,
      platBuckets,
      chunk.platforms,
      chunk.disposables,
      chunk.shadowReceivers,
      chunk.qualityMaterials,
      group,
      mats
    );
    this.flushStaticChunks(platBuckets, minZ, chunk);

    const wallBuckets = new Map<number, Map<THREE.Material, { cast: THREE.BufferGeometry[]; noCast: THREE.BufferGeometry[] }>>();
    this.buildInnerWallsInto(def.walls, def.bounds, wallBuckets, chunk.walls, chunk.disposables, mats);
    this.flushStaticChunks(wallBuckets, minZ, chunk);

    // Checkpoints inside region
    def.worldCheckpoints.forEach((wc) => {
      const vis = createCheckpointVisual([wc.x, wc.y, wc.z]);
      group.add(vis.group);
      this.checkpoints.push(vis);
      chunk.checkpoints.push(vis);
      this.owCheckpointMeta.set(vis, {
        id: wc.id,
        regionId: wc.regionId,
        label: wc.label,
        yaw: wc.yaw,
      });
      const lEntry = {
        x: wc.x,
        y: wc.y + 1.25,
        z: wc.z,
        color: vis.lightColor,
        baseIntensity: 2.1,
        flickering: false,
        seed: 0,
        checkpointRef: vis,
      };
      chunk.lights.push(lEntry);
      this.levelLights.push(lEntry);
    });

    // Solo Open World: spawn local AI serpents belonging to this region
    def.monsters.forEach((mc, idx) => {
      if (this.monsters.some((existingM) => existingM.id === mc.id)) return;
      const rm = this.spawnMonsterFromConfig(mc, idx, waterY, group);
      this.monsters.push(rm);
      chunk.monsters.push(rm);
    });

    return chunk;
  }

  private mountOpenWorldConnector(connectorId: string): OpenWorldChunk | null {
    const key = `c_${connectorId}`;
    const existing = this.owChunks.get(key);
    if (existing) return existing;

    const conn: WorldConnectorDef | null = getWorldConnectorDef(connectorId);
    if (!conn) return null;

    const mats = this.ensureOpenWorldMaterials(conn.bounds.waterY);
    const group = new THREE.Group();
    const chunk: OpenWorldChunk = {
      key,
      bounds: { ...conn.bounds },
      group,
      platforms: [],
      walls: [],
      checkpoints: [],
      lights: [],
      monsters: [],
      staticChunkRefs: [],
      disposables: [],
      shadowReceivers: [],
      qualityMaterials: [],
    };
    this.levelGroup.add(group);
    this.owChunks.set(key, chunk);

    for (let i = 0; i < conn.floorBoxes.length; i++) {
      const fb = conn.floorBoxes[i];
      const w = Math.max(1, fb.maxX - fb.minX);
      const d = Math.max(1, fb.maxZ - fb.minZ);
      const cx = (fb.minX + fb.maxX) * 0.5;
      const cz = (fb.minZ + fb.maxZ) * 0.5;

      const floorGeo = new THREE.PlaneGeometry(w, d);
      this.scalePlaneUVs(floorGeo, w / 3.2, d / 3.2);
      const floorMesh = new THREE.Mesh(floorGeo, mats.floorMat);
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.position.set(cx, fb.floorY, cz);
      floorMesh.receiveShadow = true;
      this.registerShadowReceiver(floorMesh);
      chunk.shadowReceivers.push(floorMesh);
      group.add(floorMesh);
      chunk.disposables.push(floorGeo);

      const ceilGeo = new THREE.PlaneGeometry(w, d);
      this.scalePlaneUVs(ceilGeo, Math.max(2, w / 12), Math.max(2, d / 12));
      const ceilMesh = new THREE.Mesh(ceilGeo, mats.ceilMat);
      ceilMesh.rotation.x = Math.PI / 2;
      ceilMesh.position.set(cx, fb.ceilingY, cz);
      group.add(ceilMesh);
      chunk.disposables.push(ceilGeo);
    }

    if (conn.lights.length > 0) {
      const dummy = new THREE.Object3D();
      const litInst = new THREE.InstancedMesh(mats.panelGeo, mats.litMat, conn.lights.length);
      const tint = new THREE.Color('#bfd6df');
      conn.lights.forEach((l, i) => {
        dummy.position.set(l.position[0], conn.bounds.ceilingY - 0.12, l.position[2]);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        litInst.setMatrixAt(i, dummy.matrix);
        litInst.setColorAt(i, tint);
        const lEntry = {
          x: l.position[0],
          y: l.position[1],
          z: l.position[2],
          color: tint,
          baseIntensity: l.intensity ?? 1.25,
          flickering: Boolean(l.flickering),
          seed: i * 4.7,
        };
        chunk.lights.push(lEntry);
        this.levelLights.push(lEntry);
      });
      litInst.instanceMatrix.needsUpdate = true;
      if (litInst.instanceColor) litInst.instanceColor.needsUpdate = true;
      litInst.computeBoundingSphere();
      group.add(litInst);
    }

    const platBuckets = new Map<number, Map<THREE.Material, { cast: THREE.BufferGeometry[]; noCast: THREE.BufferGeometry[] }>>();
    this.buildPlatformsInto(
      conn.platforms,
      conn.bounds,
      platBuckets,
      chunk.platforms,
      chunk.disposables,
      chunk.shadowReceivers,
      chunk.qualityMaterials,
      group,
      mats
    );
    this.flushStaticChunks(platBuckets, conn.bounds.minZ, chunk);

    const wallBuckets = new Map<number, Map<THREE.Material, { cast: THREE.BufferGeometry[]; noCast: THREE.BufferGeometry[] }>>();
    this.buildInnerWallsInto(conn.walls, conn.bounds, wallBuckets, chunk.walls, chunk.disposables, mats);
    this.flushStaticChunks(wallBuckets, conn.bounds.minZ, chunk);

    conn.checkpoints.forEach((wc) => {
      const vis = createCheckpointVisual([wc.x, wc.y, wc.z]);
      group.add(vis.group);
      this.checkpoints.push(vis);
      chunk.checkpoints.push(vis);
      this.owCheckpointMeta.set(vis, {
        id: wc.id,
        regionId: wc.regionId,
        label: wc.label,
        yaw: wc.yaw,
      });
      const lEntry = {
        x: wc.x,
        y: wc.y + 1.25,
        z: wc.z,
        color: vis.lightColor,
        baseIntensity: 2.2,
        flickering: false,
        seed: 0,
        checkpointRef: vis,
      };
      chunk.lights.push(lEntry);
      this.levelLights.push(lEntry);
    });

    return chunk;
  }

  private unmountOpenWorldChunk(chunk: OpenWorldChunk, deleteFromMap = true): void {
    if (deleteFromMap) {
      this.owChunks.delete(chunk.key);
    }

    if (chunk.platforms.length > 0) {
      const platSet = new Set(chunk.platforms);
      this.platforms = this.platforms.filter((p) => !platSet.has(p));
      this.dynamicPlatforms = this.dynamicPlatforms.filter((p) => !platSet.has(p));
      if (this.stoodPlatform && platSet.has(this.stoodPlatform)) {
        this.stoodPlatform = null;
      }
    }

    if (chunk.walls.length > 0) {
      const wallSet = new Set(chunk.walls);
      this.walls = this.walls.filter((w) => !wallSet.has(w));
    }

    if (chunk.staticChunkRefs.length > 0) {
      const scSet = new Set(chunk.staticChunkRefs);
      this.staticChunks = this.staticChunks.filter((c) => !scSet.has(c));
    }

    if (chunk.checkpoints.length > 0) {
      const cpSet = new Set(chunk.checkpoints);
      this.checkpoints = this.checkpoints.filter((cp) => !cpSet.has(cp));
      for (const cp of chunk.checkpoints) {
        this.owCheckpointMeta.delete(cp);
        cp.group.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            if (!obj.geometry.userData?.sharedPool) obj.geometry.dispose();
            if (Array.isArray(obj.material)) {
              obj.material.forEach((m) => {
                if (!m.userData?.sharedPool) m.dispose();
              });
            } else if (!obj.material.userData?.sharedPool) {
              obj.material.dispose();
            }
          }
        });
      }
    }

    if (chunk.lights.length > 0) {
      const lSet = new Set(chunk.lights);
      this.levelLights = this.levelLights.filter((l) => !lSet.has(l));
      this._lastLightCamX = NaN;
      this._lastLightCamZ = NaN;
    }

    if (chunk.shadowReceivers.length > 0) {
      const srSet = new Set(chunk.shadowReceivers);
      this.levelShadowReceivers = this.levelShadowReceivers.filter((m) => !srSet.has(m));
    }

    if (chunk.qualityMaterials.length > 0) {
      const qmSet = new Set(chunk.qualityMaterials);
      this.levelQualityMaterials = this.levelQualityMaterials.filter((qm) => !qmSet.has(qm));
    }

    if (chunk.monsters.length > 0) {
      const kept: RuntimeMonster[] = [];
      for (const m of chunk.monsters) {
        const keepLive =
          deleteFromMap &&
          (m === this.jumpscareMonster ||
            m.eatingUserId === '__local__' ||
            Math.hypot(m.pos.x - this.playerPos.x, m.pos.z - this.playerPos.z) < 95);
        if (keepLive) {
          this.levelGroup.attach(m.rig.root);
          kept.push(m);
        } else {
          if (m.eatingUserId) {
            this.sound.stopAttackEatingAudio(`${m.id}:${m.eatingUserId}`, 0.05);
          }
          this.sound.stopSnakeSwimmingAudio(0.05, m.id);
          chunk.group.remove(m.rig.root);
          m.rig.dispose();
          const idx = this.monsters.indexOf(m);
          if (idx >= 0) this.monsters.splice(idx, 1);
        }
      }
      chunk.monsters = kept;
    }

    chunk.group.traverse((obj) => {
      if (obj instanceof THREE.InstancedMesh) {
        obj.dispose();
      }
    });
    for (let i = 0; i < chunk.disposables.length; i++) {
      chunk.disposables[i].dispose();
    }
    chunk.disposables = [];
    this.levelGroup.remove(chunk.group);
  }

  private updateOpenWorldStreaming(force = false): void {
    if (this.activeWorldMode !== 'open_world') return;
    const fx = Number.isFinite(this.playerPos.x) ? this.playerPos.x : OPEN_WORLD_SPAWN.x;
    const fz = Number.isFinite(this.playerPos.z) ? this.playerPos.z : OPEN_WORLD_SPAWN.z;

    if (
      !force &&
      !Number.isNaN(this.owLastStreamX) &&
      !Number.isNaN(this.owLastStreamZ) &&
      Math.hypot(fx - this.owLastStreamX, fz - this.owLastStreamZ) < 16
    ) {
      return;
    }
    this.owLastStreamX = fx;
    this.owLastStreamZ = fz;

    const curMeta = getWorldRegionAtPos(fx, fz);
    if (curMeta.regionId !== this.owCurrentRegionId || force) {
      this.owCurrentRegionId = curMeta.regionId;
      this.currentLevel = getWorldRegionDef(curMeta.regionId);
      this.owTargetAtmo = this.computeHorrorAtmosphere(this.currentLevel);
    }

    const streamRadius =
      this.activeQuality === 'ultra' ? 210 : this.activeQuality === 'standard' ? 170 : 140;
    const unmountRadius = streamRadius + 38;

    const desiredRegions = new Set<number>(getNearbyWorldRegionIds(fx, fz, streamRadius));
    desiredRegions.add(curMeta.regionId);
    for (let i = 0; i < curMeta.connectedRegionIds.length; i++) {
      desiredRegions.add(curMeta.connectedRegionIds[i]);
    }

    // Retain already-mounted regions within hysteresis radius so boundary crossing never flickers
    const activeRegions = new Set<number>(desiredRegions);
    for (const [key, chunk] of this.owChunks.entries()) {
      if (!key.startsWith('r_')) continue;
      const rid = Number(key.slice(2));
      if (desiredRegions.has(rid)) continue;
      const b = chunk.bounds;
      const cx = fx < b.minX ? b.minX : fx > b.maxX ? b.maxX : fx;
      const cz = fz < b.minZ ? b.minZ : fz > b.maxZ ? b.maxZ : fz;
      if (Math.hypot(fx - cx, fz - cz) <= unmountRadius) {
        activeRegions.add(rid);
      }
    }

    const desiredConnectors = new Set<string>(getConnectorIdsForRegions(activeRegions));
    let topologyChanged = force;

    for (const key of Array.from(this.owChunks.keys())) {
      if (key.startsWith('r_')) {
        const rid = Number(key.slice(2));
        if (!activeRegions.has(rid)) {
          const ch = this.owChunks.get(key);
          if (ch) {
            this.unmountOpenWorldChunk(ch, true);
            topologyChanged = true;
          }
        }
      } else if (key.startsWith('c_')) {
        const cid = key.slice(2);
        if (!desiredConnectors.has(cid)) {
          const ch = this.owChunks.get(key);
          if (ch) {
            this.unmountOpenWorldChunk(ch, true);
            topologyChanged = true;
          }
        }
      }
    }

    for (const rid of activeRegions) {
      if (!this.owChunks.has(`r_${rid}`)) {
        this.mountOpenWorldRegion(rid);
        topologyChanged = true;
      }
    }
    for (const cid of desiredConnectors) {
      if (!this.owChunks.has(`c_${cid}`)) {
        this.mountOpenWorldConnector(cid);
        topologyChanged = true;
      }
    }

    if (topologyChanged) {
      this.syncOpenWorldCheckpointVisuals();
      this.rebuildActiveSpatialGrid();
      this._lastCullCamX = NaN;
      this._lastCullCamZ = NaN;
      this.updateVisibilityCulling(true);
    }
  }

  private rebuildActiveSpatialGrid(): void {
    if (this.activeWorldMode !== 'open_world') return;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    let floorY = OPEN_WORLD_BOUNDS.floorY;
    let ceilingY = OPEN_WORLD_BOUNDS.ceilingY;

    for (const chunk of this.owChunks.values()) {
      const b = chunk.bounds;
      if (b.minX < minX) minX = b.minX;
      if (b.maxX > maxX) maxX = b.maxX;
      if (b.minZ < minZ) minZ = b.minZ;
      if (b.maxZ > maxZ) maxZ = b.maxZ;
      if (b.floorY < floorY) floorY = b.floorY;
      if (b.ceilingY > ceilingY) ceilingY = b.ceilingY;
    }

    if (!Number.isFinite(minX)) {
      minX = -50;
      maxX = 50;
      minZ = -180;
      maxZ = 40;
    }

    const platDefs: PlatformDef[] = this.platforms.map((p) => p.def);
    const wallDefs: WallDef[] = this.walls.map((w) => ({
      position: [w.centerX, (w.minY + w.maxY) * 0.5, w.centerZ],
      size: [w.maxX - w.minX, w.maxY - w.minY, w.maxZ - w.minZ],
    }));

    this.spatialGrid = new LevelSpatialGrid(
      {
        bounds: {
          minX,
          maxX,
          minZ,
          maxZ,
          floorY,
          waterY: OPEN_WORLD_BOUNDS.waterY,
          ceilingY,
        },
        platforms: platDefs,
        walls: wallDefs,
      },
      12
    );
  }

  private syncOpenWorldCheckpointVisuals(): void {
    for (let i = 0; i < this.checkpoints.length; i++) {
      const cp = this.checkpoints[i];
      const meta = this.owCheckpointMeta.get(cp);
      if (!meta) continue;
      const isAct = this.owActivatedCheckpointIds.has(meta.id) || meta.id === this.owCheckpointId;
      cp.activated = isAct;
      if (isAct) {
        cp.beaconMat.color.setHex(0x4ef2b8);
        cp.beaconMat.emissive.setHex(0x28d196);
        cp.lightColor.setHex(0x4ef2b8);
      } else {
        cp.beaconMat.color.setHex(0xebb144);
        cp.beaconMat.emissive.setHex(0xd99626);
        cp.lightColor.setHex(0xebb144);
      }
    }
  }

  public loadLevel(levelId: number, nextPhase: GamePhase, skipPrewarm = false): void {
    this.clearLevel();
    this.activeWorldMode = 'sector';

    const def = getLevelById(levelId);
    this.currentLevel = def;
    this.spatialGrid = new LevelSpatialGrid(def, 12);
    this.phase = nextPhase;
    this.needsStaticRender = true;
    this.menuFrameAccum = 0;
    this.deathReason = null;
    this.jumpscareMonster = null;
    this.jumpscareTimer = 0;
    this.resetFpsTracker();
    this.ensureLoopRunning();

    // Reset timers & spawn
    this.platformTime = 0;
    this.levelTimeRemaining = def.timeLimit;
    this.levelTimeElapsed = 0;
    this.activeSpawn.set(def.spawn[0], def.spawn[1], def.spawn[2]);
    this.activeCheckpointIndex = 0;
    this.checkpointNotice = null;
    this.checkpointNoticeTimer = 0;

    this.respawnAtActiveCheckpoint(false);

    // Survival-horror atmosphere & fog calibrated per level/wing while preserving gameplay sightlines
    const atmo = this.computeHorrorAtmosphere(def);
    this.baseFogColor.copy(atmo.fogColor);
    this.underwaterFogColor.copy(atmo.underwaterFogColor);
    this.baseFogDensity = atmo.fogDensity;
    this.baseHemiColor.copy(atmo.hemiSky);
    this.baseHemiIntensity = atmo.hemiIntensity;
    this.baseRimIntensity = atmo.rimIntensity;
    this.baseKeyIntensity = atmo.moonIntensity;

    this.scene.background = this.baseFogColor.clone();
    this.scene.fog = new THREE.FogExp2(this.baseFogColor, this.baseFogDensity);

    // 3-point soft horror moonlight + gentle slate-aqua pool bounce rig
    const hemi = new THREE.HemisphereLight(atmo.hemiSky, atmo.hemiGround, atmo.hemiIntensity);
    this.levelGroup.add(hemi);
    this.hemiLight = hemi;

    const rimLight = new THREE.DirectionalLight(atmo.rimColor, atmo.rimIntensity);
    rimLight.position.set(-22, 20, def.bounds.minZ * 0.45 - 35);
    this.levelGroup.add(rimLight);
    this.rimLight = rimLight;

    const keyLight = new THREE.DirectionalLight(atmo.moonColor, atmo.moonIntensity);
    keyLight.position.set(def.spawn[0] + 18, 34, def.spawn[2] + 14);
    keyLight.target.position.set(def.spawn[0], 0, def.spawn[2]);
    const wantShadow = !this.isSoftwareGl && this.activeQuality !== 'smooth';
    keyLight.castShadow = wantShadow;
    const sMap = this.activeQuality === 'ultra' ? (this.isTouchDevice ? 1024 : 2048) : this.isTouchDevice ? 768 : 1024;
    keyLight.shadow.mapSize.set(sMap, sMap);
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 135;
    const d = this.activeQuality === 'ultra' ? 52 : this.isTouchDevice ? 32 : 38;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.00045;
    keyLight.shadow.normalBias = 0.022;
    keyLight.shadow.radius = this.activeQuality === 'ultra' && !this.isTouchDevice ? 3.0 : 1.8;
    this.levelGroup.add(keyLight);
    this.levelGroup.add(keyLight.target);
    this.keyLight = keyLight;

    // Fixed-count PointLight pool sized to device capability so shaders stay lean and never recompile
    const compactLights = this.isSoftwareGl || this.isLowEndGpu || this.isTouchDevice;
    const poolCount = compactLights ? 2 : 4;
    for (let i = 0; i < poolCount; i++) {
      const pLight = new THREE.PointLight('#b4d0cc', i === 0 ? 1.25 : 0, 50, 1.35);
      this.levelGroup.add(pLight);
      this.pointLightPool.push(pLight);
    }

    // Ceiling fixtures: aged/dimmed housings, subtle emergency beacons, & moody fluorescent tubes
    if (def.lights.length > 0) {
      const shaftTex = this.ensureShaftTexture();
      const panelGeo = new THREE.BoxGeometry(3.8, 0.14, 1.35);
      const deadMat = new THREE.MeshStandardMaterial({
        color: 0x3b484d,
        roughness: 0.72,
        metalness: 0.32,
      });
      const litMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: '#ffffff',
        emissiveIntensity: 1.48,
        roughness: 0.24,
      });
      // Enable vertex/instance tinting on emissive so dead/emergency/sickly fixtures render in 2 draw calls total
      litMat.customProgramCacheKey = () => 'horror_fixture_emissive_v1';
      litMat.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <emissivemap_fragment>',
          `
          #include <emissivemap_fragment>
          #ifdef USE_INSTANCING_COLOR
            totalEmissiveRadiance *= vColor;
          #endif
          `
        );
      };

      const deadIndices: number[] = [];
      const litFixtures: Array<{ idx: number; color: THREE.Color; intensity: number; flickering: boolean; emergency: boolean }> = [];
      def.lights.forEach((l, idx) => {
        const hash = Math.abs(Math.sin((def.id * 71.3 + idx * 19.7) * 43758.5453) % 1);
        if (hash < atmo.deadFixtureChance && def.lights.length > 2) {
          deadIndices.push(idx);
          return;
        }
        const isEmergency = hash < atmo.deadFixtureChance + atmo.emergencyChance;
        const fxColor = isEmergency
          ? new THREE.Color(hash % 0.08 < 0.045 ? '#cf382b' : '#cf7028')
          : atmo.tubeTint.clone();
        const fxIntensity = isEmergency
          ? (l.intensity ?? 1.4) * 1.1
          : (l.intensity ?? 1.4) * 0.96;
        const isFlickering = Boolean(l.flickering) || hash > 0.68;
        litFixtures.push({ idx, color: fxColor, intensity: fxIntensity, flickering: isFlickering, emergency: isEmergency });
      });

      const dummy = new THREE.Object3D();
      if (deadIndices.length > 0) {
        const deadInst = new THREE.InstancedMesh(panelGeo, deadMat, deadIndices.length);
        deadIndices.forEach((origIdx, i) => {
          const l = def.lights[origIdx];
          dummy.position.set(l.position[0], def.bounds.ceilingY - 0.12, l.position[2]);
          dummy.rotation.set(0, 0, (origIdx % 3 === 0 ? 0.04 : 0));
          dummy.updateMatrix();
          deadInst.setMatrixAt(i, dummy.matrix);
        });
        deadInst.instanceMatrix.needsUpdate = true;
        deadInst.computeBoundingSphere();
        this.levelGroup.add(deadInst);
      }

      if (litFixtures.length > 0) {
        const litInst = new THREE.InstancedMesh(panelGeo, litMat, litFixtures.length);
        litFixtures.forEach((f, i) => {
          const l = def.lights[f.idx];
          dummy.position.set(l.position[0], def.bounds.ceilingY - 0.12, l.position[2]);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          litInst.setMatrixAt(i, dummy.matrix);
          litInst.setColorAt(i, f.color);
          this.levelLights.push({
            x: l.position[0],
            y: l.position[1],
            z: l.position[2],
            color: f.color,
            baseIntensity: f.intensity,
            flickering: f.flickering,
            seed: f.idx * 7.13 + def.id * 1.37,
          });
        });
        litInst.instanceMatrix.needsUpdate = true;
        if (litInst.instanceColor) litInst.instanceColor.needsUpdate = true;
        litInst.computeBoundingSphere();
        this.levelGroup.add(litInst);

        if (!this.isSoftwareGl) {
          const coneH = Math.max(5.5, def.bounds.ceilingY - def.bounds.waterY - 1.1);
          const coneGeo = new THREE.ConeGeometry(4.2, coneH, 16, 1, true);
          const coneMat = new THREE.MeshBasicMaterial({
            map: shaftTex,
            color: 0xffffff,
            transparent: true,
            opacity: 0.052,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          });
          const coneInst = new THREE.InstancedMesh(coneGeo, coneMat, litFixtures.length);
          litFixtures.forEach((f, i) => {
            const l = def.lights[f.idx];
            dummy.position.set(l.position[0], def.bounds.ceilingY - 0.25 - coneH * 0.5, l.position[2]);
            dummy.rotation.set(0, 0, 0);
            dummy.updateMatrix();
            coneInst.setMatrixAt(i, dummy.matrix);
            coneInst.setColorAt(i, f.color);
          });
          coneInst.instanceMatrix.needsUpdate = true;
          if (coneInst.instanceColor) coneInst.instanceColor.needsUpdate = true;
          coneInst.computeBoundingSphere();
          coneInst.visible = this.activeQuality !== 'smooth';
          this.levelGroup.add(coneInst);
          this.coneMesh = coneInst;
          this.levelDisposables.push(coneGeo, coneMat);
        }
      }
      this.levelDisposables.push(panelGeo, deadMat, litMat);
    }

    // Build pool basin architecture, horror environmental dressing, skylights & atmospheric dust/mist
    this.buildArchitecture(def, atmo);
    this.buildHorrorDressing(def, atmo);
    this.buildAtmosphericParticles(def, atmo);

    // Build dark oiled Fresnel water surface
    this.buildWater(def);

    // Build platforms & inner walls with chunked UV-baked static batching
    this.buildPlatforms(def);
    this.buildInnerWalls(def);

    // Build checkpoints + register virtual light sources for pooled PointLights
    def.checkpoints.forEach((cp, cpIdx) => {
      const vis = createCheckpointVisual(cp.position);
      this.levelGroup.add(vis.group);
      this.checkpoints.push(vis);
      this.levelLights.push({
        x: cp.position[0],
        y: cp.position[1] + 1.25,
        z: cp.position[2],
        color: vis.lightColor,
        baseIntensity: 2.1,
        flickering: false,
        seed: 0,
        checkpointIdx: cpIdx,
      });
    });

    // Build Exit Gate + register portal glow in pooled lights
    this.exitGroup = createExitGateMesh(def.exit.position, def.exit.size);
    this.levelGroup.add(this.exitGroup);
    const exitH = Math.max(3.4, def.exit.size[1]);
    this.levelLights.push({
      x: def.exit.position[0],
      y: def.exit.position[1] + exitH * 0.62,
      z: def.exit.position[2] + 1.35,
      color: new THREE.Color(0x52f2bf),
      baseIntensity: 4.5,
      flickering: false,
      seed: 0,
    });

    // Spawn Giant Aquatic Serpents
    def.monsters.forEach((mc, idx) => {
      const rig = createMonsterRig(this.textures, mc.scale || 1);
      rig.setShadowDetail(this.activeQuality);
      const startWp = mc.waypoints[0] || [0, -25];
      const nextWp = mc.waypoints[1] || startWp;
      const scale = mc.scale || 1;
      const pos = new THREE.Vector3(startWp[0], def.bounds.waterY - 0.14, startWp[1]);
      const monsterRadius = 0.9 * scale;
      this.resolveCircleSolids(
        pos,
        monsterRadius,
        def.bounds.waterY - 1.5,
        def.bounds.waterY + 4.2 * scale,
        monsterRadius + 0.15,
        true
      );
      const initYaw = Math.atan2(nextWp[0] - pos.x, nextWp[1] - pos.z) || 0;
      rig.root.position.copy(pos);
      rig.root.rotation.y = 0;
      resetSerpentTrail(rig, pos, initYaw);
      this.levelGroup.add(rig.root);

      this.monsters.push({
        id: mc.id,
        rig,
        pos,
        yaw: initYaw,
        targetYaw: initYaw,
        targetUserId: null,
        waypoints: mc.waypoints,
        wpIndex: 1 % Math.max(1, mc.waypoints.length),
        patrolSpeed: mc.patrolSpeed,
        chaseSpeed: mc.chaseSpeed,
        detectionRadius: mc.detectionRadius,
        waterDetectionRadius: mc.waterDetectionRadius,
        scale,
        alert: 'calm',
        searchTarget: pos.clone(),
        searchTimer: 0,
        velX: 0,
        velZ: 0,
        avoidDir: idx % 2 === 0 ? 1 : -1,
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
        eatingPreyStartYaw: initYaw,
        eatingGulpStage: 0,
        eatingSwallowAudioPlayed: false,
        safeEpoch: 0,
        intimidationPhase: 'none',
        intimidationTimer: 0,
        intimidationDuration: 0,
        intimidationSpot: pos.clone(),
        intimidationPlatform: null,
        intimidationLocalOffset: new THREE.Vector3(),
        intimidationYaw: initYaw,
        diveTimer: 0,
        visionState: 'none',
        visionTimer: 0,
        watchingUserId: null,
        lookAway: false,
        lookAwayYaw: initYaw,
        lastEdgeSpotTime: -1,
        lastEdgeSpotPlayerX: NaN,
        lastEdgeSpotPlayerZ: NaN,
      });
    });

    if (typeof this.sound?.prewarmMonsterSwimAudio === 'function') {
      this.sound.prewarmMonsterSwimAudio(def.monsters.length);
    }

    this.groundPlayerOnSpawnPlatform();
    const shouldShowLocal = nextPhase !== 'menu';
    resetPlayerRigPose(this.playerRig);
    this.playerRig.setVisible(shouldShowLocal);
    this.ensureLocalPlayerVisible();
    this.syncLocalPlayerRigTransform('idle', 0);
    this.applyQualityToRenderer();
    if (nextPhase !== 'menu') {
      // Snap play camera again AFTER platforms & inner walls exist so occlusion and chunk visibility match frame 0
      this.snapPlayCameraImmediate();
    }
    if (!skipPrewarm) {
      this.prewarmSceneShaders();
      this.lastTimeMs = performance.now();
    }
    this.emitHud(true);
  }

  private prewarmSceneShaders(): void {
    if (!this.renderer || !this.scene || !this.camera) return;
    // Keep horrorSpotLight.castShadow permanently false so NUM_SPOT_LIGHT_SHADOWS never changes at runtime
    const wantComposer = !this.isSoftwareGl && this.activeQuality !== 'smooth' && Boolean(this.horrorComposer);
    const prevSpotInt = this.horrorSpotLight?.intensity ?? 0;

    if (this.horrorSpotLight) {
      this.horrorSpotLight.castShadow = false;
      this.horrorSpotLight.intensity = 0.01;
    }

    const savedVisibility: Array<{ obj: THREE.Object3D; visible: boolean }> = [];
    const savedFrustum: Array<{ obj: THREE.Object3D; frustumCulled: boolean }> = [];

    const forceShow = (obj: THREE.Object3D | null | undefined) => {
      if (!obj) return;
      if (!obj.visible) {
        savedVisibility.push({ obj, visible: false });
        obj.visible = true;
      }
    };
    const forceShowSubtree = (root: THREE.Object3D | null | undefined) => {
      if (!root) return;
      root.traverse((obj) => {
        forceShow(obj);
      });
    };

    forceShowSubtree(this.playerRig?.root);
    if (Array.isArray(this.monsters)) {
      for (const m of this.monsters) {
        forceShowSubtree(m?.rig?.root);
        if (Array.isArray(m?.rig?.jawTendons)) {
          for (const td of m.rig.jawTendons) {
            forceShow(td);
          }
        }
        forceShow(m?.rig?.wakeRing);
        forceShow(m?.rig?.bowWake);
      }
    }


    const prevSplashCount = this.splashMesh ? this.splashMesh.count : 0;
    let warmedSplash = false;
    if (this.splashMesh && prevSplashCount === 0) {
      _vSplashScale.setScalar(0.0001);
      _mSplash.compose(this.camera.position, _qIdentity, _vSplashScale);
      this.splashMesh.setMatrixAt(0, _mSplash);
      this.splashMesh.instanceMatrix.needsUpdate = true;
      this.splashMesh.count = 1;
      warmedSplash = true;
    }

    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh || (obj as THREE.Sprite).isSprite) {
        if (obj.frustumCulled) {
          savedFrustum.push({ obj, frustumCulled: true });
          obj.frustumCulled = false;
        }
      }
    });

    // Temporarily widen keyLight shadow camera so distant serpents/structures compile their shadow depth
    // shaders upfront instead of stalling when a serpent swims into the active shadow box later.
    const kl = this.keyLight;
    const savedKeyLeft = kl ? kl.shadow.camera.left : 0;
    const savedKeyRight = kl ? kl.shadow.camera.right : 0;
    const savedKeyTop = kl ? kl.shadow.camera.top : 0;
    const savedKeyBottom = kl ? kl.shadow.camera.bottom : 0;
    const savedKeyFar = kl ? kl.shadow.camera.far : 0;
    let widenedShadowCam = false;
    if (kl && kl.castShadow) {
      kl.shadow.camera.left = -500;
      kl.shadow.camera.right = 500;
      kl.shadow.camera.top = 500;
      kl.shadow.camera.bottom = -500;
      kl.shadow.camera.far = Math.max(savedKeyFar, 600);
      kl.shadow.camera.updateProjectionMatrix();
      widenedShadowCam = true;
    }

    const prevScissorTest = this.renderer.getScissorTest();
    const prevAutoClear = this.renderer.autoClear;
    const prevScissor = this._prewarmScissor;
    const prevViewport = this._prewarmViewport;
    this.renderer.getScissor(prevScissor);
    this.renderer.getViewport(prevViewport);

    try {
      this.scene.updateMatrixWorld(true);
      this.camera.updateMatrixWorld(true);
      this.renderer.compile(this.scene, this.camera);
      this.coreShadersWarmed = true;
      this.renderer.autoClear = true;
      this.renderer.setScissorTest(true);
      this.renderer.setScissor(0, 0, 1, 1);
      this.renderer.setViewport(0, 0, 1, 1);
      this.renderer.render(this.scene, this.camera);
      this.horrorShadowWarmed = true;
      if (wantComposer && this.horrorComposer) {
        if (this.horrorPass) {
          this.horrorPass.uniforms.uIntensity.value = 0.01;
          this.horrorPass.uniforms.uMotionBlur.value = 0.004;
          this.horrorPass.uniforms.uChroma.value = 0.002;
          this.horrorPass.uniforms.uVignette.value = 0.1;
        }
        this.horrorComposer.render();
        this.renderer.setRenderTarget(null);
        this.horrorComposerWarmed = true;
      }
    } catch {
      // ignore if WebGL context is unavailable or lost
    } finally {
      if (widenedShadowCam && kl) {
        kl.shadow.camera.left = savedKeyLeft;
        kl.shadow.camera.right = savedKeyRight;
        kl.shadow.camera.top = savedKeyTop;
        kl.shadow.camera.bottom = savedKeyBottom;
        kl.shadow.camera.far = savedKeyFar;
        kl.shadow.camera.updateProjectionMatrix();
      }
      if (this.horrorSpotLight) {
        this.horrorSpotLight.castShadow = false;
        this.horrorSpotLight.intensity = prevSpotInt;
      }
      if (this.horrorPass) {
        this.horrorPass.uniforms.uIntensity.value = 0;
        this.horrorPass.uniforms.uMotionBlur.value = 0;
        this.horrorPass.uniforms.uChroma.value = 0;
        this.horrorPass.uniforms.uVignette.value = 0;
      }
      this.renderer.setScissorTest(prevScissorTest);
      this.renderer.setViewport(prevViewport);
      this.renderer.setScissor(prevScissor);
      this.renderer.autoClear = prevAutoClear;

      for (let i = 0; i < savedFrustum.length; i++) {
        savedFrustum[i].obj.frustumCulled = savedFrustum[i].frustumCulled;
      }
      for (let i = 0; i < savedVisibility.length; i++) {
        savedVisibility[i].obj.visible = savedVisibility[i].visible;
      }
      this.ensureLocalPlayerVisible?.();
      if (warmedSplash && this.splashMesh) {
        this.splashMesh.count = prevSplashCount;
      }
    }
  }

  private injectUnderwaterCaustics(mat: THREE.MeshStandardMaterial, waterY: number, isFloor: boolean): void {
    mat.customProgramCacheKey = () => (isFloor ? 'caustics_floor_v2' : 'caustics_wall_v2');
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.uCausticTime;
      shader.uniforms.uCausticEnabled = this.uCausticEnabled;
      shader.uniforms.uCausticRangeSq = this.uCausticRangeSq;
      shader.uniforms.uWaterY = { value: waterY };

      shader.vertexShader =
        'varying vec3 vCausticWorldPos;\n' +
        shader.vertexShader.replace(
          '#include <worldpos_vertex>',
          `
          #include <worldpos_vertex>
          vCausticWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          `
        );

      shader.fragmentShader =
        `
        uniform float uTime;
        uniform float uWaterY;
        uniform float uCausticEnabled;
        uniform float uCausticRangeSq;
        varying vec3 vCausticWorldPos;
        float causticPattern(vec2 p, float t) {
          float a = sin(p.x * 1.15 + t * 1.45 + cos(p.y * 0.9 - t * 1.1));
          float b = cos(p.y * 1.25 - t * 1.3 + sin(p.x * 0.85 + t * 0.95));
          float c = sin((p.x + p.y) * 0.95 + t * 1.75);
          float v = abs(a * 0.45 + b * 0.4 + c * 0.25);
          return pow(max(0.0, 1.0 - v * 1.65), 3.0);
        }
        ` +
        shader.fragmentShader.replace(
          '#include <emissivemap_fragment>',
          `
          #include <emissivemap_fragment>
          if (uCausticEnabled > 0.5) {
            vec3 cDelta = vCausticWorldPos - cameraPosition;
            float cDistSq = dot(cDelta, cDelta);
            if (cDistSq < uCausticRangeSq) {
              float subDepth = uWaterY - vCausticWorldPos.y;
              float mask = ${isFloor ? '1.0' : 'smoothstep(-0.25, 0.45, subDepth)'};
              if (mask > 0.01) {
                float c1 = causticPattern(vCausticWorldPos.xz * 0.42 + vCausticWorldPos.xy * 0.12, uTime);
                float c2 = causticPattern(vCausticWorldPos.zx * 0.34 - uTime * 0.3, -uTime * 0.85);
                float cFade = 1.0 - smoothstep(uCausticRangeSq * 0.45, uCausticRangeSq, cDistSq);
                float caustic = (c1 + c2) * 0.5 * mask * cFade;
                totalEmissiveRadiance += vec3(0.05, 0.11, 0.14) * caustic * 0.58;
              }
            }
          }
          `
        );
    };
  }

  private scalePlaneUVs(geo: THREE.BufferGeometry, repU: number, repV: number): void {
    const uv = geo.attributes.uv;
    if (!uv) return;
    const arr = uv.array as Float32Array;
    for (let i = 0; i < arr.length; i += 2) {
      arr[i] *= repU;
      arr[i + 1] *= repV;
    }
    uv.needsUpdate = true;
  }

  private createHorrorEnvironmentScene(): { scene: THREE.Scene; dispose: () => void } {
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x283a47);
    const disposables: Array<{ dispose: () => void }> = [];

    const roomGeo = new THREE.BoxGeometry(28, 12, 28);
    const roomMat = new THREE.MeshBasicMaterial({ color: 0x354c59, side: THREE.BackSide });
    envScene.add(new THREE.Mesh(roomGeo, roomMat));
    disposables.push(roomGeo, roomMat);

    const waterFloorGeo = new THREE.PlaneGeometry(26, 26);
    const waterFloorMat = new THREE.MeshBasicMaterial({ color: 0x264c57 });
    const waterFloor = new THREE.Mesh(waterFloorGeo, waterFloorMat);
    waterFloor.rotation.x = -Math.PI / 2;
    waterFloor.position.y = -5.8;
    envScene.add(waterFloor);
    disposables.push(waterFloorGeo, waterFloorMat);

    const skyStripGeo = new THREE.PlaneGeometry(4.2, 20);
    const skyStripMat = new THREE.MeshBasicMaterial({ color: 0xb2cfe8 });
    for (const sx of [-5.5, 5.5]) {
      const strip = new THREE.Mesh(skyStripGeo, skyStripMat);
      strip.rotation.x = Math.PI / 2;
      strip.position.set(sx, 5.85, 0);
      envScene.add(strip);
    }
    disposables.push(skyStripGeo, skyStripMat);

    const slitGeo = new THREE.BoxGeometry(0.4, 2.2, 0.8);
    const slitMat = new THREE.MeshBasicMaterial({ color: 0x7d3d30 });
    const slit = new THREE.Mesh(slitGeo, slitMat);
    slit.position.set(-13.4, 0.4, -4);
    envScene.add(slit);
    disposables.push(slitGeo, slitMat);

    return {
      scene: envScene,
      dispose: () => {
        disposables.forEach((d) => d.dispose());
      },
    };
  }

  private computeHorrorAtmosphere(def: LevelDef) {
    const wing = Math.min(9, Math.max(0, Math.floor((def.id - 1) / 10)));
    const seed = Math.abs(Math.sin(def.id * 12.9898) * 43758.5453) % 1;

    const wingPalettes = [
      { fog: '#354b54', hemi: '#94b6c4', moon: '#c8def2', rim: '#567c94', tube: '#c8e0db', dead: 0.14, emerg: 0.10 },
      { fog: '#324a46', hemi: '#8cb3a8', moon: '#c0dfd6', rim: '#4d7a72', tube: '#bfe0d2', dead: 0.16, emerg: 0.12 },
      { fog: '#384650', hemi: '#92a7b5', moon: '#c4d8eb', rim: '#597182', tube: '#c5d6e0', dead: 0.18, emerg: 0.12 },
      { fog: '#423c38', hemi: '#a89a8f', moon: '#d2d4de', rim: '#735a4f', tube: '#d4ccbe', dead: 0.18, emerg: 0.15 },
      { fog: '#314552', hemi: '#89acc2', moon: '#bed9f2', rim: '#4c718f', tube: '#bdd8eb', dead: 0.18, emerg: 0.12 },
      { fog: '#36483d', hemi: '#91ad96', moon: '#c4ded0', rim: '#53735c', tube: '#c2dbc6', dead: 0.18, emerg: 0.14 },
      { fog: '#423437', hemi: '#a88c8f', moon: '#d2c6d8', rim: '#75484c', tube: '#d4bebc', dead: 0.20, emerg: 0.18 },
      { fog: '#343e4a', hemi: '#8ea0b3', moon: '#c2d3eb', rim: '#546880', tube: '#c0cfe0', dead: 0.20, emerg: 0.15 },
      { fog: '#2f3d4d', hemi: '#849eb8', moon: '#b8d1ed', rim: '#496582', tube: '#b8cde3', dead: 0.22, emerg: 0.16 },
      { fog: '#353445', hemi: '#918cad', moon: '#c4cce8', rim: '#614d70', tube: '#c3c8e0', dead: 0.22, emerg: 0.18 },
    ];
    const pal = wingPalettes[wing];
    const fogColor = new THREE.Color(pal.fog).offsetHSL((seed - 0.5) * 0.025, 0, (seed - 0.5) * 0.015);
    const hemiSky = new THREE.Color(pal.hemi);
    const hemiGround = fogColor.clone().multiplyScalar(0.82).lerp(new THREE.Color('#243a42'), 0.45);
    const moonColor = new THREE.Color(pal.moon);
    const rimColor = new THREE.Color(pal.rim);
    const tubeTint = new THREE.Color(pal.tube);
    const underwaterFogColor = fogColor.clone().multiplyScalar(0.56).lerp(new THREE.Color('#13333d'), 0.48);
    const fogDensity = THREE.MathUtils.clamp(def.fogDensity * 0.56 + seed * 0.0012, 0.0075, 0.0115);

    return {
      fogColor,
      underwaterFogColor,
      fogDensity,
      hemiSky,
      hemiGround,
      hemiIntensity: 0.78,
      moonColor,
      moonIntensity: 1.35,
      rimColor,
      rimIntensity: 0.52,
      tubeTint,
      deadFixtureChance: pal.dead,
      emergencyChance: pal.emerg,
    };
  }

  private ensureShaftTexture(): THREE.CanvasTexture {
    if (this.shaftTex) return this.shaftTex;
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createLinearGradient(0, 0, 0, 128);
      grad.addColorStop(0.0, 'rgba(255,255,255,0.0)');
      grad.addColorStop(0.14, 'rgba(255,255,255,0.85)');
      grad.addColorStop(0.55, 'rgba(255,255,255,0.42)');
      grad.addColorStop(1.0, 'rgba(255,255,255,0.0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 128);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.NoColorSpace;
    this.shaftTex = tex;
    return tex;
  }

  private ensureHorrorDecalTextures(): { grate: THREE.CanvasTexture; warning: THREE.CanvasTexture } {
    if (!this.grateDecalTex) {
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 128;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, 128, 128);
        // Dark mold seepage halo
        const g = ctx.createRadialGradient(64, 48, 8, 64, 64, 62);
        g.addColorStop(0, 'rgba(12, 16, 14, 0.92)');
        g.addColorStop(0.65, 'rgba(18, 22, 18, 0.55)');
        g.addColorStop(1, 'rgba(18, 22, 18, 0.0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 128, 128);
        // Rusted iron grate frame + bars
        ctx.fillStyle = '#2b2420';
        ctx.fillRect(28, 22, 72, 46);
        ctx.fillStyle = '#090c0d';
        for (let bx = 34; bx < 96; bx += 9) {
          ctx.fillRect(bx, 27, 5, 36);
        }
        // Sludge drips downward
        ctx.fillStyle = 'rgba(24, 18, 14, 0.78)';
        for (let dx = 32; dx < 96; dx += 11) {
          const dh = 22 + ((dx * 17) % 34);
          ctx.fillRect(dx, 66, 4, dh);
        }
      }
      this.grateDecalTex = new THREE.CanvasTexture(c);
      this.grateDecalTex.colorSpace = THREE.SRGBColorSpace;
    }

    if (!this.warningDecalTex) {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 128;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, 256, 128);
        // Grimy border plate
        ctx.fillStyle = 'rgba(26, 28, 24, 0.85)';
        ctx.fillRect(16, 20, 224, 88);
        ctx.strokeStyle = 'rgba(162, 118, 38, 0.75)';
        ctx.lineWidth = 4;
        ctx.strokeRect(22, 26, 212, 76);
        // Faded quarantine stencil
        ctx.fillStyle = 'rgba(186, 138, 48, 0.82)';
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('QUARANTINE', 128, 56);
        ctx.fillStyle = 'rgba(168, 42, 34, 0.86)';
        ctx.font = 'bold 14px monospace';
        ctx.fillText('DO NOT ENTER WATER', 128, 82);
        // Claw/scuff smear over stencil
        ctx.strokeStyle = 'rgba(14, 10, 10, 0.82)';
        ctx.lineWidth = 5;
        for (let s = 0; s < 3; s++) {
          ctx.beginPath();
          ctx.moveTo(46 + s * 14, 24);
          ctx.lineTo(148 + s * 16, 106);
          ctx.stroke();
        }
      }
      this.warningDecalTex = new THREE.CanvasTexture(c);
      this.warningDecalTex.colorSpace = THREE.SRGBColorSpace;
    }

    return { grate: this.grateDecalTex, warning: this.warningDecalTex };
  }

  private buildArchitecture(def: LevelDef, atmo: ReturnType<PoolGameEngine['computeHorrorAtmosphere']>): void {
    const { minX, maxX, minZ, maxZ, floorY, waterY, ceilingY } = def.bounds;
    const width = maxX - minX;
    const depth = maxZ - minZ;
    const height = ceilingY - floorY;
    const cx = (minX + maxX) * 0.5;
    const cz = (minZ + maxZ) * 0.5;

    // Pool Floor (weathered ceramic tile + soft moonlit underwater caustics)
    const floorMat = new THREE.MeshStandardMaterial({
      map: this.textures.tileAlbedo,
      bumpMap: this.textures.tileBump,
      bumpScale: 0.028,
      roughnessMap: this.textures.tileRoughness,
      color: 0x8ea4a9,
      roughness: 0.34,
      metalness: 0.08,
    });
    this.injectUnderwaterCaustics(floorMat, waterY, true);
    this.registerLevelMaterial(floorMat);
    const floorGeo = new THREE.PlaneGeometry(width, depth);
    this.scalePlaneUVs(floorGeo, width / 3.2, depth / 3.2);
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(cx, floorY, cz);
    floorMesh.receiveShadow = true;
    this.registerShadowReceiver(floorMesh);
    this.levelGroup.add(floorMesh);
    this.levelDisposables.push(floorMat, floorGeo);

    // Ceiling (water-damaged coffer slab)
    const ceilGeo = new THREE.PlaneGeometry(width, depth);
    this.scalePlaneUVs(ceilGeo, Math.max(2, width / 12), Math.max(4, depth / 12));
    const ceilMat = new THREE.MeshStandardMaterial({
      map: this.textures.ceilingAlbedo,
      color: 0x849396,
      roughness: 0.88,
      metalness: 0.08,
    });
    const ceilMesh = new THREE.Mesh(ceilGeo, ceilMat);
    ceilMesh.rotation.x = Math.PI / 2;
    ceilMesh.position.set(cx, ceilingY, cz);
    this.levelGroup.add(ceilMesh);
    this.levelDisposables.push(ceilGeo, ceilMat);

    // Outer Perimeter Tiled Walls sharing one material
    const wallMat = new THREE.MeshStandardMaterial({
      map: this.textures.wallAlbedo,
      bumpMap: this.textures.wallBump,
      bumpScale: 0.03,
      color: 0xa8b6ba,
      roughness: 0.46,
      metalness: 0.06,
    });
    this.injectUnderwaterCaustics(wallMat, waterY, false);
    this.registerLevelMaterial(wallMat);
    this.levelDisposables.push(wallMat);

    const wallLRGeo = new THREE.PlaneGeometry(depth, height);
    this.scalePlaneUVs(wallLRGeo, depth / 4.2, height / 4.2);
    const leftWall = new THREE.Mesh(wallLRGeo, wallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(minX, floorY + height * 0.5, cz);
    leftWall.receiveShadow = true;
    this.registerShadowReceiver(leftWall);
    this.levelGroup.add(leftWall);

    const rightWall = new THREE.Mesh(wallLRGeo, wallMat);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(maxX, floorY + height * 0.5, cz);
    rightWall.receiveShadow = true;
    this.registerShadowReceiver(rightWall);
    this.levelGroup.add(rightWall);

    const wallFBGeo = new THREE.PlaneGeometry(width, height);
    this.scalePlaneUVs(wallFBGeo, width / 4.2, height / 4.2);
    const backWall = new THREE.Mesh(wallFBGeo, wallMat);
    backWall.position.set(cx, floorY + height * 0.5, minZ);
    backWall.receiveShadow = true;
    this.registerShadowReceiver(backWall);
    this.levelGroup.add(backWall);

    const frontWall = new THREE.Mesh(wallFBGeo, wallMat);
    frontWall.rotation.y = Math.PI;
    frontWall.position.set(cx, floorY + height * 0.5, maxZ);
    frontWall.receiveShadow = true;
    this.registerShadowReceiver(frontWall);
    this.levelGroup.add(frontWall);
    this.levelDisposables.push(wallLRGeo, wallFBGeo);

    // Instanced Concrete Ceiling Beams + Pilasters + Corroded Perimeter Coping + Abandoned Ladders
    const ribSpacing = 16;
    const ribZs: number[] = [];
    for (let z = maxZ - 8; z >= minZ + 8; z -= ribSpacing) ribZs.push(z);

    if (ribZs.length > 0) {
      const beamGeo = new THREE.BoxGeometry(width, 0.72, 0.85);
      const beamMat = new THREE.MeshStandardMaterial({
        map: this.textures.concreteAlbedo,
        bumpMap: this.textures.concreteBump,
        bumpScale: 0.028,
        color: 0x808d91,
        roughness: 0.84,
        metalness: 0.1,
      });
      this.registerLevelMaterial(beamMat);
      const beamInst = new THREE.InstancedMesh(beamGeo, beamMat, ribZs.length);
      const dummy = new THREE.Object3D();
      ribZs.forEach((z, idx) => {
        dummy.position.set(cx, ceilingY - 0.36, z);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        beamInst.setMatrixAt(idx, dummy.matrix);
      });
      beamInst.instanceMatrix.needsUpdate = true;
      beamInst.computeBoundingSphere();
      this.levelGroup.add(beamInst);

      // Wall vertical concrete pilasters under each ceiling beam along left & right walls
      const pilasterGeo = new THREE.BoxGeometry(0.55, height, 0.95);
      const pilInst = new THREE.InstancedMesh(pilasterGeo, beamMat, ribZs.length * 2);
      ribZs.forEach((z, idx) => {
        dummy.position.set(minX + 0.25, floorY + height * 0.5, z);
        dummy.updateMatrix();
        pilInst.setMatrixAt(idx * 2, dummy.matrix);
        dummy.position.set(maxX - 0.25, floorY + height * 0.5, z);
        dummy.updateMatrix();
        pilInst.setMatrixAt(idx * 2 + 1, dummy.matrix);
      });
      pilInst.instanceMatrix.needsUpdate = true;
      pilInst.computeBoundingSphere();
      this.levelGroup.add(pilInst);
      this.levelDisposables.push(beamGeo, pilasterGeo, beamMat);

      // Perimeter tarnished stainless wall coping gutter rails just above waterline
      const gutterGeo = new THREE.BoxGeometry(0.28, 0.22, depth);
      const steelMat = new THREE.MeshStandardMaterial({
        map: this.textures.metalAlbedo,
        bumpMap: this.textures.metalBump,
        bumpScale: 0.018,
        color: 0x9aa8ad,
        roughness: 0.38,
        metalness: 0.82,
      });
      this.registerLevelMaterial(steelMat);
      for (const sideX of [minX + 0.14, maxX - 0.14]) {
        const g = new THREE.Mesh(gutterGeo, steelMat);
        g.position.set(sideX, waterY + 0.22, cz);
        this.levelGroup.add(g);
      }

      // Instanced weathered pool ladders along side walls (select rails subtly crooked/damaged)
      const ladderZs = ribZs.filter((_, i) => i % 2 === 0);
      if (ladderZs.length > 0) {
        const railGeo = new THREE.CylinderGeometry(0.032, 0.032, 3.2, 8);
        const railInst = new THREE.InstancedMesh(railGeo, steelMat, ladderZs.length * 4);
        let rIdx = 0;
        ladderZs.forEach((z, lIdx) => {
          for (const side of [-1, 1] as const) {
            const wx = side < 0 ? minX + 0.28 : maxX - 0.28;
            const crooked = ((lIdx + (side > 0 ? 1 : 0)) % 3 === 0) ? 0.055 * side : 0;
            for (const dz of [-0.32, 0.32]) {
              dummy.position.set(wx, waterY + 0.25, z + dz);
              dummy.rotation.set(crooked, 0, crooked * 0.6);
              dummy.updateMatrix();
              railInst.setMatrixAt(rIdx++, dummy.matrix);
            }
          }
        });
        dummy.rotation.set(0, 0, 0);
        railInst.instanceMatrix.needsUpdate = true;
        railInst.computeBoundingSphere();
        this.levelGroup.add(railInst);
        this.levelDisposables.push(railGeo);
      }
      this.levelDisposables.push(gutterGeo, steelMat);

      // Distant cavernous ceiling bulkhead silhouettes
      if (ribZs.length > 2) {
        const dropH = Math.max(1.4, (ceilingY - waterY) * 0.22);
        const dropGeo = new THREE.BoxGeometry(width * 0.72, dropH, 0.55);
        const dropMat = new THREE.MeshStandardMaterial({
          color: 0x525e63,
          roughness: 0.92,
          metalness: 0.12,
        });
        const bulkheadZs = ribZs.filter((_, i) => i % 2 === 1);
        if (bulkheadZs.length > 0) {
          const dropInst = new THREE.InstancedMesh(dropGeo, dropMat, bulkheadZs.length);
          bulkheadZs.forEach((z, idx) => {
            dummy.position.set(cx, ceilingY - dropH * 0.5 - 0.2, z);
            dummy.updateMatrix();
            dropInst.setMatrixAt(idx, dummy.matrix);
          });
          dropInst.instanceMatrix.needsUpdate = true;
          dropInst.computeBoundingSphere();
          this.levelGroup.add(dropInst);
        }
        this.levelDisposables.push(dropGeo, dropMat);
      }

      // Organic drifting surface vapor mist sheets with GLSL UV scroll
      if (!this.isSoftwareGl) {
        if (!this.mistTex) {
          const mistCanvas = document.createElement('canvas');
          mistCanvas.width = 128;
          mistCanvas.height = 128;
          const mctx = mistCanvas.getContext('2d');
          if (mctx) {
            mctx.clearRect(0, 0, 128, 128);
            const blobs: [number, number, number, number][] = [
              [64, 64, 58, 0.26],
              [44, 54, 34, 0.18],
              [84, 60, 32, 0.16],
              [58, 82, 36, 0.15],
            ];
            for (const [bx, by, br, alpha] of blobs) {
              const grad = mctx.createRadialGradient(bx, by, 4, bx, by, br);
              grad.addColorStop(0, `rgba(190, 214, 224, ${alpha})`);
              grad.addColorStop(0.55, `rgba(146, 178, 190, ${alpha * 0.42})`);
              grad.addColorStop(1, 'rgba(120, 154, 168, 0)');
              mctx.fillStyle = grad;
              mctx.fillRect(0, 0, 128, 128);
            }
          }
          this.mistTex = new THREE.CanvasTexture(mistCanvas);
        }
        const mistGeo = new THREE.PlaneGeometry(26, 26);
        const mistMat = new THREE.MeshBasicMaterial({
          map: this.mistTex,
          color: atmo.hemiSky.clone().lerp(new THREE.Color('#b8d1db'), 0.52),
          transparent: true,
          opacity: 0.17,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        mistMat.customProgramCacheKey = () => 'horror_drifting_mist_v1';
        mistMat.onBeforeCompile = (shader) => {
          shader.uniforms.uTime = this.uMistTime;
          shader.vertexShader =
            'uniform float uTime;\nvarying vec2 vMistShift;\n' +
            shader.vertexShader.replace(
              '#include <begin_vertex>',
              `
              #include <begin_vertex>
              float instSeed = float(gl_InstanceID) * 1.73;
              vMistShift = vec2(sin(uTime * 0.18 + instSeed) * 0.12, cos(uTime * 0.14 + instSeed * 1.3) * 0.12);
              `
            );
          shader.fragmentShader =
            'varying vec2 vMistShift;\n' +
            shader.fragmentShader.replace(
              '#include <map_fragment>',
              `
              #ifdef USE_MAP
                vec4 sampledDiffuseColor = texture2D( map, clamp(vMapUv + vMistShift, 0.01, 0.99) );
                diffuseColor *= sampledDiffuseColor;
              #endif
              `
            );
        };
        const mistCols = width > 70 ? [-width * 0.26, 0, width * 0.26] : [0];
        const mistRows = Math.min(11, Math.max(4, Math.floor(depth / 30)));
        const mistCount = mistCols.length * mistRows;
        const mistInst = new THREE.InstancedMesh(mistGeo, mistMat, mistCount);
        let mIdx = 0;
        for (let r = 0; r < mistRows; r++) {
          const mz = maxZ - 16 - (r / Math.max(1, mistRows - 1)) * (depth - 32);
          for (let c = 0; c < mistCols.length; c++) {
            dummy.position.set(cx + mistCols[c], waterY + 0.42 + (mIdx % 3) * 0.18, mz);
            dummy.rotation.set(-Math.PI / 2, 0, (mIdx * 1.17) % Math.PI);
            dummy.updateMatrix();
            mistInst.setMatrixAt(mIdx++, dummy.matrix);
          }
        }
        mistInst.instanceMatrix.needsUpdate = true;
        mistInst.computeBoundingSphere();
        mistInst.renderOrder = 3;
        mistInst.visible = this.activeQuality !== 'smooth';
        this.levelGroup.add(mistInst);
        this.mistMesh = mistInst;
        this.levelDisposables.push(mistGeo, mistMat);
      }
    }
  }

  private buildHorrorDressing(
    def: LevelDef,
    atmo: ReturnType<PoolGameEngine['computeHorrorAtmosphere']>
  ): void {
    const { minX, maxX, minZ, maxZ, floorY, waterY, ceilingY } = def.bounds;
    const width = maxX - minX;
    const depth = maxZ - minZ;
    const cx = (minX + maxX) * 0.5;
    const dummy = new THREE.Object3D();

    const rustMat = new THREE.MeshStandardMaterial({
      map: this.textures.metalAlbedo,
      bumpMap: this.textures.metalBump,
      bumpScale: 0.024,
      color: 0x785c4e,
      roughness: 0.72,
      metalness: 0.65,
    });
    const rubbleMat = new THREE.MeshStandardMaterial({
      map: this.textures.concreteAlbedo,
      bumpMap: this.textures.concreteBump,
      bumpScale: 0.03,
      color: 0x6b777a,
      roughness: 0.9,
      metalness: 0.08,
    });
    this.registerLevelMaterial(rustMat);
    this.registerLevelMaterial(rubbleMat);
    this.levelDisposables.push(rustMat, rubbleMat);

    // 1. Broken Ceiling Skylights + Volumetric Angled Moonlight Shafts along corridor centerline
    const skylightZs: number[] = [];
    for (let z = maxZ - 24; z >= minZ + 22; z -= 30) {
      skylightZs.push(z);
    }
    if (skylightZs.length > 0) {
      const frameGeo = new THREE.BoxGeometry(Math.min(7.2, width * 0.34), 0.24, 4.6);
      const glassGeo = new THREE.PlaneGeometry(Math.min(6.4, width * 0.30), 3.9);
      const glassMat = new THREE.MeshStandardMaterial({
        color: 0x4b6e8f,
        emissive: atmo.moonColor,
        emissiveIntensity: 0.72,
        roughness: 0.2,
        metalness: 0.4,
      });
      const frameInst = new THREE.InstancedMesh(frameGeo, rustMat, skylightZs.length);
      const glassInst = new THREE.InstancedMesh(glassGeo, glassMat, skylightZs.length);

      skylightZs.forEach((z, idx) => {
        const sx = cx + Math.sin(def.id * 3.1 + idx * 2.3) * Math.min(2.8, width * 0.08);
        dummy.position.set(sx, ceilingY - 0.14, z);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        frameInst.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(sx, ceilingY - 0.28, z);
        dummy.rotation.set(Math.PI / 2, 0, 0);
        dummy.updateMatrix();
        glassInst.setMatrixAt(idx, dummy.matrix);
      });
      frameInst.instanceMatrix.needsUpdate = true;
      glassInst.instanceMatrix.needsUpdate = true;
      frameInst.computeBoundingSphere();
      glassInst.computeBoundingSphere();
      this.levelGroup.add(frameInst, glassInst);
      this.levelDisposables.push(frameGeo, glassGeo, glassMat);

      if (!this.isSoftwareGl) {
        const shaftTex = this.ensureShaftTexture();
        const shaftH = Math.max(6.5, ceilingY - waterY + 0.6);
        const shaftGeo = new THREE.ConeGeometry(Math.min(5.2, width * 0.24), shaftH, 16, 1, true);
        const shaftMat = new THREE.MeshBasicMaterial({
          map: shaftTex,
          color: atmo.moonColor,
          transparent: true,
          opacity: 0.052,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        const shaftInst = new THREE.InstancedMesh(shaftGeo, shaftMat, skylightZs.length);
        skylightZs.forEach((z, idx) => {
          const sx = cx + Math.sin(def.id * 3.1 + idx * 2.3) * Math.min(2.8, width * 0.08);
          dummy.position.set(sx - 1.35, ceilingY - shaftH * 0.5 - 0.15, z + 0.9);
          dummy.rotation.set(0.11, 0, -0.15);
          dummy.updateMatrix();
          shaftInst.setMatrixAt(idx, dummy.matrix);
        });
        shaftInst.instanceMatrix.needsUpdate = true;
        shaftInst.computeBoundingSphere();
        shaftInst.visible = this.activeQuality !== 'smooth';
        this.levelGroup.add(shaftInst);
        this.moonShaftMesh = shaftInst;
        this.levelDisposables.push(shaftGeo, shaftMat);
      }
    }

    // 2. Overhead Rusted Pipes hugging upper perimeter walls (strictly non-colliding along minX/maxX)
    const pipeGeo = new THREE.CylinderGeometry(0.14, 0.14, depth - 2, 8);
    const pipeInst = new THREE.InstancedMesh(pipeGeo, rustMat, 4);
    const pipeSpecs: [number, number][] = [
      [minX + 0.32, ceilingY - 1.35],
      [minX + 0.32, ceilingY - 1.88],
      [maxX - 0.32, ceilingY - 1.35],
      [maxX - 0.32, ceilingY - 1.88],
    ];
    pipeSpecs.forEach(([px, py], i) => {
      dummy.position.set(px, py, (minZ + maxZ) * 0.5);
      dummy.rotation.set(Math.PI / 2, 0, 0);
      dummy.updateMatrix();
      pipeInst.setMatrixAt(i, dummy.matrix);
    });
    pipeInst.instanceMatrix.needsUpdate = true;
    pipeInst.computeBoundingSphere();
    this.levelGroup.add(pipeInst);
    this.levelDisposables.push(pipeGeo);

    // 3. Snapped Hanging Ceiling Cables & Rusted Chains near outer perimeter walls
    const cableSpacing = 16;
    const cableZs: number[] = [];
    for (let z = maxZ - 12; z >= minZ + 12; z -= cableSpacing) {
      cableZs.push(z);
    }
    if (cableZs.length > 0) {
      const cableCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0.22, -0.95, 0.14),
        new THREE.Vector3(0.16, -2.05, -0.1),
        new THREE.Vector3(0.28, -2.95, 0.08),
      ]);
      const cableGeo = new THREE.TubeGeometry(cableCurve, 8, 0.032, 5, false);
      const cableInst = new THREE.InstancedMesh(cableGeo, rustMat, cableZs.length);
      cableZs.forEach((z, idx) => {
        const side = idx % 2 === 0 ? -1 : 1;
        const wx = side < 0 ? minX + 0.65 : maxX - 0.65;
        dummy.position.set(wx, ceilingY - 0.1, z);
        dummy.rotation.set(0, side < 0 ? 0 : Math.PI, 0);
        dummy.scale.setScalar(0.85 + ((idx * 37) % 10) * 0.04);
        dummy.updateMatrix();
        cableInst.setMatrixAt(idx, dummy.matrix);
      });
      dummy.scale.setScalar(1);
      cableInst.instanceMatrix.needsUpdate = true;
      cableInst.computeBoundingSphere();
      this.levelGroup.add(cableInst);
      this.levelDisposables.push(cableGeo);
    }

    // 4. Perimeter Wall Horror Decals (rusted overflow grates with black mold drips + faded Quarantine signs)
    const decals = this.ensureHorrorDecalTextures();
    const grateZs: number[] = [];
    const warnZs: number[] = [];
    for (let z = maxZ - 14; z >= minZ + 14; z -= 24) {
      grateZs.push(z);
    }
    for (let z = maxZ - 26; z >= minZ + 20; z -= 44) {
      warnZs.push(z);
    }

    if (grateZs.length > 0) {
      const grateGeo = new THREE.PlaneGeometry(2.1, 2.1);
      const grateMat = new THREE.MeshStandardMaterial({
        map: decals.grate,
        transparent: true,
        alphaTest: 0.12,
        roughness: 0.9,
        metalness: 0.15,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      });
      const grateInst = new THREE.InstancedMesh(grateGeo, grateMat, grateZs.length * 2);
      grateZs.forEach((z, i) => {
        dummy.position.set(minX + 0.03, waterY + 0.88, z);
        dummy.rotation.set(0, Math.PI / 2, 0);
        dummy.updateMatrix();
        grateInst.setMatrixAt(i * 2, dummy.matrix);

        dummy.position.set(maxX - 0.03, waterY + 0.88, z);
        dummy.rotation.set(0, -Math.PI / 2, 0);
        dummy.updateMatrix();
        grateInst.setMatrixAt(i * 2 + 1, dummy.matrix);
      });
      grateInst.instanceMatrix.needsUpdate = true;
      grateInst.computeBoundingSphere();
      this.levelGroup.add(grateInst);
      this.levelDisposables.push(grateGeo, grateMat);
    }

    if (warnZs.length > 0) {
      const warnGeo = new THREE.PlaneGeometry(2.6, 1.3);
      const warnMat = new THREE.MeshStandardMaterial({
        map: decals.warning,
        transparent: true,
        alphaTest: 0.15,
        roughness: 0.85,
        metalness: 0.1,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      });
      const warnInst = new THREE.InstancedMesh(warnGeo, warnMat, warnZs.length);
      warnZs.forEach((z, i) => {
        const left = i % 2 === 0;
        dummy.position.set(left ? minX + 0.035 : maxX - 0.035, waterY + 2.35, z);
        dummy.rotation.set(0, left ? Math.PI / 2 : -Math.PI / 2, (i % 3 === 0 ? -0.05 : 0.04));
        dummy.updateMatrix();
        warnInst.setMatrixAt(i, dummy.matrix);
      });
      warnInst.instanceMatrix.needsUpdate = true;
      warnInst.computeBoundingSphere();
      this.levelGroup.add(warnInst);
      this.levelDisposables.push(warnGeo, warnMat);
    }

    // 5. Crimson Emergency Bulkhead Pinpoint Beacons along perimeter walls
    const beaconZs: number[] = [];
    for (let z = maxZ - 16; z >= minZ + 16; z -= 32) {
      beaconZs.push(z);
    }
    if (beaconZs.length > 0) {
      const cageGeo = new THREE.BoxGeometry(0.22, 0.34, 0.22);
      const bulbGeo = new THREE.SphereGeometry(0.08, 6, 5);
      const bulbMat = new THREE.MeshStandardMaterial({
        color: 0xff281c,
        emissive: 0xd91a12,
        emissiveIntensity: 2.2,
        roughness: 0.2,
      });
      const cageInst = new THREE.InstancedMesh(cageGeo, rustMat, beaconZs.length);
      const bulbInst = new THREE.InstancedMesh(bulbGeo, bulbMat, beaconZs.length);
      beaconZs.forEach((z, i) => {
        const left = (i + def.id) % 2 === 0;
        const bx = left ? minX + 0.58 : maxX - 0.58;
        dummy.position.set(bx, waterY + 3.2, z);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        cageInst.setMatrixAt(i, dummy.matrix);
        dummy.position.set(bx + (left ? 0.08 : -0.08), waterY + 3.2, z);
        dummy.updateMatrix();
        bulbInst.setMatrixAt(i, dummy.matrix);
      });
      cageInst.instanceMatrix.needsUpdate = true;
      bulbInst.instanceMatrix.needsUpdate = true;
      cageInst.computeBoundingSphere();
      bulbInst.computeBoundingSphere();
      this.levelGroup.add(cageInst, bulbInst);
      this.levelDisposables.push(cageGeo, bulbGeo, bulbMat);
    }

    // 6. Submerged Sunken Concrete Slabs & Rusted Girders resting on deep pool floor (strictly below water)
    if (waterY - floorY >= 1.5) {
      const slabGeo = new THREE.BoxGeometry(2.6, 0.32, 1.5);
      const rubbleCount = Math.min(24, Math.max(8, Math.floor(depth / 14)));
      const slabInst = new THREE.InstancedMesh(slabGeo, rubbleMat, rubbleCount);
      for (let i = 0; i < rubbleCount; i++) {
        const h1 = Math.abs(Math.sin((def.id * 31.7 + i * 17.3) * 1234.5) % 1);
        const h2 = Math.abs(Math.cos((def.id * 19.3 + i * 43.1) * 2345.6) % 1);
        const rx = minX + 3.5 + h1 * Math.max(4, width - 7);
        const rz = minZ + 6 + (i / rubbleCount) * Math.max(8, depth - 12);
        dummy.position.set(rx, floorY + 0.14, rz);
        dummy.rotation.set((h1 - 0.5) * 0.18, h2 * Math.PI, (h2 - 0.5) * 0.16);
        dummy.updateMatrix();
        slabInst.setMatrixAt(i, dummy.matrix);
      }
      slabInst.instanceMatrix.needsUpdate = true;
      slabInst.computeBoundingSphere();
      this.levelGroup.add(slabInst);
      this.levelDisposables.push(slabGeo);
    }
  }

  private buildAtmosphericParticles(
    def: LevelDef,
    atmo: ReturnType<PoolGameEngine['computeHorrorAtmosphere']>
  ): void {
    if (this.isSoftwareGl) return;
    const count = this.isTouchDevice ? 130 : 240;
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 44;
      positions[i * 3 + 1] = Math.random() * 11;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 44;
      seeds[i * 2 + 0] = Math.random() * 6.283;
      seeds[i * 2 + 1] = 0.6 + Math.random() * 0.9;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 2));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uCamPos: { value: this.camera.position.clone() },
        uWaterY: { value: def.bounds.waterY + 0.15 },
        uPixelRatio: { value: this.renderer.getPixelRatio() },
        uColor: { value: atmo.moonColor.clone().lerp(new THREE.Color('#c8dce6'), 0.4) },
      },
      vertexShader: `
        attribute vec2 aSeed;
        uniform float uTime;
        uniform vec3 uCamPos;
        uniform float uWaterY;
        uniform float uPixelRatio;
        varying float vAlpha;
        void main() {
          vec3 p = position;
          p.x += sin(uTime * 0.35 * aSeed.y + aSeed.x) * 1.1;
          p.y += uTime * 0.14 * aSeed.y;
          p.z += cos(uTime * 0.31 * aSeed.y + aSeed.x * 1.7) * 1.1;

          // Wrap endlessly inside 44x11x44 volume tracking the camera
          vec3 rel = p - uCamPos;
          rel.x = mod(rel.x + 22.0, 44.0) - 22.0;
          rel.y = mod(rel.y + 4.5, 11.0) - 4.5;
          rel.z = mod(rel.z + 22.0, 44.0) - 22.0;
          vec3 worldPos = uCamPos + rel;
          worldPos.y = max(worldPos.y, uWaterY);

          vec4 mvPos = modelViewMatrix * vec4(worldPos, 1.0);
          float dist = -mvPos.z;
          vAlpha = smoothstep(24.0, 5.0, dist) * smoothstep(0.6, 2.2, dist) * (0.26 + 0.18 * sin(uTime * 1.1 + aSeed.x));
          gl_PointSize = clamp((16.0 * aSeed.y * uPixelRatio) / max(1.0, dist), 1.0, 5.5);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          vec2 c = gl_PointCoord - vec2(0.5);
          float d = dot(c, c);
          if (d > 0.25) discard;
          float soft = pow(1.0 - d * 4.0, 1.7);
          gl_FragColor = vec4(uColor, soft * max(0.0, vAlpha));
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.renderOrder = 4;
    pts.visible = this.activeQuality !== 'smooth';
    this.levelGroup.add(pts);
    this.dustPoints = pts;
    this.dustMat = mat;
    this.levelDisposables.push(geo, mat);
  }

  private buildWater(def: LevelDef): void {
    const isOW = this.activeWorldMode === 'open_world';
    const waterY = isOW ? OPEN_WORLD_BOUNDS.waterY : def.bounds.waterY;
    const width = isOW ? 408 : def.bounds.maxX - def.bounds.minX;
    const depth = isOW ? 408 : def.bounds.maxZ - def.bounds.minZ;
    const cx = isOW
      ? Math.round((Number.isFinite(this.playerPos.x) ? this.playerPos.x : OPEN_WORLD_SPAWN.x) / 85) * 85
      : (def.bounds.minX + def.bounds.maxX) * 0.5;
    const cz = isOW
      ? Math.round((Number.isFinite(this.playerPos.z) ? this.playerPos.z : OPEN_WORLD_SPAWN.z) / 85) * 85
      : (def.bounds.minZ + def.bounds.maxZ) * 0.5;

    const lowWater = this.isSoftwareGl || this.isLowEndGpu || this.activeQuality === 'smooth';
    const segX = isOW ? (lowWater ? 24 : this.isTouchDevice ? 36 : 56) : (lowWater ? 14 : this.isTouchDevice ? 18 : 28);
    const segZ = isOW ? (lowWater ? 24 : this.isTouchDevice ? 36 : 56) : (lowWater ? 28 : this.isTouchDevice ? 36 : 56);
    const geo = new THREE.PlaneGeometry(width, depth, segX, segZ);

    this.textures.waterNormal.repeat.set(Math.max(5, width / 8.5), Math.max(10, depth / 8.5));
    this.textures.waterNormal.needsUpdate = true;
    this.waterOrigNormalMap = this.textures.waterNormal;

    const useLightWaterMat = lowWater || this.isTouchDevice || this.activeQuality !== 'ultra';
    const mat: THREE.MeshStandardMaterial = useLightWaterMat
      ? new THREE.MeshStandardMaterial({
          color: 0x1a4450,
          roughness: 0.1,
          metalness: 0.28,
          normalMap: this.textures.waterNormal,
          normalScale: new THREE.Vector2(1.0, 1.0),
          envMapIntensity: this.activeQuality === 'smooth' ? 0.92 : 1.48,
          transparent: true,
          opacity: 0.80,
        })
      : new THREE.MeshPhysicalMaterial({
          color: 0x163d48,
          roughness: 0.05,
          metalness: 0.18,
          clearcoat: 1.0,
          clearcoatRoughness: 0.04,
          ior: 1.333,
          reflectivity: 0.94,
          normalMap: this.textures.waterNormal,
          normalScale: new THREE.Vector2(1.05, 1.05),
          envMapIntensity: 1.75,
          transparent: true,
          opacity: 0.80,
        });

    // Multi-octave swells + real-time serpent V-wake water displacement & churning whitewater foam (quality-scaled)
    mat.customProgramCacheKey = () => 'water_surface_aaa_v3';
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      shader.uniforms.uSerpentHead = { value: new THREE.Vector2(0, -999) };
      shader.uniforms.uSerpentDir = { value: new THREE.Vector2(0, 1) };
      shader.uniforms.uSerpentWake = { value: 0 };
      shader.uniforms.uWaterQuality = this.uWaterQuality;
      mat.userData.shader = shader;
      shader.vertexShader =
        'uniform float uTime;\nuniform vec2 uSerpentHead;\nuniform vec2 uSerpentDir;\nuniform float uSerpentWake;\nuniform float uWaterQuality;\nvarying float vWaveHeight;\nvarying float vSerpentFoam;\n' +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          `
          #include <begin_vertex>
          float w1 = sin(position.x * 0.48 + uTime * 1.65) * cos(position.y * 0.42 - uTime * 1.25) * 0.014;
          float wh = w1 + 0.026;
          if (uWaterQuality > 0.5) {
            float w2 = sin((position.x * 0.82 - position.y * 0.95) + uTime * 2.15) * 0.008;
            float w3 = cos((position.x * 1.4 + position.y * 1.1) - uTime * 2.8) * 0.004;
            wh += w2 + w3;
          }

          float wakeDisp = 0.0;
          float foamMask = 0.0;
          if (uSerpentWake > 0.01) {
            vec2 worldXZ = (modelMatrix * vec4(transformed, 1.0)).xz;
            vec2 rel = worldXZ - uSerpentHead;
            float along = dot(rel, uSerpentDir);
            if (along < 3.5 && along > -24.0) {
              float across = dot(rel, vec2(-uSerpentDir.y, uSerpentDir.x));
              float trailT = clamp(-along / 22.0, 0.0, 1.0);
              float vWidth = 1.0 + trailT * 4.4;
              float vEdge = abs(abs(across) - vWidth * 0.72);
              float bowCrest = exp(-(vEdge * vEdge) / 0.85) * exp(-trailT * 1.65);
              float coreTrough = exp(-(across * across) / (0.8 + trailT * 1.2)) * exp(-trailT * 1.4);
              float thrash = uWaterQuality > 0.5 ? (sin(along * 1.5 - uTime * 26.0) * 0.5 + 0.5) : 0.5;
              wakeDisp = (bowCrest * 0.24 - coreTrough * 0.14 + bowCrest * thrash * 0.12) * uSerpentWake;
              foamMask = clamp((bowCrest * 0.85 + coreTrough * (0.55 + thrash * 0.45)) * uSerpentWake, 0.0, 1.0);
            }
          }

          transformed.z += wh + wakeDisp;
          vWaveHeight = wh + wakeDisp;
          vSerpentFoam = foamMask;
          `
        );

      shader.fragmentShader =
        'uniform float uWaterQuality;\nvarying float vWaveHeight;\nvarying float vSerpentFoam;\n' +
        shader.fragmentShader.replace(
          '#include <emissivemap_fragment>',
          `
          #include <emissivemap_fragment>
          float fresnel = uWaterQuality > 0.5
            ? pow(1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0), 3.0)
            : 0.18;
          float crest = smoothstep(0.032, 0.09, vWaveHeight);
          totalEmissiveRadiance += vec3(0.035, 0.085, 0.115) * fresnel * 0.6 + vec3(0.09, 0.15, 0.17) * vSerpentFoam * 0.42;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.36, 0.46, 0.50), clamp(crest * 0.22 + fresnel * 0.14 + vSerpentFoam * 0.72, 0.0, 0.88));
          `
        );
    };

    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(cx, waterY, cz);
    mesh.receiveShadow = !this.isSoftwareGl && !this.isTouchDevice && this.activeQuality !== 'smooth';
    mesh.renderOrder = 2;
    this.levelGroup.add(mesh);

    this.waterMesh = mesh;
    this.waterMat = mat;
    this.levelDisposables.push(geo, mat);
  }

  private makeTiledBoxGeo(w: number, h: number, d: number, tileU: number, tileV: number): THREE.BoxGeometry {
    const geo = new THREE.BoxGeometry(w, h, d);
    const uv = geo.attributes.uv;
    const arr = uv.array as Float32Array;
    const ux = Math.max(0.5, d / tileU);
    const vx = Math.max(0.5, h / tileV);
    for (let i = 0; i < 8; i++) {
      arr[i * 2] *= ux;
      arr[i * 2 + 1] *= vx;
    }
    const uy = Math.max(0.5, w / tileU);
    const vy = Math.max(0.5, d / tileV);
    for (let i = 8; i < 16; i++) {
      arr[i * 2] *= uy;
      arr[i * 2 + 1] *= vy;
    }
    const uz = Math.max(0.5, w / tileU);
    const vz = Math.max(0.5, h / tileV);
    for (let i = 16; i < 24; i++) {
      arr[i * 2] *= uz;
      arr[i * 2 + 1] *= vz;
    }
    uv.needsUpdate = true;
    return geo;
  }

  private transformGeo(
    geo: THREE.BufferGeometry,
    px: number,
    py: number,
    pz: number,
    rx = 0,
    ry = 0,
    rz = 0
  ): THREE.BufferGeometry {
    _eBake.set(rx, ry, rz);
    _qBake.setFromEuler(_eBake);
    _pBake.set(px, py, pz);
    _mBake.compose(_pBake, _qBake, _sBake);
    geo.applyMatrix4(_mBake);
    return geo;
  }

  private flushStaticChunks(
    buckets: Map<number, Map<THREE.Material, { cast: THREE.BufferGeometry[]; noCast: THREE.BufferGeometry[] }>>,
    baseMinZ = this.currentLevel.bounds.minZ,
    owChunk?: OpenWorldChunk
  ): void {
    const targetGroup = owChunk ? owChunk.group : this.levelGroup;
    const targetDisposables = owChunk ? owChunk.disposables : this.levelDisposables;
    const fbMinX = owChunk ? owChunk.bounds.minX - 4 : -1e6;
    const fbMaxX = owChunk ? owChunk.bounds.maxX + 4 : 1e6;
    for (const [chunkIdx, matMap] of buckets.entries()) {
      const fallbackMinZ = baseMinZ + chunkIdx * CHUNK_Z_SPAN - 4;
      const fallbackMaxZ = baseMinZ + (chunkIdx + 1) * CHUNK_Z_SPAN + 4;
      for (const [mat, lists] of matMap.entries()) {
        if (lists.cast.length > 0) {
          const merged = lists.cast.length === 1 ? lists.cast[0] : mergeGeometries(lists.cast, false);
          if (merged) {
            if (lists.cast.length > 1) {
              lists.cast.forEach((g) => g.dispose());
            }
            merged.computeBoundingBox();
            const cMinX = merged.boundingBox ? merged.boundingBox.min.x : fbMinX;
            const cMaxX = merged.boundingBox ? merged.boundingBox.max.x : fbMaxX;
            const cMinZ = merged.boundingBox ? merged.boundingBox.min.z : fallbackMinZ;
            const cMaxZ = merged.boundingBox ? merged.boundingBox.max.z : fallbackMaxZ;
            const mesh = new THREE.Mesh(merged, mat);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.registerShadowReceiver(mesh);
            if (owChunk) owChunk.shadowReceivers.push(mesh);
            targetGroup.add(mesh);
            targetDisposables.push(merged);
            const entry: StaticChunkEntry = {
              mesh,
              minX: cMinX,
              maxX: cMaxX,
              minZ: cMinZ,
              maxZ: cMaxZ,
              castShadow: true,
              owChunkKey: owChunk?.key,
            };
            this.staticChunks.push(entry);
            if (owChunk) owChunk.staticChunkRefs.push(entry);
          }
        }
        if (lists.noCast.length > 0) {
          const merged = lists.noCast.length === 1 ? lists.noCast[0] : mergeGeometries(lists.noCast, false);
          if (merged) {
            if (lists.noCast.length > 1) {
              lists.noCast.forEach((g) => g.dispose());
            }
            merged.computeBoundingBox();
            const cMinX = merged.boundingBox ? merged.boundingBox.min.x : fbMinX;
            const cMaxX = merged.boundingBox ? merged.boundingBox.max.x : fbMaxX;
            const cMinZ = merged.boundingBox ? merged.boundingBox.min.z : fallbackMinZ;
            const cMaxZ = merged.boundingBox ? merged.boundingBox.max.z : fallbackMaxZ;
            const mesh = new THREE.Mesh(merged, mat);
            mesh.castShadow = false;
            mesh.receiveShadow = true;
            this.registerShadowReceiver(mesh);
            if (owChunk) owChunk.shadowReceivers.push(mesh);
            targetGroup.add(mesh);
            targetDisposables.push(merged);
            const entry: StaticChunkEntry = {
              mesh,
              minX: cMinX,
              maxX: cMaxX,
              minZ: cMinZ,
              maxZ: cMaxZ,
              castShadow: false,
              owChunkKey: owChunk?.key,
            };
            this.staticChunks.push(entry);
            if (owChunk) owChunk.staticChunkRefs.push(entry);
          }
        }
      }
    }
  }

  private updateVisibilityCulling(force = false): void {
    const camX = this.camera.position.x;
    const camZ = this.camera.position.z;
    if (
      !force &&
      !Number.isNaN(this._lastCullCamX) &&
      !Number.isNaN(this._lastCullCamZ) &&
      Math.abs(camX - this._lastCullCamX) < 0.75 &&
      Math.abs(camZ - this._lastCullCamZ) < 0.75 &&
      this._lastCullPhase === this.phase &&
      this._lastCullQuality === this.activeQuality &&
      this.renderFrameIdx % 6 !== 0
    ) {
      return;
    }
    this._lastCullCamX = camX;
    this._lastCullCamZ = camZ;
    this._lastCullPhase = this.phase;
    this._lastCullQuality = this.activeQuality;

    const isJumpscare = this.phase === 'jumpscare';
    // During close-up devouring, dense abyssal fog (>=0.058) completely hides geometry past ~35m
    const distLimit = isJumpscare ? Math.min(this.activeRenderDist, 48) : this.activeRenderDist;
    const shadowCastEnabled = !this.isSoftwareGl && this.activeQuality !== 'smooth';
    const baseShadowRadius = this.activeQuality === 'ultra' ? 60 : 45;
    const shadowZRadius = isJumpscare ? Math.min(baseShadowRadius, 24) : baseShadowRadius;
    const focusPos = this.getCameraFocusPos();
    const px = isJumpscare && this.jumpscareMonster ? this.jumpscareMonster.pos.x : focusPos.x;
    const pz = isJumpscare && this.jumpscareMonster ? this.jumpscareMonster.pos.z : focusPos.z;

    for (let i = 0; i < this.staticChunks.length; i++) {
      const c = this.staticChunks[i];
      const vis =
        camZ + distLimit >= c.minZ &&
        camZ - distLimit <= c.maxZ &&
        camX + distLimit >= c.minX &&
        camX - distLimit <= c.maxX;
      c.mesh.visible = vis;
      if (c.castShadow) {
        c.mesh.castShadow =
          vis &&
          shadowCastEnabled &&
          pz + shadowZRadius >= c.minZ &&
          pz - shadowZRadius <= c.maxZ &&
          px + shadowZRadius >= c.minX &&
          px - shadowZRadius <= c.maxX;
      }
    }

    for (let i = 0; i < this.dynamicPlatforms.length; i++) {
      const p = this.dynamicPlatforms[i];
      if (p.state !== 'gone') {
        const lim = distLimit + p.boundRadiusXZ;
        p.mesh.visible =
          Math.abs(p.currentPos.z - camZ) <= lim &&
          Math.abs(p.currentPos.x - camX) <= lim;
      }
    }

    for (let i = 0; i < this.checkpoints.length; i++) {
      const cp = this.checkpoints[i];
      const lim = distLimit + 6;
      cp.group.visible =
        Math.abs(cp.group.position.z - camZ) <= lim &&
        Math.abs(cp.group.position.x - camX) <= lim;
    }
  }

  private addChunkPart(
    buckets: Map<number, Map<THREE.Material, { cast: THREE.BufferGeometry[]; noCast: THREE.BufferGeometry[] }>>,
    chunkIdx: number,
    mat: THREE.Material,
    geo: THREE.BufferGeometry,
    castShadow: boolean
  ): void {
    let matMap = buckets.get(chunkIdx);
    if (!matMap) {
      matMap = new Map();
      buckets.set(chunkIdx, matMap);
    }
    let lists = matMap.get(mat);
    if (!lists) {
      lists = { cast: [], noCast: [] };
      matMap.set(mat, lists);
    }
    if (castShadow) lists.cast.push(geo);
    else lists.noCast.push(geo);
  }

  private buildPlatforms(def: LevelDef): void {
    const chunkBuckets = new Map<number, Map<THREE.Material, { cast: THREE.BufferGeometry[]; noCast: THREE.BufferGeometry[] }>>();
    this.buildPlatformsInto(
      def.platforms,
      def.bounds,
      chunkBuckets,
      this.platforms,
      this.levelDisposables,
      this.levelShadowReceivers,
      this.levelQualityMaterials,
      this.levelGroup
    );
    this.flushStaticChunks(chunkBuckets);
  }

  private buildPlatformsInto(
    platformDefs: PlatformDef[],
    bounds: LevelDef['bounds'],
    chunkBuckets: Map<number, Map<THREE.Material, { cast: THREE.BufferGeometry[]; noCast: THREE.BufferGeometry[] }>>,
    outPlatforms: RuntimePlatform[],
    outDisposables: Array<{ dispose: () => void }>,
    outShadowReceivers: THREE.Mesh[],
    outQualityMaterials: Array<{
      mat: THREE.MeshStandardMaterial;
      origBumpScale: number;
      origEnvIntensity: number;
    }>,
    parentGroup: THREE.Group,
    owMats?: OpenWorldMaterialPalette
  ): void {
    const subFrameMat =
      owMats?.subFrameMat ??
      new THREE.MeshStandardMaterial({
        map: this.textures.concreteAlbedo,
        bumpMap: this.textures.concreteBump,
        bumpScale: 0.022,
        color: 0x5d6b70,
        roughness: 0.86,
        metalness: 0.14,
      });
    const curbSteelMat =
      owMats?.curbSteelMat ??
      new THREE.MeshStandardMaterial({
        map: this.textures.metalAlbedo,
        bumpMap: this.textures.metalBump,
        bumpScale: 0.018,
        color: 0x9aa8ad,
        roughness: 0.36,
        metalness: 0.82,
      });
    const woodWetMat =
      owMats?.woodWetMat ??
      new THREE.MeshStandardMaterial({
        map: this.textures.woodAlbedo,
        bumpMap: this.textures.woodBump,
        bumpScale: 0.03,
        color: 0x8a694c,
        roughness: 0.38,
        metalness: 0.05,
      });
    const woodTrimMat =
      owMats?.woodTrimMat ??
      new THREE.MeshStandardMaterial({
        map: this.textures.woodAlbedo,
        bumpMap: this.textures.woodBump,
        bumpScale: 0.028,
        color: 0xa6815e,
        roughness: 0.74,
        metalness: 0.04,
      });
    const woodIronMat =
      owMats?.woodIronMat ??
      new THREE.MeshStandardMaterial({
        map: this.textures.metalAlbedo,
        bumpMap: this.textures.metalBump,
        bumpScale: 0.02,
        color: 0x667075,
        roughness: 0.58,
        metalness: 0.72,
      });

    if (!owMats) {
      this.registerLevelMaterial(subFrameMat);
      this.registerLevelMaterial(curbSteelMat);
      this.registerLevelMaterial(woodWetMat);
      this.registerLevelMaterial(woodTrimMat);
      this.registerLevelMaterial(woodIronMat);
      outDisposables.push(subFrameMat, curbSteelMat, woodWetMat, woodTrimMat, woodIronMat);
    }

    const accentMatMap = owMats?.accentMats ?? new Map<string, THREE.MeshStandardMaterial>();
    const getAccentMaterial = (
      texKey: string,
      isWood: boolean,
      color: number,
      roughness: number,
      metalness: number,
      baseTex: THREE.Texture,
      bumpBase: THREE.Texture | null,
      roughBase: THREE.Texture | null
    ) => {
      let cached = accentMatMap.get(texKey);
      if (!cached) {
        cached = new THREE.MeshStandardMaterial({
          map: baseTex,
          bumpMap: bumpBase,
          bumpScale: isWood ? 0.032 : 0.022,
          roughnessMap: roughBase,
          color,
          roughness,
          metalness,
        });
        if (owMats) {
          cached.userData.sharedPool = true;
        }
        accentMatMap.set(texKey, cached);
        this.registerLevelMaterial(cached);
        if (!owMats) {
          outDisposables.push(cached);
        }
      }
      return cached;
    };

    const bollardProto = owMats?.bollardProto ?? new THREE.CylinderGeometry(0.085, 0.1, 0.34, 8);
    const minZ = bounds.minZ;
    const dummyStaticObj = new THREE.Object3D();

    platformDefs.forEach((p) => {
      const [w, h, d] = p.size;
      const isWood = p.accent === 'wood';
      const isDynamic = p.kind === 'moving' || p.kind === 'disappearing' || Boolean(p.rotationSpeed);

      let color = 0xc4d2d6;
      let baseTex = this.textures.tileAlbedo;
      let bumpBase: THREE.Texture | null = this.textures.tileBump;
      let roughBase: THREE.Texture | null = this.textures.tileRoughness;
      let texKey = 'tile';
      let roughness = 0.36;
      let metalness = 0.08;

      if (isWood) {
        baseTex = this.textures.woodAlbedo;
        bumpBase = this.textures.woodBump;
        roughBase = this.textures.woodRoughness;
        texKey = 'wood';
        color = 0xc49f7a;
        roughness = 0.78;
        metalness = 0.04;
      } else if (p.accent === 'caution' || p.kind === 'moving' || p.kind === 'disappearing') {
        baseTex = this.textures.cautionAlbedo;
        bumpBase = this.textures.metalBump;
        roughBase = null;
        texKey = p.kind === 'disappearing' ? 'caution_fragile' : 'caution';
        color = p.kind === 'disappearing' ? 0xd9ad7c : 0xc4ccd0;
        roughness = 0.48;
        metalness = 0.24;
      } else if (p.accent === 'concrete') {
        baseTex = this.textures.concreteAlbedo;
        bumpBase = this.textures.concreteBump;
        roughBase = null;
        texKey = 'concrete';
        color = 0x9da8ab;
        roughness = 0.82;
      } else if (p.accent === 'metal' || p.kind === 'bridge' || p.kind === 'ladder_step') {
        baseTex = this.textures.metalAlbedo;
        bumpBase = this.textures.metalBump;
        roughBase = null;
        texKey = 'metal';
        color = 0xb8c6cc;
        roughness = 0.3;
        metalness = 0.84;
      } else if (p.accent === 'start') {
        color = 0xbad0d6;
        texKey = 'start';
      } else if (p.accent === 'exit') {
        color = 0x9dd1be;
        texKey = 'exit';
      }

      let mat: THREE.MeshStandardMaterial;
      if (p.kind === 'disappearing') {
        mat = new THREE.MeshStandardMaterial({
          map: baseTex,
          bumpMap: bumpBase,
          bumpScale: 0.022,
          color,
          roughness,
          metalness,
          transparent: false,
          opacity: 1,
        });
        const qEntry = {
          mat,
          origBumpScale: mat.bumpScale ?? 0.025,
          origEnvIntensity: mat.envMapIntensity,
        };
        this.levelQualityMaterials.push(qEntry);
        if (outQualityMaterials !== this.levelQualityMaterials) {
          outQualityMaterials.push(qEntry);
        }
        outDisposables.push(mat);
      } else {
        mat = getAccentMaterial(texKey, isWood, color, roughness, metalness, baseTex, bumpBase, roughBase);
      }

      const [px0, py0, pz0] = p.position;
      const chunkIdx = Math.floor((pz0 - minZ) / CHUNK_Z_SPAN);

      if (!isDynamic) {
        // Bake every static deck sub-part cleanly into 36m Z-chunks for massive draw-call reduction
        if (isWood) {
          const topH = Math.min(h * 0.34, 0.24);
          this.addChunkPart(
            chunkBuckets,
            chunkIdx,
            mat,
            this.transformGeo(this.makeTiledBoxGeo(w, topH, d, 2.4, 2.4), px0, py0 + h * 0.5 - topH * 0.5, pz0),
            true
          );

          const subH = Math.max(0.12, h - topH);
          this.addChunkPart(
            chunkBuckets,
            chunkIdx,
            woodWetMat,
            this.transformGeo(this.makeTiledBoxGeo(Math.max(0.5, w * 0.94), subH, Math.max(0.5, d * 0.94), 2.4, 2.4), px0, py0 - h * 0.5 + subH * 0.5, pz0),
            false
          );

          const isCompactWood = Math.min(w, d) < 4.5;
          const joistCount = Math.max(2, Math.round(d / 4.2));
          const jw = w * 0.985;
          const jh = isCompactWood ? 0.11 : 0.14;
          const jd = isCompactWood ? 0.18 : 0.24;
          for (let ji = 0; ji < joistCount; ji++) {
            const zFrac = joistCount === 1 ? 0 : -0.42 + (0.84 * ji) / (joistCount - 1);
            this.addChunkPart(
              chunkBuckets,
              chunkIdx,
              woodTrimMat,
              this.transformGeo(this.makeTiledBoxGeo(jw, jh, jd, 2.4, 2.4), px0, py0 + h * 0.5 - topH - 0.06, pz0 + zFrac * d),
              false
            );
          }

          const pilingH = h + 0.02;
          const pilingSize = isCompactWood ? 0.24 : 0.36;
          const collarSize = isCompactWood ? 0.28 : 0.4;
          const pilingInset = isCompactWood ? 0.14 : 0.2;
          const collarH = isCompactWood ? 0.07 : 0.09;
          for (const sx of [-1, 1] as const) {
            for (const sz of [-1, 1] as const) {
              const cx = px0 + sx * (w * 0.5 - pilingInset);
              const cz = pz0 + sz * (d * 0.5 - pilingInset);
              this.addChunkPart(
                chunkBuckets,
                chunkIdx,
                woodTrimMat,
                this.transformGeo(this.makeTiledBoxGeo(pilingSize, pilingH, pilingSize, 2.0, 2.0), cx, py0 + 0.01, cz),
                false
              );
              this.addChunkPart(
                chunkBuckets,
                chunkIdx,
                woodIronMat,
                this.transformGeo(this.makeTiledBoxGeo(collarSize, collarH, collarSize, 1.5, 1.5), cx, py0 + h * 0.5 - 0.09, cz),
                false
              );
            }
          }
        } else {
          const topH = Math.min(h * 0.48, 0.24);
          this.addChunkPart(
            chunkBuckets,
            chunkIdx,
            mat,
            this.transformGeo(this.makeTiledBoxGeo(w, topH, d, 2.4, 2.4), px0, py0 + h * 0.5 - topH * 0.5, pz0),
            true
          );

          const subH = Math.max(0.08, h - topH);
          this.addChunkPart(
            chunkBuckets,
            chunkIdx,
            subFrameMat,
            this.transformGeo(this.makeTiledBoxGeo(Math.max(0.5, w * 0.91), subH, Math.max(0.5, d * 0.91), 2.8, 2.8), px0, py0 - h * 0.5 + subH * 0.5, pz0),
            false
          );

          if (p.kind === 'bridge') {
            const alongZ = d >= w;
            const rw = alongZ ? 0.14 : w;
            const rd = alongZ ? d : 0.14;
            for (const s of [-1, 1] as const) {
              const rx = alongZ ? px0 + s * (w * 0.5 - 0.07) : px0;
              const rz = alongZ ? pz0 : pz0 + s * (d * 0.5 - 0.07);
              this.addChunkPart(
                chunkBuckets,
                chunkIdx,
                curbSteelMat,
                this.transformGeo(this.makeTiledBoxGeo(rw, 0.12, rd, 2.0, 2.0), rx, py0 + h * 0.5 + 0.04, rz),
                false
              );
            }
          } else if (p.size[0] >= 6.8 && p.size[2] >= 6.8) {
            for (const sx of [-1, 1] as const) {
              for (const sz of [-1, 1] as const) {
                const bGeo = bollardProto.clone();
                this.transformGeo(bGeo, px0 + sx * (w * 0.5 - 0.35), py0 + h * 0.5 + 0.15, pz0 + sz * (d * 0.5 - 0.35));
                this.addChunkPart(chunkBuckets, chunkIdx, curbSteelMat, bGeo, false);
              }
            }
          }
        }

        const boundRadiusXZ = Math.hypot(w * 0.5, d * 0.5);
        const rtStatic: RuntimePlatform = {
          def: p,
          mesh: dummyStaticObj,
          material: mat,
          baseColorHex: color,
          boundRadiusXZ,
          currentPos: new THREE.Vector3(px0, py0, pz0),
          prevPos: new THREE.Vector3(px0, py0, pz0),
          currentQuat: _qIdentity.clone(),
          prevQuat: _qIdentity.clone(),
          invQuat: _qIdentity.clone(),
          prevInvQuat: _qIdentity.clone(),
          isRotated: false,
          state: 'solid',
          stateTimer: 0,
        };
        this.platforms.push(rtStatic);
        if (outPlatforms !== this.platforms) outPlatforms.push(rtStatic);
        return;
      }

      // Dynamic platform (moving, rotating, disappearing) — merge repeated trim sub-parts into minimal draw calls
      const group = new THREE.Group();
      group.position.set(px0, py0, pz0);
      const localBuckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
      const pushLocal = (m: THREE.Material, g: THREE.BufferGeometry) => {
        let arr = localBuckets.get(m);
        if (!arr) {
          arr = [];
          localBuckets.set(m, arr);
        }
        arr.push(g);
      };

      if (isWood) {
        const topH = Math.min(h * 0.34, 0.24);
        const topGeo = this.makeTiledBoxGeo(w, topH, d, 2.4, 2.4);
        const topMesh = new THREE.Mesh(topGeo, mat);
        topMesh.position.y = h * 0.5 - topH * 0.5;
        topMesh.castShadow = true;
        topMesh.receiveShadow = true;
        this.registerShadowReceiver(topMesh);
        if (outShadowReceivers !== this.levelShadowReceivers) outShadowReceivers.push(topMesh);
        group.add(topMesh);
        outDisposables.push(topGeo);

        const subH = Math.max(0.12, h - topH);
        pushLocal(
          woodWetMat,
          this.transformGeo(this.makeTiledBoxGeo(Math.max(0.5, w * 0.94), subH, Math.max(0.5, d * 0.94), 2.4, 2.4), 0, -h * 0.5 + subH * 0.5, 0)
        );

        const isCompactWood = Math.min(w, d) < 4.5;
        const joistCount = Math.max(2, Math.round(d / 4.2));
        for (let ji = 0; ji < joistCount; ji++) {
          const zFrac = joistCount === 1 ? 0 : -0.42 + (0.84 * ji) / (joistCount - 1);
          pushLocal(
            woodTrimMat,
            this.transformGeo(
              this.makeTiledBoxGeo(w * 0.985, isCompactWood ? 0.11 : 0.14, isCompactWood ? 0.18 : 0.24, 2.4, 2.4),
              0,
              h * 0.5 - topH - 0.06,
              zFrac * d
            )
          );
        }

        const pilingH = h + 0.02;
        const pilingSize = isCompactWood ? 0.24 : 0.36;
        const collarSize = isCompactWood ? 0.28 : 0.4;
        const pilingInset = isCompactWood ? 0.14 : 0.2;
        for (const sx of [-1, 1] as const) {
          for (const sz of [-1, 1] as const) {
            const px = sx * (w * 0.5 - pilingInset);
            const pz = sz * (d * 0.5 - pilingInset);
            pushLocal(woodTrimMat, this.transformGeo(this.makeTiledBoxGeo(pilingSize, pilingH, pilingSize, 2.0, 2.0), px, 0.01, pz));
            pushLocal(
              woodIronMat,
              this.transformGeo(this.makeTiledBoxGeo(collarSize, isCompactWood ? 0.07 : 0.09, collarSize, 1.5, 1.5), px, h * 0.5 - 0.09, pz)
            );
          }
        }
      } else {
        const topH = Math.min(h * 0.48, 0.24);
        const topGeo = this.makeTiledBoxGeo(w, topH, d, 2.4, 2.4);
        const topMesh = new THREE.Mesh(topGeo, mat);
        topMesh.position.y = h * 0.5 - topH * 0.5;
        topMesh.castShadow = true;
        topMesh.receiveShadow = true;
        this.registerShadowReceiver(topMesh);
        if (outShadowReceivers !== this.levelShadowReceivers) outShadowReceivers.push(topMesh);
        group.add(topMesh);
        outDisposables.push(topGeo);

        const subH = Math.max(0.08, h - topH);
        pushLocal(
          subFrameMat,
          this.transformGeo(this.makeTiledBoxGeo(Math.max(0.5, w * 0.91), subH, Math.max(0.5, d * 0.91), 2.8, 2.8), 0, -h * 0.5 + subH * 0.5, 0)
        );

        if (p.kind === 'bridge') {
          const alongZ = d >= w;
          for (const s of [-1, 1] as const) {
            pushLocal(
              curbSteelMat,
              this.transformGeo(
                this.makeTiledBoxGeo(alongZ ? 0.14 : w, 0.12, alongZ ? d : 0.14, 2.0, 2.0),
                alongZ ? s * (w * 0.5 - 0.07) : 0,
                h * 0.5 + 0.04,
                alongZ ? 0 : s * (d * 0.5 - 0.07)
              )
            );
          }
        } else if (p.size[0] >= 6.8 && p.size[2] >= 6.8) {
          for (const sx of [-1, 1] as const) {
            for (const sz of [-1, 1] as const) {
              pushLocal(
                curbSteelMat,
                this.transformGeo(bollardProto.clone(), sx * (w * 0.5 - 0.35), h * 0.5 + 0.15, sz * (d * 0.5 - 0.35))
              );
            }
          }
        }
      }

      for (const [m, arr] of localBuckets.entries()) {
        const merged = arr.length === 1 ? arr[0] : mergeGeometries(arr, false);
        if (merged) {
          if (arr.length > 1) arr.forEach((g) => g.dispose());
          const subMesh = new THREE.Mesh(merged, m);
          subMesh.receiveShadow = true;
          this.registerShadowReceiver(subMesh);
          if (outShadowReceivers !== this.levelShadowReceivers) outShadowReceivers.push(subMesh);
          group.add(subMesh);
          outDisposables.push(merged);
        }
      }

      group.rotation.order = 'YXZ';
      let isRotated = false;
      if (p.rotationSpeed) {
        const axis = p.rotationAxis || 'y';
        const phase = p.rotationPhase ?? 0;
        if (axis === 'y') group.rotation.set(0, phase, 0);
        else if (axis === 'x') group.rotation.set(phase, 0, 0);
        else if (axis === 'z') group.rotation.set(0, 0, phase);
        else if (axis === 'xy') group.rotation.set(phase * 0.7, phase, 0);
        else if (axis === 'zy') group.rotation.set(0, phase, phase * 0.7);
        isRotated = true;
      }

      parentGroup.add(group);

      const initQuat = group.quaternion.clone();
      const tilted = Boolean(p.rotationSpeed && p.rotationAxis && p.rotationAxis !== 'y');
      const boundRadiusXZ = tilted
        ? Math.hypot(w * 0.5, h * 0.5, d * 0.5)
        : Math.hypot(w * 0.5, d * 0.5);
      const rt: RuntimePlatform = {
        def: p,
        mesh: group,
        material: mat,
        baseColorHex: color,
        boundRadiusXZ,
        currentPos: new THREE.Vector3(px0, py0, pz0),
        prevPos: new THREE.Vector3(px0, py0, pz0),
        currentQuat: initQuat.clone(),
        prevQuat: initQuat.clone(),
        invQuat: initQuat.clone().invert(),
        prevInvQuat: initQuat.clone().invert(),
        isRotated,
        state: 'solid',
        stateTimer: 0,
      };
      this.platforms.push(rt);
      if (outPlatforms !== this.platforms) outPlatforms.push(rt);
      this.dynamicPlatforms.push(rt);
    });

    if (!owMats) {
      bollardProto.dispose();
    }
  }

  private buildInnerWalls(def: LevelDef): void {
    const chunkBuckets = new Map<number, Map<THREE.Material, { cast: THREE.BufferGeometry[]; noCast: THREE.BufferGeometry[] }>>();
    this.buildInnerWallsInto(def.walls, def.bounds, chunkBuckets, this.walls, this.levelDisposables);
    this.flushStaticChunks(chunkBuckets);
  }

  private buildInnerWallsInto(
    wallDefs: WallDef[],
    bounds: LevelDef['bounds'],
    chunkBuckets: Map<number, Map<THREE.Material, { cast: THREE.BufferGeometry[]; noCast: THREE.BufferGeometry[] }>>,
    outWalls: RuntimeWall[],
    outDisposables: Array<{ dispose: () => void }>,
    owMats?: OpenWorldMaterialPalette
  ): void {
    const collarMat =
      owMats?.collarMat ??
      new THREE.MeshStandardMaterial({
        map: this.textures.concreteAlbedo,
        bumpMap: this.textures.concreteBump,
        bumpScale: 0.028,
        color: 0x7d8a8e,
        roughness: 0.84,
        metalness: 0.1,
      });
    const pillarMat =
      owMats?.pillarMat ??
      new THREE.MeshStandardMaterial({
        map: this.textures.concreteAlbedo,
        bumpMap: this.textures.concreteBump,
        bumpScale: 0.028,
        color: 0x9ca7ab,
        roughness: 0.78,
        metalness: 0.06,
      });
    const wallTileMat =
      owMats?.wallMat ??
      new THREE.MeshStandardMaterial({
        map: this.textures.wallAlbedo,
        bumpMap: this.textures.wallBump,
        bumpScale: 0.03,
        color: 0xadbac0,
        roughness: 0.46,
        metalness: 0.06,
      });
    if (!owMats) {
      this.injectUnderwaterCaustics(pillarMat, bounds.waterY, false);
      this.injectUnderwaterCaustics(wallTileMat, bounds.waterY, false);
      this.registerLevelMaterial(collarMat);
      this.registerLevelMaterial(pillarMat);
      this.registerLevelMaterial(wallTileMat);
      outDisposables.push(collarMat, pillarMat, wallTileMat);
    }

    const minZ = bounds.minZ;

    wallDefs.forEach((w) => {
      const [sx, sy, sz] = w.size;
      const [wx, wy, wz] = w.position;
      const isPillar = w.kind === 'pillar' || w.kind === 'concrete';
      const mat = isPillar ? pillarMat : wallTileMat;
      const chunkIdx = Math.floor((wz - minZ) / CHUNK_Z_SPAN);

      this.addChunkPart(
        chunkBuckets,
        chunkIdx,
        mat,
        this.transformGeo(this.makeTiledBoxGeo(sx, sy, sz, 2.5, 3.0), wx, wy, wz),
        true
      );

      if (w.kind === 'pillar') {
        this.addChunkPart(
          chunkBuckets,
          chunkIdx,
          collarMat,
          this.transformGeo(this.makeTiledBoxGeo(sx + 0.36, 0.65, sz + 0.36, 2.5, 2.5), wx, bounds.ceilingY - 0.34, wz),
          false
        );
        this.addChunkPart(
          chunkBuckets,
          chunkIdx,
          collarMat,
          this.transformGeo(this.makeTiledBoxGeo(sx + 0.36, 0.65, sz + 0.36, 2.5, 2.5), wx, bounds.waterY + 0.12, wz),
          false
        );
      }

      const rtWall: RuntimeWall = {
        centerX: wx,
        centerZ: wz,
        boundRadiusXZ: Math.hypot(sx * 0.5, sz * 0.5),
        minX: wx - sx * 0.5,
        maxX: wx + sx * 0.5,
        minY: wy - sy * 0.5,
        maxY: wy + sy * 0.5,
        minZ: wz - sz * 0.5,
        maxZ: wz + sz * 0.5,
      };
      this.walls.push(rtWall);
      if (outWalls !== this.walls) outWalls.push(rtWall);
    });
  }

  private respawnAtActiveCheckpoint(playSound = true): void {
    if (
      Number.isFinite(this.activeSpawn.x) &&
      Number.isFinite(this.activeSpawn.y) &&
      Number.isFinite(this.activeSpawn.z)
    ) {
      this.playerPos.copy(this.activeSpawn);
    } else {
      this.activeSpawn.set(this.currentLevel.spawn[0], this.currentLevel.spawn[1], this.currentLevel.spawn[2]);
      this.playerPos.copy(this.activeSpawn);
    }
    this.playerVel.set(0, 0, 0);
    const defaultYaw = this.activeWorldMode === 'open_world' ? this.owCheckpointYaw : Math.PI;
    this.playerYaw = defaultYaw;
    this.camYaw = defaultYaw - Math.PI;
    this.camPitch = 0.25;
    this.camDist = 5.0;
    this.pendingLookDx = 0;
    this.pendingLookDy = 0;
    this.grounded = false;
    this.stoodPlatform = null;
    this.inWater = false;
    this.wasInWater = false;
    this.playerInWaterSession = false;
    this.playerWaterEpoch = 0;
    this.pendingClimbIntimidation = false;
    this.isWatchedFreezeActive = false;
    this.watchFreezeGraceTimer = 0;
    this.watchMoveAttempted = false;
    this.waterJumpTimer = 0;
    this.waterJumpCooldown = 0;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.camShake = 0;
    this.stamina = 100;
    this.exhausted = false;
    if (this.platforms.length > 0) {
      this.groundPlayerOnSpawnPlatform();
    }
    this.watchAnchorX = this.playerPos.x;
    this.watchAnchorZ = this.playerPos.z;
    resetPlayerRigPose(this.playerRig);
    const shouldShowLocal = this.phase !== 'menu';
    this.playerRig.setVisible(shouldShowLocal);
    this.ensureLocalPlayerVisible();
    this.syncLocalPlayerRigTransform('idle', 0);
    if (this.phase !== 'menu') {
      this.snapPlayCameraImmediate();
    }
    if (playSound) this.sound.playCheckpoint();
  }

  private spawnSplash(pos: THREE.Vector3, count: number, strength = 1): void {
    let spawned = 0;
    const cap = Math.min(this.splashPool.length, this.splashMaxActive);
    const waterY = this.getActiveBounds().waterY + 0.05;
    for (let i = 0; i < cap && spawned < count; i++) {
      const p = this.splashPool[i];
      if (p.life <= 0) {
        p.life = 0.45 + Math.random() * 0.3;
        p.maxLife = p.life;
        p.pos.set(
          pos.x + (Math.random() - 0.5) * 0.6,
          waterY,
          pos.z + (Math.random() - 0.5) * 0.6
        );
        const angle = Math.random() * Math.PI * 2;
        const spd = (1.2 + Math.random() * 2.2) * strength;
        p.vel.set(Math.cos(angle) * spd, (2.4 + Math.random() * 2.8) * strength, Math.sin(angle) * spd);
        spawned++;
      }
    }
    if (spawned > 0) {
      this.splashHasActive = true;
    }
  }

  private cancelScheduledTick(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    if (this.timerId) {
      window.clearTimeout(this.timerId);
      this.timerId = 0;
    }
    if (this.pendingSync) {
      const gl = this.renderer.getContext() as WebGL2RenderingContext | null;
      if (gl && typeof gl.deleteSync === 'function') {
        try {
          gl.deleteSync(this.pendingSync);
        } catch {
          // ignore if context was lost
        }
      }
      this.pendingSync = null;
    }
  }

  private scheduleNextTick(immediate = false): void {
    if (this.disposed) return;
    this.cancelScheduledTick();
    if (this.isSoftwareGl && !immediate) {
      this.afterDraw(() => this.tick());
    } else {
      this.rafId = requestAnimationFrame(() => {
        this.rafId = 0;
        this.tick();
      });
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext | null;
    if (!gl || gl.isContextLost?.() || typeof gl.fenceSync !== 'function') {
      this.timerId = window.setTimeout(() => {
        this.timerId = 0;
        cb();
      }, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (!sync) {
      this.timerId = window.setTimeout(() => {
        this.timerId = 0;
        cb();
      }, 80);
      return;
    }
    this.pendingSync = sync;
    gl.flush();
    const startedAt = performance.now();
    let polls = 0;
    const poll = () => {
      this.timerId = 0;
      if (this.disposed || this.pendingSync !== sync) return;
      if (gl.isContextLost?.()) {
        this.pendingSync = null;
        this.timerId = window.setTimeout(() => {
          this.timerId = 0;
          cb();
        }, 80);
        return;
      }
      polls++;
      const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED && polls < 32 && performance.now() - startedAt < 180) {
        this.timerId = window.setTimeout(poll, 5);
      } else {
        try {
          gl.deleteSync(sync);
        } catch {
          // ignore
        }
        if (this.pendingSync === sync) {
          this.pendingSync = null;
        }
        this.timerId = window.setTimeout(() => {
          this.timerId = 0;
          cb();
        }, 80);
      }
    };
    this.timerId = window.setTimeout(poll, 5);
  }

  private tick(): void {
    if (this.disposed || this.suspended || this.contextLost) return;

    const isStaticPhase =
      this.phase === 'paused' || this.phase === 'gameover' || this.phase === 'victory';

    // When a full-screen modal (Multiplayer Hub, Sector Select, Settings) covers the menu or static screen,
    // pause the 3D render loop completely to eliminate GPU heat, battery drain, and lobby UI stutter.
    if (this.overlayOccluded && (this.phase === 'menu' || isStaticPhase)) {
      return;
    }

    // Static phases (paused / gameover / victory) only need a single render when entered, resized, or settings change.
    if (isStaticPhase) {
      if (!this.needsStaticRender) return;
      this.needsStaticRender = false;
      this.updateVisibilityCulling(true);
      const gl = this.renderer.getContext() as WebGL2RenderingContext | null;
      if (!gl || !gl.isContextLost?.()) {
        this.renderer.render(this.scene, this.camera);
      }
      return;
    }

    const nowMs = performance.now();
    const rawDt = Math.max(0.001, (nowMs - this.lastTimeMs) / 1000);
    this.lastTimeMs = nowMs;

    // Pace lobby backdrop to ~30fps on touch/low-end devices to keep menus cool and silky smooth
    let dt = Math.min(rawDt, 0.05);
    if (this.phase === 'menu' && (this.isTouchDevice || this.isLowEndGpu || this.activeQuality === 'smooth')) {
      this.menuFrameAccum += rawDt;
      if (!this.needsStaticRender && this.menuFrameAccum < 0.032) {
        this.scheduleNextTick(false);
        return;
      }
      dt = Math.min(0.05, Math.max(dt, this.menuFrameAccum));
      this.menuFrameAccum = 0;
    }
    this.needsStaticRender = false;

    this.simTime += dt;
    if (this.phase === 'playing') {
      this.platformTime += dt;
    }
    this.renderFrameIdx++;

    // Zero-GC FPS ring buffer & adaptive quality + DRS scaler (ignore >200ms tab-switch stalls)
    if (rawDt <= 0.2) {
      this.fpsRing[this.fpsRingIdx] = 1 / rawDt;
      this.fpsRingIdx = (this.fpsRingIdx + 1) % this.fpsRing.length;
      if (this.fpsRingCount < this.fpsRing.length) this.fpsRingCount++;
      if (rawDt > 0.042 && this.phase === 'playing') {
        this.slowFrameCount++;
      } else if (this.slowFrameCount > 0) {
        this.slowFrameCount = Math.max(0, this.slowFrameCount - 1);
      }
    }
    if (this.qualityCooldownTimer > 0) {
      this.qualityCooldownTimer = Math.max(0, this.qualityCooldownTimer - dt);
    }

    this.qualityEvalTimer += dt;
    if (this.qualityEvalTimer >= 1.2 && this.fpsRingCount > 0) {
      this.qualityEvalTimer = 0;
      let sum = 0;
      for (let i = 0; i < this.fpsRingCount; i++) sum += this.fpsRing[i];
      const avg = sum / this.fpsRingCount;
      this.currentFps = Math.round(avg);
      if (
        this.settings.quality === 'auto' &&
        !this.isSoftwareGl &&
        this.phase === 'playing' &&
        this.qualityCooldownTimer <= 0
      ) {
        if (avg < 36 || this.slowFrameCount >= 9) {
          if (this.activeQuality !== 'smooth') {
            this.activeQuality = this.activeQuality === 'ultra' ? 'standard' : 'smooth';
            this.autoDowngradeCount++;
            this.qualityCooldownTimer = 6;
            this.slowFrameCount = 0;
            this.highFpsStreak = 0;
            this.applyQualityToRenderer();
          } else if (avg < 30 && this.dynamicResScale > 0.75) {
            // Gentle dynamic resolution scaling fallback on ultra-low-end mobile GPUs
            this.dynamicResScale = Math.max(0.75, Math.round((this.dynamicResScale - 0.1) * 100) / 100);
            this.qualityCooldownTimer = 6;
            this.slowFrameCount = 0;
            this.highFpsStreak = 0;
            this.applyQualityToRenderer();
          }
        } else if (avg > 56) {
          this.highFpsStreak++;
          if (this.highFpsStreak >= 4) {
            if (this.activeQuality === 'smooth' && this.dynamicResScale < 1.0) {
              this.dynamicResScale = Math.min(1.0, Math.round((this.dynamicResScale + 0.1) * 100) / 100);
              this.qualityCooldownTimer = 10;
              this.highFpsStreak = 0;
              this.applyQualityToRenderer();
            } else if (this.activeQuality !== 'ultra' && !(this.isLowEndGpu && this.activeQuality === 'standard')) {
              this.activeQuality = this.activeQuality === 'smooth' ? 'standard' : 'ultra';
              this.qualityCooldownTimer = 14 + Math.min(18, this.autoDowngradeCount * 6);
              this.highFpsStreak = 0;
              this.applyQualityToRenderer();
            } else {
              this.highFpsStreak = 0;
            }
          }
        } else {
          this.highFpsStreak = 0;
        }
      }
    }

    if (this.phase === 'menu') {
      this.updateMenuCamera();
      this.updateMonsters(dt, false);
      this.sound.updateAtmosphere(this.simTime, 30, 'calm', false, false, false);
    } else if (this.phase === 'playing') {
      this.flushPendingLookInput();
      this.levelTimeElapsed += dt;
      if (this.activeWorldMode !== 'open_world') {
        this.levelTimeRemaining -= dt;
      }
      if (this.activeWorldMode !== 'open_world' && this.levelTimeRemaining <= 0) {
        this.levelTimeRemaining = 0;
        this.triggerDeath('timeout', this.monsters[0] || null);
        if ((this.phase as GamePhase) === 'jumpscare') {
          this.updateJumpscare(0);
        }
      } else {
        this.updatePlatforms(dt);
        this.updatePlayer(dt);
        this.updateRemoteCoopPlayers(dt);
        this.updateOpenWorldStreaming(false);
        this.updateCheckpoints(dt);
        this.updateMonsters(dt, true);
        if ((this.phase as GamePhase) === 'playing') {
          this.updatePlayCamera(dt);
          this.checkExit();
          if (this.coopMode && this.activeWorldMode === 'open_world' && this.callbacks.onCoopStateEmit) {
            this.coopEmitTimer += dt;
            if (this.coopEmitTimer >= 0.05) {
              this.coopEmitTimer = 0;
              this.callbacks.onCoopStateEmit({
                x: this.playerPos.x,
                y: this.playerPos.y,
                z: this.playerPos.z,
                yaw: this.playerYaw,
                animState: this.lastAnimState,
                horizSpeed: this.lastHorizSpeed,
                regionId: this.owCurrentRegionId,
                inWater: this.inWater,
              });
            }
          }
        } else if ((this.phase as GamePhase) === 'jumpscare') {
          this.updateJumpscare(0);
        }
      }
    } else if (this.phase === 'jumpscare') {
      this.levelTimeElapsed += dt;
      this.updatePlatforms(dt);
      this.updateRemoteCoopPlayers(dt);
      this.animateSecondaryMonstersDuringEat(dt);
      this.updateJumpscare(dt);
    }

    if (this.phase !== 'jumpscare' && this.horrorVisualActive) {
      this.resetHorrorVisualState();
    }

    // Run environment lighting, fog, dust, shadow-frustum tracking & splash particles
    // AFTER player physics and camera updates so they never lag 1 frame behind jumps/camera motion
    this.updateEnvironmentFX(dt);
    this.updateSplashParticles(dt);

    this.updateVisibilityCulling();
    this.syncAudioListener();
    const gl = this.renderer.getContext() as WebGL2RenderingContext | null;
    if (!gl || !gl.isContextLost?.()) {
      if (
        this.phase === 'jumpscare' &&
        this.horrorComposer &&
        !this.isSoftwareGl &&
        this.activeQuality !== 'smooth'
      ) {
        this.horrorComposer.render();
      } else {
        this.renderer.render(this.scene, this.camera);
      }
    }

    if (this.phase === 'playing' || this.phase === 'jumpscare') {
      this.hudEmitTimer += dt;
      if (this.hudEmitTimer >= 0.08) {
        this.hudEmitTimer = 0;
        this.emitHud();
      }
    }

    this.scheduleNextTick(false);
  }

  private updateEnvironmentFX(dt: number): void {
    // Water wave shader + real-time serpent displacement wake + underwater caustics + normal scroll
    if (this.waterMat?.userData.shader) {
      const sh = this.waterMat.userData.shader;
      sh.uniforms.uTime.value = this.simTime;
      let wakeMonster: RuntimeMonster | null =
        this.phase === 'jumpscare' && this.jumpscareMonster ? this.jumpscareMonster : null;
      if (!wakeMonster) {
        wakeMonster = this.monsters[0] || null;
        const focusPos = this.getCameraFocusPos();
        let bestScore = -Infinity;
        for (let i = 0; i < this.monsters.length; i++) {
          const m = this.monsters[i];
          const dx = focusPos.x - m.pos.x;
          const dz = focusPos.z - m.pos.z;
          const sc = (m.alert === 'chasing' ? 1000000 : 0) - (dx * dx + dz * dz);
          if (sc > bestScore) {
            bestScore = sc;
            wakeMonster = m;
          }
        }
      }
      if (wakeMonster) {
        sh.uniforms.uSerpentHead.value.set(wakeMonster.pos.x, wakeMonster.pos.z);
        sh.uniforms.uSerpentDir.value.set(Math.sin(wakeMonster.yaw), Math.cos(wakeMonster.yaw));
        const targetWake = wakeMonster.alert === 'chasing' ? 1.45 : 0.28;
        sh.uniforms.uSerpentWake.value = THREE.MathUtils.lerp(
          sh.uniforms.uSerpentWake.value,
          targetWake,
          Math.min(1, dt * 12)
        );
      } else {
        sh.uniforms.uSerpentWake.value = 0;
      }
    }
    if (this.uCausticTime) this.uCausticTime.value = this.simTime;
    if (this.uMistTime) this.uMistTime.value = this.simTime;
    if (this.dustPoints?.visible && this.dustMat) {
      this.dustMat.uniforms.uTime.value = this.simTime;
      this.dustMat.uniforms.uCamPos.value.copy(this.camera.position);
    }
    if (this.textures?.waterNormal) {
      this.textures.waterNormal.offset.x = (this.simTime * 0.025) % 1;
      this.textures.waterNormal.offset.y = (this.simTime * 0.018) % 1;
    }

    if (this.activeWorldMode === 'open_world') {
      if (this.waterMesh) {
        const snapWX = Math.round(this.camera.position.x / 85) * 85;
        const snapWZ = Math.round(this.camera.position.z / 85) * 85;
        if (this.waterMesh.position.x !== snapWX || this.waterMesh.position.z !== snapWZ) {
          this.waterMesh.position.x = snapWX;
          this.waterMesh.position.z = snapWZ;
        }
      }
      if (this.owTargetAtmo) {
        const kAtmo = Math.min(1, dt * 1.4);
        this.baseFogColor.lerp(this.owTargetAtmo.fogColor, kAtmo);
        this.underwaterFogColor.lerp(this.owTargetAtmo.underwaterFogColor, kAtmo);
        this.baseFogDensity = THREE.MathUtils.lerp(this.baseFogDensity, this.owTargetAtmo.fogDensity, kAtmo);
        this.baseHemiColor.lerp(this.owTargetAtmo.hemiSky, kAtmo);
        if (this.hemiLight) {
          this.hemiLight.color.copy(this.baseHemiColor);
          this.hemiLight.groundColor.lerp(this.owTargetAtmo.hemiGround, kAtmo);
        }
        if (this.rimLight) {
          this.rimLight.color.lerp(this.owTargetAtmo.rimColor, kAtmo);
        }
        if (this.keyLight) {
          this.keyLight.color.lerp(this.owTargetAtmo.moonColor, kAtmo);
        }
      }
    }

    // Dynamic underwater fog murkiness transition when camera dives below water surface
    if (this.scene.fog instanceof THREE.FogExp2 && this.scene.background instanceof THREE.Color) {
      const underwater = this.camera.position.y < this.getActiveBounds().waterY - 0.04;
      const baseD = this.baseFogDensity ?? this.currentLevel.fogDensity;
      const targetDensity = underwater
        ? Math.min(0.036, baseD * 2.4)
        : baseD;
      const targetColor = underwater ? this.underwaterFogColor : this.baseFogColor;
      const kFog = Math.min(1, dt * 8);
      this.scene.fog.density = THREE.MathUtils.lerp(this.scene.fog.density, targetDensity, kFog);
      this.scene.fog.color.lerp(targetColor, kFog);
      this.scene.background.lerp(targetColor, kFog);
    }

    // Follow active camera focus (local player or devouring serpent) with shadow-casting moonlight
    if (this.keyLight) {
      const focusPos = this.getCameraFocusPos();
      const focusX =
        this.phase === 'jumpscare' && this.jumpscareMonster
          ? this.jumpscareMonster.pos.x
          : focusPos.x;
      const focusZ =
        this.phase === 'jumpscare' && this.jumpscareMonster
          ? this.jumpscareMonster.pos.z
          : focusPos.z;
      const d = Math.max(1, this.keyLight.shadow.camera.right);
      const sMap = Math.max(1, this.keyLight.shadow.mapSize.width);
      const texelSize = (d * 2) / sMap;
      const snapX = Math.round(focusX / texelSize) * texelSize;
      const snapZ = Math.round(focusZ / texelSize) * texelSize;
      this.keyLight.position.set(snapX + 18, 34, snapZ + 14);
      this.keyLight.target.position.set(snapX, 0, snapZ);
    }

    // Assign active pooled PointLights to nearest fixtures/checkpoints/exit around camera (cached across camera motion)
    if (this.pointLightPool.length > 0 && this.levelLights.length > 0) {
      const cx = this.camera.position.x;
      const cz = this.camera.position.z;
      const activeLimit = Math.min(this.pointLightPool.length, this.activePointLightLimit);
      const camMoved =
        Number.isNaN(this._lastLightCamX) ||
        Math.hypot(cx - this._lastLightCamX, cz - this._lastLightCamZ) > 1.2;

      if (camMoved || this._lightPickFrame++ % 4 === 0 || _pickedLights.length !== activeLimit) {
        this._lastLightCamX = cx;
        this._lastLightCamZ = cz;
        _pickedLights.length = 0;
        _pickedLightSet.clear();
        for (let slot = 0; slot < activeLimit; slot++) {
          let bestIdx = -1;
          let bestD2 = Infinity;
          for (let i = 0; i < this.levelLights.length; i++) {
            if (_pickedLightSet.has(i)) continue;
            const l = this.levelLights[i];
            const dx = l.x - cx;
            const dz = l.z - cz;
            const d2 = dx * dx + dz * dz;
            if (d2 < bestD2) {
              bestD2 = d2;
              bestIdx = i;
            }
          }
          if (bestIdx >= 0) {
            _pickedLights.push(bestIdx);
            _pickedLightSet.add(bestIdx);
          }
        }
      }

      for (let slot = 0; slot < this.pointLightPool.length; slot++) {
        const pl = this.pointLightPool[slot];
        if (slot >= activeLimit || slot >= _pickedLights.length) {
          pl.intensity = 0;
          continue;
        }
        const src = this.levelLights[_pickedLights[slot]];
        pl.position.set(src.x, src.y, src.z);
        if (src.checkpointIdx !== undefined) {
          const cp = this.checkpoints[src.checkpointIdx];
          if (cp) pl.color.copy(cp.lightColor);
        } else if (src.checkpointRef) {
          pl.color.copy(src.checkpointRef.lightColor);
        } else {
          pl.color.copy(src.color);
        }
        let intensity = src.baseIntensity;
        if (src.flickering) {
          const wave =
            Math.sin(this.simTime * 17 + src.seed) * 0.5 +
            Math.sin(this.simTime * 43 + src.seed * 2) * 0.5;
          if (wave > 0.72) intensity *= 0.28;
        }
        pl.intensity = intensity;
      }
    }

    // Checkpoint beacon spin (only when visible)
    for (let i = 0; i < this.checkpoints.length; i++) {
      const cp = this.checkpoints[i];
      if (!cp.group.visible) continue;
      cp.ring.rotation.z += dt * 1.4;
      cp.ring.position.y = 0.9 + Math.sin(this.simTime * 2.5) * 0.08;
    }
  }

  private updateSplashParticles(dt: number): void {
    if (!this.splashHasActive && !this.splashMesh.userData.hadActive) return;
    let activeCount = 0;
    const cap = Math.min(this.splashPool.length, this.splashMaxActive);
    for (let i = 0; i < cap; i++) {
      const p = this.splashPool[i];
      if (p.life > 0) {
        p.life -= dt;
        if (p.life > 0) {
          p.vel.y -= 12 * dt;
          p.pos.addScaledVector(p.vel, dt);
          const s = (p.life / p.maxLife) * 0.9;
          _vSplashScale.setScalar(s);
          _mSplash.compose(p.pos, _qIdentity, _vSplashScale);
          this.splashMesh.setMatrixAt(activeCount++, _mSplash);
        }
      }
    }
    this.splashMesh.count = activeCount;
    this.splashHasActive = activeCount > 0;
    if (activeCount > 0 || this.splashMesh.userData.hadActive) {
      this.splashMesh.instanceMatrix.needsUpdate = true;
    }
    this.splashMesh.userData.hadActive = activeCount > 0;
  }

  private updateMenuCamera(): void {
    const t = this.simTime * 0.16;
    const focusZ = Math.max(this.currentLevel.bounds.minZ + 35, -34);
    this.camera.position.set(Math.sin(t) * 9.5, 4.8 + Math.sin(t * 1.5) * 0.5, focusZ + 18 + Math.cos(t) * 6);
    this.camera.lookAt(0, 1.5, focusZ - 14);
  }

  private updatePlatforms(dt: number): void {
    for (let i = 0; i < this.dynamicPlatforms.length; i++) {
      const p = this.dynamicPlatforms[i];
      if (p.def.kind === 'disappearing' && p.state === 'solid' && !p.def.rotationSpeed) {
        continue;
      }
      p.prevPos.copy(p.currentPos);
      if (p.isRotated || p.def.rotationSpeed) {
        p.prevQuat.copy(p.currentQuat);
        p.prevInvQuat.copy(p.invQuat);
      }

      if (p.def.kind === 'moving' && p.def.moveOffset) {
        const speed = p.def.moveSpeed ?? 1.0;
        const phase = p.def.movePhase ?? 0;
        const factor = 0.5 - 0.5 * Math.cos(this.platformTime * speed + phase);
        p.currentPos.set(
          p.def.position[0] + p.def.moveOffset[0] * factor,
          p.def.position[1] + p.def.moveOffset[1] * factor,
          p.def.position[2] + p.def.moveOffset[2] * factor
        );
        p.mesh.position.copy(p.currentPos);
      } else if (p.def.kind === 'disappearing') {
        if (p.state === 'warning') {
          p.stateTimer -= dt;
          const pulse = 0.5 + 0.5 * Math.sin(this.simTime * 14);
          p.material.color.setHex(0xd96b52);
          p.material.emissive.setHex(0xcc3a1e);
          p.material.emissiveIntensity = 0.45 + pulse * 0.85;
          p.mesh.position.copy(p.currentPos);
          if (p.stateTimer <= 0) {
            p.state = 'gone';
            p.stateTimer = p.def.respawnDelay ?? 2.4;
            p.mesh.visible = false;
            p.material.emissive.setHex(0x000000);
            p.material.emissiveIntensity = 0;
          }
        } else if (p.state === 'gone') {
          p.stateTimer -= dt;
          if (p.stateTimer <= 0) {
            p.state = 'solid';
            p.mesh.visible = true;
            p.mesh.position.copy(p.currentPos);
            p.material.color.setHex(p.baseColorHex);
            p.material.emissive.setHex(0x000000);
            p.material.emissiveIntensity = 0;
          }
        }
      }

      if (p.def.rotationSpeed) {
        const axis = p.def.rotationAxis || 'y';
        const spd = p.def.rotationSpeed;
        const phase = p.def.rotationPhase ?? 0;
        const ang = phase + this.platformTime * spd;
        if (axis === 'y') {
          p.mesh.rotation.set(0, ang, 0);
        } else if (axis === 'x') {
          p.mesh.rotation.set(ang, 0, 0);
        } else if (axis === 'z') {
          p.mesh.rotation.set(0, 0, ang);
        } else if (axis === 'xy') {
          p.mesh.rotation.set(phase * 0.7 + this.platformTime * spd * 0.55, ang, 0);
        } else if (axis === 'zy') {
          p.mesh.rotation.set(0, ang, phase * 0.7 + this.platformTime * spd * 0.55);
        }
        p.currentQuat.copy(p.mesh.quaternion);
        p.invQuat.copy(p.currentQuat).invert();
        p.isRotated = true;
      }
    }
  }

  private populateNearbyObstacles(cx: number, cz: number, range: number): void {
    _nearPlatforms.length = 0;
    _nearWalls.length = 0;
    if (this.spatialGrid) {
      this.spatialGrid.queryRadius(cx, cz, range, _nearPlatIdx, _nearWallIdx);
      for (let i = 0; i < _nearPlatIdx.length; i++) {
        const p = this.platforms[_nearPlatIdx[i]];
        if (!p || p.state === 'gone') continue;
        const r = range + p.boundRadiusXZ;
        const dx = p.currentPos.x - cx;
        const dz = p.currentPos.z - cz;
        if (dx * dx + dz * dz <= r * r) {
          _nearPlatforms.push(p);
        }
      }
      for (let i = 0; i < _nearWallIdx.length; i++) {
        const w = this.walls[_nearWallIdx[i]];
        if (!w) continue;
        const r = range + w.boundRadiusXZ;
        const dx = w.centerX - cx;
        const dz = w.centerZ - cz;
        if (dx * dx + dz * dz <= r * r) {
          _nearWalls.push(w);
        }
      }
      return;
    }

    for (let i = 0; i < this.platforms.length; i++) {
      const p = this.platforms[i];
      if (p.state === 'gone') continue;
      const r = range + p.boundRadiusXZ;
      const dx = p.currentPos.x - cx;
      const dz = p.currentPos.z - cz;
      if (dx * dx + dz * dz <= r * r) {
        _nearPlatforms.push(p);
      }
    }
    for (let i = 0; i < this.walls.length; i++) {
      const w = this.walls[i];
      const r = range + w.boundRadiusXZ;
      const dx = w.centerX - cx;
      const dz = w.centerZ - cz;
      if (dx * dx + dz * dz <= r * r) {
        _nearWalls.push(w);
      }
    }
  }

  private isCircleBlocked(
    x: number,
    z: number,
    radius: number,
    botY: number,
    topY: number,
    platList: RuntimePlatform[] = this.platforms,
    wallList: RuntimeWall[] = this.walls
  ): boolean {
    const b = this.getActiveBounds();
    if (x < b.minX + radius || x > b.maxX - radius || z < b.minZ + radius || z > b.maxZ - radius) {
      return true;
    }

    const rSq = radius * radius;
    for (let i = 0; i < wallList.length; i++) {
      const w = wallList[i];
      if (w.maxY <= botY + 0.05 || w.minY >= topY - 0.05) continue;
      const bdx = x - w.centerX;
      const bdz = z - w.centerZ;
      const br = w.boundRadiusXZ + radius;
      if (bdx * bdx + bdz * bdz > br * br) continue;
      const cx = Math.max(w.minX, Math.min(x, w.maxX));
      const cz = Math.max(w.minZ, Math.min(z, w.maxZ));
      const dx = x - cx;
      const dz = z - cz;
      if (dx * dx + dz * dz < rSq) return true;
    }

    for (let i = 0; i < platList.length; i++) {
      const p = platList[i];
      if (p.state === 'gone') continue;
      const bdx = x - p.currentPos.x;
      const bdz = z - p.currentPos.z;
      const br = p.boundRadiusXZ + radius;
      if (bdx * bdx + bdz * bdz > br * br) continue;
      const [pw, ph, pd] = p.def.size;
      const hw = pw * 0.5;
      const hh = ph * 0.5;
      const hd = pd * 0.5;

      if (!p.isRotated || p.def.rotationAxis === 'y') {
        const pBotY = p.currentPos.y - hh;
        const pTopY = p.currentPos.y + hh;
        if (pTopY <= botY + 0.05 || pBotY >= topY - 0.05) continue;

        if (!p.isRotated) {
          const lx = x - p.currentPos.x;
          const lz = z - p.currentPos.z;
          const clx = Math.max(-hw, Math.min(lx, hw));
          const clz = Math.max(-hd, Math.min(lz, hd));
          const dlx = lx - clx;
          const dlz = lz - clz;
          if (dlx * dlx + dlz * dlz < rSq) return true;
        } else {
          _vLocal.set(x - p.currentPos.x, 0, z - p.currentPos.z).applyQuaternion(p.invQuat);
          const clx = Math.max(-hw, Math.min(_vLocal.x, hw));
          const clz = Math.max(-hd, Math.min(_vLocal.z, hd));
          const dlx = _vLocal.x - clx;
          const dlz = _vLocal.z - clz;
          if (dlx * dlx + dlz * dlz < rSq) return true;
        }
      } else {
        const spanY = Math.max(0.1, topY - botY);
        const padY = Math.min(radius * 0.5, spanY * 0.25);
        const yMin = botY + padY;
        const yMax = topY - padY;
        const numSamples = Math.max(3, Math.min(6, Math.ceil((yMax - yMin) / Math.max(0.25, radius * 1.4)) + 1));
        for (let sIdx = 0; sIdx < numSamples; sIdx++) {
          const sy = yMin + ((yMax - yMin) * sIdx) / (numSamples - 1);
          _vLocal.set(x - p.currentPos.x, sy - p.currentPos.y, z - p.currentPos.z).applyQuaternion(p.invQuat);
          const clx = Math.max(-hw, Math.min(_vLocal.x, hw));
          const cly = Math.max(-hh, Math.min(_vLocal.y, hh));
          const clz = Math.max(-hd, Math.min(_vLocal.z, hd));
          const dlx = _vLocal.x - clx;
          const dly = _vLocal.y - cly;
          const dlz = _vLocal.z - clz;
          if (dlx * dlx + dly * dly + dlz * dlz < rSq) return true;
        }
      }
    }

    return false;
  }

  private resolveCircleSolids(
    pos: THREE.Vector3,
    radius: number,
    botY: number,
    topY: number,
    boundsMargin: number,
    includePlatforms: boolean,
    vel?: THREE.Vector3,
    minPlatformTopForSide = -Infinity,
    skipPlatform: RuntimePlatform | null = null,
    platList: RuntimePlatform[] = this.platforms,
    wallList: RuntimeWall[] = this.walls,
    iterations = 2
  ): void {
    const b = this.getActiveBounds();
    const rSq = radius * radius;

    for (let iter = 0; iter < iterations; iter++) {
      // 1. Active platforms (exact circle vs OBB push-out)
      if (includePlatforms) {
        for (let i = 0; i < platList.length; i++) {
          const p = platList[i];
          if (p.state === 'gone' || p === skipPlatform) continue;
          const bdx = pos.x - p.currentPos.x;
          const bdz = pos.z - p.currentPos.z;
          const br = p.boundRadiusXZ + radius;
          if (bdx * bdx + bdz * bdz > br * br) continue;
          const [pw, ph, pd] = p.def.size;
          const hw = pw * 0.5;
          const hh = ph * 0.5;
          const hd = pd * 0.5;

          if (!p.isRotated || p.def.rotationAxis === 'y') {
            const pBotY = p.currentPos.y - hh;
            const pTopY = p.currentPos.y + hh;
            if (pTopY <= botY || pBotY >= topY || pTopY <= minPlatformTopForSide) continue;

            if (!p.isRotated) {
              const lx = pos.x - p.currentPos.x;
              const lz = pos.z - p.currentPos.z;
              const clx = Math.max(-hw, Math.min(lx, hw));
              const clz = Math.max(-hd, Math.min(lz, hd));
              const dlx = lx - clx;
              const dlz = lz - clz;
              const dSq = dlx * dlx + dlz * dlz;

              if (dSq < rSq) {
                let wx = 0;
                let wz = 0;
                if (dSq > 1e-8) {
                  const d = Math.sqrt(dSq);
                  const pen = radius - d;
                  wx = (dlx / d) * pen;
                  wz = (dlz / d) * pen;
                } else {
                  const penX = hw + radius - Math.abs(lx);
                  const penZ = hd + radius - Math.abs(lz);
                  if (penX < penZ) wx = lx >= 0 ? penX : -penX;
                  else wz = lz >= 0 ? penZ : -penZ;
                }

                pos.x += wx;
                pos.z += wz;

                if (vel) {
                  const wLen = Math.hypot(wx, wz);
                  if (wLen > 1e-6) {
                    const nx = wx / wLen;
                    const nz = wz / wLen;
                    const vn = vel.x * nx + vel.z * nz;
                    if (vn < 0) {
                      vel.x -= vn * nx;
                      vel.z -= vn * nz;
                    }
                  }
                }
              }
            } else {
              _vLocal.set(pos.x - p.currentPos.x, 0, pos.z - p.currentPos.z).applyQuaternion(p.invQuat);
              const clx = Math.max(-hw, Math.min(_vLocal.x, hw));
              const clz = Math.max(-hd, Math.min(_vLocal.z, hd));
              const dlx = _vLocal.x - clx;
              const dlz = _vLocal.z - clz;
              const dSq = dlx * dlx + dlz * dlz;

              if (dSq < rSq) {
                let lwx = 0;
                let lwz = 0;
                if (dSq > 1e-8) {
                  const d = Math.sqrt(dSq);
                  const pen = radius - d;
                  lwx = (dlx / d) * pen;
                  lwz = (dlz / d) * pen;
                } else {
                  const penX = hw + radius - Math.abs(_vLocal.x);
                  const penZ = hd + radius - Math.abs(_vLocal.z);
                  if (penX < penZ) lwx = _vLocal.x >= 0 ? penX : -penX;
                  else lwz = _vLocal.z >= 0 ? penZ : -penZ;
                }
                _vLocal.set(lwx, 0, lwz).applyQuaternion(p.currentQuat);
                const wx = _vLocal.x;
                const wz = _vLocal.z;
                pos.x += wx;
                pos.z += wz;

                if (vel) {
                  const wLen = Math.hypot(wx, wz);
                  if (wLen > 1e-6) {
                    const nx = wx / wLen;
                    const nz = wz / wLen;
                    const vn = vel.x * nx + vel.z * nz;
                    if (vn < 0) {
                      vel.x -= vn * nx;
                      vel.z -= vn * nz;
                    }
                  }
                }
              }
            }
          } else {
            // Multi-sphere vertical capsule vs 3D OBB push-out for X/Z/compound rotating platforms
            const effBotY = minPlatformTopForSide > -Infinity ? Math.max(botY, minPlatformTopForSide) : botY;
            if (topY <= effBotY) continue;
            const spanY = topY - effBotY;
            const padY = Math.min(radius * 0.5, spanY * 0.25);
            const yMin = effBotY + padY;
            const yMax = topY - padY;
            const numSamples = Math.max(4, Math.min(6, Math.ceil((yMax - yMin) / Math.max(0.25, radius * 1.4)) + 1));

            let bestDSq = rSq;
            let bestLwx = 0;
            let bestLwy = 0;
            let bestLwz = 0;
            let bestPen = 0;

            for (let sIdx = 0; sIdx < numSamples; sIdx++) {
              const sy = yMin + ((yMax - yMin) * sIdx) / (numSamples - 1);
              _vLocal
                .set(pos.x - p.currentPos.x, sy - p.currentPos.y, pos.z - p.currentPos.z)
                .applyQuaternion(p.invQuat);
              const clx = Math.max(-hw, Math.min(_vLocal.x, hw));
              const cly = Math.max(-hh, Math.min(_vLocal.y, hh));
              const clz = Math.max(-hd, Math.min(_vLocal.z, hd));
              const dlx = _vLocal.x - clx;
              const dly = _vLocal.y - cly;
              const dlz = _vLocal.z - clz;
              const dSq = dlx * dlx + dly * dly + dlz * dlz;
              if (dSq < bestDSq) {
                bestDSq = dSq;
                if (dSq > 1e-8) {
                  const d = Math.sqrt(dSq);
                  const pen = radius - d;
                  bestPen = pen;
                  bestLwx = (dlx / d) * pen;
                  bestLwy = (dly / d) * pen;
                  bestLwz = (dlz / d) * pen;
                } else {
                  const penX = hw + radius - Math.abs(_vLocal.x);
                  const penY = hh + radius - Math.abs(_vLocal.y);
                  const penZ = hd + radius - Math.abs(_vLocal.z);
                  bestLwx = 0;
                  bestLwy = 0;
                  bestLwz = 0;
                  if (penX <= penY && penX <= penZ) {
                    bestPen = penX;
                    bestLwx = _vLocal.x >= 0 ? penX : -penX;
                  } else if (penZ <= penY && penZ <= penX) {
                    bestPen = penZ;
                    bestLwz = _vLocal.z >= 0 ? penZ : -penZ;
                  } else {
                    bestPen = penY;
                    bestLwy = _vLocal.y >= 0 ? penY : -penY;
                  }
                }
              }
            }

            if (bestDSq < rSq) {
              _vLocal.set(bestLwx, bestLwy, bestLwz).applyQuaternion(p.currentQuat);
              const wx = _vLocal.x;
              const wy = _vLocal.y;
              const wz = _vLocal.z;
              pos.x += wx;
              pos.z += wz;
              if (wy < -0.35 * bestPen && vel && vel.y > 0) {
                pos.y += wy;
                vel.y = 0;
              }
              if (vel) {
                const wLen = Math.hypot(wx, wz);
                if (wLen > 1e-6) {
                  const nx = wx / wLen;
                  const nz = wz / wLen;
                  const vn = vel.x * nx + vel.z * nz;
                  if (vn < 0) {
                    vel.x -= vn * nx;
                    vel.z -= vn * nz;
                  }
                }
              }
            }
          }
        }
      }

      // 2. Inner walls & pillars (exact circle vs AABB push-out)
      for (let i = 0; i < wallList.length; i++) {
        const w = wallList[i];
        if (w.maxY <= botY + 0.05 || w.minY >= topY - 0.05) continue;
        const bdx = pos.x - w.centerX;
        const bdz = pos.z - w.centerZ;
        const br = w.boundRadiusXZ + radius;
        if (bdx * bdx + bdz * bdz > br * br) continue;
        const cx = Math.max(w.minX, Math.min(pos.x, w.maxX));
        const cz = Math.max(w.minZ, Math.min(pos.z, w.maxZ));
        const dx = pos.x - cx;
        const dz = pos.z - cz;
        const dSq = dx * dx + dz * dz;

        if (dSq < rSq) {
          let wx = 0;
          let wz = 0;
          if (dSq > 1e-8) {
            const d = Math.sqrt(dSq);
            const pen = radius - d;
            wx = (dx / d) * pen;
            wz = (dz / d) * pen;
          } else {
            const dLeft = pos.x - (w.minX - radius);
            const dRight = w.maxX + radius - pos.x;
            const dFront = pos.z - (w.minZ - radius);
            const dBack = w.maxZ + radius - pos.z;
            const minPen = Math.min(dLeft, dRight, dFront, dBack);
            if (minPen === dLeft) wx = -dLeft;
            else if (minPen === dRight) wx = dRight;
            else if (minPen === dFront) wz = -dFront;
            else wz = dBack;
          }

          pos.x += wx;
          pos.z += wz;

          if (vel) {
            const wLen = Math.hypot(wx, wz);
            if (wLen > 1e-6) {
              const nx = wx / wLen;
              const nz = wz / wLen;
              const vn = vel.x * nx + vel.z * nz;
              if (vn < 0) {
                vel.x -= vn * nx;
                vel.z -= vn * nz;
              }
            }
          }
        }
      }

      // 3. Pool outer bounds
      const minBX = b.minX + boundsMargin;
      const maxBX = b.maxX - boundsMargin;
      const minBZ = b.minZ + boundsMargin;
      const maxBZ = b.maxZ - boundsMargin;
      if (pos.x < minBX) {
        pos.x = minBX;
        if (vel && vel.x < 0) vel.x = 0;
      } else if (pos.x > maxBX) {
        pos.x = maxBX;
        if (vel && vel.x > 0) vel.x = 0;
      }
      if (pos.z < minBZ) {
        pos.z = minBZ;
        if (vel && vel.z < 0) vel.z = 0;
      } else if (pos.z > maxBZ) {
        pos.z = maxBZ;
        if (vel && vel.z > 0) vel.z = 0;
      }
    }
  }

  private hasWallBetweenXZ(
    ax: number,
    az: number,
    bx: number,
    bz: number,
    botY: number,
    topY: number
  ): boolean {
    const dx = bx - ax;
    const dz = bz - az;
    const dist = Math.hypot(dx, dz);
    if (dist <= 0.35) return false;
    const steps = Math.max(1, Math.min(8, Math.ceil(dist / 1.4)));
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      if (
        this.isCircleBlocked(
          ax + dx * t,
          az + dz * t,
          0.28,
          botY,
          topY,
          _emptyPlatforms,
          this.walls
        )
      ) {
        return true;
      }
    }
    return false;
  }

  private isLocalPlayerWatchedBySnake(): boolean {
    if (this.phase !== 'playing') return false;
    // In water, serpents attack immediately with zero freeze/watch standoff
    if (this.inWater) return false;

    for (let i = 0; i < this.monsters.length; i++) {
      const m = this.monsters[i];
      if (m.eatingUserId || m.lookAway) continue;
      if (m.intimidationPhase === 'staring') {
        return true;
      }
      if (m.visionState === 'lunging' && m.watchingUserId === '__local__') {
        return true;
      }
    }
    return false;
  }

  private updatePlayer(dt: number): void {
    const activeBounds = this.getActiveBounds();
    const waterY = activeBounds.waterY;
    const playerRadius = 0.34;
    const playerHeight = 1.75;
    const gravity = 18.5;
    const groundJumpVel = 10.4;
    const waterJumpVel = 10.8;
    const targetSwimY = waterY - 0.45;

    if (this.waterJumpTimer > 0) {
      this.waterJumpTimer = Math.max(0, this.waterJumpTimer - dt);
    }
    if (this.waterJumpCooldown > 0) {
      this.waterJumpCooldown = Math.max(0, this.waterJumpCooldown - dt);
    }

    // Carry player with stood moving or rotating platform before physics step
    if (this.grounded && this.stoodPlatform && this.stoodPlatform.state !== 'gone') {
      const prevCarryX = this.playerPos.x;
      const prevCarryZ = this.playerPos.z;
      if (this.stoodPlatform.isRotated) {
        _vDelta.subVectors(this.playerPos, this.stoodPlatform.prevPos);
        _qTmp.copy(this.stoodPlatform.prevQuat).invert();
        _vDelta.applyQuaternion(_qTmp);
        _vDelta.applyQuaternion(this.stoodPlatform.currentQuat);
        _vDelta.add(this.stoodPlatform.currentPos);
        this.playerPos.copy(_vDelta);
      } else {
        _vDelta.subVectors(this.stoodPlatform.currentPos, this.stoodPlatform.prevPos);
        this.playerPos.add(_vDelta);
      }
      if (this.isWatchedFreezeActive) {
        this.watchAnchorX += this.playerPos.x - prevCarryX;
        this.watchAnchorZ += this.playerPos.z - prevCarryZ;
      }
    }

    // Platform Watch Freeze Check: player moves freely until exiting water onto a platform and a snake arrives & starts watching.
    // During those 5 seconds, player is frozen and any movement triggers an immediate attack.
    const watchedBySnakeNow = this.isLocalPlayerWatchedBySnake();
    if (watchedBySnakeNow && !this.isWatchedFreezeActive) {
      this.isWatchedFreezeActive = true;
      this.watchFreezeGraceTimer = SERPENT_WATCH_FREEZE_GRACE_SEC;
      this.watchMoveAttempted = false;
      this.watchAnchorX = this.playerPos.x;
      this.watchAnchorZ = this.playerPos.z;
      this.playerVel.x = 0;
      this.playerVel.z = 0;
      this.virtualAutoRun = false;
      this.jumpBufferTimer = 0;
    } else if (!watchedBySnakeNow && this.isWatchedFreezeActive) {
      this.isWatchedFreezeActive = false;
      this.watchFreezeGraceTimer = 0;
      this.watchMoveAttempted = false;
    }
    if (this.isWatchedFreezeActive && this.watchFreezeGraceTimer > 0) {
      this.watchFreezeGraceTimer = Math.max(0, this.watchFreezeGraceTimer - dt);
    }

    // 1. Gather movement input
    let inX = this.virtualMove.x;
    let inY = this.virtualMove.y;
    if (this.virtualAutoRun && Math.hypot(inX, inY) <= 0.08) {
      inY = 1;
    }
    if (this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft')) inX -= 1;
    if (this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight')) inX += 1;
    if (this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp')) inY += 1;
    if (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown')) inY -= 1;

    const inLen = Math.hypot(inX, inY);
    if (inLen > 1) {
      inX /= inLen;
      inY /= inLen;
    }

    let wantsRun = false;
    if (this.isWatchedFreezeActive) {
      // Detect any movement/jump input or displacement while frozen under snake watch
      const jumpPressed = this.jumpBufferTimer > 0;
      const dispFromAnchorSq =
        (this.playerPos.x - this.watchAnchorX) * (this.playerPos.x - this.watchAnchorX) +
        (this.playerPos.z - this.watchAnchorZ) * (this.playerPos.z - this.watchAnchorZ);
      if (
        inLen > 0.08 ||
        jumpPressed ||
        this.virtualAutoRun ||
        (this.watchFreezeGraceTimer <= 0 && dispFromAnchorSq > 0.12 * 0.12)
      ) {
        this.watchMoveAttempted = true;
      }
      this.playerVel.x = 0;
      this.playerVel.z = 0;
      this.jumpBufferTimer = 0;
      this.virtualAutoRun = false;
      this.stamina = Math.min(100, this.stamina + 20 * dt);
      if (this.exhausted && this.stamina >= 25) this.exhausted = false;
    } else {
      wantsRun =
        (this.heldKeys.has('ShiftLeft') ||
          this.heldKeys.has('ShiftRight') ||
          this.virtualRun ||
          this.virtualAutoRun) &&
        inLen > 0.1 &&
        !this.inWater &&
        !this.exhausted;

      if (wantsRun) {
        this.stamina = Math.max(0, this.stamina - 28 * dt);
        if (this.stamina <= 0) this.exhausted = true;
      } else {
        this.stamina = Math.min(100, this.stamina + 20 * dt);
        if (this.exhausted && this.stamina >= 25) this.exhausted = false;
      }

      // Camera-relative world movement direction on XZ
      _vForward.set(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw));
      _vRight.set(Math.cos(this.camYaw), 0, -Math.sin(this.camYaw));
      _vMove.set(0, 0, 0).addScaledVector(_vRight, inX).addScaledVector(_vForward, inY);
      const moveMag = Math.min(1, _vMove.length());
      if (moveMag > 0.001) _vMove.normalize();

      const maxSpeed = this.inWater ? 3.8 : wantsRun ? 8.8 : 5.7;
      const accel = this.grounded ? 36 : this.inWater ? 18 : 22;

      const targetVx = _vMove.x * maxSpeed * moveMag;
      const targetVz = _vMove.z * maxSpeed * moveMag;
      this.playerVel.x = THREE.MathUtils.lerp(this.playerVel.x, targetVx, Math.min(1, accel * dt));
      this.playerVel.z = THREE.MathUtils.lerp(this.playerVel.z, targetVz, Math.min(1, accel * dt));

      // Face character accurately toward movement direction (never walk backwards)
      if (moveMag > 0.08) {
        const targetYaw = Math.atan2(_vMove.x, _vMove.z);
        const diff = shortestAngleDiff(this.playerYaw, targetYaw);
        this.playerYaw += diff * Math.min(1, 16 * dt);
      }

      // 2. Coyote time + Jump buffer (normal platform jumping unchanged; 2s cooldown applies ONLY to water jumps)
      if (this.grounded) this.coyoteTimer = 0.16;
      else this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);

      if (this.jumpBufferTimer > 0) this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);

      const canGroundJump = this.coyoteTimer > 0;
      const canWaterJump = this.inWater && this.waterJumpCooldown <= 0;

      if (this.jumpBufferTimer > 0 && (canGroundJump || canWaterJump)) {
        const jumpedFromWater = !canGroundJump && canWaterJump;
        this.playerVel.y = jumpedFromWater ? waterJumpVel : groundJumpVel;
        if (jumpedFromWater) {
          this.waterJumpTimer = 0.38;
          this.waterJumpCooldown = 2.0;
          this.inWater = false;
        } else {
          this.waterJumpCooldown = 0;
        }
        this.grounded = false;
        this.stoodPlatform = null;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        this.sound.playJump();
        if (jumpedFromWater) {
          this.spawnSplash(this.playerPos, 8, 0.9);
        }
      }
    }

    // 3. 4-Substep anti-tunneling integration + single spatial-grid query covering frame displacement
    this.populateNearbyObstacles(
      this.playerPos.x,
      this.playerPos.z,
      6.5 + Math.hypot(this.playerVel.x, this.playerVel.z) * dt
    );
    const startGrounded = this.grounded;
    const startY = this.playerPos.y;
    const subSteps = 4;
    const subDt = dt / subSteps;

    let finalGrounded = false;
    let finalStood: RuntimePlatform | null = null;

    for (let step = 0; step < subSteps; step++) {
      const prevFeetY = this.playerPos.y;
      _vPrevFeet.copy(this.playerPos);

      // Gravity / Water Buoyancy (never let buoyancy damp an active water jump!)
      if (this.inWater && this.waterJumpTimer <= 0) {
        const depthDiff = targetSwimY - this.playerPos.y;
        this.playerVel.y += (depthDiff * 14 - this.playerVel.y * 4.5) * subDt;
      } else {
        this.playerVel.y -= gravity * subDt;
      }

      this.playerPos.x += this.playerVel.x * subDt;
      this.playerPos.y += this.playerVel.y * subDt;
      this.playerPos.z += this.playerVel.z * subDt;

      let bestTopY = -Infinity;
      let bestPlat: RuntimePlatform | null = null;
      let bestIsTilted = false;
      const landMargin = playerRadius * 1.08;

      for (let i = 0; i < _nearPlatforms.length; i++) {
        const p = _nearPlatforms[i];
        if (p.state === 'gone') continue;
        const bdx = this.playerPos.x - p.currentPos.x;
        const bdz = this.playerPos.z - p.currentPos.z;
        const br = p.boundRadiusXZ + landMargin;
        if (bdx * bdx + bdz * bdz > br * br) continue;

        const [pw, ph, pd] = p.def.size;
        const hw = pw * 0.5;
        const hh = ph * 0.5;
        const hd = pd * 0.5;

        if (!p.isRotated || p.def.rotationAxis === 'y') {
          const topY = p.currentPos.y + hh;
          const prevTopY = p.prevPos.y + hh;
          let lx: number;
          let lz: number;

          if (!p.isRotated) {
            lx = this.playerPos.x - p.currentPos.x;
            lz = this.playerPos.z - p.currentPos.z;
          } else {
            _vLocal.set(this.playerPos.x - p.currentPos.x, 0, this.playerPos.z - p.currentPos.z).applyQuaternion(p.invQuat);
            lx = _vLocal.x;
            lz = _vLocal.z;
          }

          if (Math.abs(lx) <= hw + landMargin && Math.abs(lz) <= hd + landMargin) {
            const minPrevTop = Math.min(prevTopY, topY);
            const fallingLand =
              this.playerVel.y <= 0.6 &&
              prevFeetY >= minPrevTop - 0.36 &&
              this.playerPos.y <= topY + 0.16;
            const stepUp =
              startGrounded &&
              this.playerVel.y <= 1.2 &&
              topY >= this.playerPos.y &&
              topY - this.playerPos.y <= 0.34 &&
              prevFeetY >= topY - 0.34;

            if ((fallingLand || stepUp) && topY > bestTopY) {
              bestTopY = topY;
              bestPlat = p;
              bestIsTilted = false;
            }
          }
        } else {
          // 3D rotated OBB landing (X, Z, XY, ZY axes): evaluate all upward-facing axes smoothly
          _vAxisX.set(1, 0, 0).applyQuaternion(p.currentQuat);
          _vAxisY.set(0, 1, 0).applyQuaternion(p.currentQuat);
          _vAxisZ.set(0, 0, 1).applyQuaternion(p.currentQuat);

          _vLocal.subVectors(this.playerPos, p.currentPos).applyQuaternion(p.invQuat);
          if (step === 0 && p !== this.stoodPlatform) {
            _vLocalPrev.subVectors(_vPrevFeet, p.prevPos).applyQuaternion(p.prevInvQuat);
          } else {
            _vLocalPrev.subVectors(_vPrevFeet, p.currentPos).applyQuaternion(p.invQuat);
          }

          const wasGroundedOnP = startGrounded && this.stoodPlatform === p;
          for (let axisIdx = 0; axisIdx < 3; axisIdx++) {
            const axisVec = axisIdx === 0 ? _vAxisX : axisIdx === 1 ? _vAxisY : _vAxisZ;
            const normalY = Math.abs(axisVec.y);
            if (normalY < 0.52) continue;

            const sign = axisVec.y >= 0 ? 1 : -1;
            _vCandNormal.copy(axisVec).multiplyScalar(sign);

            const faceHalf = axisIdx === 0 ? hw : axisIdx === 1 ? hh : hd;
            const e1 = axisIdx === 0 ? hh : hw;
            const e2 = axisIdx === 2 ? hh : hd;
            const t1 = axisIdx === 0 ? _vLocal.y : _vLocal.x;
            const t2 = axisIdx === 2 ? _vLocal.y : _vLocal.z;
            if (Math.abs(t1) > e1 + landMargin || Math.abs(t2) > e2 + landMargin) continue;

            const sCurr = (axisIdx === 0 ? _vLocal.x : axisIdx === 1 ? _vLocal.y : _vLocal.z) * sign;
            const sPrev = (axisIdx === 0 ? _vLocalPrev.x : axisIdx === 1 ? _vLocalPrev.y : _vLocalPrev.z) * sign;

            const normalVel = this.playerVel.dot(_vCandNormal);
            const stayGrounded =
              wasGroundedOnP &&
              this.playerVel.y <= 1.2 &&
              sCurr >= faceHalf - 0.50 &&
              sCurr <= faceHalf + 0.42;
            const fallingLand =
              normalVel <= 0.85 &&
              sPrev >= faceHalf - 0.42 &&
              sCurr <= faceHalf + 0.24;
            const stepUp =
              startGrounded &&
              this.playerVel.y <= 1.2 &&
              sCurr >= faceHalf - 0.36 &&
              sCurr <= faceHalf + 0.26;

            if (stayGrounded || fallingLand || stepUp) {
              const fcX = p.currentPos.x + _vCandNormal.x * faceHalf;
              const fcY = p.currentPos.y + _vCandNormal.y * faceHalf;
              const fcZ = p.currentPos.z + _vCandNormal.z * faceHalf;
              const surfY =
                fcY -
                ((this.playerPos.x - fcX) * _vCandNormal.x + (this.playerPos.z - fcZ) * _vCandNormal.z) /
                  _vCandNormal.y;
              if (surfY > bestTopY) {
                bestTopY = surfY;
                bestPlat = p;
                bestIsTilted = true;
                _vBestNormal.copy(_vCandNormal);
              }
            }
          }
        }
      }

      if (bestPlat) {
        this.playerPos.y = bestTopY;
        this.playerVel.y = 0;
        if (bestIsTilted && _vBestNormal.y < 0.80) {
          const slopeLen = Math.hypot(_vBestNormal.x, _vBestNormal.z);
          if (slopeLen > 1e-4) {
            const slideAccel = (0.80 - _vBestNormal.y) * 9.0;
            this.playerVel.x += (_vBestNormal.x / slopeLen) * slideAccel * subDt;
            this.playerVel.z += (_vBestNormal.z / slopeLen) * slideAccel * subDt;
          }
        }
        finalGrounded = true;
        finalStood = bestPlat;

        if (bestPlat.def.kind === 'disappearing' && bestPlat.state === 'solid') {
          bestPlat.state = 'warning';
          bestPlat.stateTimer = bestPlat.def.collapseDelay ?? 0.85;
          this.sound.playPlatformWarn();
        }
      } else {
        finalGrounded = false;
        finalStood = null;
      }

      // 4B. Underside head-bonk against nearby platforms & overhead walls when jumping upward
      if (!finalGrounded && this.playerVel.y > 0) {
        const headMargin = playerRadius * 0.65;
        const prevHeadY = prevFeetY + playerHeight;
        const currHeadY = this.playerPos.y + playerHeight;

        for (let i = 0; i < _nearPlatforms.length; i++) {
          const p = _nearPlatforms[i];
          if (p.state === 'gone') continue;
          const bdx = this.playerPos.x - p.currentPos.x;
          const bdz = this.playerPos.z - p.currentPos.z;
          const br = p.boundRadiusXZ + headMargin;
          if (bdx * bdx + bdz * bdz > br * br) continue;

          const [pw, ph, pd] = p.def.size;
          const botY = p.currentPos.y - ph * 0.5;
          if (!p.isRotated || p.def.rotationAxis === 'y') {
            if (prevHeadY <= botY + 0.28 && currHeadY >= botY) {
              let lx: number;
              let lz: number;
              if (!p.isRotated) {
                lx = this.playerPos.x - p.currentPos.x;
                lz = this.playerPos.z - p.currentPos.z;
              } else {
                _vLocal.set(this.playerPos.x - p.currentPos.x, 0, this.playerPos.z - p.currentPos.z).applyQuaternion(p.invQuat);
                lx = _vLocal.x;
                lz = _vLocal.z;
              }
              if (Math.abs(lx) < pw * 0.5 + headMargin && Math.abs(lz) < pd * 0.5 + headMargin) {
                this.playerPos.y = botY - playerHeight;
                this.playerVel.y = 0;
                break;
              }
            }
          }
        }

        for (let i = 0; i < _nearWalls.length; i++) {
          const w = _nearWalls[i];
          if (prevHeadY <= w.minY + 0.28 && this.playerPos.y + playerHeight >= w.minY) {
            if (
              this.playerPos.x > w.minX - headMargin &&
              this.playerPos.x < w.maxX + headMargin &&
              this.playerPos.z > w.minZ - headMargin &&
              this.playerPos.z < w.maxZ + headMargin
            ) {
              this.playerPos.y = w.minY - playerHeight;
              this.playerVel.y = 0;
              break;
            }
          }
        }
      }

      // 5. Horizontal side collision against elevated platform edges, inner walls & pool bounds
      this.resolveCircleSolids(
        this.playerPos,
        playerRadius,
        this.playerPos.y + 0.08,
        this.playerPos.y + playerHeight - 0.08,
        0.55,
        true,
        this.playerVel,
        this.playerPos.y + 0.34,
        finalStood && finalStood.isRotated && finalStood.def.rotationAxis !== 'y' ? finalStood : null,
        _nearPlatforms,
        _nearWalls
      );

      // 6. Pool floor clamp
      if (this.playerPos.y < activeBounds.floorY) {
        this.playerPos.y = activeBounds.floorY;
        this.playerVel.y = Math.max(0, this.playerVel.y);
      }
    }

    this.grounded = finalGrounded;
    this.stoodPlatform = finalStood;

    if (this.grounded) {
      this.waterJumpCooldown = 0;
    }

    if (this.grounded && !startGrounded && startY - this.playerPos.y > 0.12) {
      this.sound.playLand(false);
    }

    // 7. Water entry/exit state, climb-out trigger & audio
    this.wasInWater = this.inWater;
    this.inWater =
      !this.grounded &&
      this.playerPos.y < waterY - 0.05 &&
      (this.waterJumpTimer <= 0 || this.playerVel.y <= 0.1);
    if (this.inWater) {
      this.pendingClimbIntimidation = false;
      if (!this.playerInWaterSession) {
        this.playerInWaterSession = true;
        this.playerWaterEpoch++;
      }
      if (!this.wasInWater) {
        this.sound.playLand(true);
        this.spawnSplash(this.playerPos, 14, 1.3);
        this.camShake = Math.max(this.camShake, 0.25);
      }
    } else if (!this.grounded && this.playerPos.y < waterY - 0.05) {
      // Mid water-jump arc while still below surface: retain active water session so snake keeps chasing
      this.pendingClimbIntimidation = false;
      if (!this.playerInWaterSession) {
        this.playerInWaterSession = true;
        this.playerWaterEpoch++;
      }
    } else if (
      this.playerInWaterSession &&
      this.grounded &&
      this.stoodPlatform !== null &&
      this.playerPos.y >= waterY - 0.15
    ) {
      this.playerInWaterSession = false;
      this.pendingClimbIntimidation = true;
    }

    // 8. Footstep / Swim audio & Rig Animation
    const horizSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
    let animState: PlayerAnimState = 'idle';
    if (this.inWater) {
      animState = 'swim';
      if (horizSpeed > 0.6) {
        this.swimSplashTimer -= dt;
        if (this.swimSplashTimer <= 0) {
          this.swimSplashTimer = 0.42;
          this.sound.playSplash(0.2);
          this.spawnSplash(this.playerPos, 4, 0.6);
        }
      }
    } else if (!this.grounded) {
      animState = this.playerVel.y > 0.5 ? 'jump' : 'fall';
    } else if (horizSpeed > 0.45) {
      animState = wantsRun && horizSpeed > 6.2 ? 'run' : 'walk';
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.stepTimer = animState === 'run' ? 0.28 : 0.42;
        this.sound.playStep(animState === 'run');
      }
    }

    this.lastAnimState = animState;
    this.lastHorizSpeed = horizSpeed;
    this.ensureLocalPlayerVisible();
    this.playerRig.root.position.copy(this.playerPos);
    this.playerRig.root.rotation.set(0, this.playerYaw, 0);
    animatePlayerRig(this.playerRig, animState, horizSpeed, this.simTime, dt);
  }

  private getCameraFocusPos(): THREE.Vector3 {
    return this.playerPos;
  }

  private stepMonsterEating(m: RuntimeMonster, dt: number, playAudio: boolean): void {
    const b = this.getActiveBounds();
    const waterY = b.waterY;
    m.eatingTimer += dt;
    const localProgress = THREE.MathUtils.clamp(m.eatingTimer / EAT_DURATION_SEC, 0, 1);
    const eatU = Math.max(m.eatingProgress, localProgress);
    m.eatingProgress = eatU;

    if (eatU < 0.62) {
      m.wakeSplashTimer -= dt;
      if (m.wakeSplashTimer <= 0) {
        m.wakeSplashTimer = 0.06;
        this.spawnSplash(m.pos, 7, 1.4);
      }
    }

    m.pos.y += (waterY - 0.14 - m.pos.y) * Math.min(1, 18 * Math.max(0.016, dt));
    m.rig.root.position.copy(m.pos);
    m.rig.root.rotation.y = 0;

    animateMonsterRig(
      m.rig,
      'chasing',
      m.eatingPreyStartPos,
      m.pos,
      m.yaw,
      waterY,
      this.simTime,
      dt,
      1,
      eatU,
      null,
      b.floorY,
      true,
      b.ceilingY
    );

    // Serpent is stationary horizontally while devouring; run spine obstacle push on initial frames & every 3rd frame
    if (eatU < 0.04 || this.renderFrameIdx % 3 === 0) {
      const segBoundDist = m.scale * 22 + 2;
      const nearBounds =
        m.pos.x - b.minX < segBoundDist ||
        b.maxX - m.pos.x < segBoundDist ||
        m.pos.z - b.minZ < segBoundDist ||
        b.maxZ - m.pos.z < segBoundDist;
      this.populateNearbyObstacles(m.pos.x, m.pos.z, m.scale * 20 + 4);
      if (_nearPlatforms.length > 0 || _nearWalls.length > 0 || nearBounds) {
        for (let sIdx = 1; sIdx < m.rig.segments.length; sIdx++) {
          const seg = m.rig.segments[sIdx];
          const segR = Math.max(0.24, seg.radius * 0.85);
          const origX = m.pos.x + seg.group.position.x;
          const origZ = m.pos.z + seg.group.position.z;
          const origY = m.pos.y + seg.group.position.y;
          _vSegWorld.set(origX, origY, origZ);
          this.resolveCircleSolids(
            _vSegWorld,
            segR,
            origY - segR * 0.9,
            origY + segR * 0.9,
            segR + 0.1,
            true,
            undefined,
            -Infinity,
            null,
            _nearPlatforms,
            _nearWalls,
            1
          );
          const pushDx = _vSegWorld.x - origX;
          const pushDz = _vSegWorld.z - origZ;
          if (pushDx * pushDx + pushDz * pushDz > 1e-6) {
            seg.group.position.x = _vSegWorld.x - m.pos.x;
            seg.group.position.z = _vSegWorld.z - m.pos.z;
            seg.worldPos.x += pushDx * 0.35;
            seg.worldPos.z += pushDz * 0.35;
          }
        }
      }
    }
    syncSerpentBones(m.rig, m.yaw);
    m.rig.root.updateMatrixWorld(true);
    m.rig.headGroup.getWorldPosition(_vEatHeadPos);

    if (playAudio && m.eatingUserId) {
      const attackKey = `${m.id}:${m.eatingUserId}`;
      const underwater = this.camera.position.y < waterY || _vEatHeadPos.y < waterY - 0.15;
      const viewerPos = this.getCameraFocusPos();
      const distToViewer = Math.hypot(viewerPos.x - m.pos.x, viewerPos.z - m.pos.z);
      const isLocalVictim = true;
      const vol = 1.0;
      const remainingSwallowSec = Math.max(0, (0.985 - eatU) * EAT_DURATION_SEC);

      if (!m.eatingSwallowAudioPlayed && eatU >= 0.24 && eatU < 0.94 && remainingSwallowSec > 0.16) {
        m.eatingSwallowAudioPlayed = true;
        const swallowOffsetSec = Math.max(0, (eatU - 0.24) * EAT_DURATION_SEC);
        this.sound.playSnakeSwallowingAudio(
          attackKey,
          _vEatHeadPos.x,
          _vEatHeadPos.y,
          _vEatHeadPos.z,
          remainingSwallowSec,
          swallowOffsetSec,
          isLocalVictim
        );
      }

      if (eatU >= 0.38 && m.eatingGulpStage < 1) {
        m.eatingGulpStage = 1;
        this.sound.playSwallowGulp(
          1,
          vol,
          attackKey,
          _vEatHeadPos.x,
          _vEatHeadPos.y,
          _vEatHeadPos.z,
          isLocalVictim
        );
        if (isLocalVictim) this.camShake = Math.max(this.camShake, 0.22);
      } else if (eatU >= 0.66 && m.eatingGulpStage < 2) {
        m.eatingGulpStage = 2;
        const gulpOffsetSec = Math.max(0, (eatU - 0.66) * EAT_DURATION_SEC);
        this.sound.playSnakeFinalGulpAudio(
          attackKey,
          _vEatHeadPos.x,
          _vEatHeadPos.y,
          _vEatHeadPos.z,
          Math.max(0.16, remainingSwallowSec),
          gulpOffsetSec,
          isLocalVictim
        );
        this.sound.playSwallowGulp(
          2,
          vol,
          attackKey,
          _vEatHeadPos.x,
          _vEatHeadPos.y,
          _vEatHeadPos.z,
          isLocalVictim
        );
        if (isLocalVictim) this.camShake = Math.max(this.camShake, 0.18);
      }

      this.sound.updateEatingScreamPosition(
        attackKey,
        _vEatHeadPos.x,
        _vEatHeadPos.y,
        _vEatHeadPos.z,
        underwater
      );
      this.sound.updateSnakeEatingAudioPosition(
        attackKey,
        _vEatHeadPos.x,
        _vEatHeadPos.y,
        _vEatHeadPos.z,
        underwater
      );
    }

    // Attach victim rig cleanly inside serpent's jaws until swallowing completes
    if (m.eatingUserId) {
      if (eatU < 0.995) {
        this.playerRig.setVisible(true);
        attachPreyToSerpentMouth(
          m.rig,
          this.playerRig,
          eatU,
          this.simTime,
          dt,
          m.eatingPreyStartPos,
          m.eatingPreyStartYaw,
          true,
          b.ceilingY
        );
      }
    }
  }

  private syncAllMonstersSwimmingAudio(active: boolean, skipMonster: RuntimeMonster | null = null): void {
    const waterY = this.getActiveBounds().waterY;
    const listenerUnderwater = this.camera.position.y < waterY;
    const camX = this.camera.position.x;
    const camY = this.camera.position.y;
    const camZ = this.camera.position.z;
    _activeSwimIds.clear();

    for (let i = 0; i < this.monsters.length; i++) {
      const m = this.monsters[i];
      _activeSwimIds.add(m.id);

      const isEating = Boolean(m.eatingUserId) || m === skipMonster;
      if (m.rig.root.visible) {
        _vSwimHeadPos.set(
          m.pos.x + m.rig.headAssembly.position.x,
          m.pos.y + m.rig.headAssembly.position.y + 0.1 * m.scale,
          m.pos.z + m.rig.headAssembly.position.z
        );
      } else {
        _vSwimHeadPos.set(m.pos.x, waterY + 0.12 * m.scale, m.pos.z);
      }

      const distToListener = Math.hypot(
        _vSwimHeadPos.x - camX,
        _vSwimHeadPos.y - camY,
        _vSwimHeadPos.z - camZ
      );
      const velSpeed = Math.hypot(m.velX, m.velZ);
      const speed = m.rig.hasPrevFrame && m.rig.root.visible ? m.rig.smoothedSpeed : velSpeed;

      _swimAudioScratch.worldX = _vSwimHeadPos.x;
      _swimAudioScratch.worldY = _vSwimHeadPos.y;
      _swimAudioScratch.worldZ = _vSwimHeadPos.z;
      _swimAudioScratch.waterY = waterY;
      _swimAudioScratch.speed = speed;
      _swimAudioScratch.swimPhase = m.rig.swimPhase;
      _swimAudioScratch.distToListener = distToListener;
      _swimAudioScratch.isChasing = m.alert === 'chasing';
      _swimAudioScratch.isEating = isEating;
      _swimAudioScratch.isSwimming = active && !isEating && m.pos.y <= waterY + 0.35;
      _swimAudioScratch.listenerUnderwater = listenerUnderwater;
      _swimAudioScratch.scale = m.scale;
      this.sound.updateSnakeSwimmingAudio(m.id, _swimAudioScratch);
    }

    this.sound.pruneSnakeSwimmingAudio(_activeSwimIds, 0.1);
  }

  private updateCheckpoints(dt: number): void {
    if (this.checkpointNoticeTimer > 0) {
      this.checkpointNoticeTimer -= dt;
      if (this.checkpointNoticeTimer <= 0) {
        this.checkpointNotice = null;
      }
    }

    if (this.activeWorldMode === 'open_world') {
      for (let i = 0; i < this.checkpoints.length; i++) {
        const cp = this.checkpoints[i];
        const meta = this.owCheckpointMeta.get(cp);
        if (!meta) continue;
        const dist = Math.hypot(
          this.playerPos.x - cp.group.position.x,
          this.playerPos.z - cp.group.position.z
        );
        const yDiff = Math.abs(this.playerPos.y - cp.group.position.y);
        if (dist < 2.4 && yDiff < 2.6) {
          const isNew = !this.owActivatedCheckpointIds.has(meta.id);
          if (isNew || meta.id !== this.owCheckpointId) {
            cp.activated = true;
            cp.beaconMat.color.setHex(0x4ef2b8);
            cp.beaconMat.emissive.setHex(0x28d196);
            cp.lightColor.setHex(0x4ef2b8);
            this.owCheckpointId = meta.id;
            this.owCheckpointRegionId = meta.regionId;
            this.owCheckpointLabel = meta.label;
            this.owCheckpointYaw = meta.yaw;
            this.owActivatedCheckpointIds.add(meta.id);
            this.activeSpawn.set(cp.group.position.x, cp.group.position.y + 0.5, cp.group.position.z);
            this.activeCheckpointIndex = this.owActivatedCheckpointIds.size;
            this.checkpointNotice = meta.label.toUpperCase();
            this.checkpointNoticeTimer = 2.6;
            this.sound.playCheckpoint();
            this.callbacks.onOpenWorldCheckpoint?.(
              meta.id,
              meta.regionId,
              meta.label,
              cp.group.position.x,
              cp.group.position.y + 0.5,
              cp.group.position.z
            );
            this.emitHud(true);
          }
        }
      }
      return;
    }

    for (let i = 0; i < this.checkpoints.length; i++) {
      const cp = this.checkpoints[i];
      if (!cp.activated) {
        const dist = Math.hypot(
          this.playerPos.x - cp.group.position.x,
          this.playerPos.z - cp.group.position.z
        );
        const yDiff = Math.abs(this.playerPos.y - cp.group.position.y);
        if (dist < 2.2 && yDiff < 2.5) {
          cp.activated = true;
          cp.beaconMat.color.setHex(0x4ef2b8);
          cp.beaconMat.emissive.setHex(0x28d196);
          cp.lightColor.setHex(0x4ef2b8);
          this.activeSpawn.set(cp.group.position.x, cp.group.position.y + 0.5, cp.group.position.z);
          this.activeCheckpointIndex = i + 1;
          this.checkpointNotice = `CHECKPOINT ${i + 1} REACHED`;
          this.checkpointNoticeTimer = 2.6;
          this.sound.playCheckpoint();
          this.emitHud(true);
        }
      }
    }
  }

  private computePlatformEdgeSpot(
    plat: RuntimePlatform,
    m: RuntimeMonster,
    monsterRadius: number,
    monsterBotY: number,
    monsterTopY: number,
    checkMonsterBlocked: (x: number, z: number, r: number) => boolean
  ): void {
    const waterY = this.getActiveBounds().waterY;
    const [pw, , pd] = plat.def.size;
    const hw = pw * 0.5;
    const hd = pd * 0.5;
    const clearance = monsterRadius + 0.62 * m.scale;

    _vLocal.set(m.pos.x - plat.currentPos.x, 0, m.pos.z - plat.currentPos.z);
    if (plat.isRotated) _vLocal.applyQuaternion(plat.invQuat);
    const mlx = _vLocal.x;
    const mlz = _vLocal.z;

    _vLocal.set(this.playerPos.x - plat.currentPos.x, 0, this.playerPos.z - plat.currentPos.z);
    if (plat.isRotated) _vLocal.applyQuaternion(plat.invQuat);
    const plx = THREE.MathUtils.clamp(_vLocal.x, -hw * 0.82, hw * 0.82);
    const plz = THREE.MathUtils.clamp(_vLocal.z, -hd * 0.82, hd * 0.82);

    _edgeCandX[0] = plx; _edgeCandZ[0] = -hd - clearance;
    _edgeCandX[1] = plx; _edgeCandZ[1] = hd + clearance;
    _edgeCandX[2] = -hw - clearance; _edgeCandZ[2] = plz;
    _edgeCandX[3] = hw + clearance; _edgeCandZ[3] = plz;
    _edgeCandX[4] = 0; _edgeCandZ[4] = -hd - clearance;
    _edgeCandX[5] = 0; _edgeCandZ[5] = hd + clearance;
    _edgeCandX[6] = -hw - clearance; _edgeCandZ[6] = 0;
    _edgeCandX[7] = hw + clearance; _edgeCandZ[7] = 0;
    _edgeCandX[8] = mlx >= 0 ? hw + clearance : -hw - clearance;
    _edgeCandZ[8] = mlz >= 0 ? hd + clearance : -hd - clearance;

    let bestScore = Infinity;
    let bestLx = 0;
    let bestLz = -hd - clearance;
    let bestWx = m.pos.x;
    let bestWz = m.pos.z;
    let foundClear = false;

    for (let c = 0; c < 9; c++) {
      const lx = _edgeCandX[c];
      const lz = _edgeCandZ[c];
      _vLocal.set(lx, 0, lz);
      if (plat.isRotated) _vLocal.applyQuaternion(plat.currentQuat);
      const wx = plat.currentPos.x + _vLocal.x;
      const wz = plat.currentPos.z + _vLocal.z;
      if (checkMonsterBlocked(wx, wz, monsterRadius * 0.92)) continue;
      if (this.isCircleBlocked(wx, wz, monsterRadius * 0.88, monsterBotY, monsterTopY, _nearPlatforms, _nearWalls)) {
        continue;
      }
      const dMon = Math.hypot(wx - m.pos.x, wz - m.pos.z);
      const dPly = Math.hypot(wx - this.playerPos.x, wz - this.playerPos.z);
      const score = dMon * 0.55 + dPly;
      if (score < bestScore) {
        bestScore = score;
        bestLx = lx;
        bestLz = lz;
        bestWx = wx;
        bestWz = wz;
        foundClear = true;
      }
    }

    if (!foundClear) {
      const dirX = m.pos.x - plat.currentPos.x;
      const dirZ = m.pos.z - plat.currentPos.z;
      const dLen = Math.hypot(dirX, dirZ) || 1;
      const fallbackDist = Math.max(hw, hd) + clearance;
      bestWx = plat.currentPos.x + (dirX / dLen) * fallbackDist;
      bestWz = plat.currentPos.z + (dirZ / dLen) * fallbackDist;
      _vLocal.set(bestWx - plat.currentPos.x, 0, bestWz - plat.currentPos.z);
      if (plat.isRotated) _vLocal.applyQuaternion(plat.invQuat);
      bestLx = _vLocal.x;
      bestLz = _vLocal.z;
    }

    m.intimidationPlatform = plat;
    m.intimidationLocalOffset.set(bestLx, 0, bestLz);
    m.intimidationSpot.set(bestWx, waterY - 0.14, bestWz);
  }

  private pickIntimidationYaw(
    m: RuntimeMonster,
    monsterRadius: number,
    checkMonsterBlocked: (x: number, z: number, r: number) => boolean
  ): number {
    const toPlayerYaw = Math.atan2(this.playerPos.x - m.pos.x, this.playerPos.z - m.pos.z);
    // Offset ~40 deg beside platform edge so head first rises toward sky, then turns toward player
    const candA = toPlayerYaw + 0.7;
    const candB = toPlayerYaw - 0.7;
    const checkTailClear = (yaw: number): boolean => {
      const bx = -Math.sin(yaw);
      const bz = -Math.cos(yaw);
      return (
        !checkMonsterBlocked(m.pos.x + bx * 4.0 * m.scale, m.pos.z + bz * 4.0 * m.scale, monsterRadius * 0.75) &&
        !checkMonsterBlocked(m.pos.x + bx * 8.0 * m.scale, m.pos.z + bz * 8.0 * m.scale, monsterRadius * 0.7)
      );
    };
    const clearA = checkTailClear(candA);
    const clearB = checkTailClear(candB);
    if (clearA && !clearB) return candA;
    if (clearB && !clearA) return candB;
    return Math.abs(shortestAngleDiff(m.yaw, candA)) <= Math.abs(shortestAngleDiff(m.yaw, candB))
      ? candA
      : candB;
  }

  private pickRetreatTarget(
    m: RuntimeMonster,
    monsterRadius: number,
    checkMonsterBlocked: (x: number, z: number, r: number) => boolean
  ): void {
    const waterY = this.getActiveBounds().waterY;
    const awayYaw = Math.atan2(m.pos.x - this.playerPos.x, m.pos.z - this.playerPos.z);
    let bestYaw = awayYaw;
    let bestClear = -1;
    for (let k = 0; k < _retreatOffsets.length; k++) {
      const ang = awayYaw + _retreatOffsets[k];
      const sx = Math.sin(ang);
      const sz = Math.cos(ang);
      let clearDist = 0;
      for (let dIdx = 0; dIdx < _retreatDists.length; dIdx++) {
        const dist = _retreatDists[dIdx];
        if (!checkMonsterBlocked(m.pos.x + sx * dist, m.pos.z + sz * dist, monsterRadius * 0.95)) {
          clearDist = dist;
        } else {
          break;
        }
      }
      if (clearDist > bestClear) {
        bestClear = clearDist;
        bestYaw = ang;
        if (clearDist >= 16.0) break;
      }
    }
    const targetDist = Math.max(10, bestClear > 0 ? bestClear : 14);
    m.intimidationSpot.set(
      m.pos.x + Math.sin(bestYaw) * targetDist,
      waterY - 0.14,
      m.pos.z + Math.cos(bestYaw) * targetDist
    );
    m.intimidationYaw = bestYaw;
  }

  private updateMonsters(dt: number, canAttack: boolean): void {
    const bBounds = this.getActiveBounds();
    const waterY = bBounds.waterY;
    const playerInWater = canAttack && this.inWater;
    const justClimbedPlatform = canAttack && this.pendingClimbIntimidation;
    this.pendingClimbIntimidation = false;

    let closestDist = 999;
    let closestMonsterIdx = -1;
    let highestAlert: 'calm' | 'searching' | 'chasing' = 'calm';

    for (let i = 0; i < this.monsters.length; i++) {
      const m = this.monsters[i];
      const d = Math.hypot(this.playerPos.x - m.pos.x, this.playerPos.z - m.pos.z);
      if (d < closestDist) {
        closestDist = d;
        closestMonsterIdx = i;
      }
    }

    // Trigger platform-edge watch when player climbs out of water onto a platform.
    // Guard strictly against duplicate watchers or multiple timers for the same water exit.
    if (justClimbedPlatform && !playerInWater && this.stoodPlatform) {
      const alreadyActiveForPlayer = this.monsters.some(
        (m) =>
          m.intimidationPhase === 'approaching' ||
          m.intimidationPhase === 'rising' ||
          m.intimidationPhase === 'staring' ||
          (m.visionState === 'lunging' && m.watchingUserId === '__local__')
      );
      if (!alreadyActiveForPlayer) {
        let primaryIdx = -1;
        let bestPursuingDist = Infinity;
        for (let i = 0; i < this.monsters.length; i++) {
          const m = this.monsters[i];
          if (m.intimidationPhase !== 'none' && m.intimidationPhase !== 'retreating') continue;
          if (m.safeEpoch >= this.playerWaterEpoch) continue;
          const d = Math.hypot(this.playerPos.x - m.pos.x, this.playerPos.z - m.pos.z);
          if (m.alert === 'chasing' || i === closestMonsterIdx || d <= m.waterDetectionRadius) {
            if (d < bestPursuingDist) {
              bestPursuingDist = d;
              primaryIdx = i;
            }
          }
        }

        if (primaryIdx >= 0) {
          const pm = this.monsters[primaryIdx];
          const pmRadius = 0.88 * pm.scale;
          const nearRadius = pm.scale * 24 + 8;
          this.populateNearbyObstacles(pm.pos.x, pm.pos.z, nearRadius);
          this._cbMobX = pm.pos.x;
          this._cbMobZ = pm.pos.z;
          this._cbMobNearR = nearRadius;
          this._cbMobBotY = waterY - 1.5;
          this._cbMobTopY = waterY + 4.2 * pm.scale;
          this.computePlatformEdgeSpot(
            this.stoodPlatform,
            pm,
            pmRadius,
            waterY - 1.5,
            waterY + 4.2 * pm.scale,
            this.checkMonsterBlockedFn
          );
          pm.safeEpoch = this.playerWaterEpoch;
          pm.visionState = 'none';
          pm.visionTimer = 0;
          pm.watchingUserId = null;
          pm.lookAway = false;
          pm.alert = 'searching';
          pm.emerged = false;
          pm.intimidationPhase = 'approaching';
          pm.intimidationTimer = 0;
          pm.intimidationDuration = 9.0;
          pm.navBestDist = Infinity;
          pm.navStallTimer = 0;

          for (let i = 0; i < this.monsters.length; i++) {
            if (i === primaryIdx) continue;
            const om = this.monsters[i];
            om.safeEpoch = this.playerWaterEpoch;
            om.watchingUserId = null;
            om.lookAway = false;
            om.visionState = 'none';
            om.visionTimer = 0;
            if (om.alert === 'chasing' && om.intimidationPhase === 'none') {
              const omRadius = 0.88 * om.scale;
              const omNear = om.scale * 24 + 8;
              this.populateNearbyObstacles(om.pos.x, om.pos.z, omNear);
              this._cbMobX = om.pos.x;
              this._cbMobZ = om.pos.z;
              this._cbMobNearR = omNear;
              this._cbMobBotY = waterY - 1.5;
              this._cbMobTopY = waterY + 4.2 * om.scale;
              this.pickRetreatTarget(om, omRadius, this.checkMonsterBlockedFn);
              om.alert = 'calm';
              om.emerged = false;
              om.intimidationPhase = 'retreating';
              om.intimidationTimer = 0;
              om.intimidationDuration = 2.0;
            }
          }
        }
      }
    }

    for (let i = 0; i < this.monsters.length; i++) {
      const m = this.monsters[i];
      const distToPlayer = Math.hypot(this.playerPos.x - m.pos.x, this.playerPos.z - m.pos.z);

      const monsterRadius = 0.88 * m.scale;
      const surfaceBotY = waterY - 1.5;
      const surfaceTopY = waterY + 4.2 * m.scale;
      const nearRadius = (canAttack && playerInWater ? 24 : 16) + m.scale * 5;
      this.populateNearbyObstacles(m.pos.x, m.pos.z, nearRadius);

      this._cbMobX = m.pos.x;
      this._cbMobZ = m.pos.z;
      this._cbMobNearR = nearRadius;
      this._cbMobBotY = surfaceBotY;
      this._cbMobTopY = surfaceTopY;
      const checkMonsterBlocked = this.checkMonsterBlockedFn;

      const nav = _monsterNavScratch;
      nav.x = m.pos.x;
      nav.z = m.pos.z;
      nav.yaw = m.yaw;
      nav.velX = m.velX;
      nav.velZ = m.velZ;
      nav.wpIndex = m.wpIndex;
      nav.waypoints = m.waypoints;
      nav.avoidDir = m.avoidDir;
      nav.avoidTimer = m.avoidTimer;
      nav.stuckTimer = m.stuckTimer;
      nav.navBestDist = m.navBestDist;
      nav.navStallTimer = m.navStallTimer;
      nav.navAnchorX = m.navAnchorX;
      nav.navAnchorZ = m.navAnchorZ;
      nav.navAnchorTimer = m.navAnchorTimer;
      nav.navTurnAccum = m.navTurnAccum;

      // Water detection and attack ALWAYS have priority over platform-watch/retreat:
      // if the player touches water, immediately attack regardless of movement.
      let interruptedActiveIntimidation = false;
      if (playerInWater && m.intimidationPhase !== 'none') {
        interruptedActiveIntimidation =
          m.intimidationPhase === 'approaching' ||
          m.intimidationPhase === 'rising' ||
          m.intimidationPhase === 'staring' ||
          m.intimidationPhase === 'lowering';
        m.intimidationPhase = 'none';
        m.intimidationTimer = 0;
        m.intimidationDuration = 0;
        m.intimidationPlatform = null;
        m.watchingUserId = null;
        m.lookAway = false;
        m.safeEpoch = Math.min(m.safeEpoch, this.playerWaterEpoch - 1);
      }

      const canPursueNow = playerInWater && m.intimidationPhase === 'none';
      const shouldChase =
        canPursueNow &&
        (interruptedActiveIntimidation || distToPlayer <= m.waterDetectionRadius || i === closestMonsterIdx);
      const holdingJumpArc =
        canAttack &&
        !this.inWater &&
        !this.grounded &&
        this.playerInWaterSession &&
        m.intimidationPhase === 'none' &&
        (m.alert === 'chasing' || distToPlayer <= m.waterDetectionRadius || i === closestMonsterIdx) &&
        this.playerWaterEpoch > m.safeEpoch;
      const platformStrikeActive =
        canAttack &&
        !playerInWater &&
        m.intimidationPhase === 'none' &&
        m.visionState === 'lunging' &&
        m.watchingUserId === '__local__';

      const extremeChaseSpeed = Math.max(48.0, m.chaseSpeed * 7.2);

      if (m.intimidationPhase !== 'none') {
        m.intimidationTimer += dt;

        if (m.intimidationPhase === 'approaching') {
          m.alert = 'searching';
          m.watchingUserId = null;
          m.lookAway = false;
          if (this.stoodPlatform && this.grounded && !this.inWater) {
            const preDistToSpot = Math.hypot(m.intimidationSpot.x - nav.x, m.intimidationSpot.z - nav.z);
            const platDynamic = Boolean(this.stoodPlatform.def.moveOffset || this.stoodPlatform.def.rotationSpeed);
            const playerShiftSq =
              (this.playerPos.x - (m.lastEdgeSpotPlayerX ?? NaN)) ** 2 +
              (this.playerPos.z - (m.lastEdgeSpotPlayerZ ?? NaN)) ** 2;
            const needEdgeRecompute =
              platDynamic ||
              m.intimidationPlatform !== this.stoodPlatform ||
              !(playerShiftSq < 0.0625) ||
              preDistToSpot <= 3.5 ||
              ((this.renderFrameIdx ?? 0) + i) % 3 === 0;
            if (needEdgeRecompute) {
              m.lastEdgeSpotPlayerX = this.playerPos.x;
              m.lastEdgeSpotPlayerZ = this.playerPos.z;
              m.lastEdgeSpotTime = this.simTime;
              this.computePlatformEdgeSpot(
                this.stoodPlatform,
                m,
                monsterRadius,
                surfaceBotY,
                surfaceTopY,
                checkMonsterBlocked
              );
            }
          } else if (m.intimidationPlatform && m.intimidationPlatform.state !== 'gone') {
            _vLocal.copy(m.intimidationLocalOffset);
            if (m.intimidationPlatform.isRotated) {
              _vLocal.applyQuaternion(m.intimidationPlatform.currentQuat);
            }
            m.intimidationSpot.set(
              m.intimidationPlatform.currentPos.x + _vLocal.x,
              waterY - 0.14,
              m.intimidationPlatform.currentPos.z + _vLocal.z
            );
          }
          const distToSpot = Math.hypot(
            m.intimidationSpot.x - nav.x,
            m.intimidationSpot.z - nav.z
          );
          if (
            distToSpot <= 1.25 * m.scale ||
            (nav.stuckTimer > 0.5 && distToSpot < 2.8 * m.scale)
          ) {
            m.intimidationPhase = 'rising';
            m.intimidationTimer = 0;
            m.intimidationDuration = SERPENT_INTIMIDATION_RISE_SEC;
            m.intimidationYaw = this.pickIntimidationYaw(m, monsterRadius, checkMonsterBlocked);
            m.watchingUserId = null;
            nav.velX *= 0.15;
            nav.velZ *= 0.15;
            nav.stuckTimer = 0;
          } else if (m.intimidationTimer >= m.intimidationDuration) {
            this.pickRetreatTarget(m, monsterRadius, checkMonsterBlocked);
            m.intimidationPhase = 'retreating';
            m.intimidationTimer = 0;
            m.intimidationDuration = 2.4;
            m.alert = 'calm';
            m.watchingUserId = null;
          }
        } else if (m.intimidationPhase === 'rising') {
          m.alert = 'searching';
          m.watchingUserId = null;
          m.lookAway = false;
          nav.velX *= Math.exp(-10 * dt);
          nav.velZ *= Math.exp(-10 * dt);
          nav.yaw = normalizeAngle(
            nav.yaw + shortestAngleDiffNav(nav.yaw, m.intimidationYaw) * Math.min(1, 5.5 * dt)
          );
          if (m.intimidationTimer >= m.intimidationDuration) {
            m.intimidationPhase = 'staring';
            m.intimidationTimer = 0;
            m.intimidationDuration = SERPENT_WATCH_DURATION_SEC; // Exact 5.0s watch starts ONLY on arrival & staring
            m.watchingUserId = '__local__';
            m.lookAway = false;
          }
        } else if (m.intimidationPhase === 'staring') {
          m.alert = 'searching';
          m.watchingUserId = '__local__';
          m.lookAway = false;
          m.emerged = true;
          nav.velX *= Math.exp(-12 * dt);
          nav.velZ *= Math.exp(-12 * dt);
          const toPlayerYaw = Math.atan2(this.playerPos.x - nav.x, this.playerPos.z - nav.z);
          const gazeDiff = shortestAngleDiffNav(nav.yaw, toPlayerYaw);
          if (Math.abs(gazeDiff) > 0.78) {
            const pivotYaw = toPlayerYaw - Math.sign(gazeDiff) * 0.78;
            nav.yaw = normalizeAngle(
              nav.yaw + shortestAngleDiffNav(nav.yaw, pivotYaw) * Math.min(1, 3.2 * dt)
            );
          }
          if (canAttack && this.watchMoveAttempted) {
            // Player moved during the 5-second watch -> immediately strike & devour
            m.intimidationPhase = 'none';
            m.intimidationTimer = 0;
            m.intimidationDuration = 0;
            m.intimidationPlatform = null;
            m.visionState = 'lunging';
            m.visionTimer = 0;
            m.watchingUserId = '__local__';
            m.lookAway = false;
            m.alert = 'chasing';
            m.emerged = true;
            this.watchMoveAttempted = false;
            const dxL = this.playerPos.x - nav.x;
            const dzL = this.playerPos.z - nav.z;
            const lLen = Math.hypot(dxL, dzL);
            if (lLen > 0.01) {
              nav.yaw = Math.atan2(dxL, dzL);
              nav.velX = (dxL / lLen) * extremeChaseSpeed;
              nav.velZ = (dzL / lLen) * extremeChaseSpeed;
            }
            this.sound.playSerpentEmerge(0.8);
            this.spawnSplash(m.pos, 32, 2.2);
          } else if (m.intimidationTimer >= m.intimidationDuration) {
            m.intimidationPhase = 'lowering';
            m.intimidationTimer = 0;
            m.intimidationDuration = SERPENT_INTIMIDATION_LOWER_SEC;
            m.watchingUserId = null;
            m.alert = 'calm';
            this.watchMoveAttempted = false;
          }
        } else if (m.intimidationPhase === 'lowering') {
          m.alert = 'calm';
          m.watchingUserId = null;
          m.lookAway = false;
          nav.velX *= Math.exp(-10 * dt);
          nav.velZ *= Math.exp(-10 * dt);
          if (m.intimidationTimer >= m.intimidationDuration) {
            this.pickRetreatTarget(m, monsterRadius, checkMonsterBlocked);
            m.intimidationPhase = 'retreating';
            m.intimidationTimer = 0;
            m.intimidationDuration = 2.6;
          }
        } else if (m.intimidationPhase === 'retreating') {
          m.alert = 'calm';
          m.watchingUserId = null;
          m.lookAway = false;
          const distRetreated = Math.hypot(
            m.pos.x - this.playerPos.x,
            m.pos.z - this.playerPos.z
          );
          if (m.intimidationTimer >= m.intimidationDuration || (m.intimidationTimer >= 1.2 && distRetreated > 22)) {
            m.intimidationPhase = 'none';
            m.intimidationTimer = 0;
            m.intimidationDuration = 0;
            m.intimidationPlatform = null;
            selectClosestPatrolWaypoint(nav, monsterRadius, checkMonsterBlocked);
          }
        }
      } else if (shouldChase) {
        // Immediate attack when player touches water, even if completely stationary
        const wasAlreadyLunging = m.visionState === 'lunging' && m.alert === 'chasing';
        m.visionState = 'lunging';
        m.visionTimer = 0;
        m.watchingUserId = null;
        m.lookAway = false;
        m.alert = 'chasing';
        m.emerged = wasAlreadyLunging || interruptedActiveIntimidation || distToPlayer < 10.5;
        if (!wasAlreadyLunging) {
          const dxLaunch = this.playerPos.x - m.pos.x;
          const dzLaunch = this.playerPos.z - m.pos.z;
          const lenLaunch = Math.hypot(dxLaunch, dzLaunch);
          if (lenLaunch > 0.01) {
            const nx = dxLaunch / lenLaunch;
            const nz = dzLaunch / lenLaunch;
            nav.yaw = Math.atan2(nx, nz);
            nav.velX = nx * extremeChaseSpeed;
            nav.velZ = nz * extremeChaseSpeed;
          }
          resetSerpentNavProgress(nav);
          this.sound.playSerpentEmerge(0.72);
          this.spawnSplash(m.pos, 32, 2.2);
          this.camShake = Math.max(this.camShake, 0.25);
        }
        m.searchTarget.copy(this.playerPos);
      } else if (platformStrikeActive) {
        m.visionState = 'lunging';
        m.alert = 'chasing';
        m.watchingUserId = '__local__';
        m.lookAway = false;
        m.emerged = true;
        m.searchTarget.copy(this.playerPos);
      } else if (!holdingJumpArc) {
        m.visionState = 'none';
        m.visionTimer = 0;
        m.watchingUserId = null;
        m.lookAway = false;
        if (m.alert !== 'calm') {
          m.alert = 'calm';
          m.searchTimer = 0;
          m.emerged = false;
          const spd = Math.hypot(nav.velX, nav.velZ);
          if (spd > m.patrolSpeed && spd > 0.01) {
            const damp = m.patrolSpeed / spd;
            nav.velX *= damp;
            nav.velZ *= damp;
          }
          nav.avoidTimer = 0;
          selectClosestPatrolWaypoint(nav, monsterRadius, checkMonsterBlocked);
        }
      }

      if (m.alert === 'chasing') highestAlert = 'chasing';
      else if (m.alert === 'searching' && highestAlert === 'calm') highestAlert = 'searching';

      const isChasing = m.alert === 'chasing';
      const isMooredIntim =
        m.intimidationPhase === 'rising' ||
        m.intimidationPhase === 'staring' ||
        m.intimidationPhase === 'lowering';
      const platformOverhead =
        !isMooredIntim &&
        this.isCircleBlocked(
          nav.x,
          nav.z,
          monsterRadius * 1.15,
          m.pos.y - 0.12 * m.scale,
          waterY + 1.25 * m.scale,
          _nearPlatforms,
          _emptyWalls
        );

      let tx = m.pos.x;
      let tz = m.pos.z;
      let moveSpeed = m.patrolSpeed;
      let hasMoveTarget = false;
      let useFastSteer = false;

      if (m.intimidationPhase === 'approaching') {
        tx = m.intimidationSpot.x;
        tz = m.intimidationSpot.z;
        const dSpot = Math.hypot(tx - nav.x, tz - nav.z);
        const fastCap = Math.max(24.0, m.chaseSpeed * 3.6);
        moveSpeed = dSpot > 3.6 * m.scale ? fastCap : THREE.MathUtils.lerp(4.5, fastCap, dSpot / (3.6 * m.scale));
        hasMoveTarget = dSpot > 0.25;
        useFastSteer = true;
      } else if (
        m.intimidationPhase === 'rising' ||
        m.intimidationPhase === 'staring' ||
        m.intimidationPhase === 'lowering'
      ) {
        moveSpeed = 0;
        hasMoveTarget = false;
      } else if (m.intimidationPhase === 'retreating') {
        tx = m.intimidationSpot.x;
        tz = m.intimidationSpot.z;
        moveSpeed = m.patrolSpeed * 1.45;
        hasMoveTarget = Math.hypot(tx - nav.x, tz - nav.z) > 0.4;
      } else if (m.visionState === 'lunging' || m.alert === 'chasing') {
        tx = this.playerPos.x;
        tz = this.playerPos.z;
        moveSpeed = extremeChaseSpeed;
        hasMoveTarget = Math.hypot(tx - nav.x, tz - nav.z) > 0.05;
        useFastSteer = true;
      } else {
        const patrolTarget = resolvePatrolTarget(nav, monsterRadius, checkMonsterBlocked);
        tx = patrolTarget.tx;
        tz = patrolTarget.tz;
        hasMoveTarget = patrolTarget.hasTarget;
      }

      const minSafeY = bBounds.floorY + 0.55 * m.scale;
      let lowestNearbyPlatBottom = waterY - 0.35;
      for (let pi = 0; pi < _nearPlatforms.length; pi++) {
        const plat = _nearPlatforms[pi];
        if (!plat || plat.state === 'gone') continue;
        const platBot = plat.currentPos.y - plat.def.size[1] * 0.5;
        if (platBot <= waterY + 0.6 && platBot > bBounds.floorY + 0.8 && platBot < lowestNearbyPlatBottom) {
          lowestNearbyPlatBottom = platBot;
        }
      }
      const deepDiveY = THREE.MathUtils.clamp(
        Math.min(waterY - 2.05 * m.scale, lowestNearbyPlatBottom - 0.62 * m.scale),
        minSafeY,
        waterY - 1.15 * m.scale
      );
      const diveHalfH = 0.5 * m.scale;
      const diveBotY = deepDiveY - diveHalfH;
      const diveTopY = deepDiveY + diveHalfH;
      const allowDive =
        !isMooredIntim &&
        !(m.visionState === 'lunging' && m.watchingUserId === '__local__' && !playerInWater) &&
        (m.intimidationPhase === 'none' ||
          m.intimidationPhase === 'retreating' ||
          (m.intimidationPhase === 'approaching' &&
            Math.hypot(tx - nav.x, tz - nav.z) > 3.2 * m.scale));

      let corridorPlatformBlocked = false;
      if (allowDive && hasMoveTarget && _nearPlatforms.length > 0) {
        const dTgt = Math.hypot(tx - nav.x, tz - nav.z);
        if (dTgt > 0.5) {
          const invD = 1 / dTgt;
          const dirX = (tx - nav.x) * invD;
          const dirZ = (tz - nav.z) * invD;
          const maxProbe = Math.min(dTgt, useFastSteer ? 18.0 : 9.0);
          const stepLen = Math.max(1.0, monsterRadius * 1.45);
          for (let d = 0.45; d <= maxProbe; d += stepLen) {
            const sx = nav.x + dirX * d;
            const sz = nav.z + dirZ * d;
            if (this.isCircleBlocked(sx, sz, monsterRadius * 0.9, diveBotY, diveTopY, _emptyPlatforms, _nearWalls)) {
              break;
            }
            if (
              this.isCircleBlocked(
                sx,
                sz,
                monsterRadius * 1.02,
                waterY - 1.05 * m.scale,
                waterY + 1.05 * m.scale,
                _nearPlatforms,
                _emptyWalls
              ) &&
              !this.isCircleBlocked(sx, sz, monsterRadius * 0.86, diveBotY, diveTopY, _nearPlatforms, _emptyWalls)
            ) {
              corridorPlatformBlocked = true;
              break;
            }
          }
        }
        if (!corridorPlatformBlocked) {
          const fwdX = nav.x + Math.sin(nav.yaw) * monsterRadius * 1.45;
          const fwdZ = nav.z + Math.cos(nav.yaw) * monsterRadius * 1.45;
          if (
            this.isCircleBlocked(
              fwdX,
              fwdZ,
              monsterRadius * 1.02,
              waterY - 1.05 * m.scale,
              waterY + 1.05 * m.scale,
              _nearPlatforms,
              _emptyWalls
            ) &&
            !this.isCircleBlocked(fwdX, fwdZ, monsterRadius * 0.86, diveBotY, diveTopY, _nearPlatforms, _emptyWalls)
          ) {
            corridorPlatformBlocked = true;
          }
        }
      }

      if (allowDive && (platformOverhead || corridorPlatformBlocked || (isChasing && nav.stuckTimer > 0.16))) {
        m.diveTimer = Math.max(m.diveTimer || 0, useFastSteer ? 0.55 : 0.75);
      } else if ((m.diveTimer || 0) > 0) {
        if (
          ((isChasing && distToPlayer < 3.6) || !allowDive) &&
          !platformOverhead &&
          !corridorPlatformBlocked
        ) {
          m.diveTimer = 0;
        } else {
          m.diveTimer = Math.max(0, (m.diveTimer || 0) - dt);
        }
      }

      const wantDive = allowDive && (platformOverhead || corridorPlatformBlocked || (m.diveTimer || 0) > 0);
      if (wantDive || m.pos.y <= waterY - 0.85 * m.scale) {
        this._cbMobBotY = diveBotY;
        this._cbMobTopY = diveTopY;
      } else {
        this._cbMobBotY = surfaceBotY;
        this._cbMobTopY = surfaceTopY;
      }

      const subSteps = useFastSteer
        ? Math.max(2, Math.min(6, Math.ceil((moveSpeed * dt) / Math.max(0.35, monsterRadius * 0.65))))
        : 1;
      const subDt = dt / subSteps;
      const subResolveIters = useFastSteer && subSteps > 2 ? 1 : 2;
      const catchDist = 2.15 * m.scale;
      let caughtDuringSubstep = false;
      const desiredY = wantDive || platformOverhead ? deepDiveY : waterY - 0.14;
      const emergedFrac =
        isChasing && m.rig.emergeAmount > 0.05 && m.pos.y >= waterY - 0.55 * m.scale
          ? m.rig.emergeAmount
          : 0;

      const strikeOverPlatform = !playerInWater && m.visionState === 'lunging' && m.watchingUserId === '__local__';

      if (!isMooredIntim) {
        let cachedSteerValid = false;
        let cachedSteerAngle = nav.yaw;
        let cachedSteerX = nav.x;
        let cachedSteerZ = nav.z;
        let prevSubBlocked = true;

        for (let step = 0; step < subSteps; step++) {
          if (desiredY < m.pos.y) {
            const diveRate = (useFastSteer ? 34.0 : 12.0) * m.scale;
            m.pos.y = Math.max(desiredY, m.pos.y - diveRate * subDt);
          } else if (desiredY > m.pos.y) {
            const subOverhead =
              !strikeOverPlatform &&
              this.isCircleBlocked(
                nav.x,
                nav.z,
                monsterRadius * 1.15,
                m.pos.y - 0.12 * m.scale,
                waterY + 1.25 * m.scale,
                _nearPlatforms,
                _emptyWalls
              );
            if (!subOverhead) {
              const riseRate = (useFastSteer ? 24.0 : 7.5) * m.scale;
              m.pos.y = Math.min(desiredY, m.pos.y + riseRate * subDt);
            }
          }
          m.pos.y = THREE.MathUtils.clamp(m.pos.y, bBounds.floorY + 0.72 * m.scale, waterY - 0.14);

          const physBotY = m.pos.y - 0.72 * m.scale;
          const physTopY = m.pos.y + (0.68 + emergedFrac * 3.45) * m.scale;
          const prevX = nav.x;
          const prevZ = nav.z;
          const prevYaw = nav.yaw;
          const steerBlockCheck = strikeOverPlatform
            ? (cx: number, cz: number, cr: number) =>
                this.isCircleBlocked(cx, cz, cr, physBotY, physTopY, _emptyPlatforms, _nearWalls)
            : checkMonsterBlocked;

          let steerValid = false;
          let steerAngle = nav.yaw;
          if (hasMoveTarget) {
            const distSqSinceSteer =
              (nav.x - cachedSteerX) * (nav.x - cachedSteerX) +
              (nav.z - cachedSteerZ) * (nav.z - cachedSteerZ);
            const targetDistSq = (tx - nav.x) * (tx - nav.x) + (tz - nav.z) * (tz - nav.z);
            const reSteerR = (useFastSteer && targetDistSq < 11.56 ? 0.34 : 0.85) * m.scale;
            const needFreshSteer =
              step === 0 ||
              prevSubBlocked ||
              !cachedSteerValid ||
              distSqSinceSteer > reSteerR * reSteerR;
            if (needFreshSteer) {
              const res = computeSerpentSteerAngle(nav, tx, tz, monsterRadius, useFastSteer, steerBlockCheck);
              cachedSteerValid = res.valid;
              cachedSteerAngle = res.steerAngle;
              cachedSteerX = nav.x;
              cachedSteerZ = nav.z;
            }
            steerValid = cachedSteerValid;
            steerAngle = cachedSteerAngle;
          }

          prevSubBlocked = false;
          if (steerValid && moveSpeed > 0.05) {
            const desiredVx = Math.sin(steerAngle) * moveSpeed;
            const desiredVz = Math.cos(steerAngle) * moveSpeed;
            const steerBlend = Math.min(1, (useFastSteer ? 65.0 : 8.5) * subDt);
            nav.velX += (desiredVx - nav.velX) * steerBlend;
            nav.velZ += (desiredVz - nav.velZ) * steerBlend;

            nav.x += nav.velX * subDt;
            nav.z += nav.velZ * subDt;

            const rawX = nav.x;
            const rawZ = nav.z;
            m.pos.x = nav.x;
            m.pos.z = nav.z;
            _vMonsterVel.set(nav.velX, 0, nav.velZ);
            this.resolveCircleSolids(
              m.pos,
              monsterRadius,
              physBotY,
              physTopY,
              monsterRadius + 0.15,
              true,
              _vMonsterVel,
              -Infinity,
              null,
              strikeOverPlatform ? _emptyPlatforms : _nearPlatforms,
              _nearWalls,
              subResolveIters
            );
            nav.x = m.pos.x;
            nav.z = m.pos.z;
            nav.velX = _vMonsterVel.x;
            nav.velZ = _vMonsterVel.z;
            if ((nav.x - rawX) * (nav.x - rawX) + (nav.z - rawZ) * (nav.z - rawZ) > 0.0004) {
              prevSubBlocked = true;
            }

            if (
              this.isCircleBlocked(
                nav.x,
                nav.z,
                monsterRadius - 0.02,
                physBotY,
                physTopY,
                strikeOverPlatform ? _emptyPlatforms : _nearPlatforms,
                _nearWalls
              )
            ) {
              prevSubBlocked = true;
              let escaped = false;
              for (let rIdx = 0; rIdx < _escRadii.length && !escaped; rIdx++) {
                const stepR = _escRadii[rIdx];
                for (let k = 0; k < 8; k++) {
                  const ang = (k * Math.PI) / 4;
                  const txEsc = nav.x + Math.sin(ang) * stepR;
                  const tzEsc = nav.z + Math.cos(ang) * stepR;
                  if (
                    !this.isCircleBlocked(
                      txEsc,
                      tzEsc,
                      monsterRadius,
                      physBotY,
                      physTopY,
                      strikeOverPlatform ? _emptyPlatforms : _nearPlatforms,
                      _nearWalls
                    )
                  ) {
                    nav.x = txEsc;
                    nav.z = tzEsc;
                    escaped = true;
                    break;
                  }
                }
              }
            }
          }

          updateSerpentProgressAndYaw(
            nav,
            prevX,
            prevZ,
            prevYaw,
            moveSpeed,
            subDt,
            useFastSteer,
            steerValid,
            steerBlockCheck,
            45.0
          );
          if (wantDive && m.pos.y > deepDiveY + 0.35 * m.scale) {
            nav.stuckTimer = 0;
          }

          m.pos.x = nav.x;
          m.pos.z = nav.z;

          const canStrikeCatch = playerInWater || (!playerInWater && m.watchingUserId === '__local__');
          if (
            canAttack &&
            canStrikeCatch &&
            isChasing &&
            m.intimidationPhase === 'none' &&
            m.visionState === 'lunging'
          ) {
            const dSub = Math.hypot(this.playerPos.x - nav.x, this.playerPos.z - nav.z);
            const effCatchDist = !playerInWater ? Math.max(catchDist, 2.75 * m.scale) : catchDist;
            if (dSub < effCatchDist) {
              const midX = (nav.x + this.playerPos.x) * 0.5;
              const midZ = (nav.z + this.playerPos.z) * 0.5;
              const wallBlocking = this.isCircleBlocked(
                midX,
                midZ,
                0.28,
                Math.min(m.pos.y, this.playerPos.y) - 0.25,
                Math.max(m.pos.y, this.playerPos.y) + 0.5,
                _emptyPlatforms,
                _nearWalls
              );
              if (!wallBlocking) {
                caughtDuringSubstep = true;
                break;
              }
            }
          }
        }
      } else {
        m.pos.y += (waterY - 0.14 - m.pos.y) * Math.min(1, 14 * dt);
      }

      m.pos.x = nav.x;
      m.pos.z = nav.z;
      m.yaw = nav.yaw;
      m.velX = nav.velX;
      m.velZ = nav.velZ;
      m.wpIndex = nav.wpIndex;
      m.avoidDir = nav.avoidDir;
      m.avoidTimer = nav.avoidTimer;
      m.stuckTimer = nav.stuckTimer;
      m.navBestDist = nav.navBestDist;
      m.navStallTimer = nav.navStallTimer;
      m.navAnchorX = nav.navAnchorX;
      m.navAnchorZ = nav.navAnchorZ;
      m.navAnchorTimer = nav.navAnchorTimer;
      m.navTurnAccum = nav.navTurnAccum;

      if (caughtDuringSubstep) {
        this.spawnSplash(this.playerPos, 40, 2.8);
        this.triggerDeath('caught', m);
        return;
      }
    }

    // Monster-vs-monster separation BEFORE spine animation so heads & spines stay cleanly aligned
    for (let i = 0; i < this.monsters.length; i++) {
      for (let j = i + 1; j < this.monsters.length; j++) {
        const a = this.monsters[i];
        const b = this.monsters[j];
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const dist = Math.hypot(dx, dz);
        const minSep = (a.scale + b.scale) * 0.92;
        if (dist < minSep && dist > 1e-4) {
          const aAnchored =
            a.intimidationPhase === 'rising' ||
            a.intimidationPhase === 'staring' ||
            a.intimidationPhase === 'lowering';
          const bAnchored =
            b.intimidationPhase === 'rising' ||
            b.intimidationPhase === 'staring' ||
            b.intimidationPhase === 'lowering';
          const push = minSep - dist;
          const nx = dx / dist;
          const nz = dz / dist;
          const shareA = aAnchored && !bAnchored ? 0 : !aAnchored && bAnchored ? 1 : 0.5;
          const shareB = 1 - shareA;
          a.pos.x -= nx * push * shareA;
          a.pos.z -= nz * push * shareA;
          b.pos.x += nx * push * shareB;
          b.pos.z += nz * push * shareB;
          const ar = 0.9 * a.scale;
          const br = 0.9 * b.scale;
          this.populateNearbyObstacles(a.pos.x, a.pos.z, ar + br + 3);
          this.resolveCircleSolids(a.pos, ar, a.pos.y - 0.72 * a.scale, a.pos.y + 0.72 * a.scale, ar + 0.15, true, undefined, -Infinity, null, _nearPlatforms, _nearWalls);
          this.resolveCircleSolids(b.pos, br, b.pos.y - 0.72 * b.scale, b.pos.y + 0.72 * b.scale, br + 0.15, true, undefined, -Infinity, null, _nearPlatforms, _nearWalls);
        }
      }
    }

    // Visual animation, surface emergence, wake splashes, and continuous spine collision (LOD & view-cone culled)
    const lodCut = this.activeQuality === 'smooth' ? 68 : this.activeQuality === 'standard' ? 110 : 175;
    this.camera.getWorldDirection(_vForward);
    const camX = this.camera.position.x;
    const camZ = this.camera.position.z;

    for (let i = 0; i < this.monsters.length; i++) {
      const m = this.monsters[i];

      // Underwater approach -> sudden violent surface emergence near player (plus eerie calm dorsal crest)
      const postDist = Math.hypot(this.playerPos.x - m.pos.x, this.playerPos.z - m.pos.z);
      const isSubmerged = m.pos.y < waterY - 0.55 * m.scale || (m.diveTimer || 0) > 0;
      const targetEmerge =
        (m.alert === 'chasing' && postDist < 10.5 && !isSubmerged) ||
        ((m.visionState === 'watching' || m.visionState === 'look_away' || m.visionState === 'lunging') && !isSubmerged)
          ? 1
          : 0;
      const calmCrest =
        m.alert === 'calm' && m.intimidationPhase === 'none' && !isSubmerged
          ? Math.max(0, Math.sin(this.simTime * 0.5 + i * 1.9) - 0.58) * 0.55
          : 0;
      if ((m.alert === 'chasing' || m.visionState === 'watching') && targetEmerge > 0.5 && !m.emerged) {
        m.emerged = true;
        this.sound.playSerpentEmerge(0.7);
        this.spawnSplash(m.pos, 32, 2.4);
        this.camShake = Math.max(this.camShake, 0.38);
      } else if (targetEmerge === 0) {
        m.emerged = false;
      }

      const toMX = m.pos.x - camX;
      const toMZ = m.pos.z - camZ;
      const camDist = Math.hypot(toMX, toMZ);
      const behindCam =
        camDist > 26 * m.scale && (_vForward.x * toMX + _vForward.z * toMZ) / camDist < -0.35;

      if ((camDist > lodCut || behindCam) && m.alert !== 'chasing' && !m.lookAway && m.intimidationPhase === 'none') {
        const visibleFar = camDist <= Math.min(lodCut * 1.15, this.activeRenderDist + 18) && !behindCam;
        m.rig.root.visible = visibleFar;
        const stepMod = visibleFar ? 4 : 8;
        if ((this.renderFrameIdx + i) % stepMod !== 0) {
          continue;
        }
        m.rig.root.position.copy(m.pos);
        m.rig.root.rotation.y = 0;
        const lookTarget = _vLookAhead.set(m.pos.x + Math.sin(m.yaw) * 8, m.pos.y, m.pos.z + Math.cos(m.yaw) * 8);
        animateMonsterRig(m.rig, m.alert, lookTarget, m.pos, m.yaw, waterY, this.simTime, dt * stepMod, calmCrest, -1, null, bBounds.floorY);
        continue;
      }
      m.rig.root.visible = true;
      if (
        (this.isTouchDevice || this.isLowEndGpu || this.activeQuality === 'smooth') &&
        camDist > 42 &&
        m.alert !== 'chasing' &&
        !m.lookAway &&
        m.intimidationPhase === 'none' &&
        (this.renderFrameIdx + i) % 2 !== 0
      ) {
        m.rig.root.position.copy(m.pos);
        continue;
      }

      // Intense churning water splashes & tail spray when surging near surface
      if ((m.alert === 'chasing' || m.intimidationPhase === 'approaching') && m.pos.y >= waterY - 0.65 * m.scale) {
        m.wakeSplashTimer -= dt;
        if (m.wakeSplashTimer <= 0) {
          const lightSplash = this.isTouchDevice || this.activeQuality === 'smooth';
          m.wakeSplashTimer = m.alert === 'chasing' ? (lightSplash ? 0.036 : 0.018) : 0.045;
          this.spawnSplash(m.pos, lightSplash ? 5 : 7, 1.65);
          if (m.rig.segments.length > 5) {
            this.spawnSplash(m.rig.segments[4].worldPos, lightSplash ? 3 : 5, 1.35);
          }
          if (m.rig.segments.length > 18) {
            this.spawnSplash(m.rig.segments[18].worldPos, lightSplash ? 3 : 5, 1.5);
          }
        }
      }

      m.rig.root.position.copy(m.pos);
      m.rig.root.rotation.y = 0;

      const isStareLook =
        m.intimidationPhase === 'rising' ||
        m.intimidationPhase === 'staring' ||
        m.intimidationPhase === 'lowering' ||
        m.visionState === 'watching';
      const lookTarget = m.lookAway
        ? _vLookAhead.set(m.pos.x + Math.sin(m.yaw) * 8, m.pos.y, m.pos.z + Math.cos(m.yaw) * 8)
        : isStareLook
          ? _vLookAhead.set(this.playerPos.x, this.playerPos.y + 1.45, this.playerPos.z)
          : canAttack && playerInWater
            ? this.playerPos
            : _vLookAhead.set(m.pos.x + Math.sin(m.yaw) * 8, m.pos.y, m.pos.z + Math.cos(m.yaw) * 8);

      let intimAnim: SerpentIntimidationAnim | null = null;
      if (m.intimidationPhase !== 'none') {
        _intimAnimScratch.phase = m.intimidationPhase;
        _intimAnimScratch.phaseProgress =
          m.intimidationDuration > 0
            ? THREE.MathUtils.clamp(m.intimidationTimer / m.intimidationDuration, 0, 1)
            : 0;
        _intimAnimScratch.stareElapsed = m.intimidationPhase === 'staring' ? m.intimidationTimer : 0;
        intimAnim = _intimAnimScratch;
      }

      animateMonsterRig(
        m.rig,
        m.alert,
        lookTarget,
        m.pos,
        m.yaw,
        waterY,
        this.simTime,
        dt,
        m.alert === 'chasing' || m.lookAway
          ? targetEmerge
          : m.intimidationPhase === 'approaching'
            ? 0.28
            : calmCrest,
        -1,
        intimAnim,
        bBounds.floorY,
        true
      );

      // Keep trailing spine segments (sIdx >= 1) out of platforms, walls, and bounds (using actual segment Y)
      const segBoundDist = m.scale * 22 + 2;
      const nearBounds =
        m.pos.x - bBounds.minX < segBoundDist ||
        bBounds.maxX - m.pos.x < segBoundDist ||
        m.pos.z - bBounds.minZ < segBoundDist ||
        bBounds.maxZ - m.pos.z < segBoundDist;
      const segNearR = m.scale * 20 + 4;
      if (this.monsters.length > 1 || this._cbMobNearR < segNearR + 2) {
        this.populateNearbyObstacles(m.pos.x, m.pos.z, segNearR);
      }
      if (_nearPlatforms.length > 0 || _nearWalls.length > 0 || nearBounds) {
        for (let sIdx = 1; sIdx < m.rig.segments.length; sIdx++) {
          const seg = m.rig.segments[sIdx];
          const segR = Math.max(0.24, seg.radius * 0.85);
          const origX = m.pos.x + seg.group.position.x;
          const origZ = m.pos.z + seg.group.position.z;
          const origY = m.pos.y + seg.group.position.y;
          _vSegWorld.set(origX, origY, origZ);
          this.resolveCircleSolids(
            _vSegWorld,
            segR,
            origY - segR * 0.9,
            origY + segR * 0.9,
            segR + 0.1,
            true,
            undefined,
            -Infinity,
            null,
            _nearPlatforms,
            _nearWalls,
            1
          );
          const pushDx = _vSegWorld.x - origX;
          const pushDz = _vSegWorld.z - origZ;
          if (pushDx * pushDx + pushDz * pushDz > 1e-6) {
            seg.group.position.x = _vSegWorld.x - m.pos.x;
            seg.group.position.z = _vSegWorld.z - m.pos.z;
            seg.worldPos.x += pushDx * 0.35;
            seg.worldPos.z += pushDz * 0.35;
          }
        }
      }
      syncSerpentBones(m.rig, m.yaw);
    }

    // Catch & Jumpscare check: active when serpent is lunging in water OR striking a watched player who moved on a platform
    if (canAttack) {
      for (const m of this.monsters) {
        if (
          m.alert !== 'chasing' ||
          m.intimidationPhase !== 'none' ||
          m.visionState !== 'lunging'
        ) {
          continue;
        }
        const canCatchNow = playerInWater || (!playerInWater && m.watchingUserId === '__local__');
        if (!canCatchNow) continue;
        const distToPlayer = Math.hypot(this.playerPos.x - m.pos.x, this.playerPos.z - m.pos.z);
        const catchDist = !playerInWater ? Math.max(2.15, 2.75) * m.scale : 2.15 * m.scale;
        if (distToPlayer < catchDist) {
          this.populateNearbyObstacles(m.pos.x, m.pos.z, m.scale * 3 + 2);
          const midX = (m.pos.x + this.playerPos.x) * 0.5;
          const midZ = (m.pos.z + this.playerPos.z) * 0.5;
          const wallBlocking = this.isCircleBlocked(
            midX,
            midZ,
            0.28,
            Math.min(m.pos.y, this.playerPos.y) - 0.25,
            Math.max(m.pos.y, this.playerPos.y) + 0.5,
            _emptyPlatforms,
            _nearWalls
          );
          if (!wallBlocking) {
            this.spawnSplash(this.playerPos, 40, 2.8);
            this.triggerDeath('caught', m);
            return;
          }
        }
      }
    }

    this.syncAllMonstersSwimmingAudio(canAttack);
    if (canAttack) {
      const underwater = this.camera.position.y < waterY;
      this.sound.updateAtmosphere(this.simTime, closestDist, highestAlert, playerInWater, underwater, true);
    }
  }

  private computePlayCameraGoals(outTarget: THREE.Vector3, outCamPos: THREE.Vector3, dt?: number): void {
    let focusPos = this.playerPos;
    const focusInWater = this.inWater;
    if (!Number.isFinite(focusPos.x) || !Number.isFinite(focusPos.y) || !Number.isFinite(focusPos.z)) {
      focusPos = this.activeSpawn;
    }
    if (!Number.isFinite(this.camYaw)) this.camYaw = 0;
    if (!Number.isFinite(this.camPitch)) this.camPitch = 0.25;

    const cosPitch = Math.cos(this.camPitch);
    const dirX = Math.sin(this.camYaw) * cosPitch;
    const dirY = Math.sin(this.camPitch);
    const dirZ = Math.cos(this.camYaw) * cosPitch;

    const b = this.getActiveBounds();
    const useThirdPerson = this.isThirdPersonView();
    if (!useThirdPerson) {
      const eyeOffset = focusInWater ? 1.52 : 1.58;
      const eyeX = THREE.MathUtils.clamp(focusPos.x, b.minX + 0.35, b.maxX - 0.35);
      const eyeY = THREE.MathUtils.clamp(focusPos.y + eyeOffset, b.floorY + 0.35, b.ceilingY - 0.35);
      const eyeZ = THREE.MathUtils.clamp(focusPos.z, b.minZ + 0.35, b.maxZ - 0.35);

      outCamPos.set(eyeX, eyeY, eyeZ);
      outTarget.set(eyeX - dirX * 4.0, eyeY - dirY * 4.0, eyeZ - dirZ * 4.0);
      this.lastCamThirdPerson = false;
      return;
    }

    const switchedFromFirstPerson = !this.lastCamThirdPerson;
    this.lastCamThirdPerson = true;
    outTarget.set(focusPos.x, focusPos.y + 1.48, focusPos.z);

    // Keep radial distance stable across brief water-jump arcs instead of jerking 4.4 <-> 5.0 mid-air
    const desiredDist = focusInWater || this.waterJumpTimer > 0 ? 4.4 : 5.0;

    const idealX = outTarget.x + dirX * desiredDist;
    const idealY = outTarget.y + dirY * desiredDist;
    const idealZ = outTarget.z + dirZ * desiredDist;

    // Exact ray-AABB / OBB slab occlusion check using spatial grid candidate walls & platforms
    const bestCamT = this.computeCameraWallOcclusion(
      outTarget.x,
      outTarget.y,
      outTarget.z,
      idealX,
      idealY,
      idealZ,
      0.35
    );
    const occludedDist =
      bestCamT < 1.0 ? desiredDist * Math.max(0.06, bestCamT * 0.94 - 0.02) : desiredDist;

    // Keep horizontal/vertical rotation and player follow 100% instant (zero lag);
    // only ease radial wall-occlusion recovery rapidly along the exact current look ray.
    let useDist = occludedDist;
    if (!switchedFromFirstPerson && dt !== undefined && dt > 0 && Number.isFinite(this.camDist)) {
      if (occludedDist <= this.camDist || Math.abs(occludedDist - this.camDist) < 0.015) {
        this.camDist = occludedDist;
      } else {
        const recoverK = 1 - Math.exp(-28 * dt);
        this.camDist += (occludedDist - this.camDist) * recoverK;
      }
      useDist = this.camDist;
    } else {
      this.camDist = occludedDist;
    }

    outCamPos.set(
      outTarget.x + dirX * useDist,
      outTarget.y + dirY * useDist,
      outTarget.z + dirZ * useDist
    );

    // Clamp camera safely inside level bounds and above pool floor
    outCamPos.x = THREE.MathUtils.clamp(outCamPos.x, b.minX + 0.35, b.maxX - 0.35);
    outCamPos.z = THREE.MathUtils.clamp(outCamPos.z, b.minZ + 0.35, b.maxZ - 0.35);
    outCamPos.y = THREE.MathUtils.clamp(outCamPos.y, b.floorY + 0.4, b.ceilingY - 0.4);

    // Prevent camera from collapsing inside the player's helmet/torso mesh when backed against walls/platforms
    const bodyHoriz = Math.hypot(outCamPos.x - focusPos.x, outCamPos.z - focusPos.z);
    if (bodyHoriz < 0.75 && outCamPos.y >= focusPos.y + 0.08 && outCamPos.y <= focusPos.y + 1.98) {
      let bestScore = -1;
      let bestX = outCamPos.x;
      let bestY = outCamPos.y;
      let bestZ = outCamPos.z;
      const probeDist = 1.45;
      for (let i = 0; i < _camCandOffsets.length; i++) {
        const yaw = this.camYaw + _camCandOffsets[i];
        const rawX = THREE.MathUtils.clamp(outTarget.x + Math.sin(yaw) * probeDist, b.minX + 0.35, b.maxX - 0.35);
        const rawZ = THREE.MathUtils.clamp(outTarget.z + Math.cos(yaw) * probeDist, b.minZ + 0.35, b.maxZ - 0.35);
        const rawY = THREE.MathUtils.clamp(outTarget.y + 0.35, b.floorY + 0.4, b.ceilingY - 0.4);
        const occ = this.computeCameraWallOcclusion(outTarget.x, outTarget.y, outTarget.z, rawX, rawY, rawZ, 0.25);
        const safe = occ < 1 ? Math.max(0.1, occ * 0.92 - 0.03) : 1;
        const cx = THREE.MathUtils.clamp(outTarget.x + (rawX - outTarget.x) * safe, b.minX + 0.35, b.maxX - 0.35);
        const cy = THREE.MathUtils.clamp(outTarget.y + (rawY - outTarget.y) * safe, b.floorY + 0.4, b.ceilingY - 0.4);
        const cz = THREE.MathUtils.clamp(outTarget.z + (rawZ - outTarget.z) * safe, b.minZ + 0.35, b.maxZ - 0.35);
        const hSep = Math.hypot(cx - focusPos.x, cz - focusPos.z);
        if (hSep > bestScore) {
          bestScore = hSep;
          bestX = cx;
          bestY = cy;
          bestZ = cz;
        }
      }
      if (bestScore >= 0.72) {
        outCamPos.set(bestX, bestY, bestZ);
      } else {
        // Ultra-tight shaft fallback: lift camera cleanly above player's helmet if ceiling allows
        const upY = THREE.MathUtils.clamp(focusPos.y + 2.25, b.floorY + 0.4, b.ceilingY - 0.4);
        const occUp = this.computeCameraWallOcclusion(outTarget.x, outTarget.y, outTarget.z, outCamPos.x, upY, outCamPos.z, 0.22);
        if (occUp >= 0.99 && upY > focusPos.y + 1.98) {
          outCamPos.y = upY;
        }
      }
    }

    if (!Number.isFinite(outCamPos.x) || !Number.isFinite(outCamPos.y) || !Number.isFinite(outCamPos.z)) {
      outCamPos.set(
        THREE.MathUtils.clamp(outTarget.x, b.minX + 0.35, b.maxX - 0.35),
        THREE.MathUtils.clamp(outTarget.y + 1.2, b.floorY + 0.4, b.ceilingY - 0.4),
        THREE.MathUtils.clamp(outTarget.z + 4.8, b.minZ + 0.35, b.maxZ - 0.35)
      );
    }
  }

  private snapPlayCameraImmediate(): void {
    this.computePlayCameraGoals(_vCamTarget, _vCamPos);
    this.camera.position.copy(_vCamPos);
    this.camera.lookAt(_vCamTarget);
    this.camera.updateMatrixWorld();
    this.syncFirstPersonHeadlamp();
    this.updateVisibilityCulling();
  }

  private updatePlayCamera(dt: number): void {
    this.computePlayCameraGoals(_vCamTarget, _vCamPos, dt);
    // Apply exact 1:1 orbit position directly every frame with zero angular or vertical follow lag
    this.camera.position.copy(_vCamPos);

    // Decaying camera shake from splash/monster proximity
    if (this.camShake > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * this.camShake;
      this.camera.position.y += (Math.random() - 0.5) * this.camShake;
      this.camShake = Math.max(0, this.camShake - dt * 1.4);
    }

    this.camera.lookAt(_vCamTarget);
    this.camera.updateMatrixWorld();
    this.syncFirstPersonHeadlamp();
  }

  private checkExit(): void {
    if (this.activeWorldMode === 'open_world') return;
    if (isPlayerAtExitPortal(this.currentLevel, this.playerPos.x, this.playerPos.y, this.playerPos.z, false)) {
      this.setPhase('victory');
      this.sound.playVictory();
      this.sound.updateAtmosphere(this.simTime, 50, 'calm', false, false, false);
      this.callbacks.onPhaseChange('victory', { elapsed: this.levelTimeElapsed });
    }
  }

  private computeCameraWallOcclusion(
    targetX: number,
    targetY: number,
    targetZ: number,
    camX: number,
    camY: number,
    camZ: number,
    wallPad = 0.25
  ): number {
    const rayDx = camX - targetX;
    const rayDy = camY - targetY;
    const rayDz = camZ - targetZ;
    let bestCamT = 1.0;

    let wallCount = this.walls.length;
    let platCount = this.platforms.length;
    const useGrid = Boolean(this.spatialGrid);
    if (this.spatialGrid) {
      this.spatialGrid.queryBox(
        Math.min(targetX, camX) - wallPad - 0.5,
        Math.max(targetX, camX) + wallPad + 0.5,
        Math.min(targetZ, camZ) - wallPad - 0.5,
        Math.max(targetZ, camZ) + wallPad + 0.5,
        _camPlatIdx,
        _camWallIdx
      );
      wallCount = _camWallIdx.length;
      platCount = _camPlatIdx.length;
    }

    for (let i = 0; i < wallCount; i++) {
      const w = useGrid ? this.walls[_camWallIdx[i]] : this.walls[i];
      if (!w) continue;
      let tmin = 0;
      let tmax = bestCamT;

      if (Math.abs(rayDx) < 1e-6) {
        if (targetX < w.minX - wallPad || targetX > w.maxX + wallPad) continue;
      } else {
        const inv = 1 / rayDx;
        let t1 = (w.minX - wallPad - targetX) * inv;
        let t2 = (w.maxX + wallPad - targetX) * inv;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) continue;
      }

      if (Math.abs(rayDy) < 1e-6) {
        if (targetY < w.minY - wallPad || targetY > w.maxY + wallPad) continue;
      } else {
        const inv = 1 / rayDy;
        let t1 = (w.minY - wallPad - targetY) * inv;
        let t2 = (w.maxY + wallPad - targetY) * inv;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) continue;
      }

      if (Math.abs(rayDz) < 1e-6) {
        if (targetZ < w.minZ - wallPad || targetZ > w.maxZ + wallPad) continue;
      } else {
        const inv = 1 / rayDz;
        let t1 = (w.minZ - wallPad - targetZ) * inv;
        let t2 = (w.maxZ + wallPad - targetZ) * inv;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) continue;
      }

      if (tmin > 0 && tmin < bestCamT) {
        bestCamT = tmin;
      }
    }

    // Tight vertical platform padding prevents camera rays from falsely grazing horizontal decks
    // when jumping off or landing on platforms, while preserving full occlusion behind solid decks.
    const platPadXZ = wallPad * 0.65;
    const platPadY = Math.min(0.06, wallPad * 0.22);
    for (let i = 0; i < platCount; i++) {
      const p = useGrid ? this.platforms[_camPlatIdx[i]] : this.platforms[i];
      if (!p || p.state === 'gone') continue;
      const hw = p.def.size[0] * 0.5 + platPadXZ;
      const hh = p.def.size[1] * 0.5 + platPadY;
      const hd = p.def.size[2] * 0.5 + platPadXZ;

      let ox = targetX - p.currentPos.x;
      let oy = targetY - p.currentPos.y;
      let oz = targetZ - p.currentPos.z;
      let dx = rayDx;
      let dy = rayDy;
      let dz = rayDz;

      if (p.isRotated) {
        _vCamLocalOrig.set(ox, oy, oz).applyQuaternion(p.invQuat);
        _vCamLocalDir.set(dx, dy, dz).applyQuaternion(p.invQuat);
        ox = _vCamLocalOrig.x;
        oy = _vCamLocalOrig.y;
        oz = _vCamLocalOrig.z;
        dx = _vCamLocalDir.x;
        dy = _vCamLocalDir.y;
        dz = _vCamLocalDir.z;
      }

      let tmin = 0;
      let tmax = bestCamT;

      if (Math.abs(dx) < 1e-6) {
        if (ox < -hw || ox > hw) continue;
      } else {
        const inv = 1 / dx;
        let t1 = (-hw - ox) * inv;
        let t2 = (hw - ox) * inv;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) continue;
      }

      if (Math.abs(dy) < 1e-6) {
        if (oy < -hh || oy > hh) continue;
      } else {
        const inv = 1 / dy;
        let t1 = (-hh - oy) * inv;
        let t2 = (hh - oy) * inv;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) continue;
      }

      if (Math.abs(dz) < 1e-6) {
        if (oz < -hd || oz > hd) continue;
      } else {
        const inv = 1 / dz;
        let t1 = (-hd - oz) * inv;
        let t2 = (hd - oz) * inv;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) continue;
      }

      if (tmin > 0 && tmin < bestCamT) {
        bestCamT = tmin;
      }
    }

    return bestCamT;
  }

  private animateSecondaryMonstersDuringEat(dt: number): void {
    const waterY = this.getActiveBounds().waterY;
    for (let i = 0; i < this.monsters.length; i++) {
      const m = this.monsters[i];
      if (m === this.jumpscareMonster) continue;
      const calmCrest = Math.max(0, Math.sin(this.simTime * 0.5 + i * 1.9) - 0.58) * 0.55;
      m.pos.y = waterY - 0.14;
      m.rig.root.position.copy(m.pos);
      m.rig.root.rotation.y = 0;
      const lookAhead = _vLookAhead.set(
        m.pos.x + Math.sin(m.yaw) * 8,
        m.pos.y,
        m.pos.z + Math.cos(m.yaw) * 8
      );
      animateMonsterRig(m.rig, 'calm', lookAhead, m.pos, m.yaw, waterY, this.simTime, dt, calmCrest);
    }
  }

  private updateEatingCamera(m: RuntimeMonster, eatU: number, dt: number, headMatrixReady = false): void {
    const b = this.getActiveBounds();
    const waterY = b.waterY;
    if (!headMatrixReady) {
      m.rig.root.updateMatrixWorld(true);
      m.rig.headGroup.getWorldPosition(_vEatHeadPos);
    }

    const air = computeSerpentDevourAirborneLift(eatU, m.scale, waterY, b.ceilingY);
    const airSin = air.active ? Math.sin(air.tAir * Math.PI) : 0;

    // Frame slightly ahead of head center and pan smoothly up during airborne toss so both serpent & airborne diver fit cleanly
    const forwardBias = (0.45 - eatU * 0.16) * m.scale + air.forwardOffset * 0.34;
    const headWorld = _vCamTarget.set(
      _vEatHeadPos.x + Math.sin(m.yaw) * forwardBias + Math.cos(m.yaw) * air.lateralOffset * 0.3,
      _vEatHeadPos.y - 0.06 * m.scale + air.verticalOffset * 0.44,
      _vEatHeadPos.z + Math.cos(m.yaw) * forwardBias - Math.sin(m.yaw) * air.lateralOffset * 0.3
    );

    // 3/4 side-front cinematic framing pulling slightly wider for airborne arc, then sweeping close for bite & swallow
    const orbitAngle = m.yaw + this.eatingCamSide * THREE.MathUtils.lerp(0.98, 0.68, THREE.MathUtils.smoothstep(eatU, 0.25, 0.88));
    const camDist =
      (THREE.MathUtils.lerp(5.2, 4.15, THREE.MathUtils.smoothstep(eatU, 0.44, 0.90)) + airSin * 1.45) *
      m.scale;
    const baseCamY = waterY + THREE.MathUtils.lerp(2.1, 2.65, THREE.MathUtils.smoothstep(eatU, 0.44, 0.80)) * m.scale;
    const camY = baseCamY - airSin * 0.25 * m.scale;

    const camSpot = _vCamPos.set(
      headWorld.x + Math.sin(orbitAngle) * camDist,
      camY,
      headWorld.z + Math.cos(orbitAngle) * camDist
    );

    camSpot.x = THREE.MathUtils.clamp(camSpot.x, b.minX + 0.45, b.maxX - 0.45);
    camSpot.z = THREE.MathUtils.clamp(camSpot.z, b.minZ + 0.45, b.maxZ - 0.45);
    camSpot.y = THREE.MathUtils.clamp(
      camSpot.y,
      Math.max(b.floorY + 0.45, waterY + 0.48),
      b.ceilingY - 0.45
    );

    const bestCamT = this.computeCameraWallOcclusion(
      headWorld.x,
      headWorld.y,
      headWorld.z,
      camSpot.x,
      camSpot.y,
      camSpot.z,
      0.28
    );
    if (bestCamT < 1.0) {
      const safeT = Math.max(0.42, bestCamT * 0.94);
      camSpot.set(
        headWorld.x + (camSpot.x - headWorld.x) * safeT,
        headWorld.y + (camSpot.y - headWorld.y) * safeT,
        headWorld.z + (camSpot.z - headWorld.z) * safeT
      );
    }

    const blendK = dt > 0 ? 1 - Math.exp(-10.5 * dt) : 0.35;
    this.camera.position.lerp(camSpot, blendK);

    // Realistic cinematic impact camera shake, catch clamp shock, and swallow convulsion jolts
    const impactShake = Math.exp(-eatU * 11.0) * 0.24;
    const catchShock = Math.sin(THREE.MathUtils.clamp((eatU - 0.46) / 0.14, 0, 1) * Math.PI) * 0.14;
    const gulp1Jolt = Math.sin(THREE.MathUtils.clamp((eatU - 0.58) / 0.18, 0, 1) * Math.PI) * 0.08;
    const gulp2Jolt = Math.sin(THREE.MathUtils.clamp((eatU - 0.74) / 0.18, 0, 1) * Math.PI) * 0.095;
    const totalShake = Math.max(this.camShake, impactShake + catchShock + gulp1Jolt + gulp2Jolt);

    if (totalShake > 0.001) {
      const hfX = Math.sin(this.simTime * 53.0) * 0.55 + (Math.random() - 0.5) * 0.9;
      const hfY = Math.cos(this.simTime * 47.0) * 0.55 + (Math.random() - 0.5) * 0.9;
      this.camera.position.x += hfX * totalShake * 0.55;
      this.camera.position.y += hfY * totalShake * 0.55;
      this.camShake = Math.max(0, this.camShake - dt * 1.45);
    }

    // Wide terror framing during airborne launch, tightening inward as jaws clamp & swallow
    const strikeKickFov = Math.exp(-eatU * 11.0) * 5.0 + airSin * 4.5;
    const targetFov = THREE.MathUtils.lerp(68, 61.5, THREE.MathUtils.smoothstep(eatU, 0.46, 0.94)) + strikeKickFov;
    if (Math.abs(this.camera.fov - targetFov) > 0.25) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, dt > 0 ? Math.min(1, dt * 14) : 1);
      this.camera.updateProjectionMatrix();
    }

    this.camera.lookAt(headWorld);

    // Subtle handheld Dutch-roll trauma after lookAt so impact shock & catch/gulps tilt the frame violently
    const rollImpact = Math.sin(this.simTime * 34.0) * Math.exp(-eatU * 8.5) * 0.068;
    const rollCatch = Math.sin(this.simTime * 27.0) * catchShock * 0.42;
    const rollGulp = Math.sin(this.simTime * 21.0) * (gulp1Jolt + gulp2Jolt) * 0.52;
    this.camera.rotateZ(rollImpact + rollCatch + rollGulp);
  }

  private updateDevourHorrorFX(m: RuntimeMonster | null, eatU: number, dt: number, headMatrixReady = false): void {
    this.horrorVisualActive = true;
    const k = dt > 0 ? Math.min(1, dt * 14) : 1;
    this.horrorVisualBlend = THREE.MathUtils.lerp(this.horrorVisualBlend, 1, k);
    const b = this.horrorVisualBlend;

    // 1. Plunge surrounding poolroom ambient/key lights into deep survival-horror darkness
    if (this.hemiLight) {
      _horrorBaseHemiSky.copy(this.baseHemiColor);
      this.hemiLight.color.copy(_horrorBaseHemiSky).lerp(_horrorHemiSky, b);
      this.hemiLight.intensity = THREE.MathUtils.lerp(this.baseHemiIntensity, 0.06, b);
    }
    if (this.rimLight) {
      this.rimLight.intensity = THREE.MathUtils.lerp(this.baseRimIntensity, 0.08, b);
    }
    if (this.keyLight) {
      this.keyLight.intensity = THREE.MathUtils.lerp(this.baseKeyIntensity, 0.18, b);
    }

    // Dim remaining overhead pool fixtures and inject dying-bulb strike flicker
    const flicker =
      eatU < 0.34 && Math.sin(this.simTime * 59.0) * Math.cos(this.simTime * 37.0) > 0.35
        ? 0.04
        : 0.16;
    const reserveStart = m ? 2 : 0;
    for (let i = reserveStart; i < this.pointLightPool.length; i++) {
      this.pointLightPool[i].intensity *= THREE.MathUtils.lerp(1, flicker, b);
    }

    // 2. Abyssal choking fog & background
    if (this.scene.fog instanceof THREE.FogExp2 && this.scene.background instanceof THREE.Color) {
      this.scene.fog.color.lerp(_horrorAbyssColor, b * 0.94);
      this.scene.background.lerp(_horrorAbyssColor, b * 0.94);
      const targetDenseFog = Math.max(this.baseFogDensity * 2.45, 0.058);
      this.scene.fog.density = THREE.MathUtils.lerp(this.scene.fog.density, targetDenseFog, b * 0.9);
    }

    // 3. Dedicated dramatic predator SpotLight + pooled Crimson Mouth/Gullet Light + Cold Rim Light
    if (m && this.horrorSpotLight) {
      if (!headMatrixReady) {
        m.rig.root.updateMatrixWorld(true);
        m.rig.headGroup.getWorldPosition(_vEatHeadPos);
      }
      const fwdX = Math.sin(m.yaw);
      const fwdZ = Math.cos(m.yaw);
      const sideX = Math.cos(m.yaw) * this.eatingCamSide;
      const sideZ = -Math.sin(m.yaw) * this.eatingCamSide;

      const activeB = this.getActiveBounds();
      const spotAir = computeSerpentDevourAirborneLift(
        eatU,
        m.scale,
        activeB.waterY,
        activeB.ceilingY
      );
      // Keep horrorSpotLight.castShadow permanently false to avoid WebGL shader recompilation & 2nd shadow pass stall
      this.horrorSpotLight.position.set(
        _vEatHeadPos.x + fwdX * 1.9 * m.scale + sideX * 2.1 * m.scale,
        Math.min(activeB.ceilingY - 0.5, _vEatHeadPos.y + 4.9 * m.scale + spotAir.verticalOffset * 0.4),
        _vEatHeadPos.z + fwdZ * 1.9 * m.scale + sideZ * 2.1 * m.scale
      );
      this.horrorSpotLight.target.position.set(
        _vEatHeadPos.x + fwdX * (0.35 * m.scale + spotAir.forwardOffset * 0.45),
        _vEatHeadPos.y - 0.12 * m.scale + spotAir.verticalOffset * 0.45,
        _vEatHeadPos.z + fwdZ * (0.35 * m.scale + spotAir.forwardOffset * 0.45)
      );
      this.horrorSpotLight.target.updateMatrixWorld();
      const spotFlicker =
        eatU < 0.22 && Math.sin(this.simTime * 48.0) > 0.65 ? 11.5 : 19.5;
      this.horrorSpotLight.intensity = spotFlicker * b;

      // Repurpose pointLightPool[0] for visceral internal crimson jaw glow (zero extra scene lights)
      const jawLight = this.pointLightPool[0];
      if (jawLight) {
        const jawPulse1 = Math.sin(THREE.MathUtils.clamp((eatU - 0.38) / 0.24, 0, 1) * Math.PI);
        const jawPulse2 = Math.sin(THREE.MathUtils.clamp((eatU - 0.62) / 0.24, 0, 1) * Math.PI);
        const jawOpenAmt = 1 - THREE.MathUtils.smoothstep(eatU, 0.78, 0.98);
        _vHorrorJawPos.set(
          _vEatHeadPos.x + fwdX * 0.44 * m.scale,
          _vEatHeadPos.y - 0.1 * m.scale,
          _vEatHeadPos.z + fwdZ * 0.44 * m.scale
        );
        jawLight.color.set('#ff160f');
        jawLight.distance = 9.5;
        jawLight.decay = 1.85;
        jawLight.position.copy(_vHorrorJawPos);
        jawLight.intensity =
          (3.6 * jawOpenAmt + jawPulse1 * 2.6 + jawPulse2 * 3.1 + 0.5) * b;
      }

      // Repurpose pointLightPool[1] for cold silhouette rim behind horns & dorsal ridge
      const rimLight = this.pointLightPool[1];
      if (rimLight) {
        rimLight.color.set('#4d8ea8');
        rimLight.distance = 14;
        rimLight.decay = 1.6;
        rimLight.position.set(
          _vEatHeadPos.x - fwdX * 2.6 * m.scale - sideX * 1.3 * m.scale,
          _vEatHeadPos.y + 2.2 * m.scale,
          _vEatHeadPos.z - fwdZ * 2.6 * m.scale - sideZ * 1.3 * m.scale
        );
        rimLight.intensity = 7.5 * b;
      }
    }

    // Suppress invisible underwater caustics once deep devouring darkness kicks in
    if (b > 0.85) {
      this.uCausticEnabled.value = 0;
    }

    // 4. High-contrast exposure flash on strike -> dark dread -> blackout fade at disappearance
    const strikeFlash = Math.exp(-eatU * 14.0) * 0.24;
    const swallowDarken = THREE.MathUtils.smoothstep(eatU, 0.78, 1.0) * 0.42;
    this.renderer.toneMappingExposure = THREE.MathUtils.clamp(
      (0.95 + strikeFlash - swallowDarken),
      0.48,
      1.26
    );

    // 5. GPU Radial Motion Blur, Chromatic Shock, Filmic Shadow Crush & Vignette
    if (this.horrorPass && this.activeQuality !== 'smooth') {
      const impactBlur = Math.exp(-eatU * 7.5) * 0.036;
      const swallowBlur =
        (Math.sin(THREE.MathUtils.clamp((eatU - 0.38) / 0.22, 0, 1) * Math.PI) +
          Math.sin(THREE.MathUtils.clamp((eatU - 0.64) / 0.22, 0, 1) * Math.PI)) *
        0.015;
      this.horrorPass.uniforms.uIntensity.value = b;
      this.horrorPass.uniforms.uMotionBlur.value = (0.006 + impactBlur + swallowBlur) * b;
      this.horrorPass.uniforms.uChroma.value = (0.002 + Math.exp(-eatU * 5.2) * 0.0075) * b;
      this.horrorPass.uniforms.uVignette.value = THREE.MathUtils.lerp(0.88, 1.36, eatU) * b;
      this.horrorPass.uniforms.uTime.value = this.simTime;
    }
  }

  private resetHorrorVisualState(): void {
    this.horrorVisualActive = false;
    this.horrorVisualBlend = 0;
    this.uCausticEnabled.value = this.baseCausticEnabled;
    if (this.horrorSpotLight) {
      this.horrorSpotLight.intensity = 0;
      this.horrorSpotLight.castShadow = false;
    }
    for (let i = 0; i < Math.min(2, this.pointLightPool.length); i++) {
      const pl = this.pointLightPool[i];
      pl.distance = 50;
      pl.decay = 1.35;
      pl.intensity = 0;
    }
    this._lastLightCamX = NaN;
    if (this.hemiLight) {
      if (this.baseHemiColor) this.hemiLight.color.copy(this.baseHemiColor);
      else this.hemiLight.color.set(this.currentLevel.ambientTint);
      this.hemiLight.intensity = this.baseHemiIntensity ?? 0.72;
    }
    if (this.rimLight) {
      this.rimLight.intensity = this.baseRimIntensity ?? 0.46;
    }
    if (this.keyLight) {
      this.keyLight.intensity = this.baseKeyIntensity ?? 1.25;
    }
    if (this.renderer) {
      this.renderer.toneMappingExposure = 1.14;
    }
    if (this.camera && this.camera.fov !== 68) {
      this.camera.fov = 68;
      this.camera.updateProjectionMatrix();
    }
    if (this.scene?.fog instanceof THREE.FogExp2 && this.scene.background instanceof THREE.Color) {
      this.scene.fog.color.copy(this.baseFogColor);
      this.scene.background.copy(this.baseFogColor);
      this.scene.fog.density = this.baseFogDensity ?? this.currentLevel.fogDensity;
    }
    if (this.horrorPass) {
      this.horrorPass.uniforms.uIntensity.value = 0;
      this.horrorPass.uniforms.uMotionBlur.value = 0;
      this.horrorPass.uniforms.uChroma.value = 0;
      this.horrorPass.uniforms.uVignette.value = 0;
    }
  }

  private respawnSinglePlayerAtLevelStart(reason: 'caught' | 'timeout'): void {
    if (this.spRespawning) {
      console.warn('[SERPENTIS][RESPAWN][SP] Skipped single-player respawn', {
        spRespawning: this.spRespawning,
        reason,
      });
      return;
    }
    this.spRespawning = true;
    try {
      this.sound.stopEatingScreams(0.06);
      this.sound.stopSnakeSwimmingAudio(0.06);

      for (const m of this.monsters) {
        if (m.eatingUserId) {
          this.sound.stopAttackEatingAudio(`${m.id}:${m.eatingUserId}`, 0.06);
        }
        m.alert = 'calm';
        m.emerged = false;
        m.targetUserId = null;
        m.searchTimer = 0;
        m.stuckTimer = 0;
        m.avoidTimer = 0;
        m.velX = 0;
        m.velZ = 0;
        m.navBestDist = Infinity;
        m.navStallTimer = 0;
        m.navAnchorX = m.pos.x;
        m.navAnchorZ = m.pos.z;
        m.navAnchorTimer = 0;
        m.navTurnAccum = 0;
        m.eatingUserId = null;
        m.eatingTimer = 0;
        m.eatingProgress = -1;
        m.eatingGulpStage = 0;
        m.eatingSwallowAudioPlayed = false;
        m.safeEpoch = 0;
        m.intimidationPhase = 'none';
        m.intimidationTimer = 0;
        m.intimidationDuration = 0;
        m.intimidationPlatform = null;
        m.diveTimer = 0;
        m.visionState = 'none';
        m.visionTimer = 0;
        m.watchingUserId = null;
        m.lookAway = false;
        m.lookAwayYaw = m.yaw;
        m.pos.y = this.getActiveBounds().waterY - 0.14;
        m.rig.root.position.copy(m.pos);
        m.rig.root.rotation.y = 0;
        resetSerpentTrail(m.rig, m.pos, m.yaw);
      }

      if (this.activeWorldMode === 'open_world') {
        if (!this.owCheckpointId && !this.coopMode) {
          this.activeSpawn.set(OPEN_WORLD_SPAWN.x, OPEN_WORLD_SPAWN.y, OPEN_WORLD_SPAWN.z);
          this.owCheckpointYaw = OPEN_WORLD_SPAWN.yaw;
        }
        this.playerPos.copy(this.activeSpawn);
        this.updateOpenWorldStreaming(true);
        this.syncOpenWorldCheckpointVisuals();
        this.checkpointNotice = this.owCheckpointLabel
          ? `RESPAWNED AT ${this.owCheckpointLabel.toUpperCase()}`
          : 'RESPAWNED AT REGION 01 ENTRY DOCK';
        this.checkpointNoticeTimer = 2.4;
      } else {
        this.activeCheckpointIndex = 0;
        this.activeSpawn.set(
          this.currentLevel.spawn[0],
          this.currentLevel.spawn[1],
          this.currentLevel.spawn[2]
        );
        this.checkpointNotice = 'RESPAWNED AT SECTOR START';
        this.checkpointNoticeTimer = 2.2;
        this.levelTimeRemaining = this.currentLevel.timeLimit;

        for (const cp of this.checkpoints) {
          cp.activated = false;
          cp.beaconMat.color.setHex(0xebb144);
          cp.beaconMat.emissive.setHex(0xd99626);
          cp.lightColor.setHex(0xebb144);
        }
      }

      for (const p of this.platforms) {
        if (p.def.kind === 'disappearing') {
          p.state = 'solid';
          p.stateTimer = 0;
          p.mesh.visible = true;
          p.currentPos.set(p.def.position[0], p.def.position[1], p.def.position[2]);
          p.prevPos.copy(p.currentPos);
          p.mesh.position.copy(p.currentPos);
          p.material.color.setHex(p.baseColorHex);
          p.material.emissive.setHex(0x000000);
          p.material.emissiveIntensity = 0;
        }
      }

      this.deathReason = null;
      this.jumpscareMonster = null;
      this.jumpscareTimer = 0;
      this.playerWaterEpoch = 0;
      this.playerInWaterSession = false;
      this.pendingClimbIntimidation = false;
      this.isWatchedFreezeActive = false;
      this.watchFreezeGraceTimer = 0;
      this.watchMoveAttempted = false;
      this.lastAnimState = 'idle';
      this.lastHorizSpeed = 0;
      this.camShake = 0;
      this.heldKeys.clear();
      this.virtualMove.x = 0;
      this.virtualMove.y = 0;
      this.virtualRun = false;
      this.virtualAutoRun = false;
      this.releaseDragPointerCapture();
      this.pendingLookDx = 0;
      this.pendingLookDy = 0;
      this.jumpBufferTimer = 0;

      this.resetHorrorVisualState();
      this.camera.up.set(0, 1, 0);
      this.camera.fov = 68;
      this.camera.updateProjectionMatrix();
      this.lastCamThirdPerson = this.isThirdPersonView();

      this.phase = 'playing';
      this.needsStaticRender = true;
      this.resetFpsTracker();

      if (this.playerRig.root.parent !== this.scene) {
        this.scene.add(this.playerRig.root);
      }
      resetPlayerRigPose(this.playerRig);
      this.playerRig.setVisible(true);
      this.restoreLocalPlayerMeshes();
      this.respawnAtActiveCheckpoint(true);
      this.playerRig.setVisible(true);
      this.ensureLocalPlayerVisible();
      this.syncLocalPlayerRigTransform('idle', 0);
      this.snapPlayCameraImmediate();
      this.ensureLoopRunning();
      this.callbacks.onPhaseChange('playing');
      this.emitHud(true);

      console.info('[SERPENTIS][RESPAWN][SP] Respawned local player at level start', {
        reason,
        levelId: this.currentLevel.id,
        pos: [
          Math.round(this.playerPos.x * 100) / 100,
          Math.round(this.playerPos.y * 100) / 100,
          Math.round(this.playerPos.z * 100) / 100,
        ],
        camPos: [
          Math.round(this.camera.position.x * 100) / 100,
          Math.round(this.camera.position.y * 100) / 100,
          Math.round(this.camera.position.z * 100) / 100,
        ],
        rigInScene: this.playerRig.root.parent === this.scene,
        rootVisible: this.playerRig.root.visible,
        hipsVisible: this.playerRig.hips.visible,
        rigScale: this.playerRig.root.scale.x,
        grounded: this.grounded,
        phase: this.phase,
      });
    } finally {
      this.spRespawning = false;
    }
  }

  private triggerDeath(reason: 'caught' | 'timeout', monster: RuntimeMonster | null): void {
    if (this.phase !== 'playing') return;
    console.info('[SERPENTIS][DEATH][SP] Triggered death sequence', {
      reason,
      levelId: this.currentLevel.id,
      monsterId: monster?.id ?? null,
    });
    this.sound.stopSnakeSwimmingAudio(0.1);
    this.deathReason = reason;
    this.jumpscareMonster = monster;
    this.phase = 'jumpscare';

    if (reason === 'caught' && monster) {
      this.jumpscareTimer = EAT_DURATION_SEC;
      if (this.playerRig.root.parent !== this.scene) {
        this.scene.add(this.playerRig.root);
      }
      this.playerRig.root.scale.setScalar(1);
      this.playerRig.setVisible(true);
      this.restoreLocalPlayerMeshes();
      this.beginMonsterEatingSequence(
        monster,
        '__local__',
        this.playerPos.x,
        this.playerPos.y,
        this.playerPos.z,
        this.playerYaw,
        0
      );
      this.eatingCamSide = this.chooseEatingCamSide(monster);
      this.sound.playEatingStrike(1.0);
      this.camShake = Math.max(this.camShake, 0.48);
    } else {
      this.jumpscareTimer = 0.95;
      if (reason === 'caught') {
        this.playerRig.setVisible(false);
      }
      this.sound.playJumpscare();
    }

    this.heldKeys.clear();
    this.virtualMove.x = 0;
    this.virtualMove.y = 0;
    this.virtualRun = false;
    this.virtualAutoRun = false;
    this.releaseDragPointerCapture();
    this.pendingLookDx = 0;
    this.pendingLookDy = 0;
    this.jumpBufferTimer = 0;
    try {
      if (document.pointerLockElement === this.renderer.domElement) {
        document.exitPointerLock();
      }
    } catch {
      // ignore pointer lock errors inside sandboxed iframes
    }
    this.sound.updateAtmosphere(this.simTime, 2, 'chasing', false, false, false);
    if (this.coopMode && this.activeWorldMode === 'open_world' && reason === 'caught') {
      this.coopDeathSeq = (this.coopDeathSeq || 0) + 1;
      this.coopRespawnSentForSeq = 0;
      this.callbacks.onCoopPlayerEaten?.({
        deathSeq: this.coopDeathSeq,
        monsterId: monster?.id ?? 'ow_serpent',
        monsterX: monster?.pos.x ?? this.playerPos.x,
        monsterY: monster?.pos.y ?? this.playerPos.y,
        monsterZ: monster?.pos.z ?? this.playerPos.z,
        playerX: this.playerPos.x,
        playerY: this.playerPos.y,
        playerZ: this.playerPos.z,
        playerYaw: this.playerYaw,
      });
    }
    this.callbacks.onPhaseChange('jumpscare', { deathReason: reason });
  }

  private updateJumpscare(dt: number): void {
    this.jumpscareTimer -= dt;
    if (this.jumpscareMonster) {
      const m = this.jumpscareMonster;
      const b = this.getActiveBounds();
      const waterY = b.waterY;

      // Full realistic eating sequence when caught by a sea serpent
      if (m.eatingUserId) {
        this.stepMonsterEating(m, dt, true);
        this.updateEatingCamera(m, m.eatingProgress, dt, true);
        this.updateDevourHorrorFX(m, m.eatingProgress, dt, true);

        if (this.jumpscareTimer <= 0) {
          if (m.eatingUserId) {
            this.sound.stopAttackEatingAudio(`${m.id}:${m.eatingUserId}`, 0.08);
          }
          m.eatingUserId = null;
          m.eatingProgress = -1;
          if (this.coopMode && this.activeWorldMode === 'open_world' && this.coopRespawnSentForSeq !== this.coopDeathSeq) {
            this.coopRespawnSentForSeq = this.coopDeathSeq;
            this.callbacks.onCoopRequestRespawn?.(this.coopDeathSeq);
          }
          this.respawnSinglePlayerAtLevelStart(this.deathReason || 'caught');
        }
        return;
      }

      // Timeout or fallback lunge
      const progress = THREE.MathUtils.clamp(1 - this.jumpscareTimer / 0.95, 0, 1);
      m.rig.emergeAmount = 1;
      m.pos.y = waterY - 0.14;
      m.rig.root.position.copy(m.pos);
      m.rig.root.rotation.y = 0;

      const lungeDist = THREE.MathUtils.lerp(2.95, 1.85, progress);
      const headWorld = _vPlayerPos.set(
        m.pos.x + Math.sin(m.yaw) * 0.86 * m.scale,
        m.pos.y + 1.82 * m.scale,
        m.pos.z + Math.cos(m.yaw) * 0.86 * m.scale
      );
      const camSpot = _vCamPos.set(
        m.pos.x + Math.sin(m.yaw) * lungeDist * m.scale,
        m.pos.y + 1.78 * m.scale,
        m.pos.z + Math.cos(m.yaw) * lungeDist * m.scale
      );

      camSpot.x = THREE.MathUtils.clamp(camSpot.x, b.minX + 0.45, b.maxX - 0.45);
      camSpot.z = THREE.MathUtils.clamp(camSpot.z, b.minZ + 0.45, b.maxZ - 0.45);
      camSpot.y = THREE.MathUtils.clamp(camSpot.y, b.floorY + 0.4, b.ceilingY - 0.4);

      const bestCamT = this.computeCameraWallOcclusion(
        headWorld.x,
        headWorld.y,
        headWorld.z,
        camSpot.x,
        camSpot.y,
        camSpot.z,
        0.25
      );
      if (bestCamT < 1.0) {
        const safeT = Math.max(0.35, bestCamT * 0.94);
        camSpot.set(
          headWorld.x + (camSpot.x - headWorld.x) * safeT,
          headWorld.y + (camSpot.y - headWorld.y) * safeT,
          headWorld.z + (camSpot.z - headWorld.z) * safeT
        );
      }

      if (Math.hypot(camSpot.x - headWorld.x, camSpot.z - headWorld.z) < 0.08) {
        const safeScale = m.scale || 1;
        camSpot.x = THREE.MathUtils.clamp(
          headWorld.x + Math.sin(m.yaw) * 0.45 * safeScale,
          b.minX + 0.45,
          b.maxX - 0.45
        );
        camSpot.z = THREE.MathUtils.clamp(
          headWorld.z + Math.cos(m.yaw) * 0.45 * safeScale,
          b.minZ + 0.45,
          b.maxZ - 0.45
        );
        if (Math.hypot(camSpot.x - headWorld.x, camSpot.z - headWorld.z) < 0.05) {
          camSpot.z = headWorld.z + (headWorld.z > 0 ? -0.35 : 0.35);
        }
      }

      this.camera.position.copy(camSpot);
      this.camera.position.x += (Math.random() - 0.5) * 0.24;
      this.camera.position.y += (Math.random() - 0.5) * 0.24;
      this.camera.lookAt(headWorld);
      animateMonsterRig(m.rig, 'chasing', camSpot, m.pos, m.yaw, waterY, this.simTime * 2.4, dt, 1);
      this.updateDevourHorrorFX(m, progress, dt);
    } else {
      this.updateDevourHorrorFX(null, THREE.MathUtils.clamp(1 - this.jumpscareTimer / 0.95, 0, 1), dt);
    }

    if (this.jumpscareTimer <= 0) {
      if (this.coopMode && this.activeWorldMode === 'open_world' && this.coopRespawnSentForSeq !== this.coopDeathSeq) {
        this.coopRespawnSentForSeq = this.coopDeathSeq;
        this.callbacks.onCoopRequestRespawn?.(this.coopDeathSeq);
      }
      this.respawnSinglePlayerAtLevelStart(this.deathReason || 'caught');
    }
  }

  private emitHud(force = false): void {
    const focusPos = this.getCameraFocusPos();
    let minMonsterDist = 999;
    let alertState: 'calm' | 'searching' | 'chasing' = 'calm';
    for (const m of this.monsters) {
      const d = Math.hypot(focusPos.x - m.pos.x, focusPos.z - m.pos.z);
      if (d < minMonsterDist) minMonsterDist = d;
      if (m.alert === 'chasing') alertState = 'chasing';
      else if (m.alert === 'searching' && alertState === 'calm') alertState = 'searching';
    }

    const isOW = this.activeWorldMode === 'open_world';
    const owMeta = isOW ? getWorldRegionMeta(this.owCurrentRegionId) : null;
    const regionId = isOW ? this.owCurrentRegionId : this.currentLevel.id;
    const wingIndex = owMeta ? owMeta.wingIndex : Math.floor((this.currentLevel.id - 1) / 10);
    const wingTitle = owMeta ? owMeta.wingTitle : '';
    const checkpointId = isOW ? this.owCheckpointId : null;
    const checkpointRegionId = isOW ? this.owCheckpointRegionId : this.currentLevel.id;
    const checkpointLabel = isOW ? this.owCheckpointLabel : null;

    const timeRemaining = Math.round(Math.max(0, this.levelTimeRemaining) * 10) / 10;
    const timeElapsed = Math.round(this.levelTimeElapsed * 10) / 10;
    const stamina = Math.round(this.stamina);
    const inWater = this.inWater;
    const underwater = this.camera.position.y < this.getActiveBounds().waterY;
    const waterJumpCooldown =
      this.inWater ? Math.round(Math.max(0, this.waterJumpCooldown) * 10) / 10 : 0;
    const monsterDist = Math.round(minMonsterDist);

    const prev = this.lastHudSnap;
    const curWorldMode: WorldMode = this.activeWorldMode ?? 'sector';
    if (
      !force &&
      prev.levelId === this.currentLevel.id &&
      prev.worldMode === curWorldMode &&
      prev.regionId === regionId &&
      prev.wingIndex === wingIndex &&
      prev.wingTitle === wingTitle &&
      prev.checkpointId === checkpointId &&
      prev.checkpointRegionId === checkpointRegionId &&
      prev.checkpointLabel === checkpointLabel &&
      prev.timeRemaining === timeRemaining &&
      prev.timeElapsed === timeElapsed &&
      prev.stamina === stamina &&
      prev.inWater === inWater &&
      prev.underwater === underwater &&
      prev.waterJumpCooldown === waterJumpCooldown &&
      prev.monsterDist === monsterDist &&
      prev.monsterAlert === alertState &&
      prev.checkpointIndex === this.activeCheckpointIndex &&
      prev.totalCheckpoints === this.checkpoints.length &&
      prev.checkpointNotice === this.checkpointNotice &&
      prev.activeQuality === this.activeQuality &&
      prev.fps === this.currentFps &&
      prev.isPointerLocked === this.isPointerLocked &&
      prev.deathReason === this.deathReason
    ) {
      return;
    }

    prev.levelId = this.currentLevel.id;
    prev.worldMode = curWorldMode;
    prev.regionId = regionId;
    prev.wingIndex = wingIndex;
    prev.wingTitle = wingTitle;
    prev.checkpointId = checkpointId;
    prev.checkpointRegionId = checkpointRegionId;
    prev.checkpointLabel = checkpointLabel;
    prev.timeRemaining = timeRemaining;
    prev.timeElapsed = timeElapsed;
    prev.stamina = stamina;
    prev.inWater = inWater;
    prev.underwater = underwater;
    prev.waterJumpCooldown = waterJumpCooldown;
    prev.monsterDist = monsterDist;
    prev.monsterAlert = alertState;
    prev.checkpointIndex = this.activeCheckpointIndex;
    prev.totalCheckpoints = this.checkpoints.length;
    prev.checkpointNotice = this.checkpointNotice;
    prev.activeQuality = this.activeQuality;
    prev.fps = this.currentFps;
    prev.isPointerLocked = this.isPointerLocked;
    prev.deathReason = this.deathReason;

    this.callbacks.onHudUpdate({
      levelId: this.currentLevel.id,
      levelCode: this.currentLevel.code,
      levelName: this.currentLevel.name,
      worldMode: curWorldMode,
      regionId,
      wingIndex,
      wingTitle: wingTitle || undefined,
      checkpointId,
      checkpointRegionId,
      checkpointLabel,
      timeRemaining,
      timeElapsed,
      stamina,
      inWater,
      underwater,
      waterJumpCooldown,
      monsterDist,
      monsterAlert: alertState,
      checkpointIndex: this.activeCheckpointIndex,
      totalCheckpoints: this.checkpoints.length,
      checkpointNotice: this.checkpointNotice,
      activeQuality: this.activeQuality,
      fps: this.currentFps,
      isPointerLocked: this.isPointerLocked,
      deathReason: this.deathReason,
    });
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    this.sound.unlock();
    if (e.code === 'Escape') {
      if (this.phase === 'playing') {
        this.setPhase('paused');
        this.callbacks.onPhaseChange('paused');
      } else if (this.phase === 'paused') {
        this.setPhase('playing');
        this.callbacks.onPhaseChange('playing');
      }
      return;
    }

    if (this.phase !== 'playing') return;

    if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat) this.triggerJump();
    }
    this.heldKeys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.heldKeys.delete(e.code);
  };

  private onWindowBlur = (): void => {
    this.heldKeys.clear();
    this.pendingLookDx = 0;
    this.pendingLookDy = 0;
    this.releaseDragPointerCapture();
  };

  private onPointerDown = (e: PointerEvent): void => {
    this.sound.unlock();
    if (this.phase !== 'playing') return;
    if (e.pointerType === 'mouse') {
      const dom = this.renderer.domElement as HTMLCanvasElement & {
        requestPointerLock?: (options?: { unadjustedMovement?: boolean }) => Promise<void> | void;
      };
      this.isDraggingLook = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      // Request raw unadjusted pointer lock on desktop canvas click for true 1:1 mouse tracking
      if (document.pointerLockElement !== dom && e.button === 0) {
        try {
          const lockResult = dom.requestPointerLock?.({ unadjustedMovement: true });
          if (lockResult && typeof (lockResult as Promise<void>).catch === 'function') {
            (lockResult as Promise<void>).catch(() => {
              try {
                dom.requestPointerLock?.();
              } catch {
                // fallback to drag-look if pointer lock is blocked by iframe sandbox
              }
            });
          }
        } catch {
          try {
            dom.requestPointerLock?.();
          } catch {
            // fallback to drag-look if pointer lock is blocked by iframe sandbox
          }
        }
      }
      if (document.pointerLockElement !== dom) {
        this.activeDragPointerId = e.pointerId;
        try {
          dom.setPointerCapture?.(e.pointerId);
        } catch {
          // ignore if pointer capture is unavailable
        }
      }
    }
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (this.phase !== 'playing') return;
    if (this.isPointerLocked || document.pointerLockElement === this.renderer.domElement) {
      const dx = e.movementX;
      const dy = e.movementY;
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
      // Ignore rare single-event Chromium cursor-warp glitch right when pointer lock engages
      if (
        this.pointerLockAcquiredAt > 0 &&
        performance.now() - this.pointerLockAcquiredAt < 90 &&
        (Math.abs(dx) > 350 || Math.abs(dy) > 350)
      ) {
        return;
      }
      this.pendingLookDx += dx;
      this.pendingLookDy += dy;
    }
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (this.phase !== 'playing') return;
    if (e.pointerType !== 'mouse' || !this.isDraggingLook) return;
    if (this.isPointerLocked || document.pointerLockElement === this.renderer.domElement) return;
    if (this.activeDragPointerId !== null && e.pointerId !== this.activeDragPointerId) return;
    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    if (Number.isFinite(dx) && Number.isFinite(dy)) {
      this.pendingLookDx += dx;
      this.pendingLookDy += dy;
    }
  };

  private onPointerUp = (e?: PointerEvent): void => {
    if (e && this.activeDragPointerId !== null && e.pointerId !== this.activeDragPointerId) return;
    this.releaseDragPointerCapture();
  };

  private onPointerLockChange = (): void => {
    const locked = document.pointerLockElement === this.renderer.domElement;
    this.isPointerLocked = locked;
    this.pendingLookDx = 0;
    this.pendingLookDy = 0;
    if (locked) {
      this.pointerLockAcquiredAt = performance.now();
      this.releaseDragPointerCapture();
    } else {
      this.pointerLockAcquiredAt = 0;
    }
    this.emitHud();
  };

  private handleViewportResize(): void {
    const vp = this.getViewportSize();
    if (vp.w === this._appliedViewportW && vp.h === this._appliedViewportH) {
      return;
    }
    const aspect = vp.w / vp.h;
    if (Number.isFinite(aspect) && aspect > 0) {
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
    }
    this.renderer.setSize?.(vp.w, vp.h);
    this._appliedViewportW = vp.w;
    this._appliedViewportH = vp.h;
    if (this.horrorComposer) {
      const composerDpr = Math.min(Math.max(0.72, this._appliedPixelRatio > 0 ? this._appliedPixelRatio : 1), this.isTouchDevice ? 0.85 : 1.25);
      this.horrorComposer.setPixelRatio(composerDpr);
      this.horrorComposer.setSize(vp.w, vp.h);
    }
    this.needsStaticRender = true;
    this.ensureLoopRunning();
  }

  private onResize = (): void => {
    this.handleViewportResize();
  };

  private onVisibilityChange = (): void => {
    const hidden = document.hidden;
    this.suspended = hidden;
    if (hidden) {
      this.cancelScheduledTick();
      this.heldKeys.clear();
      this.pendingLookDx = 0;
      this.pendingLookDy = 0;
      this.releaseDragPointerCapture();
    } else if (!this.disposed && !this.contextLost) {
      this.lastTimeMs = performance.now();
      this.heldKeys.clear();
      this.pendingLookDx = 0;
      this.pendingLookDy = 0;
      this.releaseDragPointerCapture();
      this.handleViewportResize();
      if (this.phase === 'playing') {
        this.ensureLocalPlayerVisible();
        this.syncLocalPlayerRigTransform(this.lastAnimState, this.lastHorizSpeed);
      }
      this.needsStaticRender = true;
      this.ensureLoopRunning();
      console.info('[SERPENTIS][LIFECYCLE] Visibility resumed', {
        phase: this.phase,
        levelId: this.currentLevel.id,
        worldMode: this.activeWorldMode,
        pos: [
          Math.round(this.playerPos.x * 100) / 100,
          Math.round(this.playerPos.y * 100) / 100,
          Math.round(this.playerPos.z * 100) / 100,
        ],
        camPos: [
          Math.round(this.camera.position.x * 100) / 100,
          Math.round(this.camera.position.y * 100) / 100,
          Math.round(this.camera.position.z * 100) / 100,
        ],
      });
    }
  };

  private onContextLost = (e: Event): void => {
    e.preventDefault();
    this.contextLost = true;
    this.cancelScheduledTick();
  };

  private onContextRestored = (): void => {
    if (this.disposed) return;
    this.contextLost = false;
    try {
      const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
      const horrorEnv = this.createHorrorEnvironmentScene();
      const nextEnvRT = pmremGenerator.fromScene(horrorEnv.scene, 0.055);
      this.envRT?.dispose();
      this.envRT = nextEnvRT;
      this.scene.environment = this.envRT.texture;
      horrorEnv.dispose();
      pmremGenerator.dispose();
    } catch {
      // ignore if WebGL context is still warming up
    }
    // Re-upload all procedural canvas textures (level + characters + serpent) after GPU memory eviction
    this.textures.markAllDirty?.();
    markEntityTexturesDirty(this.textures);
    this._appliedPixelRatio = -1;
    this._appliedViewportW = 0;
    this._appliedViewportH = 0;
    this._appliedShadowEnabled = null;
    this._appliedShadowType = null;
    this._appliedAniso = -1;
    this._appliedQualityTier = '';
    this.coreShadersWarmed = false;
    this.horrorShadowWarmed = false;
    this.horrorComposerWarmed = false;
    this.applyQualityToRenderer();
    if (this.phase === 'playing') {
      this.playerRig.setVisible(true);
      this.ensureLocalPlayerVisible();
      this.syncLocalPlayerRigTransform(this.lastAnimState, this.lastHorizSpeed);
      this.snapPlayCameraImmediate();
    }
    this.prewarmSceneShaders();
    this.lastTimeMs = performance.now();
    this.scheduleNextTick(true);
  };

  private syncAudioListener(): void {
    this.camera.getWorldDirection(_vListenerFwd);
    _vListenerUp.set(0, 1, 0).applyQuaternion(this.camera.quaternion).normalize();
    this.sound.updateListener(
      this.camera.position.x,
      this.camera.position.y,
      this.camera.position.z,
      _vListenerFwd.x,
      _vListenerFwd.y,
      _vListenerFwd.z,
      _vListenerUp.x,
      _vListenerUp.y,
      _vListenerUp.z
    );
  }

  private orientationResizeTimer: number | null = null;

  private onOrientationChange = (): void => {
    this.onResize();
    if (this.orientationResizeTimer !== null) {
      window.clearTimeout(this.orientationResizeTimer);
    }
    this.orientationResizeTimer = window.setTimeout(() => {
      this.orientationResizeTimer = null;
      if (!this.disposed) this.onResize();
    }, 150);
  };

  private bindEvents(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('orientationchange', this.onOrientationChange);
    window.visualViewport?.addEventListener('resize', this.onResize);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', this.onPointerDown);
    dom.addEventListener('lostpointercapture', this.onPointerUp);
    dom.addEventListener('webglcontextlost', this.onContextLost);
    dom.addEventListener('webglcontextrestored', this.onContextRestored);
    document.addEventListener('mousemove', this.onMouseMove, { passive: true });
    window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.onResize());
      this.resizeObserver.observe(this.container);
    }
  }

  public dispose(): void {
    this.disposed = true;
    this.cancelScheduledTick();
    if (this.orientationResizeTimer !== null) {
      window.clearTimeout(this.orientationResizeTimer);
      this.orientationResizeTimer = null;
    }

    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('orientationchange', this.onOrientationChange);
    window.visualViewport?.removeEventListener('resize', this.onResize);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);

    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.onPointerDown);
    dom.removeEventListener('lostpointercapture', this.onPointerUp);
    dom.removeEventListener('webglcontextlost', this.onContextLost);
    dom.removeEventListener('webglcontextrestored', this.onContextRestored);
    document.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    this.clearLevel();
    this.playerRig.dispose();
    disposeEntityResources(this.textures);
    this.scene.remove(this.splashMesh);
    this.splashMesh.dispose();
    this.splashGeo.dispose();
    this.splashMat.dispose();
    this.mistTex?.dispose();
    this.mistTex = null;
    this.shaftTex?.dispose();
    this.shaftTex = null;
    this.grateDecalTex?.dispose();
    this.grateDecalTex = null;
    this.warningDecalTex?.dispose();
    this.warningDecalTex = null;
    this.textures.dispose();
    this.envRT?.dispose();
    if (this.horrorSpotLight) {
      this.scene.remove(this.horrorSpotLight.target);
      this.scene.remove(this.horrorSpotLight);
      this.horrorSpotLight.shadow.map?.dispose();
      this.horrorSpotLight.dispose();
      this.horrorSpotLight = null;
    }
    this.horrorPass?.dispose();
    this.horrorPass = null;
    this.horrorComposer?.dispose();
    this.horrorComposer = null;
    this.sound.dispose();
    this.renderer.dispose();
    if (dom.parentElement === this.container) {
      this.container.removeChild(dom);
    }
  }
}
