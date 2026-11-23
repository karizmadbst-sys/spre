import type { LevelDef, PlatformDef, WallDef } from './types';

/**
 * Zero-GC 2D XZ spatial hash grid for static platforms and inner walls.
 * Dynamic platforms (moving, rotating, disappearing) live in `dynamicPlatIndices`
 * and are always returned so time-varying transforms remain 100% exact.
 * Framework-agnostic: used by Three.js client engine, Node multiplayer server, and Cloudflare Worker DO.
 */
export class LevelSpatialGrid {
  readonly cellSize: number;
  private readonly minX: number;
  private readonly minZ: number;
  private readonly cols: number;
  private readonly rows: number;
  private readonly platBuckets: Int32Array[];
  private readonly wallBuckets: Int32Array[];
  readonly dynamicPlatIndices: Int32Array;
  private readonly platStamp: Uint32Array;
  private readonly wallStamp: Uint32Array;
  private stampCounter = 1;

  constructor(def: Pick<LevelDef, 'bounds' | 'platforms' | 'walls'>, cellSize = 12) {
    this.cellSize = cellSize;
    this.minX = def.bounds.minX - cellSize;
    this.minZ = def.bounds.minZ - cellSize;
    const maxX = def.bounds.maxX + cellSize;
    const maxZ = def.bounds.maxZ + cellSize;
    this.cols = Math.max(1, Math.ceil((maxX - this.minX) / cellSize));
    this.rows = Math.max(1, Math.ceil((maxZ - this.minZ) / cellSize));
    const totalCells = this.cols * this.rows;

    const tmpPlatBuckets: number[][] = Array.from({ length: totalCells }, () => []);
    const tmpWallBuckets: number[][] = Array.from({ length: totalCells }, () => []);
    const dynList: number[] = [];

    for (let i = 0; i < def.platforms.length; i++) {
      const p: PlatformDef = def.platforms[i];
      const hw = p.size[0] * 0.5;
      const hh = p.size[1] * 0.5;
      const hd = p.size[2] * 0.5;
      let rx: number;
      let rz: number;
      if (p.rotationSpeed) {
        const isTilt = Boolean(p.rotationAxis && p.rotationAxis !== 'y');
        const sweepR = (isTilt ? Math.hypot(hw, hh, hd) : Math.hypot(hw, hd)) + 0.05;
        rx = sweepR;
        rz = sweepR;
      } else {
        rx = hw + 0.05;
        rz = hd + 0.05;
      }

      let minPX = p.position[0] - rx;
      let maxPX = p.position[0] + rx;
      let minPZ = p.position[2] - rz;
      let maxPZ = p.position[2] + rz;
      if (p.kind === 'moving' && p.moveOffset) {
        minPX = Math.min(p.position[0], p.position[0] + p.moveOffset[0]) - rx;
        maxPX = Math.max(p.position[0], p.position[0] + p.moveOffset[0]) + rx;
        minPZ = Math.min(p.position[2], p.position[2] + p.moveOffset[2]) - rz;
        maxPZ = Math.max(p.position[2], p.position[2] + p.moveOffset[2]) + rz;
      }

      const gx0 = this.clampCol(minPX);
      const gx1 = this.clampCol(maxPX);
      const gz0 = this.clampRow(minPZ);
      const gz1 = this.clampRow(maxPZ);
      for (let gz = gz0; gz <= gz1; gz++) {
        const rowOff = gz * this.cols;
        for (let gx = gx0; gx <= gx1; gx++) {
          tmpPlatBuckets[rowOff + gx].push(i);
        }
      }
    }

    for (let i = 0; i < def.walls.length; i++) {
      const w: WallDef = def.walls[i];
      const hw = w.size[0] * 0.5;
      const hd = w.size[2] * 0.5;
      const gx0 = this.clampCol(w.position[0] - hw);
      const gx1 = this.clampCol(w.position[0] + hw);
      const gz0 = this.clampRow(w.position[2] - hd);
      const gz1 = this.clampRow(w.position[2] + hd);
      for (let gz = gz0; gz <= gz1; gz++) {
        const rowOff = gz * this.cols;
        for (let gx = gx0; gx <= gx1; gx++) {
          tmpWallBuckets[rowOff + gx].push(i);
        }
      }
    }

    this.platBuckets = tmpPlatBuckets.map((b) => Int32Array.from(b));
    this.wallBuckets = tmpWallBuckets.map((b) => Int32Array.from(b));
    this.dynamicPlatIndices = Int32Array.from(dynList);
    this.platStamp = new Uint32Array(def.platforms.length);
    this.wallStamp = new Uint32Array(def.walls.length);
  }

  private clampCol(x: number): number {
    const gx = Math.floor((x - this.minX) / this.cellSize);
    return gx < 0 ? 0 : gx >= this.cols ? this.cols - 1 : gx;
  }

  private clampRow(z: number): number {
    const gz = Math.floor((z - this.minZ) / this.cellSize);
    return gz < 0 ? 0 : gz >= this.rows ? this.rows - 1 : gz;
  }

  private nextStamp(): number {
    this.stampCounter++;
    if (this.stampCounter >= 0xfffffffe) {
      this.platStamp.fill(0);
      this.wallStamp.fill(0);
      this.stampCounter = 1;
    }
    return this.stampCounter;
  }

  queryBox(
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number,
    outPlats: number[] | null,
    outWalls: number[] | null
  ): void {
    const stamp = this.nextStamp();
    const gx0 = this.clampCol(minX);
    const gx1 = this.clampCol(maxX);
    const gz0 = this.clampRow(minZ);
    const gz1 = this.clampRow(maxZ);

    if (outPlats) {
      outPlats.length = 0;
      const dyn = this.dynamicPlatIndices;
      for (let i = 0; i < dyn.length; i++) {
        const idx = dyn[i];
        this.platStamp[idx] = stamp;
        outPlats.push(idx);
      }
      for (let gz = gz0; gz <= gz1; gz++) {
        const rowOff = gz * this.cols;
        for (let gx = gx0; gx <= gx1; gx++) {
          const bucket = this.platBuckets[rowOff + gx];
          for (let k = 0; k < bucket.length; k++) {
            const idx = bucket[k];
            if (this.platStamp[idx] !== stamp) {
              this.platStamp[idx] = stamp;
              outPlats.push(idx);
            }
          }
        }
      }
    }

    if (outWalls) {
      outWalls.length = 0;
      for (let gz = gz0; gz <= gz1; gz++) {
        const rowOff = gz * this.cols;
        for (let gx = gx0; gx <= gx1; gx++) {
          const bucket = this.wallBuckets[rowOff + gx];
          for (let k = 0; k < bucket.length; k++) {
            const idx = bucket[k];
            if (this.wallStamp[idx] !== stamp) {
              this.wallStamp[idx] = stamp;
              outWalls.push(idx);
            }
          }
        }
      }
    }
  }

  queryRadius(
    cx: number,
    cz: number,
    radius: number,
    outPlats: number[] | null,
    outWalls: number[] | null
  ): void {
    this.queryBox(cx - radius, cx + radius, cz - radius, cz + radius, outPlats, outWalls);
  }
}
