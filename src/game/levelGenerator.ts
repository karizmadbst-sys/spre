import { ORIGINAL_LEVELS } from './levelsOriginal.ts';
import type {
  CheckpointDef,
  LevelDef,
  LevelSummary,
  MonsterConfig,
  PlatformDef,
  PlatformRotationAxis,
  RoomZone,
  WallDef,
} from './types.ts';

export const TOTAL_LEVELS = 100;

export interface SectorWing {
  index: number; // 0..9
  name: string;
  subtitle: string;
  startId: number;
  endId: number;
  accentHex: string;
}

export const SECTOR_WINGS: SectorWing[] = [
  {
    index: 0,
    name: 'Intake & Overflow Wing',
    subtitle: 'Introductory poolroom basins, rotating turbine bridges, and first serpent sightings.',
    startId: 1,
    endId: 10,
    accentHex: '#52e0b6',
  },
  {
    index: 1,
    name: 'Flooded Cistern Wing',
    subtitle: 'Expansive cistern basins with moving ferries, wide water gaps, and 4 patrolling serpents.',
    startId: 11,
    endId: 20,
    accentHex: '#5ec9d6',
  },
  {
    index: 2,
    name: 'Submerged Viaducts',
    subtitle: 'Sweeping aqueduct arches, spinning viaduct spans, and high-clearance pools.',
    startId: 21,
    endId: 30,
    accentHex: '#63b4e0',
  },
  {
    index: 3,
    name: 'Timber Drydock Vaults',
    subtitle: 'Weathered pier networks, rotating wharves, and isolated refuge pontoons.',
    startId: 31,
    endId: 40,
    accentHex: '#cfa167',
  },
  {
    index: 4,
    name: 'Sluice & Lock Chambers',
    subtitle: 'Divided bulkhead halls with staggered floodgate chicanes and tumbling lock rotors.',
    startId: 41,
    endId: 50,
    accentHex: '#84c79c',
  },
  {
    index: 5,
    name: 'Elevated Catwalk Towers',
    subtitle: 'Multi-tier concrete piers, ascending steel spans, and gyroscopic skybridges.',
    startId: 51,
    endId: 60,
    accentHex: '#9aaec4',
  },
  {
    index: 6,
    name: 'Fractured Spillway Halls',
    subtitle: 'Collapsing warning pontoons, multi-axis rotors, and aggressive serpent packs.',
    startId: 61,
    endId: 70,
    accentHex: '#e09155',
  },
  {
    index: 7,
    name: 'Deep Turbine Reservoirs',
    subtitle: 'Vast darkened basins demanding timed sprint jumps and fast rotor transfers.',
    startId: 71,
    endId: 80,
    accentHex: '#c9716b',
  },
  {
    index: 8,
    name: 'Labyrinthine Abyss Galleries',
    subtitle: 'Branched abyssal mazes and spiral monolith rings veiled in cold mist.',
    startId: 81,
    endId: 90,
    accentHex: '#a382d4',
  },
  {
    index: 9,
    name: 'Hadal Core Sanctum',
    subtitle: 'Extreme endurance gauntlets hunted by up to 8 apex sea leviathans.',
    startId: 91,
    endId: 100,
    accentHex: '#eb6585',
  },
];

type PlatformMode = 'fixed_only' | 'rotating_only' | 'mixed';

type SegmentPattern =
  | 'wide_s_curve'
  | 'diagonal_slash'
  | 'staircase_ascent'
  | 'stepped_high_low'
  | 'archipelago_wander'
  | 'switchback_hairpin'
  | 'crescent_bay'
  | 'rotor_bridge_chain'
  | 'tumbler_gauntlet'
  | 'spiral_coil'
  | 'twin_split_lanes'
  | 'zigzag_slalom'
  | 'narrow_causeway'
  | 'gyro_nexus';

const SEGMENT_PATTERNS: SegmentPattern[] = [
  'wide_s_curve',
  'diagonal_slash',
  'staircase_ascent',
  'stepped_high_low',
  'archipelago_wander',
  'switchback_hairpin',
  'crescent_bay',
  'rotor_bridge_chain',
  'tumbler_gauntlet',
  'spiral_coil',
  'twin_split_lanes',
  'zigzag_slalom',
  'narrow_causeway',
  'gyro_nexus',
];

const UNIQUE_SECTOR_NAMES: string[] = [
  // 11..20 Flooded Cistern Wing
  'North Cistern Hall',
  'Twin Intake Sump',
  'Condensation Gallery',
  'Chlorine Settling Basin',
  'Brine Conduit Vault',
  'Echoing Spillway',
  'Deep Suction Well',
  'Columned Holding Tank',
  'Misted Surge Reservoir',
  'Cistern Bulkhead Lock',
  // 21..30 Submerged Viaducts
  'Arched Viaduct Approach',
  'Lower Aqueduct Span',
  'Cross-Current Gallery',
  'Tile-Ribbed Culvert',
  'Submerged Pilaster Nave',
  'Split Siphon Channel',
  'Twilight Overflow Reach',
  'Sunken Promenade',
  'High-Vaulted Watercourse',
  'Viaduct Terminus Gate',
  // 31..40 Timber Drydock Vaults
  'Rotting Pier Basin',
  'Weathered Timber Slipway',
  'Pontoon Mooring Yard',
  'Flooded Boathouse Hall',
  'Creaking Wharf Cavern',
  'Tidal Barge Anchorage',
  'Splintered Dock Atoll',
  'Lantern Wharf Crossing',
  'Submerged Drydock Lock',
  'Outer Shipyard Bulkhead',
  // 41..50 Sluice & Lock Chambers
  'Primary Sluice Partition',
  'Staggered Weir Gallery',
  'Floodgate Transfer Hall',
  'Twin-Chamber Lock',
  'Headwall Spill Vault',
  'Valve-House Basin',
  'Backwash Baffle Room',
  'Triple Weir Crossing',
  'Pressurized Intake Lock',
  'Sluice Control Threshold',
  // 51..60 Elevated Catwalk Towers
  'Steel Gantry Basin',
  'Upper Catwalk Terrace',
  'Stepped Riser Cistern',
  'Suspended Walk Vault',
  'High-Tier Valve Deck',
  'Overpass Truss Hall',
  'Tiered Pump Promenade',
  'Cantilever Pool Span',
  'Skybridge Water Vault',
  'Gantry Apex Exit',
  // 61..70 Fractured Spillway Halls
  'Hairline Tile Crossing',
  'Crumbling Causeway',
  'Unstable Weir Chain',
  'Warning Deck Passage',
  'Fractured Atoll Run',
  'Sinking Pontoon Strait',
  'Amber Beacon Span',
  'Fragile Archipelago',
  'Collapsing Sluice Path',
  'Breached Spillway Lock',
  // 71..80 Deep Turbine Reservoirs
  'Turbine Tailrace Pool',
  'Rotor Shaft Basin',
  'Deep Coolant Vault',
  'Dynamo Overflow Hall',
  'Cavitating Sump Arena',
  'Black-Water Generator',
  'Sub-Level Hydro Hall',
  'Darkened Penstock Bay',
  'Resonant Pump Abyss',
  'Turbine Seal Chamber',
  // 81..90 Labyrinthine Abyss Galleries
  'Mist-Shrouded Maze',
  'Forked Catacomb Pool',
  'Pillared Shadow Hall',
  'Deadlight Atoll Ring',
  'Branched Abyssal Nave',
  'Sunken Cloister Basin',
  'Blind-Corner Cistern',
  'Veiled Pillar Labyrinth',
  'Whispering Tile Abyss',
  'Abyssal Nexus Gate',
  // 91..100 Hadal Core Sanctum
  'Hadal Perimeter Trench',
  'Leviathan Breeding Pool',
  'Black Tide Sanctuary',
  'Deep Trench Viaduct',
  'Obsidian Grout Hall',
  'Apex Serpent Strait',
  'Subterranean Sea Vault',
  'Sunken Cathedral Core',
  'Penultimate Abyss Lock',
  'Zero-Depth Omega Exit',
];

const WING_THEMES = [
  { fog: '#324247', ambient: '#698086', waterTone: 'cold mineral mist' },
  { fog: '#2b3d45', ambient: '#607b87', waterTone: 'indigo vault fog' },
  { fog: '#333b38', ambient: '#6f7c72', waterTone: 'damp timber vapor' },
  { fog: '#2a3a37', ambient: '#5d7a73', waterTone: 'verdigris sluice haze' },
  { fog: '#2f3a44', ambient: '#677a8a', waterTone: 'slate steel condensation' },
  { fog: '#363230', ambient: '#756f6b', waterTone: 'rusted caution gloom' },
  { fog: '#283238', ambient: '#5a6d78', waterTone: 'deep turbine murk' },
  { fog: '#262d36', ambient: '#576273', waterTone: 'abyssal twilight fog' },
  { fog: '#24292e', ambient: '#545f69', waterTone: 'hadal blackout haze' },
];

// Exact player physics constants mirrored from src/game/engine.ts
const PLAYER_GRAVITY = 18.5;
const PLAYER_JUMP_VEL = 10.4;
const PLAYER_WALK_SPEED = 5.7;
const PLAYER_RUN_SPEED = 8.8;

function maxPhysicsReachForDy(dY: number, speed: number): number {
  const disc = PLAYER_JUMP_VEL * PLAYER_JUMP_VEL - 2 * PLAYER_GRAVITY * dY;
  if (disc <= 0) return 0;
  const airTime = (PLAYER_JUMP_VEL + Math.sqrt(disc)) / PLAYER_GRAVITY;
  return airTime * speed;
}

function hashSeed(id: number): number {
  let h = (id * 0x9e3779b1) ^ 0x85ebca6b;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h = h ^ (h >>> 16);
  return h >>> 0;
}

