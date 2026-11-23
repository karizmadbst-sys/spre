import {
  SECTOR_WINGS,
  TOTAL_LEVELS,
  getLevelById,
} from './levelGenerator.ts';
import { LevelSpatialGrid } from './spatialGrid.ts';
import type {
  LevelDef,
  MonsterConfig,
  PlatformDef,
  WallDef,
} from './types.ts';

export const OPEN_WORLD_REGION_COUNT = TOTAL_LEVELS; // 100
export const WING_COLUMN_PITCH_X = 190;
export const REGION_CONNECTOR_GAP_Z = 22;
export const WING_TURN_BASIN_DEPTH = 22;
export const DOORWAY_HALF_WIDTH_NS = 8.0;
export const DOORWAY_HALF_WIDTH_EW = 6.5;
export const DOORWAY_CLEAR_HEIGHT = 6.4;
export const PERIMETER_WALL_THICK = 1.6;

export type CardinalSide = 'n' | 's' | 'e' | 'w';

export interface WorldDoorway {
  side: CardinalSide;
  center: number; // X coordinate if side is 'n'|'s', Z coordinate if side is 'e'|'w'
  halfWidth: number;
  targetRegionId: number;
  connectorId: string;
}

export interface WorldCheckpoint {
  id: string;
  regionId: number;
  index: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  label: string;
}

export interface WorldRegionMeta {
  regionId: number;
  name: string;
  wingIndex: number;
  wingTitle: string;
  wingAccent: string;
  difficulty: LevelDef['difficulty'];
  flip180: boolean;
  offsetX: number;
  offsetZ: number;
  bounds: LevelDef['bounds'];
  spawn: [number, number, number];
  spawnYaw: number;
  exit: LevelDef['exit'];
  fogColor: string;
  fogDensity: number;
  ambientTint: string;
  doorways: WorldDoorway[];
  connectedRegionIds: number[];
  connectorIds: string[];
  checkpoints: WorldCheckpoint[];
}

export interface WorldRegionRuntimeDef extends LevelDef {
  regionId: number;
  wingIndex: number;
  wingTitle: string;
  wingAccent: string;
  flip180: boolean;
  spawnYaw: number;
  perimeterWalls: WallDef[];
  overheadLintels: WallDef[];
  doorways: WorldDoorway[];
  connectedRegionIds: number[];
  connectorIds: string[];
  worldCheckpoints: WorldCheckpoint[];
}

export interface WorldConnectorFloorBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  floorY: number;
  waterY: number;
  ceilingY: number;
}

export interface WorldConnectorDef {
  id: string;
  kind: 'linear' | 'turn' | 'cross_wing';
  regionA: number;
  regionB: number;
  wingIndex: number;
  bounds: LevelDef['bounds'];
  floorBoxes: WorldConnectorFloorBox[];
  platforms: PlatformDef[];
  walls: WallDef[];
  lights: LevelDef['lights'];
  checkpoints: WorldCheckpoint[];
  grid: LevelSpatialGrid;
}

interface DoorwayStub {
  regionId: number;
  doorway: WorldDoorway;
}

const REGION_METAS: WorldRegionMeta[] = [];
const REGION_BY_ID = new Map<number, WorldRegionMeta>();
const WORLD_CHECKPOINTS: WorldCheckpoint[] = [];
const CHECKPOINT_BY_ID = new Map<string, WorldCheckpoint>();
const CONNECTORS: WorldConnectorDef[] = [];
const CONNECTOR_BY_ID = new Map<string, WorldConnectorDef>();

export let OPEN_WORLD_BOUNDS: LevelDef['bounds'] = {
  minX: -50,
  maxX: 1850,
  minZ: -3300,
  maxZ: 1400,
  floorY: -5.6,
  waterY: 0,
  ceilingY: 19,
};

function txLocal(offsetX: number, flip180: boolean, lx: number): number {
  return offsetX + (flip180 ? -lx : lx);
}

function tzLocal(offsetZ: number, flip180: boolean, lz: number): number {
  return offsetZ + (flip180 ? -lz : lz);
}

function findRegionEntrancePlatform(def: LevelDef, spawn: [number, number, number]): PlatformDef | null {
  let best: PlatformDef | null = null;
  let bestDist = Infinity;
  for (let i = 0; i < def.platforms.length; i++) {
    const p = def.platforms[i];
    const d = Math.hypot(p.position[0] - spawn[0], p.position[2] - spawn[2]);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best;
}

function findRegionExitPlatform(def: LevelDef, exitPos: [number, number, number]): PlatformDef | null {
  let best: PlatformDef | null = null;
  let bestDist = Infinity;
  for (let i = 0; i < def.platforms.length; i++) {
    const p = def.platforms[i];
    const d = Math.hypot(p.position[0] - exitPos[0], p.position[2] - exitPos[2]);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best;
}

function makeBridgeSegmentPlatforms(
  idPrefix: string,
  x1: number,
  y1Top: number,
  z1: number,
  x2: number,
  y2Top: number,
  z2: number,
  width: number,
  accentKind: PlatformDef['accent'] = 'metal'
): PlatformDef[] {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.25) return [];

  const yDiff = Math.abs(y2Top - y1Top);
  // Step up/down gracefully if height differs > 0.28m (never exceeds STEP_UP_HEIGHT = 0.50m)
  const segments = yDiff > 0.28 ? Math.max(3, Math.ceil(yDiff / 0.28)) : 1;
  const out: PlatformDef[] = [];
  const axisX = Math.abs(dx) >= Math.abs(dz);

  for (let i = 0; i < segments; i++) {
    const t0 = i / segments;
    const t1 = (i + 1) / segments;
    const tm = (t0 + t1) * 0.5;
    const topY = y1Top + (y2Top - y1Top) * tm;
    const thick = 0.72;
    const segLen = Math.max(1.2, dist / segments + 0.3);
    const sx = axisX ? segLen : width;
    const sz = axisX ? width : segLen;
    out.push({
      id: `${idPrefix}_${i}`,
      position: [x1 + dx * tm, topY - thick * 0.5, z1 + dz * tm],
      size: [sx, thick, sz],
      kind: 'bridge',
      accent: accentKind,
    });
  }
  return out;
}

function buildConnectorGridForBoxes(
  boxes: WorldConnectorFloorBox[],
  platforms: PlatformDef[],
  walls: WallDef[]
): { bounds: LevelDef['bounds']; grid: LevelSpatialGrid } {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let floorY = -4.6;
  let ceilingY = 14.0;

  for (const b of boxes) {
    if (b.minX < minX) minX = b.minX;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.minZ < minZ) minZ = b.minZ;
    if (b.maxZ > maxZ) maxZ = b.maxZ;
    if (b.floorY < floorY) floorY = b.floorY;
    if (b.ceilingY > ceilingY) ceilingY = b.ceilingY;
  }

  for (const w of walls) {
    minX = Math.min(minX, w.position[0] - w.size[0] * 0.5);
    maxX = Math.max(maxX, w.position[0] + w.size[0] * 0.5);
    minZ = Math.min(minZ, w.position[2] - w.size[2] * 0.5);
    maxZ = Math.max(maxZ, w.position[2] + w.size[2] * 0.5);
  }

  const bounds: LevelDef['bounds'] = {
    minX,
    maxX,
    minZ,
    maxZ,
    floorY,
    waterY: 0,
    ceilingY,
  };

  return {
    bounds,
    grid: new LevelSpatialGrid({ bounds, platforms, walls }, 12),
  };
}

