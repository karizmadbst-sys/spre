import type { LevelDef, LevelSummary } from './types.ts';
import {
  TOTAL_LEVELS,
  SECTOR_WINGS,
  type SectorWing,
  generateLevelCatalog,
  getLevelById,
  getLevelSummary,
  isValidLevelId,
} from './levelGenerator.ts';

export {
  TOTAL_LEVELS,
  SECTOR_WINGS,
  type SectorWing,
  getLevelById,
  getLevelSummary,
  isValidLevelId,
};

export const LEVEL_CATALOG: LevelSummary[] = generateLevelCatalog();

const backingLevels = new Array<LevelDef>(TOTAL_LEVELS);

export const LEVELS: LevelDef[] = new Proxy(backingLevels, {
  get(target, prop, receiver) {
    if (typeof prop === 'string') {
      const idx = Number(prop);
      if (Number.isInteger(idx) && idx >= 0 && idx < TOTAL_LEVELS && prop === String(idx)) {
        return getLevelById(idx + 1);
      }
    }
    if (prop === 'find') {
      return (predicate: (value: LevelDef, index: number, obj: LevelDef[]) => unknown) => {
        for (let i = 0; i < TOTAL_LEVELS; i++) {
          const item = getLevelById(i + 1);
          if (predicate(item, i, receiver)) return item;
        }
        return undefined;
      };
    }
    if (prop === 'some') {
      return (predicate: (value: LevelDef, index: number, obj: LevelDef[]) => unknown) => {
        for (let i = 0; i < TOTAL_LEVELS; i++) {
          if (predicate(getLevelById(i + 1), i, receiver)) return true;
        }
        return false;
      };
    }
    if (prop === Symbol.iterator) {
      return function* () {
        for (let i = 0; i < TOTAL_LEVELS; i++) {
          yield getLevelById(i + 1);
        }
      };
    }
    return Reflect.get(target, prop, receiver);
  },
});