function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function shuffleWithRng<T>(arr: T[], rng: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

function edgeGapBoxes(
  ax: number,
  az: number,
  aw: number,
  ad: number,
  bx: number,
  bz: number,
  bw: number,
  bd: number
): number {
  const gx = Math.max(0, Math.abs(ax - bx) - (aw + bw) * 0.5);
  const gz = Math.max(0, Math.abs(az - bz) - (ad + bd) * 0.5);
  return Math.hypot(gx, gz);
}

interface PlacedPlat {
  id: string;
  kind: PlatformDef['kind'];
  x: number;
  topY: number; // Nominal top Y when flat (for elevated rotating X/Z platforms, centerY is topY - h*0.5)
  z: number;
  w: number;
  h?: number; // Optional fixed thickness (used for elevated X/Z/compound rotating platforms)
  d: number;
  accent: NonNullable<PlatformDef['accent']>;
  moveOffset?: [number, number, number];
  moveSpeed?: number;
  movePhase?: number;
  rotationAxis?: PlatformRotationAxis;
  rotationSpeed?: number;
  rotationPhase?: number;
  collapseDelay?: number;
  respawnDelay?: number;
  isHub?: boolean;
}

function isRotatingPlat(p: PlacedPlat): boolean {
  return Boolean(p.rotationSpeed && Math.abs(p.rotationSpeed) > 0.001);
}

function isTiltingAxis(axis?: PlatformRotationAxis): boolean {
  return axis === 'x' || axis === 'z' || axis === 'xy' || axis === 'zy';
}

function sweepRadiusXZ(p: PlacedPlat): number {
  if (isRotatingPlat(p)) {
    const halfH = (p.h ?? 0.72) * 0.5;
    const baseR = Math.hypot(p.w * 0.5, p.d * 0.5);
    return isTiltingAxis(p.rotationAxis) ? Math.max(baseR, Math.hypot(Math.max(p.w, p.d) * 0.5, halfH)) : baseR;
  }
  return Math.hypot(p.w * 0.5, p.d * 0.5);
}

function effectiveReachHalf(p: PlacedPlat): number {
  if (!isRotatingPlat(p)) return Math.min(p.w, p.d) * 0.5;
  if (p.rotationAxis === 'y' || p.rotationAxis === 'xy' || p.rotationAxis === 'zy') {
    const minH = Math.min(p.w, p.d) * 0.5;
    const maxH = Math.max(p.w, p.d) * 0.5;
    // Allow generous landing window without requiring frame-perfect tip alignment
    return minH + (maxH - minH) * 0.55;
  }
  return Math.min(p.w, p.d) * 0.5;
}

function boxToCircleGap(
  bx: number,
  bz: number,
  bw: number,
  bd: number,
  cx: number,
  cz: number,
  cr: number
): number {
  const gx = Math.max(0, Math.abs(cx - bx) - bw * 0.5);
  const gz = Math.max(0, Math.abs(cz - bz) - bd * 0.5);
  return Math.hypot(gx, gz) - cr;
}

function effectiveJumpGap(a: PlacedPlat, b: PlacedPlat): number {
  if (!isRotatingPlat(a) && !isRotatingPlat(b)) {
    return maxReachableEdgeGap(a, b).minGap;
  }
  const sa: Array<[number, number]> =
    a.kind === 'moving' && a.moveOffset
      ? [
          [a.x, a.z],
          [a.x + a.moveOffset[0] * 0.5, a.z + a.moveOffset[2] * 0.5],
          [a.x + a.moveOffset[0], a.z + a.moveOffset[2]],
        ]
      : [[a.x, a.z]];
  const sb: Array<[number, number]> =
    b.kind === 'moving' && b.moveOffset
      ? [
          [b.x, b.z],
          [b.x + b.moveOffset[0] * 0.5, b.z + b.moveOffset[2] * 0.5],
          [b.x + b.moveOffset[0], b.z + b.moveOffset[2]],
        ]
      : [[b.x, b.z]];

  const rotA = isRotatingPlat(a);
  const rotB = isRotatingPlat(b);
  const ra = rotA ? effectiveReachHalf(a) : 0;
  const rb = rotB ? effectiveReachHalf(b) : 0;

  let best = Infinity;
  for (const [ax, az] of sa) {
    for (const [bx, bz] of sb) {
      let gap: number;
      if (rotA && rotB) {
        gap = Math.max(0, Math.hypot(ax - bx, az - bz) - ra - rb);
      } else if (rotA) {
        gap = Math.max(0, boxToCircleGap(bx, bz, b.w, b.d, ax, az, ra));
      } else {
        gap = Math.max(0, boxToCircleGap(ax, az, a.w, a.d, bx, bz, rb));
      }
      if (gap < best) best = gap;
    }
  }
  return best;
}

function minSweptEdgeGap(a: PlacedPlat, b: PlacedPlat): number {
  const rotA = isRotatingPlat(a);
  const rotB = isRotatingPlat(b);
  const ra = rotA ? sweepRadiusXZ(a) : 0;
  const rb = rotB ? sweepRadiusXZ(b) : 0;

  const sa: Array<[number, number]> = [[a.x, a.z]];
  if (a.kind === 'moving' && a.moveOffset) {
    sa.push([a.x + a.moveOffset[0], a.z + a.moveOffset[2]]);
    sa.push([a.x + a.moveOffset[0] * 0.5, a.z + a.moveOffset[2] * 0.5]);
  }
  const sb: Array<[number, number]> = [[b.x, b.z]];
  if (b.kind === 'moving' && b.moveOffset) {
    sb.push([b.x + b.moveOffset[0], b.z + b.moveOffset[2]]);
    sb.push([b.x + b.moveOffset[0] * 0.5, b.z + b.moveOffset[2] * 0.5]);
  }

  let minG = Infinity;
  for (const [ax, az] of sa) {
    for (const [bx, bz] of sb) {
      let g: number;
      if (rotA && rotB) {
        g = Math.hypot(ax - bx, az - bz) - (ra + rb);
      } else if (rotA) {
        g = boxToCircleGap(bx, bz, b.w, b.d, ax, az, ra);
      } else if (rotB) {
        g = boxToCircleGap(ax, az, a.w, a.d, bx, bz, rb);
      } else {
        g = edgeGapBoxes(ax, az, a.w, a.d, bx, bz, b.w, b.d);
      }
      if (g < minG) minG = g;
    }
  }
  return minG;
}

function maxReachableEdgeGap(a: PlacedPlat, b: PlacedPlat): { minGap: number; dY: number } {
  const dY = b.topY - a.topY;
  const sa: Array<[number, number]> =
    a.kind === 'moving' && a.moveOffset
      ? [
          [a.x, a.z],
          [a.x + a.moveOffset[0] * 0.5, a.z + a.moveOffset[2] * 0.5],
          [a.x + a.moveOffset[0], a.z + a.moveOffset[2]],
        ]
      : [[a.x, a.z]];
  const sb: Array<[number, number]> =
    b.kind === 'moving' && b.moveOffset
      ? [
          [b.x, b.z],
          [b.x + b.moveOffset[0] * 0.5, b.z + b.moveOffset[2] * 0.5],
          [b.x + b.moveOffset[0], b.z + b.moveOffset[2]],
        ]
      : [[b.x, b.z]];
  let best = Infinity;
  for (const [ax, az] of sa) {
    for (const [bx, bz] of sb) {
      const g = edgeGapBoxes(ax, az, a.w, a.d, bx, bz, b.w, b.d);
      if (g < best) best = g;
    }
  }
  return { minGap: best, dY };
}

function isInsideBounds(p: PlacedPlat, bounds: LevelDef['bounds'], margin = 2.6): boolean {
  const samples: Array<[number, number]> = [[p.x, p.z]];
  if (p.kind === 'moving' && p.moveOffset) {
    samples.push([p.x + p.moveOffset[0], p.z + p.moveOffset[2]]);
  }
  const halfX = isRotatingPlat(p) ? sweepRadiusXZ(p) : p.w * 0.5;
  const halfZ = isRotatingPlat(p) ? sweepRadiusXZ(p) : p.d * 0.5;
  for (const [sx, sz] of samples) {
    if (
      sx - halfX < bounds.minX + margin ||
      sx + halfX > bounds.maxX - margin ||
      sz - halfZ < bounds.minZ + margin ||
      sz + halfZ > bounds.maxZ - margin
    ) {
      return false;
    }
  }
  return true;
}

function isOverheadWall(w: WallDef, refTopY: number): boolean {
  const wallBottom = w.position[1] - w.size[1] * 0.5;
  return wallBottom >= refTopY + 2.4;
}

function segmentCrossesWalls(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  walls: WallDef[],
  pad = 0.75,
  refTopY = 1.8
): boolean {
  for (const w of walls) {
    if (isOverheadWall(w, refTopY)) continue;
    const minX = w.position[0] - w.size[0] * 0.5 - pad;
    const maxX = w.position[0] + w.size[0] * 0.5 + pad;
    const minZ = w.position[2] - w.size[2] * 0.5 - pad;
    const maxZ = w.position[2] + w.size[2] * 0.5 + pad;
    for (let s = 0; s <= 14; s++) {
      const t = s / 14;
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) return true;
    }
  }
  return false;
}

function collidesWithWalls(p: PlacedPlat, walls: WallDef[], pad = 1.4): boolean {
  const samples: Array<[number, number]> = [[p.x, p.z]];
  if (p.kind === 'moving' && p.moveOffset) {
    samples.push([p.x + p.moveOffset[0], p.z + p.moveOffset[2]]);
    samples.push([p.x + p.moveOffset[0] * 0.5, p.z + p.moveOffset[2] * 0.5]);
  }
  const rot = isRotatingPlat(p);
  const sweepR = rot ? sweepRadiusXZ(p) : 0;
  for (const [px, pz] of samples) {
    for (const w of walls) {
      if (isOverheadWall(w, p.topY)) continue;
      if (rot) {
        if (boxToCircleGap(w.position[0], w.position[2], w.size[0], w.size[2], px, pz, sweepR) < pad) {
          return true;
        }
      } else if (
        Math.abs(px - w.position[0]) < p.w * 0.5 + w.size[0] * 0.5 + pad &&
        Math.abs(pz - w.position[2]) < p.d * 0.5 + w.size[2] * 0.5 + pad
      ) {
        return true;
      }
    }
  }
  return false;
}

function toPlatformDef(p: PlacedPlat, waterY: number): PlatformDef {
  let h: number;
  let posY: number;

  if (p.h !== undefined) {
    h = round2(p.h);
    posY = round2(p.topY - h * 0.5);
  } else {
    const botY = waterY - 0.04;
    h = round2(Math.max(0.54, p.topY - botY));
    posY = round2(botY + h * 0.5);
  }

  const out: PlatformDef = {
    id: p.id,
    kind: p.kind,
    position: [p.x, posY, p.z],
    size: [p.w, h, p.d],
    accent: p.accent,
  };
  if (p.moveOffset) {
    out.moveOffset = p.moveOffset;
    out.moveSpeed = p.moveSpeed;
    out.movePhase = p.movePhase;
  }
  if (p.rotationSpeed) {
    out.rotationAxis = p.rotationAxis || 'y';
    out.rotationSpeed = p.rotationSpeed;
    out.rotationPhase = p.rotationPhase ?? 0;
  }
  if (p.collapseDelay !== undefined) out.collapseDelay = p.collapseDelay;
  if (p.respawnDelay !== undefined) out.respawnDelay = p.respawnDelay;
  return out;
}