function initOpenWorldCatalog(): void {
  if (REGION_METAS.length > 0) return;

  const doorwaysByRegion = new Map<number, WorldDoorway[]>();
  const addDoorway = (stub: DoorwayStub) => {
    let arr = doorwaysByRegion.get(stub.regionId);
    if (!arr) {
      arr = [];
      doorwaysByRegion.set(stub.regionId, arr);
    }
    arr.push(stub.doorway);
  };

  let cursorZ = 0;
  let worldMinX = Infinity;
  let worldMaxX = -Infinity;
  let worldMinZ = Infinity;
  let worldMaxZ = -Infinity;
  let worldFloorY = -4.6;
  let worldCeilY = 14;

  // Step 1: Place all 100 regions in a 10-Wing continuous serpentine layout
  for (let w = 0; w < 10; w++) {
    const flip180 = w % 2 === 1;
    const wingCenterX = w * WING_COLUMN_PITCH_X;
    const wing = SECTOR_WINGS[w] ?? SECTOR_WINGS[SECTOR_WINGS.length - 1];

    for (let s = 0; s < 10; s++) {
      const id = w * 10 + s + 1;
      const raw = getLevelById(id);
      const b = raw.bounds;

      let offsetZ: number;
      if (!flip180) {
        // Flows North (-Z): South edge sits at cursorZ
        offsetZ = cursorZ - b.maxZ;
      } else {
        // Flipped 180 -> flows South (+Z): North edge (-b.maxZ) sits at cursorZ
        offsetZ = cursorZ + b.maxZ;
      }

      const bounds: LevelDef['bounds'] = {
        minX: wingCenterX + (flip180 ? -b.maxX : b.minX),
        maxX: wingCenterX + (flip180 ? -b.minX : b.maxX),
        minZ: offsetZ + (flip180 ? -b.maxZ : b.minZ),
        maxZ: offsetZ + (flip180 ? -b.minZ : b.maxZ),
        floorY: b.floorY,
        waterY: b.waterY,
        ceilingY: b.ceilingY,
      };

      const spawn: [number, number, number] = [
        txLocal(wingCenterX, flip180, raw.spawn[0]),
        raw.spawn[1],
        tzLocal(offsetZ, flip180, raw.spawn[2]),
      ];

      const exit: LevelDef['exit'] = {
        position: [
          txLocal(wingCenterX, flip180, raw.exit.position[0]),
          raw.exit.position[1],
          tzLocal(offsetZ, flip180, raw.exit.position[2]),
        ],
        size: [...raw.exit.size],
      };

      const spawnYaw = flip180 ? 0 : Math.PI;
      const checkpoints: WorldCheckpoint[] = raw.checkpoints.map((cp, idx) => {
        const pos = cp.position;
        const wc: WorldCheckpoint = {
          id: `cp_${id}_${idx}`,
          regionId: id,
          index: idx,
          x: txLocal(wingCenterX, flip180, pos[0]),
          y: pos[1],
          z: tzLocal(offsetZ, flip180, pos[2]),
          yaw: spawnYaw,
          label: `Sector ${String(id).padStart(3, '0')} · Beacon ${idx + 1}`,
        };
        WORLD_CHECKPOINTS.push(wc);
        CHECKPOINT_BY_ID.set(wc.id, wc);
        return wc;
      });

      const meta: WorldRegionMeta = {
        regionId: id,
        name: raw.name,
        wingIndex: w,
        wingTitle: wing.name,
        wingAccent: wing.accentHex,
        difficulty: raw.difficulty,
        flip180,
        offsetX: wingCenterX,
        offsetZ,
        bounds,
        spawn,
        spawnYaw,
        exit,
        fogColor: raw.fogColor,
        fogDensity: raw.fogDensity,
        ambientTint: raw.ambientTint,
        doorways: [],
        connectedRegionIds: [],
        connectorIds: [],
        checkpoints,
      };

      REGION_METAS.push(meta);
      REGION_BY_ID.set(id, meta);

      worldMinX = Math.min(worldMinX, bounds.minX);
      worldMaxX = Math.max(worldMaxX, bounds.maxX);
      worldMinZ = Math.min(worldMinZ, bounds.minZ);
      worldMaxZ = Math.max(worldMaxZ, bounds.maxZ);
      worldFloorY = Math.min(worldFloorY, bounds.floorY);
      worldCeilY = Math.max(worldCeilY, bounds.ceilingY);

      if (!flip180) {
        cursorZ = s < 9 ? bounds.minZ - REGION_CONNECTOR_GAP_Z : bounds.minZ;
      } else {
        cursorZ = s < 9 ? bounds.maxZ + REGION_CONNECTOR_GAP_Z : bounds.maxZ;
      }
    }
  }

  // Step 2: Build sequential N-S & Wing-Turn connectors for 1 -> 2 -> ... -> 100
  for (let id = 1; id < TOTAL_LEVELS; id++) {
    const a = REGION_BY_ID.get(id)!;
    const b = REGION_BY_ID.get(id + 1)!;
    const rawA = getLevelById(id);
    const rawB = getLevelById(id + 1);
    const aExitPlat = findRegionExitPlatform(rawA, rawA.exit.position);
    const bSpawnPlat = findRegionEntrancePlatform(rawB, rawB.spawn);
    const aExitTop = aExitPlat ? aExitPlat.position[1] + aExitPlat.size[1] * 0.5 : a.exit.position[1];
    const bSpawnTop = bSpawnPlat ? bSpawnPlat.position[1] + bSpawnPlat.size[1] * 0.5 : b.spawn[1];

    const sameWing = a.wingIndex === b.wingIndex;
    const connId = `conn_${id}_${id + 1}`;
    const floorY = Math.min(a.bounds.floorY, b.bounds.floorY);
    const ceilY = Math.max(12.5, Math.min(a.bounds.ceilingY, b.bounds.ceilingY));

    if (sameWing) {
      // Linear N-S corridor along X = a.offsetX
      const cx = a.offsetX;
      const goingNorth = !a.flip180;
      const zMin = goingNorth ? b.bounds.maxZ : a.bounds.maxZ;
      const zMax = goingNorth ? a.bounds.minZ : b.bounds.minZ;
      const canalLen = Math.max(4, zMax - zMin);
      const midZ = (zMin + zMax) * 0.5;
      const hw = DOORWAY_HALF_WIDTH_NS;

      // Extend bridge cleanly from A exit platform edge to B spawn platform edge
      const aExitHalfD = (aExitPlat?.size[2] ?? 5.8) * 0.5;
      const bSpawnHalfD = (bSpawnPlat?.size[2] ?? 5.8) * 0.5;
      const aEdgeZ = goingNorth
        ? a.exit.position[2] - aExitHalfD + 0.4
        : a.exit.position[2] + aExitHalfD - 0.4;
      const bEdgeZ = goingNorth
        ? b.spawn[2] + bSpawnHalfD - 0.4
        : b.spawn[2] - bSpawnHalfD + 0.4;

      const platforms = makeBridgeSegmentPlatforms(
        `${connId}_span`,
        cx,
        aExitTop,
        aEdgeZ,
        cx,
        bSpawnTop,
        bEdgeZ,
        5.4,
        'tile'
      );
      const wallH = ceilY - floorY;
      const wallY = floorY + wallH * 0.5;
      const wallZSpan = canalLen + PERIMETER_WALL_THICK * 2;
      const walls: WallDef[] = [
        {
          position: [cx - hw - PERIMETER_WALL_THICK * 0.5, wallY, midZ],
          size: [PERIMETER_WALL_THICK, wallH, wallZSpan],
        },
        {
          position: [cx + hw + PERIMETER_WALL_THICK * 0.5, wallY, midZ],
          size: [PERIMETER_WALL_THICK, wallH, wallZSpan],
        },
      ];
      const lights: LevelDef['lights'] = [
        { position: [cx, ceilY - 0.6, zMin + canalLen * 0.25] },
        { position: [cx, ceilY - 0.6, zMin + canalLen * 0.75] },
      ];
      const floorBoxes: WorldConnectorFloorBox[] = [
        { minX: cx - hw, maxX: cx + hw, minZ: zMin, maxZ: zMax, floorY, waterY: 0, ceilingY: ceilY },
      ];
      const { bounds, grid } = buildConnectorGridForBoxes(floorBoxes, platforms, walls);
      const conn: WorldConnectorDef = {
        id: connId,
        kind: 'linear',
        regionA: id,
        regionB: id + 1,
        wingIndex: a.wingIndex,
        bounds,
        floorBoxes,
        platforms,
        walls,
        lights,
        checkpoints: [],
        grid,
      };
      CONNECTORS.push(conn);
      CONNECTOR_BY_ID.set(connId, conn);

      addDoorway({
        regionId: id,
        doorway: {
          side: goingNorth ? 'n' : 's',
          center: cx,
          halfWidth: hw,
          targetRegionId: id + 1,
          connectorId: connId,
        },
      });
      addDoorway({
        regionId: id + 1,
        doorway: {
          side: goingNorth ? 's' : 'n',
          center: cx,
          halfWidth: hw,
          targetRegionId: id,
          connectorId: connId,
        },
      });
    } else {
      // 90-degree Wing Turn U-Basin linking Wing w end -> Wing w+1 start
      const isNorthTurn = !a.flip180; // even wing exited North -> turn sits North of both bounds
      const hw = DOORWAY_HALF_WIDTH_NS;
      const ax = a.offsetX;
      const bx = b.offsetX;
      const junctionEdgeZ = isNorthTurn ? a.bounds.minZ : a.bounds.maxZ;
      const zMin = isNorthTurn ? junctionEdgeZ - WING_TURN_BASIN_DEPTH : junctionEdgeZ;
      const zMax = isNorthTurn ? junctionEdgeZ : junctionEdgeZ + WING_TURN_BASIN_DEPTH;
      const basinMidZ = (zMin + zMax) * 0.5;
      const basinMinX = Math.min(ax, bx) - hw;
      const basinMaxX = Math.max(ax, bx) + hw;
      const midX = (ax + bx) * 0.5;

      const aExitHalfD = (aExitPlat?.size[2] ?? 5.8) * 0.5;
      const bSpawnHalfD = (bSpawnPlat?.size[2] ?? 5.8) * 0.5;
      const aEdgeZ = isNorthTurn
        ? a.exit.position[2] - aExitHalfD + 0.4
        : a.exit.position[2] + aExitHalfD - 0.4;
      const bEdgeZ = isNorthTurn
        ? b.spawn[2] - bSpawnHalfD + 0.4
        : b.spawn[2] + bSpawnHalfD - 0.4;

      const restYTop = 0.92;
      const platforms: PlatformDef[] = [
        // Arm from Region A exit to basin bridge corner at (ax, basinMidZ)
        ...makeBridgeSegmentPlatforms(`${connId}_arm_a`, ax, aExitTop, aEdgeZ, ax, restYTop, basinMidZ, 5.4, 'metal'),
        // Grand East-West catwalk spanning across the turn canal
        ...makeBridgeSegmentPlatforms(`${connId}_cross`, ax, restYTop, basinMidZ, bx, restYTop, basinMidZ, 5.0, 'metal'),
        // Arm from basin corner (bx, basinMidZ) into Region B entrance deck
        ...makeBridgeSegmentPlatforms(`${connId}_arm_b`, bx, restYTop, basinMidZ, bx, bSpawnTop, bEdgeZ, 5.4, 'metal'),
        // Central resting island dock carrying the Wing Transition Checkpoint
        {
          id: `${connId}_dock`,
          position: [midX, restYTop - 0.45, basinMidZ],
          size: [11.0, 0.9, 10.0],
          kind: 'static',
          accent: 'tile',
        },
      ];

      const wallH = ceilY - floorY;
      const wallY = floorY + wallH * 0.5;
      const fullSpanX = basinMaxX - basinMinX + PERIMETER_WALL_THICK * 2;
      const innerGapStart = ax + hw;
      const innerGapEnd = bx - hw;
      const innerSpanX = Math.max(1, innerGapEnd - innerGapStart);

      const walls: WallDef[] = [
        // Outer long wall along the far side of turn basin
        {
          position: [
            midX,
            wallY,
            isNorthTurn ? zMin - PERIMETER_WALL_THICK * 0.5 : zMax + PERIMETER_WALL_THICK * 0.5,
          ],
          size: [fullSpanX, wallH, PERIMETER_WALL_THICK],
        },
        // Inner span wall sealing the gap between Region A doorway and Region B doorway
        {
          position: [
            (innerGapStart + innerGapEnd) * 0.5,
            wallY,
            isNorthTurn ? zMax + PERIMETER_WALL_THICK * 0.5 : zMin - PERIMETER_WALL_THICK * 0.5,
          ],
          size: [innerSpanX, wallH, PERIMETER_WALL_THICK],
        },
        // West cap wall
        {
          position: [basinMinX - PERIMETER_WALL_THICK * 0.5, wallY, basinMidZ],
          size: [PERIMETER_WALL_THICK, wallH, WING_TURN_BASIN_DEPTH + PERIMETER_WALL_THICK * 2],
        },
        // East cap wall
        {
          position: [basinMaxX + PERIMETER_WALL_THICK * 0.5, wallY, basinMidZ],
          size: [PERIMETER_WALL_THICK, wallH, WING_TURN_BASIN_DEPTH + PERIMETER_WALL_THICK * 2],
        },
      ];

      const lights: LevelDef['lights'] = [];
      for (let lx = ax; lx <= bx + 1; lx += 38) {
        lights.push({ position: [lx, ceilY - 0.6, basinMidZ] });
      }

      const cpTurn: WorldCheckpoint = {
        id: `cp_turn_${id}_${id + 1}`,
        regionId: id + 1,
        index: -1,
        x: midX,
        y: restYTop,
        z: basinMidZ,
        yaw: -Math.PI * 0.5,
        label: `Wing ${String(b.wingIndex + 1).padStart(2, '0')} Junction`,
      };
      WORLD_CHECKPOINTS.push(cpTurn);
      CHECKPOINT_BY_ID.set(cpTurn.id, cpTurn);

      const floorBoxes: WorldConnectorFloorBox[] = [
        { minX: basinMinX, maxX: basinMaxX, minZ: zMin, maxZ: zMax, floorY, waterY: 0, ceilingY: ceilY },
      ];
      const { bounds, grid } = buildConnectorGridForBoxes(floorBoxes, platforms, walls);
      const conn: WorldConnectorDef = {
        id: connId,
        kind: 'turn',
        regionA: id,
        regionB: id + 1,
        wingIndex: b.wingIndex,
        bounds,
        floorBoxes,
        platforms,
        walls,
        lights,
        checkpoints: [cpTurn],
        grid,
      };
      CONNECTORS.push(conn);
      CONNECTOR_BY_ID.set(connId, conn);

      worldMinZ = Math.min(worldMinZ, zMin);
      worldMaxZ = Math.max(worldMaxZ, zMax);

      const turnSide: CardinalSide = isNorthTurn ? 'n' : 's';
      addDoorway({
        regionId: id,
        doorway: { side: turnSide, center: ax, halfWidth: hw, targetRegionId: id + 1, connectorId: connId },
      });
      addDoorway({
        regionId: id + 1,
        doorway: { side: turnSide, center: bx, halfWidth: hw, targetRegionId: id, connectorId: connId },
      });
    }
  }

  // Step 3: Add Cross-Wing Express Bridges where adjacent Wings share overlapping Z space (true Open World network!)
  for (let w = 0; w < 9; w++) {
    const midA = REGION_BY_ID.get(w * 10 + 5)!; // middle chamber of Wing w
    const midACenterZ = (midA.bounds.minZ + midA.bounds.maxZ) * 0.5;
    let bestB: WorldRegionMeta | null = null;
    let bestOverlapCenter = 0;
    let bestScore = -Infinity;

    for (let s = 1; s <= 10; s++) {
      const cand = REGION_BY_ID.get((w + 1) * 10 + s)!;
      const oMinZ = Math.max(midA.bounds.minZ + 18, cand.bounds.minZ + 18);
      const oMaxZ = Math.min(midA.bounds.maxZ - 18, cand.bounds.maxZ - 18);
      if (oMaxZ - oMinZ >= 18) {
        const oc = (oMinZ + oMaxZ) * 0.5;
        const score = (oMaxZ - oMinZ) - Math.abs(oc - midACenterZ) * 0.25;
        if (score > bestScore) {
          bestScore = score;
          bestB = cand;
          bestOverlapCenter = oc;
        }
      }
    }

    if (bestB) {
      const connId = `conn_x_${midA.regionId}_${bestB.regionId}`;
      const hw = DOORWAY_HALF_WIDTH_EW;
      const xMin = midA.bounds.maxX;
      const xMax = bestB.bounds.minX;
      const canalSpanX = Math.max(6, xMax - xMin);
      const midX = (xMin + xMax) * 0.5;
      const floorY = Math.min(midA.bounds.floorY, bestB.bounds.floorY);
      const ceilY = Math.max(12.5, Math.min(midA.bounds.ceilingY, bestB.bounds.ceilingY));
      const wallH = ceilY - floorY;
      const wallY = floorY + wallH * 0.5;

      // Entry catwalk pads extending slightly into both chambers + stepped ramp to water level
      const platforms: PlatformDef[] = [
        ...makeBridgeSegmentPlatforms(`${connId}_span`, xMin - 4.5, 0.85, bestOverlapCenter, xMax + 4.5, 0.85, bestOverlapCenter, 4.6, 'metal'),
        {
          id: `${connId}_pad_w`,
          position: [xMin - 6.0, 0.22, bestOverlapCenter],
          size: [3.2, 0.65, 4.6],
          kind: 'bridge',
          accent: 'caution',
        },
        {
          id: `${connId}_pad_e`,
          position: [xMax + 6.0, 0.22, bestOverlapCenter],
          size: [3.2, 0.65, 4.6],
          kind: 'bridge',
          accent: 'caution',
        },
      ];

      const walls: WallDef[] = [
        {
          position: [midX, wallY, bestOverlapCenter - hw - PERIMETER_WALL_THICK * 0.5],
          size: [canalSpanX + PERIMETER_WALL_THICK * 2, wallH, PERIMETER_WALL_THICK],
        },
        {
          position: [midX, wallY, bestOverlapCenter + hw + PERIMETER_WALL_THICK * 0.5],
          size: [canalSpanX + PERIMETER_WALL_THICK * 2, wallH, PERIMETER_WALL_THICK],
        },
      ];

      const lights: LevelDef['lights'] = [];
      for (let lx = xMin + 14; lx <= xMax - 12; lx += 28) {
        lights.push({ position: [lx, ceilY - 0.6, bestOverlapCenter] });
      }

      const floorBoxes: WorldConnectorFloorBox[] = [
        {
          minX: xMin,
          maxX: xMax,
          minZ: bestOverlapCenter - hw,
          maxZ: bestOverlapCenter + hw,
          floorY,
          waterY: 0,
          ceilingY: ceilY,
        },
      ];
      const { bounds, grid } = buildConnectorGridForBoxes(floorBoxes, platforms, walls);
      const conn: WorldConnectorDef = {
        id: connId,
        kind: 'cross_wing',
        regionA: midA.regionId,
        regionB: bestB.regionId,
        wingIndex: midA.wingIndex,
        bounds,
        floorBoxes,
        platforms,
        walls,
        lights,
        checkpoints: [],
        grid,
      };
      CONNECTORS.push(conn);
      CONNECTOR_BY_ID.set(connId, conn);

      addDoorway({
        regionId: midA.regionId,
        doorway: { side: 'e', center: bestOverlapCenter, halfWidth: hw, targetRegionId: bestB.regionId, connectorId: connId },
      });
      addDoorway({
        regionId: bestB.regionId,
        doorway: { side: 'w', center: bestOverlapCenter, halfWidth: hw, targetRegionId: midA.regionId, connectorId: connId },
      });
    }
  }

  // Step 4: Finalize doorway + adjacency metadata on every region
  for (const meta of REGION_METAS) {
    const dw = doorwaysByRegion.get(meta.regionId) ?? [];
    meta.doorways = dw;
    meta.connectedRegionIds = Array.from(new Set(dw.map((d) => d.targetRegionId)));
    meta.connectorIds = Array.from(new Set(dw.map((d) => d.connectorId)));
  }

  OPEN_WORLD_BOUNDS = {
    minX: worldMinX - 16,
    maxX: worldMaxX + 16,
    minZ: worldMinZ - 24,
    maxZ: worldMaxZ + 24,
    floorY: worldFloorY,
    waterY: 0,
    ceilingY: worldCeilY,
  };
}

