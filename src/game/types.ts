export type GamePhase =
  | 'menu'
  | 'playing'
  | 'paused'
  | 'jumpscare'
  | 'gameover'
  | 'victory';

export type CharacterId = 'male' | 'female';

export function normalizeCharacterId(raw: unknown): CharacterId {
  return raw === 'female' ? 'female' : 'male';
}

export type ActiveQualityTier = 'smooth' | 'standard' | 'ultra';
export type QualityPreset = 'auto' | ActiveQualityTier;
export type TouchControlsMode = 'auto' | 'on' | 'off';

export function normalizeQualityPreset(raw: unknown): QualityPreset {
  if (raw === 'smooth' || raw === 'standard' || raw === 'ultra' || raw === 'auto') {
    return raw;
  }
  if (raw === 'low') return 'smooth';
  if (raw === 'medium') return 'standard';
  if (raw === 'high') return 'ultra';
  return 'auto';
}

export interface GameSettings {
  masterVolume: number; // 0..1
  musicVolume: number; // 0..1
  sfxVolume: number; // 0..1
  muted: boolean;
  mouseSensitivity: number; // 0.3..2.5
  invertY: boolean;
  quality: QualityPreset;
  touchControls: TouchControlsMode;
}

export const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.8,
  musicVolume: 0.7,
  sfxVolume: 0.85,
  muted: false,
  mouseSensitivity: 1.0,
  invertY: false,
  quality: 'auto',
  touchControls: 'auto',
};

function clampFinite(val: unknown, fallback: number, min: number, max: number): number {
  return typeof val === 'number' && Number.isFinite(val)
    ? Math.max(min, Math.min(max, val))
    : fallback;
}

export function sanitizeGameSettings(raw: unknown): GameSettings {
  const src = raw && typeof raw === 'object' ? (raw as Partial<GameSettings>) : {};
  const touch: TouchControlsMode =
    src.touchControls === 'on' || src.touchControls === 'off' || src.touchControls === 'auto'
      ? src.touchControls
      : DEFAULT_SETTINGS.touchControls;
  return {
    masterVolume: clampFinite(src.masterVolume, DEFAULT_SETTINGS.masterVolume, 0, 1),
    musicVolume: clampFinite(src.musicVolume, DEFAULT_SETTINGS.musicVolume, 0, 1),
    sfxVolume: clampFinite(src.sfxVolume, DEFAULT_SETTINGS.sfxVolume, 0, 1),
    muted: typeof src.muted === 'boolean' ? src.muted : DEFAULT_SETTINGS.muted,
    mouseSensitivity:
      Math.round(clampFinite(src.mouseSensitivity, DEFAULT_SETTINGS.mouseSensitivity, 0.3, 2.5) * 100) /
      100,
    invertY: typeof src.invertY === 'boolean' ? src.invertY : DEFAULT_SETTINGS.invertY,
    quality: normalizeQualityPreset(src.quality),
    touchControls: touch,
  };
}

export type TouchControlId = 'joystick' | 'autoRun' | 'jump';

export interface TouchControlPlacement {
  xPct: number; // 4..96 horizontal screen center percentage
  yPct: number; // 14..94 vertical screen center percentage
  scale: number; // 0.65..1.45
  opacity: number; // 0.3..1.0
}

export type TouchLayoutConfig = Record<TouchControlId, TouchControlPlacement>;

export const DEFAULT_TOUCH_LAYOUT: TouchLayoutConfig = {
  joystick: { xPct: 14, yPct: 81, scale: 1, opacity: 0.9 },
  autoRun: { xPct: 73, yPct: 84, scale: 1, opacity: 0.9 },
  jump: { xPct: 88, yPct: 80, scale: 1, opacity: 0.9 },
};

export type PlatformKind =
  | 'static'
  | 'moving'
  | 'disappearing'
  | 'bridge'
  | 'ladder_step';

export type PlatformRotationAxis = 'y' | 'x' | 'z' | 'xy' | 'zy';

export interface PlatformDef {
  id: string;
  kind: PlatformKind;
  position: [number, number, number];
  size: [number, number, number]; // width, height, depth
  /** For moving platforms: world offset from position */
  moveOffset?: [number, number, number];
  moveSpeed?: number;
  movePhase?: number;
  /** For rotating platforms: continuous rotation around platform center */
  rotationAxis?: PlatformRotationAxis;
  rotationSpeed?: number; // signed rad/s (+ = CCW, - = CW)
  rotationPhase?: number; // initial angle in radians
  /** For disappearing platforms: delay after step (sec) & respawn delay (sec) */
  collapseDelay?: number;
  respawnDelay?: number;
  /** Optional visual accent */
  accent?: 'tile' | 'caution' | 'concrete' | 'metal' | 'wood' | 'start' | 'exit';
}

export interface WallDef {
  position: [number, number, number];
  size: [number, number, number];
  kind?: 'tile' | 'concrete' | 'pillar' | 'arch_pillar';
}

export interface CheckpointDef {
  id: string;
  position: [number, number, number]; // Center on top of platform
}

export interface MonsterConfig {
  id: string;
  regionId?: number;
  waypoints: [number, number][]; // [x, z] points in the pool
  patrolSpeed: number;
  chaseSpeed: number;
  detectionRadius: number;
  waterDetectionRadius: number;
  scale?: number;
}

export interface RoomZone {
  center: [number, number]; // x, z
  size: [number, number]; // width, depth
  ceilingY: number;
  floorY: number; // pool floor Y
  waterY: number; // water surface Y
}

export interface LevelDef {
  id: number;
  code: string;
  name: string;
  subtitle: string;
  difficulty: 'Low' | 'Moderate' | 'High' | 'Severe' | 'Extreme';
  timeLimit: number; // seconds
  parTimes: [number, number, number]; // [S-rank, A-rank, B-rank] remaining or elapsed -> let's use elapsed seconds <= S, A, B
  fogColor: string;
  fogDensity: number;
  ambientTint: string;
  rooms: RoomZone[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number; floorY: number; waterY: number; ceilingY: number };
  spawn: [number, number, number];
  exit: { position: [number, number, number]; size: [number, number, number] };
  platforms: PlatformDef[];
  walls: WallDef[];
  checkpoints: CheckpointDef[];
  monsters: MonsterConfig[];
  lights: Array<{ position: [number, number, number]; color?: string; intensity?: number; flickering?: boolean }>;
}

export type LevelSummary = Pick<
  LevelDef,
  'id' | 'code' | 'name' | 'subtitle' | 'difficulty' | 'timeLimit' | 'parTimes'
>;

export type WorldMode = 'open_world' | 'sector';

export interface HudSnapshot {
  levelId: number;
  levelCode: string;
  levelName: string;
  worldMode?: WorldMode;
  regionId?: number;
  wingIndex?: number;
  wingTitle?: string;
  checkpointId?: string | null;
  checkpointRegionId?: number;
  checkpointLabel?: string | null;
  timeRemaining: number;
  timeElapsed: number;
  stamina: number; // 0..100
  inWater: boolean;
  underwater: boolean;
  waterJumpCooldown: number;
  monsterDist: number;
  monsterAlert: 'calm' | 'searching' | 'chasing';
  checkpointIndex: number;
  totalCheckpoints: number;
  checkpointNotice: string | null;
  activeQuality: ActiveQualityTier;
  fps: number;
  isPointerLocked: boolean;
  deathReason: 'caught' | 'timeout' | null;
}

export interface LevelRecord {
  completed: boolean;
  bestTime: number | null; // elapsed seconds
  stars: number; // 0..3
}

export type SaveData = Record<number, LevelRecord>;