function getPlatformMode(id: number): PlatformMode {
  if (id === 1) return 'fixed_only';
  if (id === 2) return 'mixed';
  if (id === 3) return 'rotating_only';
  if (id === 4) return 'mixed';
  if (id === 5) return 'fixed_only';
  const earlyModes: PlatformMode[] = ['rotating_only', 'mixed', 'fixed_only', 'rotating_only', 'mixed'];
  if (id <= 10) return earlyModes[id - 6];

  const wingIdx = Math.floor((id - 1) / 10);
  const subIdx = (id - 1) % 10;
  const wingRng = createRng(hashSeed(wingIdx * 7919 + 42));
  const pool: PlatformMode[] = [
    'fixed_only',
    'fixed_only',
    'fixed_only',
    'rotating_only',
    'rotating_only',
    'rotating_only',
    'mixed',
    'mixed',
    'mixed',
    'mixed',
  ];
  const shuffled = shuffleWithRng(pool, wingRng);
  return shuffled[subIdx];
}

interface PathOptions {
  rng: () => number;
  levelId: number;
  levelProgress: number; // 0 (Lv1) -> 1 (Lv100)
  platformMode: PlatformMode;
  pattern: SegmentPattern;
  minGap: number;
  maxGap: number;
  minOtherSep: number;
  baseTileSize: number;
  movingRatio: number;
  fragileRatio: number;
  bridgeRatio: number;
  woodPrefer: boolean;
  maxHeightWave: number;
  moveSpeed: number;
  rotYSpeedBase: number;
  rotTiltSpeedBase: number;
  rotDirBias: -1 | 1;
  collapseDelay: number;
  bounds: LevelDef['bounds'];
  walls: WallDef[];
  allPlats: PlacedPlat[];
  guideTargets: Array<[number, number]>;
  reservedClearZones?: Array<{ x: number; z: number; r: number }>;
}

function pickRotatingSpec(
  rng: () => number,
  levelId: number,
  levelProgress: number,
  pattern: SegmentPattern,
  stepIdx: number,
  baseTileSize: number,
  woodPrefer: boolean,
  alongZ: boolean,
  rotYSpeedBase: number,
  rotTiltSpeedBase: number,
  rotDirBias: -1 | 1
): {
  kind: PlatformDef['kind'];
  w: number;
  d: number;
  h?: number;
  accent: NonNullable<PlatformDef['accent']>;
  rotationAxis: PlatformRotationAxis;
  rotationSpeed: number;
  rotationPhase: number;
  targetTopYOffset: number;
} {
  // Choose axis variety progressively & according to pattern
  let axis: PlatformRotationAxis = 'y';
  const tiltAllowed = levelId >= 3;
  const compoundAllowed = levelId >= 16;

  if (pattern === 'rotor_bridge_chain') {
    axis = 'y';
  } else if (pattern === 'tumbler_gauntlet' && tiltAllowed) {
    axis = stepIdx % 2 === 0 ? 'x' : 'z';
  } else if (pattern === 'gyro_nexus' && compoundAllowed) {
    const r = rng();
    axis = r < 0.4 ? 'xy' : r < 0.8 ? 'zy' : 'y';
  } else if (tiltAllowed) {
    const r = rng();
    const tiltChance = 0.25 + levelProgress * 0.22;
    const compChance = compoundAllowed ? 0.12 + levelProgress * 0.18 : 0;
    if (r < compChance) {
      axis = rng() < 0.5 ? 'xy' : 'zy';
    } else if (r < compChance + tiltChance) {
      axis = rng() < 0.5 ? 'x' : 'z';
    } else {
      axis = 'y';
    }
  }

  // Direction alternates or follows level bias so levels feel distinct
  const dir: -1 | 1 =
    rng() < 0.72 ? rotDirBias : (rotDirBias === 1 ? -1 : 1);
  const alternatingDir: -1 | 1 = stepIdx % 2 === 0 ? dir : (dir === 1 ? -1 : 1);
  const useDir = pattern === 'rotor_bridge_chain' ? alternatingDir : dir;

  if (axis === 'y') {
    const speedJitter = 0.88 + rng() * 0.28;
    const rotationSpeed = round2(useDir * rotYSpeedBase * speedJitter);
    const rotationPhase = round2(rng() * Math.PI * 2);

    // Varied shapes: spinning bridges, elongated piers, or wide squares
    const shapeRoll = rng();
    if (pattern === 'rotor_bridge_chain' || shapeRoll < 0.45) {
      const bridgeLen = round2(clamp(5.6 + rng() * 1.4 - levelProgress * 0.4, 5.2, 7.0));
      const bridgeW = round2(clamp(2.65 + (1 - levelProgress) * 0.35, 2.55, 3.05));
      return {
        kind: 'bridge',
        w: alongZ ? bridgeW : bridgeLen,
        d: alongZ ? bridgeLen : bridgeW,
        accent: woodPrefer && rng() < 0.35 ? 'wood' : 'metal',
        rotationAxis: 'y',
        rotationSpeed,
        rotationPhase,
        targetTopYOffset: 0,
      };
    } else if (shapeRoll < 0.75) {
      const longSide = round2(clamp(baseTileSize + 1.1 + rng() * 0.6, 4.4, 5.4));
      const shortSide = round2(clamp(baseTileSize - 0.15, 3.0, 3.6));
      const accents: Array<NonNullable<PlatformDef['accent']>> = woodPrefer
        ? ['wood', 'caution']
        : ['tile', 'caution', 'concrete'];
      return {
        kind: 'static',
        w: alongZ ? shortSide : longSide,
        d: alongZ ? longSide : shortSide,
        accent: accents[Math.floor(rng() * accents.length)],
        rotationAxis: 'y',
        rotationSpeed,
        rotationPhase,
        targetTopYOffset: 0,
      };
    } else {
      const sq = round2(clamp(baseTileSize + 0.15, 3.2, 4.2));
      const accents: Array<NonNullable<PlatformDef['accent']>> = woodPrefer
        ? ['wood', 'caution']
        : ['caution', 'tile', 'metal'];
      return {
        kind: 'static',
        w: sq,
        d: sq,
        accent: accents[Math.floor(rng() * accents.length)],
        rotationAxis: 'y',
        rotationSpeed,
        rotationPhase,
        targetTopYOffset: 0,
      };
    }
  } else {
    // X, Z, XY, ZY tilting/tumbling rotor — elevated cleanly above water & fair speed
    const speedJitter = 0.88 + rng() * 0.24;
    const rotationSpeed = round2(useDir * rotTiltSpeedBase * speedJitter);
    // Start near flat/gentle angle or offset phase
    const rotationPhase = round2((rng() - 0.5) * 0.9 + (stepIdx % 2 === 0 ? 0 : Math.PI));
    const sq = round2(clamp(baseTileSize + 0.15, 3.25, 3.95));
    const accents: Array<NonNullable<PlatformDef['accent']>> = woodPrefer
      ? ['wood', 'caution']
      : ['caution', 'metal', 'concrete', 'tile'];
    return {
      kind: 'static',
      w: sq,
      d: sq,
      h: 0.68,
      accent: accents[Math.floor(rng() * accents.length)],
      rotationAxis: axis,
      rotationSpeed,
      rotationPhase,
      targetTopYOffset: 0.45,
    };
  }
}