initOpenWorldCatalog();

export const OPEN_WORLD_SPAWN: { x: number; y: number; z: number; yaw: number; regionId: number } = (() => {
  const r1 = REGION_BY_ID.get(1)!;
  return {
    x: r1.spawn[0],
    y: r1.spawn[1],
    z: r1.spawn[2],
    yaw: r1.spawnYaw,
    regionId: 1,
  };
})();

function buildCutoutPerimeterWalls(
  bounds: LevelDef['bounds'],
  doorways: WorldDoorway[]
): { perimeterWalls: WallDef[]; overheadLintels: WallDef[] } {
  const perimeterWalls: WallDef[] = [];
  const overheadLintels: WallDef[] = [];
  const wallH = bounds.ceilingY - bounds.floorY;
  const wallCY = bounds.floorY + wallH * 0.5;
  const ht = PERIMETER_WALL_THICK * 0.5;

  const lintelH = Math.max(0.8, bounds.ceilingY - DOORWAY_CLEAR_HEIGHT);
  const lintelCY = DOORWAY_CLEAR_HEIGHT + lintelH * 0.5;

  const emitAxisSegments = (
    side: CardinalSide,
    spanMin: number,
    spanMax: number,
    fixedCoord: number
  ) => {
    const doors = doorways
      .filter((d) => d.side === side)
      .map((d) => ({ min: Math.max(spanMin, d.center - d.halfWidth), max: Math.min(spanMax, d.center + d.halfWidth) }))
      .filter((d) => d.max > d.min + 0.2)
      .sort((a, b) => a.min - b.min);

    let cursor = spanMin;
    for (const d of doors) {
      if (d.min > cursor + 0.1) {
        const len = d.min - cursor;
        const mid = (cursor + d.min) * 0.5;
        if (side === 'n' || side === 's') {
          perimeterWalls.push({
            position: [mid, wallCY, fixedCoord],
            size: [len + PERIMETER_WALL_THICK * 2, wallH, PERIMETER_WALL_THICK],
          });
        } else {
          perimeterWalls.push({
            position: [fixedCoord, wallCY, mid],
            size: [PERIMETER_WALL_THICK, wallH, len + PERIMETER_WALL_THICK * 2],
          });
        }
      }
      // Overhead header beam above doorway clearance
      const doorLen = d.max - d.min;
      const doorMid = (d.min + d.max) * 0.5;
      if (side === 'n' || side === 's') {
        overheadLintels.push({
          position: [doorMid, lintelCY, fixedCoord],
          size: [doorLen, lintelH, PERIMETER_WALL_THICK],
        });
      } else {
        overheadLintels.push({
          position: [fixedCoord, lintelCY, doorMid],
          size: [PERIMETER_WALL_THICK, lintelH, doorLen],
        });
      }
      cursor = Math.max(cursor, d.max);
    }

    if (cursor < spanMax - 0.1) {
      const len = spanMax - cursor;
      const mid = (cursor + spanMax) * 0.5;
      if (side === 'n' || side === 's') {
        perimeterWalls.push({
          position: [mid, wallCY, fixedCoord],
          size: [len + PERIMETER_WALL_THICK * 2, wallH, PERIMETER_WALL_THICK],
        });
      } else {
        perimeterWalls.push({
          position: [fixedCoord, wallCY, mid],
          size: [PERIMETER_WALL_THICK, wallH, len + PERIMETER_WALL_THICK * 2],
        });
      }
    }
  };

  emitAxisSegments('n', bounds.minX, bounds.maxX, bounds.minZ - ht);
  emitAxisSegments('s', bounds.minX, bounds.maxX, bounds.maxZ + ht);
  emitAxisSegments('w', bounds.minZ, bounds.maxZ, bounds.minX - ht);
  emitAxisSegments('e', bounds.minZ, bounds.maxZ, bounds.maxX + ht);

  return { perimeterWalls, overheadLintels };
}

function buildWorldRegionRuntimeDef(regionId: number): WorldRegionRuntimeDef {
  const meta = REGION_BY_ID.get(regionId) ?? REGION_BY_ID.get(1)!;
  const raw = getLevelById(meta.regionId);
  const { offsetX, offsetZ, flip180 } = meta;

  const platforms: PlatformDef[] = raw.platforms.map((p) => ({
    ...p,
    position: [
      txLocal(offsetX, flip180, p.position[0]),
      p.position[1],
      tzLocal(offsetZ, flip180, p.position[2]),
    ],
    size: [...p.size],
    moveOffset: p.moveOffset
      ? [
          flip180 ? -p.moveOffset[0] : p.moveOffset[0],
          p.moveOffset[1],
          flip180 ? -p.moveOffset[2] : p.moveOffset[2],
        ]
      : undefined,
    rotationPhase:
      p.rotationSpeed && flip180 ? (p.rotationPhase ?? 0) + Math.PI : p.rotationPhase,
  }));

  const interiorWalls: WallDef[] = raw.walls.map((w) => ({
    ...w,
    position: [
      txLocal(offsetX, flip180, w.position[0]),
      w.position[1],
      tzLocal(offsetZ, flip180, w.position[2]),
    ],
    size: [...w.size],
  }));

  const { perimeterWalls, overheadLintels } = buildCutoutPerimeterWalls(meta.bounds, meta.doorways);
  const allWalls = [...interiorWalls, ...perimeterWalls, ...overheadLintels];

  const checkpoints = meta.checkpoints.map((cp) => ({
    id: cp.id,
    position: [cp.x, cp.y, cp.z] as [number, number, number],
  }));
  const lights: LevelDef['lights'] = raw.lights.map((l) => ({
    ...l,
    position: [
      txLocal(offsetX, flip180, l.position[0]),
      l.position[1],
      tzLocal(offsetZ, flip180, l.position[2]),
    ],
  }));

  const rooms: LevelDef['rooms'] = raw.rooms.map((rm) => ({
    ...rm,
    center: [
      txLocal(offsetX, flip180, rm.center[0]),
      tzLocal(offsetZ, flip180, rm.center[1]),
    ],
    size: [...rm.size] as [number, number],
  }));

  const monsters: MonsterConfig[] = raw.monsters.map((m) => ({
    ...m,
    id: m.id.startsWith(`r${meta.regionId}_`) ? m.id : `r${meta.regionId}_${m.id}`,
    regionId: meta.regionId,
    waypoints: m.waypoints.map(([wx, wz]) => [
      txLocal(offsetX, flip180, wx),
      tzLocal(offsetZ, flip180, wz),
    ]),
  }));

  return {
    id: meta.regionId,
    code: raw.code,
    regionId: meta.regionId,
    name: meta.name,
    subtitle: `${meta.wingTitle} · ${meta.name}`,
    difficulty: meta.difficulty,
    timeLimit: raw.timeLimit,
    parTimes: [...raw.parTimes] as [number, number, number],
    fogColor: meta.fogColor,
    fogDensity: meta.fogDensity,
    ambientTint: meta.ambientTint,
    rooms,
    bounds: { ...meta.bounds },
    spawn: [...meta.spawn],
    spawnYaw: meta.spawnYaw,
    exit: {
      position: [...meta.exit.position],
      size: [...meta.exit.size],
    },
    platforms,
    walls: allWalls,
    perimeterWalls,
    overheadLintels,
    checkpoints,
    lights,
    monsters,
    wingIndex: meta.wingIndex,
    wingTitle: meta.wingTitle,
    wingAccent: meta.wingAccent,
    flip180: meta.flip180,
    doorways: meta.doorways,
    connectedRegionIds: meta.connectedRegionIds,
    connectorIds: meta.connectorIds,
    worldCheckpoints: meta.checkpoints,
  };
}

export interface RegionCollisionBundle {
  def: WorldRegionRuntimeDef;
  grid: LevelSpatialGrid;
}

const REGION_CACHE_LIMIT = 24;
const regionBundleCache = new Map<number, RegionCollisionBundle>();

export function getRegionCollisionBundle(regionId: number): RegionCollisionBundle {
  const safeId = Math.max(1, Math.min(OPEN_WORLD_REGION_COUNT, Math.round(regionId) || 1));
  const existing = regionBundleCache.get(safeId);
  if (existing) {
    // Refresh LRU order
    regionBundleCache.delete(safeId);
    regionBundleCache.set(safeId, existing);
    return existing;
  }
  const def = buildWorldRegionRuntimeDef(safeId);
  const grid = new LevelSpatialGrid(def, 12);
  const bundle: RegionCollisionBundle = { def, grid };
  regionBundleCache.set(safeId, bundle);
  if (regionBundleCache.size > REGION_CACHE_LIMIT) {
    const oldestKey = regionBundleCache.keys().next().value;
    if (oldestKey !== undefined) {
      regionBundleCache.delete(oldestKey);
    }
  }
  return bundle;
}

export function getWorldRegionDef(regionId: number): WorldRegionRuntimeDef {
  return getRegionCollisionBundle(regionId).def;
}

export function getWorldRegionMeta(regionId: number): WorldRegionMeta {
  const safeId = Math.max(1, Math.min(OPEN_WORLD_REGION_COUNT, Math.round(regionId) || 1));
  return REGION_BY_ID.get(safeId) ?? REGION_BY_ID.get(1)!;
}

export function getWorldRegionMetas(): readonly WorldRegionMeta[] {
  return REGION_METAS;
}

export function getAllWorldConnectors(): readonly WorldConnectorDef[] {
  return CONNECTORS;
}

export function getWorldConnectorDef(connectorId: string): WorldConnectorDef | null {
  return CONNECTOR_BY_ID.get(connectorId) ?? null;
}

export function getAllWorldCheckpoints(): readonly WorldCheckpoint[] {
  return WORLD_CHECKPOINTS;
}

export function getWorldCheckpointById(checkpointId: string | null | undefined): WorldCheckpoint | null {
  if (!checkpointId) return null;
  return CHECKPOINT_BY_ID.get(checkpointId) ?? null;
}

export function getWorldRegionAtPos(x: number, z: number): WorldRegionMeta {
  // Fast wing-column match first, then nearest fallback across connectors
  for (let i = 0; i < REGION_METAS.length; i++) {
    const m = REGION_METAS[i];
    if (x >= m.bounds.minX && x <= m.bounds.maxX && z >= m.bounds.minZ && z <= m.bounds.maxZ) {
      return m;
    }
  }
  // Check connectors and assign closest endpoint
  let best = REGION_METAS[0];
  let bestDist = Infinity;
  for (let i = 0; i < REGION_METAS.length; i++) {
    const m = REGION_METAS[i];
    const cx = x < m.bounds.minX ? m.bounds.minX : x > m.bounds.maxX ? m.bounds.maxX : x;
    const cz = z < m.bounds.minZ ? m.bounds.minZ : z > m.bounds.maxZ ? m.bounds.maxZ : z;
    const d = (x - cx) * (x - cx) + (z - cz) * (z - cz);
    if (d < bestDist) {
      bestDist = d;
      best = m;
    }
  }
  return best;
}

export function getNearbyWorldRegionIds(x: number, z: number, radius: number): number[] {
  const ids: number[] = [];
  const r = Math.max(20, radius);
  for (let i = 0; i < REGION_METAS.length; i++) {
    const m = REGION_METAS[i];
    const cx = x < m.bounds.minX ? m.bounds.minX : x > m.bounds.maxX ? m.bounds.maxX : x;
    const cz = z < m.bounds.minZ ? m.bounds.minZ : z > m.bounds.maxZ ? m.bounds.maxZ : z;
    if ((x - cx) * (x - cx) + (z - cz) * (z - cz) <= r * r) {
      ids.push(m.regionId);
    }
  }
  if (ids.length === 0) {
    ids.push(getWorldRegionAtPos(x, z).regionId);
  }
  return ids;
}

export function getConnectorIdsForRegions(regionIds: Iterable<number>): string[] {
  const seen = new Set<string>();
  for (const rid of regionIds) {
    const m = REGION_BY_ID.get(rid);
    if (!m) continue;
    for (let i = 0; i < m.connectorIds.length; i++) {
      seen.add(m.connectorIds[i]);
    }
  }
  return Array.from(seen);
}

export function findReachableWorldCheckpoint(
  x: number,
  y: number,
  z: number,
  maxHorizDist = 4.6,
  maxVertDist = 4.0
): WorldCheckpoint | null {
  let best: WorldCheckpoint | null = null;
  let bestDist = Infinity;
  for (let i = 0; i < WORLD_CHECKPOINTS.length; i++) {
    const cp = WORLD_CHECKPOINTS[i];
    const hd = Math.hypot(x - cp.x, z - cp.z);
    if (hd <= maxHorizDist && Math.abs(y - cp.y) <= maxVertDist && hd < bestDist) {
      bestDist = hd;
      best = cp;
    }
  }
  return best;
}