function connectWithWaterGaps(
  prefix: string,
  fromPlat: PlacedPlat,
  toPlat: PlacedPlat,
  opts: PathOptions
): boolean {
  const {
    rng,
    levelId,
    levelProgress,
    platformMode,
    pattern,
    minGap,
    maxGap,
    minOtherSep,
    baseTileSize,
    movingRatio,
    fragileRatio,
    bridgeRatio,
    woodPrefer,
    maxHeightWave,
    moveSpeed,
    rotYSpeedBase,
    rotTiltSpeedBase,
    rotDirBias,
    collapseDelay,
    bounds,
    walls,
    allPlats,
    guideTargets,
    reservedClearZones,
  } = opts;

  let current = fromPlat;
  const waypoints: Array<[number, number]> = [...guideTargets, [toPlat.x, toPlat.z]];
  let wpIdx = 0;
  let stepIdx = 0;
  let fragileStreak = 0;

  // Compute safe physical jump limit for this level
  const safeSpeedCap =
    levelProgress < 0.25
      ? PLAYER_WALK_SPEED * 0.9
      : PLAYER_WALK_SPEED + (PLAYER_RUN_SPEED - PLAYER_WALK_SPEED) * clamp((levelProgress - 0.2) / 0.8, 0, 0.7);

  for (let guard = 0; guard < 56; guard++) {
    const directGap = effectiveJumpGap(current, toPlat);
    const directDy = toPlat.topY - current.topY;
    const directSafety = isTiltingAxis(current.rotationAxis) ? 0.72 : 0.84;
    const directPhysMax = maxPhysicsReachForDy(directDy, safeSpeedCap) * directSafety;
    if (
      directGap <= Math.min(maxGap + 0.15, directPhysMax) &&
      directDy <= 1.05 &&
      directDy >= -1.6 &&
      !segmentCrossesWalls(current.x, current.z, toPlat.x, toPlat.z, walls, 0.75, Math.max(current.topY, toPlat.topY))
    ) {
      return true;
    }

    while (wpIdx < waypoints.length - 1) {
      const [wx, wz] = waypoints[wpIdx];
      if (Math.hypot(wx - current.x, wz - current.z) < baseTileSize + maxGap * 1.25) {
        wpIdx++;
      } else {
        break;
      }
    }

    const [tx, tz] = waypoints[wpIdx];
    const vx = tx - current.x;
    const vz = tz - current.z;
    const vLen = Math.hypot(vx, vz);
    if (vLen < 0.01) {
      if (wpIdx < waypoints.length - 1) {
        wpIdx++;
        continue;
      }
      break;
    }

    const baseAng = Math.atan2(vx, vz);
    const distToEnd = edgeGapBoxes(current.x, current.z, current.w, current.d, toPlat.x, toPlat.z, toPlat.w, toPlat.d);
    const alongZ = Math.abs(vz) >= Math.abs(vx);

    stepIdx++;
    const nearEnd = distToEnd < maxGap * 2.1 + baseTileSize;

    // Decide platform type according to level platformMode
    let kind: PlatformDef['kind'] = 'static';
    let accent: NonNullable<PlatformDef['accent']> = woodPrefer ? 'wood' : 'tile';
    let w = round2(Math.max(2.95, baseTileSize + (rng() - 0.5) * 0.65));
    let d = round2(Math.max(2.95, baseTileSize + (rng() - 0.5) * 0.65));
    let customH: number | undefined;
    let rotationAxis: PlatformRotationAxis | undefined;
    let rotationSpeed: number | undefined;
    let rotationPhase: number | undefined;
    let topYOffset = 0;

    let wantRotating = false;
    if (platformMode === 'rotating_only') {
      wantRotating = true;
    } else if (platformMode === 'mixed') {
      const rotChance =
        pattern === 'rotor_bridge_chain' || pattern === 'tumbler_gauntlet' || pattern === 'gyro_nexus'
          ? 0.62
          : 0.36 + levelProgress * 0.14;
      wantRotating = rng() < rotChance || (stepIdx === 2 && rng() < 0.7);
    }

    if (wantRotating) {
      const rotSpec = pickRotatingSpec(
        rng,
        levelId,
        levelProgress,
        pattern,
        stepIdx,
        baseTileSize,
        woodPrefer,
        alongZ,
        rotYSpeedBase,
        rotTiltSpeedBase,
        rotDirBias
      );
      kind = rotSpec.kind;
      w = rotSpec.w;
      d = rotSpec.d;
      customH = rotSpec.h;
      accent = rotSpec.accent;
      rotationAxis = rotSpec.rotationAxis;
      rotationSpeed = rotSpec.rotationSpeed;
      rotationPhase = rotSpec.rotationPhase;
      topYOffset = rotSpec.targetTopYOffset;
      // Near end, avoid forcing an overly tall tilt platform if toPlat is low
      if (nearEnd && isTiltingAxis(rotationAxis) && toPlat.topY < 1.0 && current.topY > 1.8) {
        rotationAxis = 'y';
        customH = undefined;
        topYOffset = 0;
        rotationSpeed = round2((rotDirBias) * rotYSpeedBase);
      }
      fragileStreak = 0;
    } else if (platformMode === 'fixed_only') {
      const roll = rng();
      if (!nearEnd && (pattern === 'narrow_causeway' ? roll < 0.5 : roll < bridgeRatio)) {
        kind = 'bridge';
        accent = woodPrefer && rng() < 0.45 ? 'wood' : 'metal';
        const len = round2(clamp(baseTileSize + 1.8 + rng() * 1.1, 4.8, 6.8));
        const wid = round2(clamp(2.75 + (1 - levelProgress) * 0.35, 2.65, 3.15));
        w = alongZ ? wid : len;
        d = alongZ ? len : wid;
      } else if (roll < bridgeRatio + 0.25) {
        kind = 'static';
        accent = woodPrefer ? 'wood' : rng() < 0.5 ? 'concrete' : 'tile';
        w = round2(clamp(baseTileSize + 0.6 + rng() * 0.8, 3.6, 5.0));
        d = round2(clamp(baseTileSize + 0.2 + rng() * 0.8, 3.4, 4.8));
      } else {
        kind = 'static';
        const pool: Array<NonNullable<PlatformDef['accent']>> = woodPrefer
          ? ['wood', 'concrete']
          : ['tile', 'concrete', 'metal', 'caution'];
        accent = pool[Math.floor(rng() * pool.length)];
      }
    } else {
      const roll = rng();
      if (!nearEnd && stepIdx % 2 === 0 && roll < movingRatio) {
        kind = 'moving';
        accent = woodPrefer && rng() < 0.4 ? 'wood' : 'caution';
        w = round2(Math.max(3.2, baseTileSize + 0.15));
        d = round2(Math.max(3.2, baseTileSize + 0.15));
        fragileStreak = 0;
      } else if (fragileStreak < 2 && roll < movingRatio + fragileRatio) {
        kind = 'disappearing';
        accent = 'caution';
        w = round2(Math.max(2.95, baseTileSize - 0.05));
        d = round2(Math.max(2.95, baseTileSize - 0.05));
        fragileStreak++;
      } else if (!nearEnd && roll < movingRatio + fragileRatio + bridgeRatio) {
        kind = 'bridge';
        accent = 'metal';
        const len = round2(clamp(baseTileSize + 1.8 + rng() * 0.9, 4.8, 6.6));
        const wid = round2(clamp(2.75 + (1 - levelProgress) * 0.35, 2.65, 3.15));
        w = alongZ ? wid : len;
        d = alongZ ? len : wid;
        fragileStreak = 0;
      } else {
        fragileStreak = 0;
        const pool: Array<NonNullable<PlatformDef['accent']>> = woodPrefer
          ? ['wood', 'concrete']
          : ['tile', 'concrete', 'metal'];
        accent = pool[Math.floor(rng() * pool.length)];
      }
    }

    // Varied vertical height progression per pattern
    const remainingRatio = clamp(
      distToEnd / Math.max(10, Math.hypot(toPlat.x - fromPlat.x, toPlat.z - fromPlat.z)),
      0,
      1
    );
    const estStepsLeft = Math.max(2, Math.ceil(distToEnd / (baseTileSize + maxGap)));
    let targetTopY = toPlat.topY + (current.topY - toPlat.topY) * clamp(1 - 1 / estStepsLeft, 0, 0.85);

    if (!nearEnd && kind !== 'moving' && kind !== 'disappearing') {
      if (pattern === 'staircase_ascent') {
        const climbCurve = Math.sin((1 - remainingRatio) * Math.PI);
        targetTopY = 0.68 + climbCurve * (1.55 + levelProgress * 1.15);
      } else if (pattern === 'stepped_high_low') {
        targetTopY = stepIdx % 2 === 0 ? 0.64 + rng() * 0.22 : 1.35 + levelProgress * 0.7 + rng() * 0.35;
      } else if (maxHeightWave > 0.2) {
        targetTopY += Math.sin(stepIdx * 1.2 + levelId * 0.7) * maxHeightWave * Math.sin(remainingRatio * Math.PI);
      }
    }

    targetTopY += topYOffset;
    if (isTiltingAxis(rotationAxis)) {
      targetTopY = clamp(targetTopY, 1.45, 2.45);
    } else {
      targetTopY = clamp(round2(targetTopY), 0.56, 3.1);
    }

    if (targetTopY - current.topY > 0.92) targetTopY = round2(current.topY + 0.88);
    if (current.topY - targetTopY > 1.35) targetTopY = round2(current.topY - 1.25);
    if (kind === 'moving' || kind === 'disappearing') {
      targetTopY = clamp(targetTopY, 0.56, Math.min(1.2, current.topY + 0.55));
    }
    targetTopY = round2(targetTopY);

    const dY = targetTopY - current.topY;
    const involvesTilt = isTiltingAxis(current.rotationAxis) || isTiltingAxis(rotationAxis);
    const safetyFactor = involvesTilt ? 0.72 : 0.82;
    const physReach = maxPhysicsReachForDy(dY, safeSpeedCap) * safetyFactor;
    const allowedMaxGap = Math.max(2.15, Math.min(maxGap, physReach));
    const effectiveMinGap = Math.min(minGap, allowedMaxGap - 0.15);
    const desiredGap = round2(clamp(effectiveMinGap + rng() * (allowedMaxGap - effectiveMinGap), 2.1, allowedMaxGap));

    let placed: PlacedPlat | null = null;
    const angleTries = nearEnd
      ? [0, 0.24, -0.24, 0.5, -0.5, 0.78, -0.78, 1.05, -1.05, 1.32, -1.32]
      : [0, 0.24, -0.24, 0.5, -0.5, 0.78, -0.78, 1.1, -1.1];
    const gapTries = nearEnd
      ? [desiredGap, round2((effectiveMinGap + allowedMaxGap) * 0.5), effectiveMinGap, Math.max(1.85, effectiveMinGap - 0.35)]
      : [desiredGap, round2((effectiveMinGap + allowedMaxGap) * 0.5), effectiveMinGap];

    for (const angOff of angleTries) {
      if (placed) break;
      const ang = baseAng + angOff;
      const sx = Math.sin(ang);
      const sz = Math.cos(ang);

      for (const tryGap of gapTries) {
        let dist: number;
        const candPreview: PlacedPlat = {
          id: `${prefix}_p${stepIdx}`,
          kind,
          x: 0,
          topY: targetTopY,
          z: 0,
          w,
          h: customH,
          d,
          accent,
          rotationAxis,
          rotationSpeed,
          rotationPhase,
        };

        if (isRotatingPlat(current) || isRotatingPlat(candPreview)) {
          const ra = isRotatingPlat(current) ? effectiveReachHalf(current) : Math.min(current.w, current.d) * 0.5;
          const rb = isRotatingPlat(candPreview) ? effectiveReachHalf(candPreview) : Math.min(w, d) * 0.5;
          const sweepMinDist = sweepRadiusXZ(current) + sweepRadiusXZ(candPreview) + 0.45;
          dist = Math.max(sweepMinDist, ra + rb + tryGap);
        } else {
          const boxExtentA = Math.min(
            Math.abs(sx) > 1e-4 ? (current.w * 0.5) / Math.abs(sx) : 1e6,
            Math.abs(sz) > 1e-4 ? (current.d * 0.5) / Math.abs(sz) : 1e6
          );
          const boxExtentB = Math.min(
            Math.abs(sx) > 1e-4 ? (w * 0.5) / Math.abs(sx) : 1e6,
            Math.abs(sz) > 1e-4 ? (d * 0.5) / Math.abs(sz) : 1e6
          );
          dist = boxExtentA + boxExtentB + tryGap;
        }

        const cx = round2(current.x + sx * dist);
        const cz = round2(current.z + sz * dist);
        const cand: PlacedPlat = {
          ...candPreview,
          x: cx,
          z: cz,
        };

        if (kind === 'moving') {
          const perpX = -sz;
          const perpZ = sx;
          const amp = round2(clamp(2.4 + levelProgress * 2.1, 2.4, 4.5));
          cand.moveOffset = [round2(perpX * amp), 0, round2(perpZ * amp)];
          cand.x = round2(cx - cand.moveOffset[0] * 0.5);
          cand.z = round2(cz - cand.moveOffset[2] * 0.5);
          cand.moveSpeed = round2(moveSpeed + (rng() - 0.5) * 0.22);
          cand.movePhase = round2(rng() * Math.PI * 2);
        } else if (kind === 'disappearing') {
          cand.collapseDelay = collapseDelay;
          cand.respawnDelay = round2(2.3 + rng() * 0.6);
        }

        if (!isInsideBounds(cand, bounds, 2.6)) continue;
        if (collidesWithWalls(cand, walls, 1.35)) continue;
        if (segmentCrossesWalls(current.x, current.z, cand.x, cand.z, walls, 0.75, Math.max(current.topY, cand.topY))) continue;

        if (reservedClearZones) {
          let hitsZone = false;
          const cr = isRotatingPlat(cand) ? sweepRadiusXZ(cand) : Math.hypot(cand.w * 0.5, cand.d * 0.5);
          for (const rz of reservedClearZones) {
            if (Math.hypot(cand.x - rz.x, cand.z - rz.z) < cr + rz.r) {
              hitsZone = true;
              break;
            }
          }
          if (hitsZone) continue;
        }

        const stepGap = effectiveJumpGap(current, cand);
        const sweptPrevGap = minSweptEdgeGap(current, cand);
        if (sweptPrevGap < (isRotatingPlat(current) || isRotatingPlat(cand) ? 0.35 : 1.75)) continue;
        if (stepGap > allowedMaxGap + 0.15) continue;

        let clear = true;
        for (const other of allPlats) {
          if (other.id === current.id) continue;
          const reqSep =
            other.id === toPlat.id
              ? isRotatingPlat(cand) || isRotatingPlat(other)
                ? 0.45
                : 1.75
              : isRotatingPlat(cand) || isRotatingPlat(other)
                ? 0.65
                : minOtherSep;
          if (minSweptEdgeGap(cand, other) < reqSep) {
            clear = false;
            break;
          }
        }
        if (!clear) continue;

        placed = cand;
        break;
      }
    }

    if (!placed) {
      // Fallback step strictly respecting platformMode & reachability
      const dirX = toPlat.x - current.x;
      const dirZ = toPlat.z - current.z;
      const baseFbAng = Math.atan2(dirX, dirZ);
      const fbSize = 3.25;
      const fbAngles = [0, 0.32, -0.32, 0.65, -0.65, 0.98, -0.98, 1.32, -1.32];
      const fbGapOpts = [Math.min(minGap, 2.75), 2.15, 1.75];

      for (const angOff of fbAngles) {
        if (placed) break;
        const ang = baseFbAng + angOff;
        const sx = Math.sin(ang);
        const sz = Math.cos(ang);
        const fbRot = platformMode === 'rotating_only';
        const fbSweep = fbRot ? Math.hypot(fbSize * 0.5, fbSize * 0.5) : fbSize * 0.5;
        const curReach = isRotatingPlat(current) ? effectiveReachHalf(current) : Math.min(current.w, current.d) * 0.5;
        const curSweep = isRotatingPlat(current) ? sweepRadiusXZ(current) : Math.hypot(current.w * 0.5, current.d * 0.5);

        for (const fbGap of fbGapOpts) {
          const minCenterDist = fbRot || isRotatingPlat(current) ? curSweep + fbSweep + 0.42 : curReach + fbSize * 0.5 + fbGap;
          const dist = Math.max(minCenterDist, curReach + fbSize * 0.5 + fbGap);
          let fbTopY = clamp(round2((current.topY + toPlat.topY) * 0.5), 0.58, current.topY + 0.85);
          if (current.topY - fbTopY > 1.25) fbTopY = round2(current.topY - 1.2);
          const fb: PlacedPlat = {
            id: `${prefix}_fb${stepIdx}`,
            kind: 'static',
            x: round2(current.x + sx * dist),
            topY: fbTopY,
            z: round2(current.z + sz * dist),
            w: fbSize,
            d: fbSize,
            accent: fbRot ? 'caution' : woodPrefer ? 'wood' : 'tile',
            ...(fbRot
              ? {
                  rotationAxis: 'y' as const,
                  rotationSpeed: round2((stepIdx % 2 === 0 ? 1 : -1) * rotYSpeedBase * 0.9),
                  rotationPhase: round2(rng() * Math.PI * 2),
                }
              : {}),
          };
          if (!isInsideBounds(fb, bounds, 2.5)) continue;
          if (collidesWithWalls(fb, walls, 1.25)) continue;
          if (segmentCrossesWalls(current.x, current.z, fb.x, fb.z, walls, 0.75, Math.max(current.topY, fb.topY))) continue;
          if (reservedClearZones) {
            const cr = fbRot ? fbSweep : Math.hypot(fbSize * 0.5, fbSize * 0.5);
            if (reservedClearZones.some((rz) => Math.hypot(fb.x - rz.x, fb.z - rz.z) < cr + rz.r)) continue;
          }
          if (effectiveJumpGap(current, fb) > maxGap + 0.15) continue;
          if (minSweptEdgeGap(current, fb) < (fbRot || isRotatingPlat(current) ? 0.35 : 1.35)) continue;
          if (
            allPlats.some((other) => {
              if (other.id === current.id) return false;
              const req = other.id === toPlat.id ? (fbRot || isRotatingPlat(other) ? 0.35 : 1.4) : fbRot || isRotatingPlat(other) ? 0.4 : 1.35;
              return minSweptEdgeGap(fb, other) < req;
            })
          ) {
            continue;
          }
          placed = fb;
          break;
        }
      }
      if (!placed) return false;
    }

    allPlats.push(placed);
    current = placed;
  }

  const finalDy = toPlat.topY - current.topY;
  const finalSafety = isTiltingAxis(current.rotationAxis) ? 0.72 : 0.84;
  const finalPhysMax = maxPhysicsReachForDy(finalDy, safeSpeedCap) * finalSafety;
  return (
    effectiveJumpGap(current, toPlat) <= Math.min(maxGap + 0.15, finalPhysMax) &&
    finalDy <= 1.05 &&
    finalDy >= -1.6 &&
    !segmentCrossesWalls(current.x, current.z, toPlat.x, toPlat.z, walls, 0.75, Math.max(current.topY, toPlat.topY))
  );
}