export function computeOpenWorldSpawnSlot(slotIndex: number, totalSlots = 1): {
  x: number;
  y: number;
  z: number;
  yaw: number;
  regionId: number;
} {
  const r1 = getWorldRegionMeta(1);
  if (totalSlots <= 1) {
    return {
      x: r1.spawn[0],
      y: r1.spawn[1],
      z: r1.spawn[2],
      yaw: r1.spawnYaw,
      regionId: 1,
    };
  }
  // Spread across Region 1 spawn deck cleanly
  const cols = totalSlots <= 4 ? totalSlots : Math.ceil(Math.sqrt(totalSlots * 1.5));
  const row = Math.floor(slotIndex / cols);
  const col = slotIndex % cols;
  const dx = (col - (cols - 1) * 0.5) * 1.1;
  const dz = (row - 0.5) * 1.1;
  return {
    x: Number((r1.spawn[0] + dx).toFixed(2)),
    y: r1.spawn[1],
    z: Number((r1.spawn[2] + dz).toFixed(2)),
    yaw: r1.spawnYaw,
    regionId: 1,
  };
}

/**
 * Queries merged collision obstacles (both nearby RegionCollisionBundles and intersecting Connectors)
 * at world coordinate (x, z) with radius `r`. Used by pushPhysics, Node server, and Cloudflare DO.
 */
const _tmpPlatIdx: number[] = [];
const _tmpWallIdx: number[] = [];

export function isOpenWorldCircleBlocked(
  x: number,
  z: number,
  r: number,
  waterY = 0,
  elapsedSec = 0
): boolean {
  const regionIds = getNearbyWorldRegionIds(x, z, r + 4);
  const connectorIds = getConnectorIdsForRegions(regionIds);

  let insideValidSpace = false;

  for (let ri = 0; ri < regionIds.length; ri++) {
    const bundle = getRegionCollisionBundle(regionIds[ri]);
    const b = bundle.def.bounds;
    if (x >= b.minX - 2 && x <= b.maxX + 2 && z >= b.minZ - 2 && z <= b.maxZ + 2) {
      insideValidSpace = true;
    }
    bundle.grid.queryRadius(x, z, r + 2, _tmpPlatIdx, _tmpWallIdx);

    for (let k = 0; k < _tmpWallIdx.length; k++) {
      const w = bundle.def.walls[_tmpWallIdx[k]];
      // Ignore overhead doorway lintels above water level
      if (w.position[1] - w.size[1] * 0.5 > waterY + 2.5) continue;
      const hx = w.size[0] * 0.5;
      const hz = w.size[2] * 0.5;
      const cx = Math.max(w.position[0] - hx, Math.min(x, w.position[0] + hx));
      const cz = Math.max(w.position[2] - hz, Math.min(z, w.position[2] + hz));
      const dx = x - cx;
      const dz = z - cz;
      if (dx * dx + dz * dz < r * r) return true;
    }

    for (let k = 0; k < _tmpPlatIdx.length; k++) {
      const p = bundle.def.platforms[_tmpPlatIdx[k]];
      if (p.kind === 'bridge') continue;
      const center = getAnimatedPlatformCenter(p, elapsedSec);
      const bottomY = center[1] - p.size[1] * 0.5;
      const topY = center[1] + p.size[1] * 0.5;
      if (bottomY >= waterY + 1.0 || topY < waterY - 1.4) continue;
      if (circleHitsPlatformXZ(x, z, r, p, center, elapsedSec)) return true;
    }
  }

  for (let ci = 0; ci < connectorIds.length; ci++) {
    const conn = CONNECTOR_BY_ID.get(connectorIds[ci]);
    if (!conn) continue;
    for (let fi = 0; fi < conn.floorBoxes.length; fi++) {
      const fb = conn.floorBoxes[fi];
      if (x >= fb.minX - 2 && x <= fb.maxX + 2 && z >= fb.minZ - 2 && z <= fb.maxZ + 2) {
        insideValidSpace = true;
      }
    }
    conn.grid.queryRadius(x, z, r + 2, _tmpPlatIdx, _tmpWallIdx);
    for (let k = 0; k < _tmpWallIdx.length; k++) {
      const w = conn.walls[_tmpWallIdx[k]];
      const hx = w.size[0] * 0.5;
      const hz = w.size[2] * 0.5;
      const cx = Math.max(w.position[0] - hx, Math.min(x, w.position[0] + hx));
      const cz = Math.max(w.position[2] - hz, Math.min(z, w.position[2] + hz));
      const dx = x - cx;
      const dz = z - cz;
      if (dx * dx + dz * dz < r * r) return true;
    }
  }

  return !insideValidSpace;
}

export function resolveOpenWorldCircleSolids(
  pos: { x: number; z: number },
  r: number,
  waterY = 0,
  elapsedSec = 0
): void {
  const regionIds = getNearbyWorldRegionIds(pos.x, pos.z, r + 4);
  const connectorIds = getConnectorIdsForRegions(regionIds);

  const pushCircle = (
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number
  ) => {
    const cx = Math.max(minX, Math.min(pos.x, maxX));
    const cz = Math.max(minZ, Math.min(pos.z, maxZ));
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) return;
    if (d2 > 1e-6) {
      const d = Math.sqrt(d2);
      const push = r - d;
      pos.x += (dx / d) * push;
      pos.z += (dz / d) * push;
    } else {
      const dLeft = Math.abs(pos.x - minX);
      const dRight = Math.abs(maxX - pos.x);
      const dBack = Math.abs(pos.z - minZ);
      const dFront = Math.abs(maxZ - pos.z);
      const m = Math.min(dLeft, dRight, dBack, dFront);
      if (m === dLeft) pos.x = minX - r;
      else if (m === dRight) pos.x = maxX + r;
      else if (m === dBack) pos.z = minZ - r;
      else pos.z = maxZ + r;
    }
  };

  for (let ri = 0; ri < regionIds.length; ri++) {
    const bundle = getRegionCollisionBundle(regionIds[ri]);
    bundle.grid.queryRadius(pos.x, pos.z, r + 2, _tmpPlatIdx, _tmpWallIdx);
    for (let k = 0; k < _tmpWallIdx.length; k++) {
      const w = bundle.def.walls[_tmpWallIdx[k]];
      if (w.position[1] - w.size[1] * 0.5 > waterY + 2.5) continue;
      const hx = w.size[0] * 0.5;
      const hz = w.size[2] * 0.5;
      pushCircle(w.position[0] - hx, w.position[0] + hx, w.position[2] - hz, w.position[2] + hz);
    }
    for (let k = 0; k < _tmpPlatIdx.length; k++) {
      const p = bundle.def.platforms[_tmpPlatIdx[k]];
      if (p.kind === 'bridge') continue;
      const center = getAnimatedPlatformCenter(p, elapsedSec);
      const bottomY = center[1] - p.size[1] * 0.5;
      const topY = center[1] + p.size[1] * 0.5;
      if (bottomY >= waterY + 1.0 || topY < waterY - 1.4) continue;
      if (p.rotationSpeed) continue; // unaligned rotating OBB handled safely via circle query
      const hx = p.size[0] * 0.5;
      const hz = p.size[2] * 0.5;
      pushCircle(center[0] - hx, center[0] + hx, center[2] - hz, center[2] + hz);
    }
  }

  for (let ci = 0; ci < connectorIds.length; ci++) {
    const conn = CONNECTOR_BY_ID.get(connectorIds[ci]);
    if (!conn) continue;
    conn.grid.queryRadius(pos.x, pos.z, r + 2, _tmpPlatIdx, _tmpWallIdx);
    for (let k = 0; k < _tmpWallIdx.length; k++) {
      const w = conn.walls[_tmpWallIdx[k]];
      const hx = w.size[0] * 0.5;
      const hz = w.size[2] * 0.5;
      pushCircle(w.position[0] - hx, w.position[0] + hx, w.position[2] - hz, w.position[2] + hz);
    }
  }
}

export function getAnimatedPlatformCenter(p: PlatformDef, elapsedSec: number): [number, number, number] {
  if (p.kind === 'moving' && p.moveOffset) {
    const s = Math.sin(elapsedSec * (p.moveSpeed ?? 1.2) + (p.movePhase ?? 0));
    const t = 0.5 + 0.5 * s;
    return [
      p.position[0] + p.moveOffset[0] * t,
      p.position[1] + p.moveOffset[1] * t,
      p.position[2] + p.moveOffset[2] * t,
    ];
  }
  return p.position;
}

export function circleHitsPlatformXZ(
  x: number,
  z: number,
  r: number,
  p: PlatformDef,
  center: [number, number, number],
  elapsedSec: number
): boolean {
  const hw = p.size[0] * 0.5;
  const hd = p.size[2] * 0.5;
  let lx = x - center[0];
  let lz = z - center[2];
  if (p.rotationSpeed) {
    const axis = p.rotationAxis ?? 'y';
    if (axis === 'y') {
      const yaw = (p.rotationPhase ?? 0) + elapsedSec * p.rotationSpeed;
      const c = Math.cos(-yaw);
      const s = Math.sin(-yaw);
      const rx = lx * c - lz * s;
      const rz = lx * s + lz * c;
      lx = rx;
      lz = rz;
    }
  }
  const cx = Math.max(-hw, Math.min(lx, hw));
  const cz = Math.max(-hd, Math.min(lz, hd));
  const dx = lx - cx;
  const dz = lz - cz;
  return dx * dx + dz * dz < r * r;
}

export function isPointStandingOnOpenWorldPlatform(
  x: number,
  y: number,
  z: number,
  elapsedSec = 0
): boolean {
  const regionIds = getNearbyWorldRegionIds(x, z, 6);
  const connectorIds = getConnectorIdsForRegions(regionIds);
  const r = 0.34;

  const checkPlats = (platforms: PlatformDef[], idxs: number[]) => {
    for (let i = 0; i < idxs.length; i++) {
      const p = platforms[idxs[i]];
      const center = getAnimatedPlatformCenter(p, elapsedSec);
      const topY = center[1] + p.size[1] * 0.5;
      if (y < topY - 0.65 || y > topY + 2.4) continue;
      if (circleHitsPlatformXZ(x, z, r, p, center, elapsedSec)) {
        return true;
      }
    }
    return false;
  };

  for (let ri = 0; ri < regionIds.length; ri++) {
    const bundle = getRegionCollisionBundle(regionIds[ri]);
    bundle.grid.queryRadius(x, z, 2, _tmpPlatIdx, null);
    if (checkPlats(bundle.def.platforms, _tmpPlatIdx)) return true;
  }

  for (let ci = 0; ci < connectorIds.length; ci++) {
    const conn = CONNECTOR_BY_ID.get(connectorIds[ci]);
    if (!conn) continue;
    conn.grid.queryRadius(x, z, 2, _tmpPlatIdx, null);
    if (checkPlats(conn.platforms, _tmpPlatIdx)) return true;
  }

  return false;
}