function buildSegmentGuidePoints(
  pattern: SegmentPattern,
  from: { x: number; z: number },
  to: { x: number; z: number },
  segIdx: number,
  halfW: number,
  rng: () => number,
  sidePref: -1 | 1,
  levelProgress: number
): Array<[number, number]> {
  const dz = to.z - from.z;
  const maxSpan = Math.max(12, halfW - 9);
  const spanX = clamp(15 + levelProgress * 30, 12, maxSpan);

  switch (pattern) {
    case 'wide_s_curve': {
      const s = sidePref;
      return [
        [round2(s * spanX * (0.65 + rng() * 0.25)), round2(from.z + dz * 0.3)],
        [round2(-s * spanX * (0.65 + rng() * 0.25)), round2(from.z + dz * 0.7)],
      ];
    }
    case 'diagonal_slash': {
      const cornerX = sidePref * spanX * (0.7 + rng() * 0.2);
      return [
        [round2(from.x + (cornerX - from.x) * 0.65), round2(from.z + dz * 0.33)],
        [round2(cornerX), round2(from.z + dz * 0.62)],
      ];
    }
    case 'switchback_hairpin': {
      const s = sidePref;
      return [
        [round2(s * spanX * 0.82), round2(from.z + dz * 0.26)],
        [round2(s * spanX * 0.88), round2(from.z + dz * 0.5)],
        [round2(-s * spanX * 0.68), round2(from.z + dz * 0.74)],
      ];
    }
    case 'crescent_bay': {
      const dir = sidePref;
      return [
        [round2(dir * spanX * 0.7), round2(from.z + dz * 0.26)],
        [round2(dir * spanX * 0.94), round2(from.z + dz * 0.5)],
        [round2(dir * spanX * 0.62), round2(from.z + dz * 0.76)],
      ];
    }
    case 'spiral_coil': {
      const d = sidePref;
      return [
        [round2(d * spanX * 0.8), round2(from.z + dz * 0.22)],
        [round2(d * spanX * 0.92), round2(from.z + dz * 0.5)],
        [round2(-d * spanX * 0.68), round2(from.z + dz * 0.74)],
        [round2(-d * spanX * 0.22), round2(from.z + dz * 0.88)],
      ];
    }
    case 'zigzag_slalom': {
      const zigs = 3 + (segIdx % 2);
      const pts: Array<[number, number]> = [];
      for (let k = 1; k <= zigs; k++) {
        const f = k / (zigs + 1);
        const s = k % 2 === 1 ? sidePref : -sidePref;
        pts.push([round2(s * spanX * (0.58 + rng() * 0.3)), round2(from.z + dz * f)]);
      }
      return pts;
    }
    case 'twin_split_lanes': {
      return [
        [round2(sidePref * spanX * 0.78), round2(from.z + dz * 0.35)],
        [round2(sidePref * spanX * 0.78), round2(from.z + dz * 0.68)],
      ];
    }
    case 'archipelago_wander': {
      return [
        [round2((rng() - 0.5) * spanX * 1.4), round2(from.z + dz * 0.28)],
        [round2(sidePref * spanX * (0.4 + rng() * 0.45)), round2(from.z + dz * 0.56)],
        [round2((rng() - 0.5) * spanX * 1.1), round2(from.z + dz * 0.8)],
      ];
    }
    case 'staircase_ascent':
    case 'stepped_high_low':
    case 'narrow_causeway':
    case 'rotor_bridge_chain':
    case 'tumbler_gauntlet':
    case 'gyro_nexus':
    default: {
      const x1 = clamp(from.x + sidePref * spanX * (0.35 + rng() * 0.35), -spanX, spanX);
      const x2 = clamp(to.x - sidePref * spanX * (0.25 + rng() * 0.35), -spanX, spanX);
      return [
        [round2(x1), round2(from.z + dz * 0.36)],
        [round2(x2), round2(from.z + dz * 0.7)],
      ];
    }
  }
}