function clampOW(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function shortestAngleDiffOW(a: number, b: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function worldToRotatedPlatformLocalOW(
  dx: number,
  dy: number,
  dz: number,
  plat: PlatformDef,
  elapsedSec: number
): [number, number, number] {
  const axis = plat.rotationAxis || 'y';
  const spd = plat.rotationSpeed || 0;
  const phase = plat.rotationPhase ?? 0;
  const ang = phase + elapsedSec * spd;

  let rx = 0;
  let ry = 0;
  let rz = 0;
  if (axis === 'y') ry = ang;
  else if (axis === 'x') rx = ang;
  else if (axis === 'z') rz = ang;
  else if (axis === 'xy') {
    rx = phase * 0.7 + elapsedSec * spd * 0.55;
    ry = ang;
  } else if (axis === 'zy') {
    ry = ang;
    rz = phase * 0.7 + elapsedSec * spd * 0.55;
  }

  const cy = Math.cos(ry);
  const sy = Math.sin(ry);
  const x1 = dx * cy - dz * sy;
  const y1 = dy;
  const z1 = dx * sy + dz * cy;

  const cx = Math.cos(rx);
  const sx = Math.sin(rx);
  const x2 = x1;
  const y2 = y1 * cx + z1 * sx;
  const z2 = -y1 * sx + z1 * cx;

  const cz = Math.cos(rz);
  const sz = Math.sin(rz);
  const lx = x2 * cz + y2 * sz;
  const ly = -x2 * sz + y2 * cz;
  const lz = z2;
  return [lx, ly, lz];
}

export function isOpenWorldPlayerOnPlatform(
  x: number,
  y: number,
  z: number,
  elapsedSec = 0,
  clientInWater = false,
  waterY = 0
): boolean {
  if (y < waterY - 0.12) return false;
  const margin = clientInWater ? 0.04 : 0.36;
  const minBelowTop = clientInWater ? 0.06 : 0.16;
  const regionIds = getNearbyWorldRegionIds(x, z, 8);
  const connectorIds = getConnectorIdsForRegions(regionIds);

  const checkPlats = (platforms: PlatformDef[], idxs: number[]): boolean => {
    for (let i = 0; i < idxs.length; i++) {
      const plat = platforms[idxs[i]];
      if (!plat) continue;
      const [pw, ph, pd] = plat.size;
      let px = plat.position[0];
      let py = plat.position[1];
      let pz = plat.position[2];
      if (plat.kind === 'moving' && plat.moveOffset) {
        const speed = plat.moveSpeed ?? 1.0;
        const phase = plat.movePhase ?? 0;
        const factor = 0.5 - 0.5 * Math.cos(elapsedSec * speed + phase);
        px += plat.moveOffset[0] * factor;
        py += plat.moveOffset[1] * factor;
        pz += plat.moveOffset[2] * factor;
      }

      if (plat.rotationSpeed) {
        const hw = pw * 0.5;
        const hh = ph * 0.5;
        const hd = pd * 0.5;
        const axis = plat.rotationAxis || 'y';
        const rotMargin = clientInWater ? 0.08 : 0.48;
        if (axis === 'y') {
          const topY = py + hh;
          if (y >= topY - minBelowTop && y <= topY + 0.5 && y >= waterY - 0.06) {
            const [lx, , lz] = worldToRotatedPlatformLocalOW(x - px, 0, z - pz, plat, elapsedSec);
            if (Math.abs(lx) <= hw + rotMargin && Math.abs(lz) <= hd + rotMargin) {
              return true;
            }
          }
        } else if (y >= waterY - 0.06) {
          const [lx, ly, lz] = worldToRotatedPlatformLocalOW(x - px, y - py, z - pz, plat, elapsedSec);
          const ox = Math.max(0, Math.abs(lx) - hw);
          const oy = Math.max(0, Math.abs(ly) - hh);
          const oz = Math.max(0, Math.abs(lz) - hd);
          if (ox * ox + oy * oy + oz * oz <= rotMargin * rotMargin) {
            return true;
          }
        }
        continue;
      }

      const topY = py + ph * 0.5;
      if (y >= topY - minBelowTop && y <= topY + 0.45 && y >= waterY - 0.06) {
        if (plat.kind === 'moving' && plat.moveOffset) {
          const minX = Math.min(plat.position[0], plat.position[0] + plat.moveOffset[0]) - pw * 0.5 - margin;
          const maxX = Math.max(plat.position[0], plat.position[0] + plat.moveOffset[0]) + pw * 0.5 + margin;
          const minZ = Math.min(plat.position[2], plat.position[2] + plat.moveOffset[2]) - pd * 0.5 - margin;
          const maxZ = Math.max(plat.position[2], plat.position[2] + plat.moveOffset[2]) + pd * 0.5 + margin;
          if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) return true;
        } else if (Math.abs(x - px) <= pw * 0.5 + margin && Math.abs(z - pz) <= pd * 0.5 + margin) {
          return true;
        }
      }
    }
    return false;
  };

  for (let ri = 0; ri < regionIds.length; ri++) {
    const bundle = getRegionCollisionBundle(regionIds[ri]);
    bundle.grid.queryRadius(x, z, 2.5, _tmpPlatIdx, null);
    if (checkPlats(bundle.def.platforms, _tmpPlatIdx)) return true;
  }

  for (let ci = 0; ci < connectorIds.length; ci++) {
    const conn = CONNECTOR_BY_ID.get(connectorIds[ci]);
    if (!conn) continue;
    conn.grid.queryRadius(x, z, 2.5, _tmpPlatIdx, null);
    if (checkPlats(conn.platforms, _tmpPlatIdx)) return true;
  }

  return false;
}

export function isOpenWorldPlayerInWater(
  x: number,
  y: number,
  z: number,
  clientInWater: boolean,
  elapsedSec = 0,
  waterY = 0
): boolean {
  if (y < waterY - 0.12) return true;
  if (isOpenWorldPlayerOnPlatform(x, y, z, elapsedSec, clientInWater, waterY)) return false;
  if (clientInWater && y <= waterY + 0.06) return true;
  return y < waterY - 0.04;
}

export function findOpenWorldPlatformUnderPlayer(
  x: number,
  y: number,
  z: number,
  elapsedSec = 0,
  waterY = 0
): PlatformDef | null {
  if (y < waterY - 0.12) return null;
  const margin = 0.42;
  const minBelowTop = 0.18;
  const regionIds = getNearbyWorldRegionIds(x, z, 8);
  const connectorIds = getConnectorIdsForRegions(regionIds);
  let bestPlat: PlatformDef | null = null;
  let bestTop = -Infinity;

  const scanPlats = (platforms: PlatformDef[], idxs: number[]) => {
    for (let i = 0; i < idxs.length; i++) {
      const plat = platforms[idxs[i]];
      if (!plat || plat.kind === 'disappearing') continue;
      const [pw, ph, pd] = plat.size;
      let px = plat.position[0];
      let py = plat.position[1];
      let pz = plat.position[2];
      if (plat.kind === 'moving' && plat.moveOffset) {
        const speed = plat.moveSpeed ?? 1.0;
        const phase = plat.movePhase ?? 0;
        const factor = 0.5 - 0.5 * Math.cos(elapsedSec * speed + phase);
        px += plat.moveOffset[0] * factor;
        py += plat.moveOffset[1] * factor;
        pz += plat.moveOffset[2] * factor;
      }
      const topY = py + ph * 0.5;
      if (y < topY - minBelowTop || y > topY + 0.55 || y < waterY - 0.06) continue;
      if (plat.rotationSpeed) {
        const [lx, , lz] = worldToRotatedPlatformLocalOW(x - px, 0, z - pz, plat, elapsedSec);
        if (Math.abs(lx) <= pw * 0.5 + margin && Math.abs(lz) <= pd * 0.5 + margin && topY > bestTop) {
          bestTop = topY;
          bestPlat = plat;
        }
      } else if (Math.abs(x - px) <= pw * 0.5 + margin && Math.abs(z - pz) <= pd * 0.5 + margin && topY > bestTop) {
        bestTop = topY;
        bestPlat = plat;
      }
    }
  };

  for (let ri = 0; ri < regionIds.length; ri++) {
    const bundle = getRegionCollisionBundle(regionIds[ri]);
    bundle.grid.queryRadius(x, z, 2.5, _tmpPlatIdx, null);
    scanPlats(bundle.def.platforms, _tmpPlatIdx);
  }

  for (let ci = 0; ci < connectorIds.length; ci++) {
    const conn = CONNECTOR_BY_ID.get(connectorIds[ci]);
    if (!conn) continue;
    conn.grid.queryRadius(x, z, 2.5, _tmpPlatIdx, null);
    scanPlats(conn.platforms, _tmpPlatIdx);
  }

  return bestPlat;
}

export function isOpenWorldCircleBlockedRange(
  x: number,
  z: number,
  radius: number,
  botY: number,
  topY: number,
  elapsedSec = 0,
  checkWalls = true,
  checkPlats = true,
  waterY = 0
): boolean {
  const bAll = OPEN_WORLD_BOUNDS;
  if (checkWalls && (x - radius < bAll.minX || x + radius > bAll.maxX || z - radius < bAll.minZ || z + radius > bAll.maxZ)) {
    return true;
  }

  const rSq = radius * radius;
  const regionIds = getNearbyWorldRegionIds(x, z, radius + 6);
  const connectorIds = getConnectorIdsForRegions(regionIds);
  let insidePlayable = false;

  const checkWallsArr = (walls: WallDef[], idxs: number[]): boolean => {
    for (let i = 0; i < idxs.length; i++) {
      const w = walls[idxs[i]];
      if (w.position[1] - w.size[1] * 0.5 > waterY + 2.5) continue;
      const [wx, wy, wz] = w.position;
      const [ww, wh, wd] = w.size;
      if (topY <= wy - wh * 0.5 + 0.05 || botY >= wy + wh * 0.5 - 0.05) continue;
      const cx = clampOW(x, wx - ww * 0.5, wx + ww * 0.5);
      const cz = clampOW(z, wz - wd * 0.5, wz + wd * 0.5);
      const dx = x - cx;
      const dz = z - cz;
      if (dx * dx + dz * dz < rSq) return true;
    }
    return false;
  };

  const checkPlatsArr = (platforms: PlatformDef[], idxs: number[]): boolean => {
    for (let i = 0; i < idxs.length; i++) {
      const plat = platforms[idxs[i]];
      if (!plat || plat.kind === 'disappearing') continue;
      let [px, py, pz] = plat.position;
      if (plat.kind === 'moving' && plat.moveOffset) {
        const speed = plat.moveSpeed ?? 1.0;
        const phase = plat.movePhase ?? 0;
        const factor = 0.5 - 0.5 * Math.cos(elapsedSec * speed + phase);
        px += plat.moveOffset[0] * factor;
        py += plat.moveOffset[1] * factor;
        pz += plat.moveOffset[2] * factor;
      }
      const [pw, ph, pd] = plat.size;
      const hw = pw * 0.5;
      const hh = ph * 0.5;
      const hd = pd * 0.5;

      if (!plat.rotationSpeed) {
        if (topY <= py - hh + 0.05 || botY >= py + hh - 0.05) continue;
        const cx = clampOW(x, px - hw, px + hw);
        const cz = clampOW(z, pz - hd, pz + hd);
        const dx = x - cx;
        const dz = z - cz;
        if (dx * dx + dz * dz < rSq) return true;
      } else if ((plat.rotationAxis || 'y') === 'y') {
        if (topY <= py - hh + 0.05 || botY >= py + hh - 0.05) continue;
        const [lx, , lz] = worldToRotatedPlatformLocalOW(x - px, 0, z - pz, plat, elapsedSec);
        const dlx = lx - clampOW(lx, -hw, hw);
        const dlz = lz - clampOW(lz, -hd, hd);
        if (dlx * dlx + dlz * dlz < rSq) return true;
      } else {
        const spanY = Math.max(0.1, topY - botY);
        const padY = Math.min(radius * 0.5, spanY * 0.25);
        const yMin = botY + padY;
        const yMax = topY - padY;
        for (let sIdx = 0; sIdx < 4; sIdx++) {
          const sy = yMin + ((yMax - yMin) * sIdx) / 3;
          const [lx, ly, lz] = worldToRotatedPlatformLocalOW(x - px, sy - py, z - pz, plat, elapsedSec);
          const dlx = lx - clampOW(lx, -hw, hw);
          const dly = ly - clampOW(ly, -hh, hh);
          const dlz = lz - clampOW(lz, -hd, hd);
          if (dlx * dlx + dly * dly + dlz * dlz < rSq) return true;
        }
      }
    }
    return false;
  };

  for (let ri = 0; ri < regionIds.length; ri++) {
    const bundle = getRegionCollisionBundle(regionIds[ri]);
    const b = bundle.def.bounds;
    if (x >= b.minX - 1.2 && x <= b.maxX + 1.2 && z >= b.minZ - 1.2 && z <= b.maxZ + 1.2) {
      insidePlayable = true;
    }
    bundle.grid.queryRadius(x, z, radius + 0.5, _tmpPlatIdx, _tmpWallIdx);
    if (checkWalls && checkWallsArr(bundle.def.walls, _tmpWallIdx)) return true;
    if (checkPlats && checkPlatsArr(bundle.def.platforms, _tmpPlatIdx)) return true;
  }

  for (let ci = 0; ci < connectorIds.length; ci++) {
    const conn = CONNECTOR_BY_ID.get(connectorIds[ci]);
    if (!conn) continue;
    for (let fi = 0; fi < conn.floorBoxes.length; fi++) {
      const fb = conn.floorBoxes[fi];
      if (x >= fb.minX - 1.2 && x <= fb.maxX + 1.2 && z >= fb.minZ - 1.2 && z <= fb.maxZ + 1.2) {
        insidePlayable = true;
      }
    }
    conn.grid.queryRadius(x, z, radius + 0.5, _tmpPlatIdx, _tmpWallIdx);
    if (checkWalls && checkWallsArr(conn.walls, _tmpWallIdx)) return true;
    if (checkPlats && checkPlatsArr(conn.platforms, _tmpPlatIdx)) return true;
  }

  if (checkWalls && !insidePlayable) return true;
  return false;
}

export function resolveOpenWorldCircleSolids3D(
  m: { x: number; z: number; velX: number; velZ: number },
  radius: number,
  botY: number,
  topY: number,
  elapsedSec: number,
  waterY = 0
): void {
  const bAll = OPEN_WORLD_BOUNDS;
  const rSq = radius * radius;
  const regionIds = getNearbyWorldRegionIds(m.x, m.z, radius + 6);
  const connectorIds = getConnectorIdsForRegions(regionIds);

  const resolvePlatsAndWalls = (platforms: PlatformDef[], walls: WallDef[]) => {
    for (let i = 0; i < _tmpPlatIdx.length; i++) {
      const plat = platforms[_tmpPlatIdx[i]];
      if (!plat || plat.kind === 'disappearing') continue;
      let [px, py, pz] = plat.position;
      if (plat.kind === 'moving' && plat.moveOffset) {
        const speed = plat.moveSpeed ?? 1.0;
        const phase = plat.movePhase ?? 0;
        const factor = 0.5 - 0.5 * Math.cos(elapsedSec * speed + phase);
        px += plat.moveOffset[0] * factor;
        py += plat.moveOffset[1] * factor;
        pz += plat.moveOffset[2] * factor;
      }
      const [pw, ph, pd] = plat.size;
      const hw = pw * 0.5;
      const hh = ph * 0.5;
      const hd = pd * 0.5;
      const axis = plat.rotationAxis || 'y';

      if (!plat.rotationSpeed) {
        if (topY <= py - hh + 0.05 || botY >= py + hh - 0.05) continue;
        const lx = m.x - px;
        const lz = m.z - pz;
        const dlx = lx - clampOW(lx, -hw, hw);
        const dlz = lz - clampOW(lz, -hd, hd);
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
          m.x += wx;
          m.z += wz;
          const wLen = Math.hypot(wx, wz);
          if (wLen > 1e-6) {
            const nx = wx / wLen;
            const nz = wz / wLen;
            const vn = m.velX * nx + m.velZ * nz;
            if (vn < 0) {
              m.velX -= vn * nx;
              m.velZ -= vn * nz;
            }
          }
        }
      } else if (axis === 'y') {
        if (topY <= py - hh + 0.05 || botY >= py + hh - 0.05) continue;
        const ang = (plat.rotationPhase ?? 0) + elapsedSec * plat.rotationSpeed;
        const [lx, , lz] = worldToRotatedPlatformLocalOW(m.x - px, 0, m.z - pz, plat, elapsedSec);
        const dlx = lx - clampOW(lx, -hw, hw);
        const dlz = lz - clampOW(lz, -hd, hd);
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
            const penX = hw + radius - Math.abs(lx);
            const penZ = hd + radius - Math.abs(lz);
            if (penX < penZ) lwx = lx >= 0 ? penX : -penX;
            else lwz = lz >= 0 ? penZ : -penZ;
          }
          const cy = Math.cos(ang);
          const sy = Math.sin(ang);
          const wx = lwx * cy + lwz * sy;
          const wz = -lwx * sy + lwz * cy;
          m.x += wx;
          m.z += wz;
          const wLen = Math.hypot(wx, wz);
          if (wLen > 1e-6) {
            const nx = wx / wLen;
            const nz = wz / wLen;
            const vn = m.velX * nx + m.velZ * nz;
            if (vn < 0) {
              m.velX -= vn * nx;
              m.velZ -= vn * nz;
            }
          }
        }
      }
    }

    for (let i = 0; i < _tmpWallIdx.length; i++) {
      const w = walls[_tmpWallIdx[i]];
      if (w.position[1] - w.size[1] * 0.5 > waterY + 2.5) continue;
      const [ww, wh, wd] = w.size;
      const [wxPos, wyPos, wzPos] = w.position;
      if (topY <= wyPos - wh * 0.5 + 0.05 || botY >= wyPos + wh * 0.5 - 0.05) continue;
      const cx = clampOW(m.x, wxPos - ww * 0.5, wxPos + ww * 0.5);
      const cz = clampOW(m.z, wzPos - wd * 0.5, wzPos + wd * 0.5);
      const dx = m.x - cx;
      const dz = m.z - cz;
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
          const dLeft = m.x - (wxPos - ww * 0.5 - radius);
          const dRight = wxPos + ww * 0.5 + radius - m.x;
          const dFront = m.z - (wzPos - wd * 0.5 - radius);
          const dBack = wzPos + wd * 0.5 + radius - m.z;
          const minPen = Math.min(dLeft, dRight, dFront, dBack);
          if (minPen === dLeft) wx = -dLeft;
          else if (minPen === dRight) wx = dRight;
          else if (minPen === dFront) wz = -dFront;
          else wz = dBack;
        }
        m.x += wx;
        m.z += wz;
        const wLen = Math.hypot(wx, wz);
        if (wLen > 1e-6) {
          const nx = wx / wLen;
          const nz = wz / wLen;
          const vn = m.velX * nx + m.velZ * nz;
          if (vn < 0) {
            m.velX -= vn * nx;
            m.velZ -= vn * nz;
          }
        }
      }
    }
  };

  for (let iter = 0; iter < 2; iter++) {
    for (let ri = 0; ri < regionIds.length; ri++) {
      const bundle = getRegionCollisionBundle(regionIds[ri]);
      bundle.grid.queryRadius(m.x, m.z, radius + 0.5, _tmpPlatIdx, _tmpWallIdx);
      resolvePlatsAndWalls(bundle.def.platforms, bundle.def.walls);
    }
    for (let ci = 0; ci < connectorIds.length; ci++) {
      const conn = CONNECTOR_BY_ID.get(connectorIds[ci]);
      if (!conn) continue;
      conn.grid.queryRadius(m.x, m.z, radius + 0.5, _tmpPlatIdx, _tmpWallIdx);
      resolvePlatsAndWalls(conn.platforms, conn.walls);
    }
    m.x = clampOW(m.x, bAll.minX + radius + 0.15, bAll.maxX - radius - 0.15);
    m.z = clampOW(m.z, bAll.minZ + radius + 0.15, bAll.maxZ - radius - 0.15);
  }
}