function findSafeWaterPoint(
  targetX: number,
  targetZ: number,
  bounds: LevelDef['bounds'],
  platforms: PlatformDef[],
  walls: WallDef[],
  clearance: number
): [number, number] {
  const minX = bounds.minX + clearance + 1.5;
  const maxX = bounds.maxX - clearance - 1.5;
  const minZ = bounds.minZ + clearance + 1.5;
  const maxZ = bounds.maxZ - clearance - 1.5;

  const isSafe = (x: number, z: number): boolean => {
    for (const w of walls) {
      if (
        Math.abs(x - w.position[0]) < w.size[0] * 0.5 + clearance &&
        Math.abs(z - w.position[2]) < w.size[2] * 0.5 + clearance
      ) {
        return false;
      }
    }
    for (const p of platforms) {
      const rPad = p.rotationSpeed ? Math.hypot(p.size[0] * 0.5, p.size[2] * 0.5) : 0;
      const samples: Array<[number, number]> = [[p.position[0], p.position[2]]];
      if (p.kind === 'moving' && p.moveOffset) {
        samples.push([p.position[0] + p.moveOffset[0], p.position[2] + p.moveOffset[2]]);
      }
      for (const [px, pz] of samples) {
        if (rPad > 0) {
          if (Math.hypot(x - px, z - pz) < rPad + clearance) return false;
        } else if (
          Math.abs(x - px) < p.size[0] * 0.5 + clearance &&
          Math.abs(z - pz) < p.size[2] * 0.5 + clearance
        ) {
          return false;
        }
      }
    }
    return true;
  };

  const cx = clamp(targetX, minX, maxX);
  const cz = clamp(targetZ, minZ, maxZ);
  if (isSafe(cx, cz)) return [round2(cx), round2(cz)];

  for (let r = 2.5; r <= 36; r += 2.5) {
    for (let k = 0; k < 16; k++) {
      const ang = (k / 16) * Math.PI * 2;
      const sx = clamp(cx + Math.cos(ang) * r, minX, maxX);
      const sz = clamp(cz + Math.sin(ang) * r, minZ, maxZ);
      if (isSafe(sx, sz)) return [round2(sx), round2(sz)];
    }
  }
  return [round2(cx), round2(cz)];
}

function buildLevelLayout(id: number): LevelDef {
  const isOriginal = id <= 10;
  const orig = isOriginal ? ORIGINAL_LEVELS[id - 1] : null;
  const wingIdx = Math.floor((id - 1) / 10); // 0..9
  const levelProgress = (id - 1) / 99; // 0.0 (Lv1) -> 1.0 (Lv100)
  const rng = createRng(hashSeed(id));
  const platformMode = getPlatformMode(id);

  // Pick a unique shuffled sequence of segment patterns for THIS level
  const eligiblePatterns = SEGMENT_PATTERNS.filter((pat) => {
    if (platformMode === 'fixed_only') {
      return pat !== 'rotor_bridge_chain' && pat !== 'tumbler_gauntlet' && pat !== 'gyro_nexus';
    }
    if (id < 16 && pat === 'gyro_nexus') return false;
    if (id < 3 && pat === 'tumbler_gauntlet') return false;
    return true;
  });
  const patternPool = shuffleWithRng(eligiblePatterns, rng);

  // Arena bounds & rooms
  let bounds: LevelDef['bounds'];
  let rooms: RoomZone[];
  let startPlat: PlacedPlat;
  let exitPlat: PlacedPlat;
  let spawn: [number, number, number];
  let exitPos: [number, number, number];
  let exitSize: [number, number, number];
  let cpCount: number;

  if (orig) {
    bounds = { ...orig.bounds };
    rooms = orig.rooms.map((r) => ({ ...r }));
    const origStart = orig.platforms[0];
    const origExit = orig.platforms[orig.platforms.length - 1];
    startPlat = {
      id: `s${id}_start`,
      kind: 'static',
      x: origStart.position[0],
      topY: round2(origStart.position[1] + origStart.size[1] * 0.5),
      z: origStart.position[2],
      w: origStart.size[0],
      d: origStart.size[2],
      accent: 'start',
      isHub: true,
    };
    exitPlat = {
      id: `s${id}_exit`,
      kind: 'static',
      x: origExit.position[0],
      topY: round2(origExit.position[1] + origExit.size[1] * 0.5),
      z: origExit.position[2],
      w: origExit.size[0],
      d: origExit.size[2],
      accent: 'exit',
      isHub: true,
    };
    spawn = [...orig.spawn] as [number, number, number];
    exitPos = [...orig.exit.position] as [number, number, number];
    exitSize = [...orig.exit.size] as [number, number, number];
    cpCount = orig.checkpoints.length;
  } else {
    const idx = id - 11; // 0..89
    const expProg = idx / 89;
    const arenaWidth = round2(88 + expProg * 68); // 88m -> 156m
    const halfW = round2(arenaWidth * 0.5);
    const arenaDepth = round2(324 + expProg * 116); // 324m -> 440m
    const maxZ = 15;
    const minZ = round2(maxZ - arenaDepth);
    const waterY = 0;
    const floorY = round2(-4.0 - expProg * 1.6);
    const ceilingY = round2(13.0 + expProg * 6.0);

    bounds = { minX: -halfW, maxX: halfW, minZ, maxZ, floorY, waterY, ceilingY };
    const chamberCount = 3;
    const chamberDepth = arenaDepth / chamberCount;
    rooms = [];
    for (let c = 0; c < chamberCount; c++) {
      rooms.push({
        center: [0, round2(maxZ - chamberDepth * (c + 0.5))],
        size: [arenaWidth, round2(chamberDepth)],
        ceilingY,
        floorY,
        waterY,
      });
    }

    startPlat = {
      id: `s${id}_start`,
      kind: 'static',
      x: 0,
      topY: 0.8,
      z: 6.5,
      w: round2(15.5 + expProg * 2.5),
      d: round2(10.5 + expProg * 1.5),
      accent: 'start',
      isHub: true,
    };
    const exitDeckZ = round2(minZ + 12.0);
    const exitTopY = id % 4 === 0 ? round2(1.2 + expProg * 0.9) : 0.85;
    exitPlat = {
      id: `s${id}_exit`,
      kind: 'static',
      x: 0,
      topY: exitTopY,
      z: exitDeckZ,
      w: 11.5,
      d: 9.0,
      accent: 'exit',
      isHub: true,
    };
    spawn = [startPlat.x, startPlat.topY, startPlat.z];
    exitPos = [exitPlat.x, exitPlat.topY, exitPlat.z - 2.4];
    exitSize = [4.6, 3.8, 1.75];
    cpCount = id >= 70 ? 4 : 3;
  }

  const arenaWidth = bounds.maxX - bounds.minX;
  const halfW = arenaWidth * 0.5;
  const arenaDepth = bounds.maxZ - bounds.minZ;
  const waterY = bounds.waterY;
  const floorY = bounds.floorY;
  const ceilingY = bounds.ceilingY;

  // Unique per-level asymmetric checkpoint coordinates & heights
  const hubPlats: PlacedPlat[] = [];
  const checkpoints: CheckpointDef[] = [];
  for (let c = 1; c <= cpCount; c++) {
    const baseFrac = c / (cpCount + 1);
    const fracJitter = (rng() - 0.5) * 0.08;
    const frac = clamp(baseFrac + fracJitter, 0.14, 0.86);
    const hz = round2(startPlat.z + (exitPlat.z - startPlat.z) * frac);

    // Keep Level 1 checkpoints centered inside its iconic archway walls (-51.84, -104.5)
    let hx: number;
    if (id === 1 && orig) {
      hx = 0;
    } else {
      const latMax = Math.min(halfW - 14, halfW * 0.58);
      hx = round2((rng() * 2 - 1) * latMax);
    }

    const hTopY =
      id === 1
        ? 0.68
        : round2(clamp(0.75 + rng() * (0.45 + levelProgress * 1.25), 0.7, 2.25));
    const hubSize = isOriginal ? round2(4.4 + rng() * 1.4) : round2(clamp(8.2 - levelProgress * 1.1, 6.8, 8.2));
    const hub: PlacedPlat = {
      id: `s${id}_cp${c}`,
      kind: 'static',
      x: hx,
      topY: hTopY,
      z: isOriginal && id === 1 && orig ? orig.checkpoints[c - 1].position[2] : hz,
      w: hubSize,
      d: hubSize,
      accent: wingIdx === 3 ? 'wood' : 'concrete',
      isHub: true,
    };
    hubPlats.push(hub);
    checkpoints.push({
      id: isOriginal ? `cp${c}` : `s${id}_checkpoint_${c}`,
      position: [hub.x, hub.topY, hub.z],
    });
  }

  const spine = [startPlat, ...hubPlats, exitPlat];
  const allPlats: PlacedPlat[] = [...spine];
  const walls: WallDef[] = [];

  // Preserve Level 1's iconic archway walls; for Levels 2-100, place architectural walls safely
  const wallH = ceilingY - floorY;
  const wallCenterY = floorY + wallH * 0.5;
  if (id === 1 && orig) {
    for (const w of orig.walls) {
      if (w.kind !== 'pillar') walls.push({ ...w });
    }
  } else {
    // Place varied divider / baffle walls in selected segments BEFORE pathing so paths weave around them!
    const wallClearFromPlats = (wx: number, wz: number, ww: number, wd: number): boolean => {
      for (const p of allPlats) {
        if (
          Math.abs(wx - p.x) < (ww + p.w) * 0.5 + 4.2 &&
          Math.abs(wz - p.z) < (wd + p.d) * 0.5 + 4.2
        ) {
          return false;
        }
      }
      return true;
    };

    for (let seg = 0; seg < spine.length - 1; seg++) {
      const segPattern = patternPool[seg % patternPool.length];
      const midZ = round2((spine[seg].z + spine[seg + 1].z) * 0.5);
      if (segPattern === 'twin_split_lanes' || segPattern === 'spiral_coil') {
        const cw = segPattern === 'spiral_coil' ? 10.0 : 3.8;
        const cd = segPattern === 'spiral_coil' ? 16.0 : 22.0;
        if (wallClearFromPlats(0, midZ, cw, cd)) {
          walls.push({ position: [0, wallCenterY, midZ], size: [cw, wallH, cd], kind: 'tile' });
        }
      } else if (segPattern === 'switchback_hairpin' || (seg % 2 === 1 && rng() < 0.55)) {
        const baffleW = round2(Math.min(18, halfW * 0.3));
        const side: -1 | 1 = rng() < 0.5 ? -1 : 1;
        const bx = round2(side * (halfW - baffleW * 0.5));
        if (wallClearFromPlats(bx, midZ, baffleW, 2.6)) {
          walls.push({
            position: [bx, wallCenterY, midZ],
            size: [baffleW, wallH, 2.6],
            kind: side < 0 ? 'tile' : 'concrete',
          });
        }
      }
    }
  }

  // Strictly monotonic progressive jump & rotation tuning across Levels 1..100
  const minGap = round2(2.25 + levelProgress * 1.95); // 2.25m -> 4.20m
  const maxGap = round2(3.35 + levelProgress * 2.45); // 3.35m -> 5.80m (inside walk=6.4m / run=9.89m)
  const minOtherSep = round2(2.05 + levelProgress * 1.05); // 2.05m -> 3.10m
  const baseTileSize = round2(3.75 - levelProgress * 0.65); // 3.75m -> 3.10m

  const movingRatio = platformMode === 'mixed' ? round2(0.10 + levelProgress * 0.16) : 0;
  const fragileRatio = platformMode === 'mixed' ? round2(0.08 + levelProgress * 0.22) : 0;
  const bridgeRatio = round2(0.14 + (rng() * 0.12));
  const woodPrefer = wingIdx === 3 || (id >= 11 && rng() < 0.18);
  const maxHeightWave = round2(0.22 + levelProgress * 0.72);
  const moveSpeed = round2(0.85 + levelProgress * 1.0);
  const collapseDelay = round2(1.1 - levelProgress * 0.6);

  // Rotating platform speeds & direction vary per level and escalate progressively!
  const rotYSpeedBase = round2(0.38 + levelProgress * 0.88); // 0.38 rad/s -> 1.26 rad/s
  const rotTiltSpeedBase = round2(0.36 + levelProgress * 0.54); // 0.36 rad/s -> 0.90 rad/s (fair landing windows!)
  const rotDirBias: -1 | 1 = rng() < 0.5 ? 1 : -1;

  // Keep (0, -24) water open in Level 1 for automated multiplayer serpent test
  const reservedClearZones = id === 1 ? [{ x: 0, z: -24, r: 4.5 }] : undefined;

  for (let seg = 0; seg < spine.length - 1; seg++) {
    const a = spine[seg];
    const b = spine[seg + 1];
    const segPattern = patternPool[seg % patternPool.length];
    const segSign: -1 | 1 = rng() < 0.5 ? -1 : 1;

    const guideMain = buildSegmentGuidePoints(
      segPattern,
      a,
      b,
      seg,
      halfW,
      rng,
      segSign,
      levelProgress
    );

    const snapMain = allPlats.length;
    const mainOk = connectWithWaterGaps(`s${id}_m${seg}`, a, b, {
      rng,
      levelId: id,
      levelProgress,
      platformMode,
      pattern: segPattern,
      minGap,
      maxGap,
      minOtherSep,
      baseTileSize,
      movingRatio,
      fragileRatio,
      bridgeRatio,
      woodPrefer,
      maxHeightWave,
      moveSpeed,
      rotYSpeedBase,
      rotTiltSpeedBase,
      rotDirBias,
      collapseDelay,
      bounds,
      walls,
      allPlats,
      guideTargets: guideMain,
      reservedClearZones,
    });

    if (!mainOk) {
      allPlats.length = snapMain;
      const snapFb = allPlats.length;
      const fbOk = connectWithWaterGaps(`s${id}_mf${seg}`, a, b, {
        rng,
        levelId: id,
        levelProgress,
        platformMode,
        pattern: 'wide_s_curve',
        minGap: Math.min(minGap, 2.45),
        maxGap,
        minOtherSep: 1.35,
        baseTileSize: round2(Math.max(3.2, baseTileSize)),
        movingRatio: 0,
        fragileRatio: 0,
        bridgeRatio: 0.15,
        woodPrefer,
        maxHeightWave: 0.2,
        moveSpeed,
        rotYSpeedBase,
        rotTiltSpeedBase: rotTiltSpeedBase * 0.9,
        rotDirBias,
        collapseDelay,
        bounds,
        walls,
        allPlats,
        guideTargets: [],
        reservedClearZones,
      });
      if (!fbOk) {
        allPlats.length = snapFb;
        // Final-resort safe direct corridor respecting platformMode
        const snapFb2 = allPlats.length;
        const fb2Ok = connectWithWaterGaps(`s${id}_mff${seg}`, a, b, {
          rng,
          levelId: id,
          levelProgress,
          platformMode,
          pattern: platformMode === 'rotating_only' ? 'rotor_bridge_chain' : 'narrow_causeway',
          minGap: 2.0,
          maxGap: Math.max(maxGap, 3.8),
          minOtherSep: 0.9,
          baseTileSize: 3.15,
          movingRatio: 0,
          fragileRatio: 0,
          bridgeRatio: 0,
          woodPrefer,
          maxHeightWave: 0,
          moveSpeed,
          rotYSpeedBase,
          rotTiltSpeedBase: rotTiltSpeedBase * 0.85,
          rotDirBias,
          collapseDelay,
          bounds,
          walls,
          allPlats,
          guideTargets: [],
          reservedClearZones,
        });
        if (!fb2Ok) {
          allPlats.length = snapFb2;
        }
      }
    }

    // Secondary branching flank route (split lanes / multiplayer relief path)
    const wantSplit =
      segPattern === 'twin_split_lanes' ||
      segPattern === 'archipelago_wander' ||
      (!isOriginal && (seg % 2 === 0 || rng() < 0.45));

    if (wantSplit) {
      const oppSign: -1 | 1 = segSign === -1 ? 1 : -1;
      const flankMidZ = round2((a.z + b.z) * 0.5 + (rng() - 0.5) * 6);
      const flankX = round2(oppSign * Math.min(halfW - 11, 14 + levelProgress * 24));
      const flankIsland: PlacedPlat = {
        id: `s${id}_flank${seg}`,
        kind: 'static',
        x: flankX,
        topY: round2(clamp((a.topY + b.topY) * 0.5 + 0.15, 0.72, 1.9)),
        z: flankMidZ,
        w: isOriginal ? 4.6 : 5.8,
        d: isOriginal ? 4.6 : 5.8,
        accent: woodPrefer ? 'wood' : 'tile',
        isHub: true,
        ...(platformMode === 'rotating_only'
          ? {
              rotationAxis: 'y' as const,
              rotationSpeed: round2(oppSign * rotYSpeedBase * 0.8),
              rotationPhase: round2(rng() * Math.PI * 2),
            }
          : {}),
      };

      const flankClear =
        isInsideBounds(flankIsland, bounds, 3.0) &&
        !collidesWithWalls(flankIsland, walls, 2.0) &&
        (!reservedClearZones ||
          reservedClearZones.every((rz) => Math.hypot(flankIsland.x - rz.x, flankIsland.z - rz.z) >= 4.5 + rz.r)) &&
        allPlats.every((o) => minSweptEdgeGap(flankIsland, o) >= minOtherSep + 1.0);

      if (flankClear) {
        allPlats.push(flankIsland);
        const snapFlA = allPlats.length;
        const okFlA = connectWithWaterGaps(`s${id}_flA${seg}`, a, flankIsland, {
          rng,
          levelId: id,
          levelProgress,
          platformMode,
          pattern: 'crescent_bay',
          minGap,
          maxGap,
          minOtherSep: 1.8,
          baseTileSize: round2(baseTileSize + 0.1),
          movingRatio: movingRatio * 0.6,
          fragileRatio: fragileRatio * 0.5,
          bridgeRatio: 0.2,
          woodPrefer,
          maxHeightWave: 0.25,
          moveSpeed,
          rotYSpeedBase,
          rotTiltSpeedBase,
          rotDirBias: oppSign,
          collapseDelay,
          bounds,
          walls,
          allPlats,
          guideTargets: [[round2(flankX * 0.65), round2((a.z + flankMidZ) * 0.5)]],
          reservedClearZones,
        });
        if (!okFlA) allPlats.length = snapFlA;

        const snapFlB = allPlats.length;
        const okFlB = connectWithWaterGaps(`s${id}_flB${seg}`, flankIsland, b, {
          rng,
          levelId: id,
          levelProgress,
          platformMode,
          pattern: 'crescent_bay',
          minGap,
          maxGap,
          minOtherSep: 1.8,
          baseTileSize: round2(baseTileSize + 0.1),
          movingRatio: movingRatio * 0.7,
          fragileRatio: fragileRatio * 0.6,
          bridgeRatio: 0.2,
          woodPrefer,
          maxHeightWave: 0.25,
          moveSpeed,
          rotYSpeedBase,
          rotTiltSpeedBase,
          rotDirBias: oppSign,
          collapseDelay,
          bounds,
          walls,
          allPlats,
          guideTargets: [[round2(flankX * 0.65), round2((flankMidZ + b.z) * 0.5)]],
          reservedClearZones,
        });
        if (!okFlB) allPlats.length = snapFlB;
      }
    }

    // Swimmer climb-out recovery pad near checkpoints (fixed ladder_step unless rotating_only)
    if (b.id !== exitPlat.id && platformMode !== 'rotating_only') {
      const climbCand: PlacedPlat = {
        id: `s${id}_climb${seg}`,
        kind: 'ladder_step',
        x: round2(clamp(b.x + (seg % 2 === 0 ? 1 : -1) * (b.w * 0.5 + 2.8), bounds.minX + 4.5, bounds.maxX - 4.5)),
        topY: 0.58,
        z: round2(b.z + 2.4),
        w: 3.0,
        d: 3.0,
        accent: 'metal',
      };
      const climbClear =
        isInsideBounds(climbCand, bounds, 2.4) &&
        !collidesWithWalls(climbCand, walls, 1.4) &&
        allPlats.every((o) => minSweptEdgeGap(climbCand, o) >= 1.85);
      if (climbClear) {
        allPlats.push(climbCand);
      }
    }
  }

  // Place structural concrete pillars in genuine open water clear of all platforms & jump lanes
  const pillarRows = isOriginal ? 5 + Math.floor(id / 2) : 8 + Math.floor(levelProgress * 6);
  for (let r = 0; r < pillarRows; r++) {
    const pz = round2(bounds.maxZ - 22 - (r / Math.max(1, pillarRows - 1)) * (arenaDepth - 44));
    const xs = [-halfW * 0.76, -halfW * 0.34, halfW * 0.34, halfW * 0.76];
    for (const rawX of xs) {
      const px = round2(rawX + (rng() - 0.5) * 4.5);
      const cand: PlacedPlat = {
        id: 'pil',
        kind: 'static',
        x: px,
        topY: 1,
        z: pz,
        w: 2.3,
        d: 2.3,
        accent: 'concrete',
      };
      if (
        (!reservedClearZones || reservedClearZones.every((rz) => Math.hypot(px - rz.x, pz - rz.z) >= 3.5 + rz.r)) &&
        !collidesWithWalls(cand, walls, 2.5) &&
        allPlats.every((o) => minSweptEdgeGap(cand, o) >= 2.5)
      ) {
        walls.push({ position: [px, wallCenterY, pz], size: [2.3, wallH, 2.3], kind: 'pillar' });
      }
    }
  }

  const platforms: PlatformDef[] = allPlats.map((p) => toPlatformDef(p, waterY));

  // Monsters: keep Level 1..10 stats & Level 1's first waypoint safely near (0, -25) water zone
  let monsters: MonsterConfig[];
  if (orig) {
    monsters = orig.monsters.map((m, mIdx) => ({
      ...m,
      waypoints: m.waypoints.map(([wx, wz], wIdx) => {
        if (id === 1 && mIdx === 0 && wIdx === 0) {
          return findSafeWaterPoint(0, -25, bounds, platforms, walls, 1.6 * (m.scale || 1));
        }
        return findSafeWaterPoint(wx, wz, bounds, platforms, walls, 1.9 * (m.scale || 1));
      }),
    }));
  } else {
    const idx = id - 11;
    const expProg = idx / 89;
    const monsterCount = 4 + Math.floor((idx + 14) / 22);
    const basePatrolSpeed = round2(4.65 + expProg * 2.85);
    const baseChaseSpeed = round2(9.15 + expProg * 4.05);
    const baseWaterDet = round2(150 + expProg * 110);

    monsters = [];
    for (let mIdx = 0; mIdx < monsterCount; mIdx++) {
      const f0 = (mIdx + 0.12) / monsterCount;
      const f1 = (mIdx + 0.88) / monsterCount;
      const zTop = startPlat.z - 20 - f0 * (arenaDepth - 48);
      const zBot = startPlat.z - 20 - f1 * (arenaDepth - 48);
      const zMid = (zTop + zBot) * 0.5;
      const scale = round2(1.15 + expProg * 0.55 + (mIdx === 0 ? 0.1 : 0));
      const clearance = 1.9 * scale;

      const rawWps: Array<[number, number]> =
        mIdx % 2 === 0
          ? [
              [-halfW * 0.55, zTop],
              [halfW * 0.55, zTop - 12],
              [halfW * 0.58, zBot],
              [-halfW * 0.56, zMid],
            ]
          : [
              [halfW * 0.55, zTop],
              [-halfW * 0.56, zMid],
              [-halfW * 0.5, zBot],
              [halfW * 0.58, zBot + 10],
            ];

      monsters.push({
        id: `s${id}_serpent_${mIdx + 1}`,
        waypoints: rawWps.map(([wx, wz]) =>
          findSafeWaterPoint(wx, wz, bounds, platforms, walls, clearance)
        ),
        patrolSpeed: round2(basePatrolSpeed + (mIdx % 2) * 0.25),
        chaseSpeed: baseChaseSpeed,
        detectionRadius: 0,
        waterDetectionRadius: baseWaterDet,
        scale,
      });
    }
  }

  if (orig) {
    return {
      ...orig,
      platforms,
      walls,
      checkpoints,
      monsters,
    };
  }

  const idx = id - 11;
  const expProg = idx / 89;
  const theme = WING_THEMES[(wingIdx - 1) % WING_THEMES.length];

  const lights: LevelDef['lights'] = [];
  const lightCols = [-halfW * 0.5, 0, halfW * 0.5];
  const lightRows = Math.max(9, Math.round(arenaDepth / 34));
  for (let r = 0; r < lightRows; r++) {
    const lz = round2(bounds.maxZ - 14 - (r / Math.max(1, lightRows - 1)) * (arenaDepth - 28));
    for (let c = 0; c < lightCols.length; c++) {
      if (r % 2 === 1 && c === 1) continue;
      const lx = round2(lightCols[c]);
      const isExitGlow = r === lightRows - 1 && c === 1;
      const flicker = !isExitGlow && rng() < 0.26 + expProg * 0.2;
      lights.push({
        position: [lx, round2(ceilingY - 0.8), lz],
        color: isExitGlow ? '#82ecc5' : flicker ? '#b0cbd2' : '#cae1e7',
        intensity: isExitGlow ? 2.0 : round2(1.3 - expProg * 0.24),
        flickering: flicker,
      });
    }
  }

  const fogDensity = round2(0.01 + expProg * 0.0045);
  const difficulty: LevelDef['difficulty'] =
    id <= 22 ? 'Low' : id <= 44 ? 'Moderate' : id <= 68 ? 'High' : id <= 88 ? 'Severe' : 'Extreme';

  const paceMargin = 1.48 - expProg * 0.44;
  const baseRunSec = arenaDepth * 0.92 + expProg * 45;
  const timeLimit = Math.round(clamp(baseRunSec * paceMargin, 240, 560));
  const parS = Math.round(timeLimit * 0.36);
  const parA = Math.round(timeLimit * 0.58);
  const parB = Math.round(timeLimit * 0.8);

  const sectorName = UNIQUE_SECTOR_NAMES[idx] || `Abyssal Sector ${id}`;
  const wing = SECTOR_WINGS[wingIdx] || SECTOR_WINGS[wingIdx % SECTOR_WINGS.length];
  const modeLabel =
    platformMode === 'fixed_only'
      ? 'fixed-deck'
      : platformMode === 'rotating_only'
        ? 'rotating-rotor'
        : 'hybrid fixed & rotating';

  return {
    id,
    code: `SECTOR ${String(id).padStart(2, '0')}`,
    name: sectorName,
    subtitle: `${wing.name} · ${Math.round(arenaWidth)}×${Math.round(arenaDepth)}m ${modeLabel} course in ${theme.waterTone}. ${monsters.length} serpents patrol below.`,
    difficulty,
    timeLimit,
    parTimes: [parS, parA, parB],
    fogColor: theme.fog,
    fogDensity,
    ambientTint: theme.ambient,
    rooms,
    bounds,
    spawn,
    exit: {
      position: exitPos,
      size: exitSize,
    },
    platforms,
    walls,
    checkpoints,
    monsters,
    lights,
  };
}