export function findLowestNearbyOpenWorldPlatformBottom(
  x: number,
  z: number,
  queryRadius: number,
  waterY: number,
  floorY: number,
  elapsedSec: number
): number {
  let lowest = waterY - 0.35;
  const regionIds = getNearbyWorldRegionIds(x, z, queryRadius + 4);
  const connectorIds = getConnectorIdsForRegions(regionIds);
  const scan = (platforms: PlatformDef[]) => {
    for (let pi = 0; pi < _tmpPlatIdx.length; pi++) {
      const plat = platforms[_tmpPlatIdx[pi]];
      if (!plat || plat.kind === 'disappearing') continue;
      let py = plat.position[1];
      if (plat.kind === 'moving' && plat.moveOffset) {
        const factor = 0.5 - 0.5 * Math.cos(elapsedSec * (plat.moveSpeed ?? 1.0) + (plat.movePhase ?? 0));
        py += plat.moveOffset[1] * factor;
      }
      const platBot = py - plat.size[1] * 0.5;
      if (platBot <= waterY + 0.6 && platBot > floorY + 0.8 && platBot < lowest) {
        lowest = platBot;
      }
    }
  };
  for (let ri = 0; ri < regionIds.length; ri++) {
    const bundle = getRegionCollisionBundle(regionIds[ri]);
    bundle.grid.queryRadius(x, z, queryRadius, _tmpPlatIdx, null);
    scan(bundle.def.platforms);
  }
  for (let ci = 0; ci < connectorIds.length; ci++) {
    const conn = CONNECTOR_BY_ID.get(connectorIds[ci]);
    if (!conn) continue;
    conn.grid.queryRadius(x, z, queryRadius, _tmpPlatIdx, null);
    scan(conn.platforms);
  }
  return lowest;
}

export function computeOpenWorldPlatformEdgeSpot(
  m: { x: number; z: number; scale: number },
  plat: PlatformDef,
  playerX: number,
  playerZ: number,
  monsterRadius: number,
  botY: number,
  topY: number,
  elapsedSec: number,
  waterY = 0
): { x: number; z: number } {
  const [pw, , pd] = plat.size;
  let px = plat.position[0];
  let pz = plat.position[2];
  if (plat.kind === 'moving' && plat.moveOffset) {
    const factor = 0.5 - 0.5 * Math.cos(elapsedSec * (plat.moveSpeed ?? 1.0) + (plat.movePhase ?? 0));
    px += plat.moveOffset[0] * factor;
    pz += plat.moveOffset[2] * factor;
  }
  const hw = pw * 0.5;
  const hd = pd * 0.5;
  const clearance = monsterRadius + 0.62 * m.scale;
  const axis = plat.rotationAxis || 'y';
  const isRotY = Boolean(plat.rotationSpeed && axis === 'y');
  const ang = isRotY ? (plat.rotationPhase ?? 0) + elapsedSec * (plat.rotationSpeed || 0) : 0;
  const cosA = Math.cos(ang);
  const sinA = Math.sin(ang);

  let mlx = m.x - px;
  let mlz = m.z - pz;
  let plx = playerX - px;
  let plz = playerZ - pz;
  if (isRotY) {
    const [rlxM, , rlzM] = worldToRotatedPlatformLocalOW(mlx, 0, mlz, plat, elapsedSec);
    mlx = rlxM;
    mlz = rlzM;
    const [rlxP, , rlzP] = worldToRotatedPlatformLocalOW(plx, 0, plz, plat, elapsedSec);
    plx = rlxP;
    plz = rlzP;
  }
  plx = clampOW(plx, -hw * 0.82, hw * 0.82);
  plz = clampOW(plz, -hd * 0.82, hd * 0.82);

  const candsX = [
    plx,
    plx,
    -hw - clearance,
    hw + clearance,
    0,
    0,
    -hw - clearance,
    hw + clearance,
    mlx >= 0 ? hw + clearance : -hw - clearance,
  ];
  const candsZ = [
    -hd - clearance,
    hd + clearance,
    plz,
    plz,
    -hd - clearance,
    hd + clearance,
    0,
    0,
    mlz >= 0 ? hd + clearance : -hd - clearance,
  ];

  let bestScore = Infinity;
  let bestWx = m.x;
  let bestWz = m.z;
  let found = false;
  for (let c = 0; c < 9; c++) {
    const lx = candsX[c];
    const lz = candsZ[c];
    const wx = px + (isRotY ? lx * cosA + lz * sinA : lx);
    const wz = pz + (isRotY ? -lx * sinA + lz * cosA : lz);
    if (isOpenWorldCircleBlockedRange(wx, wz, monsterRadius * 0.92, botY, topY, elapsedSec, true, true, waterY)) {
      continue;
    }
    const dMon = Math.hypot(wx - m.x, wz - m.z);
    const dPly = Math.hypot(wx - playerX, wz - playerZ);
    const score = dMon * 0.55 + dPly;
    if (score < bestScore) {
      bestScore = score;
      bestWx = wx;
      bestWz = wz;
      found = true;
    }
  }
  if (!found) {
    const dx = m.x - px;
    const dz = m.z - pz;
    const len = Math.hypot(dx, dz) || 1;
    const fallbackDist = Math.max(hw, hd) + clearance;
    bestWx = clampOW(
      px + (dx / len) * fallbackDist,
      OPEN_WORLD_BOUNDS.minX + monsterRadius + 0.5,
      OPEN_WORLD_BOUNDS.maxX - monsterRadius - 0.5
    );
    bestWz = clampOW(
      pz + (dz / len) * fallbackDist,
      OPEN_WORLD_BOUNDS.minZ + monsterRadius + 0.5,
      OPEN_WORLD_BOUNDS.maxZ - monsterRadius - 0.5
    );
  }
  return { x: bestWx, z: bestWz };
}

export function pickOpenWorldIntimidationYaw(
  m: { x: number; z: number; yaw: number; scale: number },
  targetX: number,
  targetZ: number,
  monsterRadius: number,
  botY: number,
  topY: number,
  elapsedSec: number,
  waterY = 0
): number {
  const toPlayerYaw = Math.atan2(targetX - m.x, targetZ - m.z);
  const candA = toPlayerYaw + 0.7;
  const candB = toPlayerYaw - 0.7;
  const checkTailClear = (yaw: number): boolean => {
    const bx = -Math.sin(yaw);
    const bz = -Math.cos(yaw);
    return (
      !isOpenWorldCircleBlockedRange(
        m.x + bx * 4.0 * m.scale,
        m.z + bz * 4.0 * m.scale,
        monsterRadius * 0.75,
        botY,
        topY,
        elapsedSec,
        true,
        true,
        waterY
      ) &&
      !isOpenWorldCircleBlockedRange(
        m.x + bx * 8.0 * m.scale,
        m.z + bz * 8.0 * m.scale,
        monsterRadius * 0.7,
        botY,
        topY,
        elapsedSec,
        true,
        true,
        waterY
      )
    );
  };
  const clearA = checkTailClear(candA);
  const clearB = checkTailClear(candB);
  if (clearA && !clearB) return candA;
  if (clearB && !clearA) return candB;
  return Math.abs(shortestAngleDiffOW(m.yaw, candA)) <= Math.abs(shortestAngleDiffOW(m.yaw, candB))
    ? candA
    : candB;
}

export function pickOpenWorldRetreatTarget(
  m: { x: number; z: number; scale: number },
  awayFromX: number,
  awayFromZ: number,
  monsterRadius: number,
  botY: number,
  topY: number,
  elapsedSec: number,
  waterY = 0
): { x: number; z: number; yaw: number } {
  const awayYaw = Math.atan2(m.x - awayFromX, m.z - awayFromZ);
  const offsets = [0, 0.45, -0.45, 0.9, -0.9, 1.35, -1.35];
  const dists = [16, 12, 9, 6];
  let bestYaw = awayYaw;
  let bestClear = -1;
  for (let k = 0; k < offsets.length; k++) {
    const ang = awayYaw + offsets[k];
    const sx = Math.sin(ang);
    const sz = Math.cos(ang);
    let clearDist = 0;
    for (let dIdx = 0; dIdx < dists.length; dIdx++) {
      const dist = dists[dIdx];
      if (
        !isOpenWorldCircleBlockedRange(
          m.x + sx * dist,
          m.z + sz * dist,
          monsterRadius * 0.95,
          botY,
          topY,
          elapsedSec,
          true,
          true,
          waterY
        )
      ) {
        clearDist = dist;
      } else {
        break;
      }
    }
    if (clearDist > bestClear) {
      bestClear = clearDist;
      bestYaw = ang;
      if (clearDist >= 16) break;
    }
  }
  const targetDist = Math.max(10, bestClear > 0 ? bestClear : 14);
  return {
    x: clampOW(
      m.x + Math.sin(bestYaw) * targetDist,
      OPEN_WORLD_BOUNDS.minX + monsterRadius + 0.5,
      OPEN_WORLD_BOUNDS.maxX - monsterRadius - 0.5
    ),
    z: clampOW(
      m.z + Math.cos(bestYaw) * targetDist,
      OPEN_WORLD_BOUNDS.minZ + monsterRadius + 0.5,
      OPEN_WORLD_BOUNDS.maxZ - monsterRadius - 0.5
    ),
    yaw: bestYaw,
  };
}