const levelLayoutCache = new Map<number, LevelDef>();
const levelSummaryCache = new Map<number, LevelSummary>();

export function isValidLevelId(id: number): boolean {
  return Number.isInteger(id) && id >= 1 && id <= TOTAL_LEVELS;
}

export function getLevelSummary(id: number): LevelSummary {
  const safeId = isValidLevelId(id) ? id : 1;
  const cached = levelSummaryCache.get(safeId);
  if (cached) return cached;

  let summary: LevelSummary;
  if (safeId <= 10) {
    const orig = ORIGINAL_LEVELS[safeId - 1];
    summary = {
      id: orig.id,
      code: orig.code,
      name: orig.name,
      subtitle: orig.subtitle,
      difficulty: orig.difficulty,
      timeLimit: orig.timeLimit,
      parTimes: orig.parTimes,
    };
  } else {
    const idx = safeId - 11;
    const expProg = idx / 89;
    const rawWidth = round2(88 + expProg * 68);
    const halfW = round2(rawWidth * 0.5);
    const arenaWidth = halfW * 2;
    const rawDepth = round2(324 + expProg * 116);
    const maxZ = 15;
    const minZ = round2(maxZ - rawDepth);
    const arenaDepth = maxZ - minZ;
    const monsterCount = 4 + Math.floor((idx + 14) / 22);
    const wingIdx = Math.floor((safeId - 1) / 10);
    const platformMode = getPlatformMode(safeId);
    const theme = WING_THEMES[(wingIdx - 1) % WING_THEMES.length];

    const difficulty: LevelDef['difficulty'] =
      safeId <= 22 ? 'Low' : safeId <= 44 ? 'Moderate' : safeId <= 68 ? 'High' : safeId <= 88 ? 'Severe' : 'Extreme';

    const paceMargin = 1.48 - expProg * 0.44;
    const baseRunSec = arenaDepth * 0.92 + expProg * 45;
    const timeLimit = Math.round(clamp(baseRunSec * paceMargin, 240, 560));
    const parS = Math.round(timeLimit * 0.36);
    const parA = Math.round(timeLimit * 0.58);
    const parB = Math.round(timeLimit * 0.8);

    const sectorName = UNIQUE_SECTOR_NAMES[idx] || `Abyssal Sector ${safeId}`;
    const wing = SECTOR_WINGS[wingIdx] || SECTOR_WINGS[wingIdx % SECTOR_WINGS.length];
    const modeLabel =
      platformMode === 'fixed_only'
        ? 'fixed-deck'
        : platformMode === 'rotating_only'
          ? 'rotating-rotor'
          : 'hybrid fixed & rotating';

    summary = {
      id: safeId,
      code: `SECTOR ${String(safeId).padStart(2, '0')}`,
      name: sectorName,
      subtitle: `${wing.name} · ${Math.round(arenaWidth)}×${Math.round(arenaDepth)}m ${modeLabel} course in ${theme.waterTone}. ${monsterCount} serpents patrol below.`,
      difficulty,
      timeLimit,
      parTimes: [parS, parA, parB],
    };
  }

  levelSummaryCache.set(safeId, summary);
  return summary;
}

export function generateLevelCatalog(): LevelSummary[] {
  const catalog: LevelSummary[] = [];
  for (let id = 1; id <= TOTAL_LEVELS; id++) {
    catalog.push(getLevelSummary(id));
  }
  return catalog;
}

export function getLevelById(id: number): LevelDef {
  const safeId = isValidLevelId(id) ? id : 1;
  const cached = levelLayoutCache.get(safeId);
  if (cached) return cached;
  const built = buildLevelLayout(safeId);
  levelLayoutCache.set(safeId, built);
  return built;
}

export function generateAllLevels(): LevelDef[] {
  const all: LevelDef[] = [];
  for (let id = 1; id <= TOTAL_LEVELS; id++) {
    all.push(getLevelById(id));
  }
  return all;
}
