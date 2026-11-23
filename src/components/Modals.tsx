import React, { useMemo, useState } from 'react';
import {
  ChevronRight,
  Compass,
  Grid,
  Lock,
  Play,
  RotateCcw,
  Settings,
  Sliders,
  Star,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { getLevelSummary, LEVEL_CATALOG, SECTOR_WINGS, TOTAL_LEVELS } from '../game/levels';
import {
  ActiveQualityTier,
  CharacterId,
  GameSettings,
  LevelSummary,
  SaveData,
  TouchControlsMode,
} from '../game/types';
import { CharacterSelector } from './CharacterSelector';
import serpentisIconUrl from '../assets/serpentis-icon.png';

// Preload & pin the official SERPENTIS emblem in browser memory so switching
// screens or WebGL compositing can never evict or drop the icon bitmap.
const MAIN_MENU_BG_URL = '/assets/aistudio/Blood_Moon_Sea_Serpent_c74c70fc.png';
const PINNED_ICON_SOURCES = [serpentisIconUrl, '/pwa-192x192.png'] as const;
const PINNED_ICON_CACHE: HTMLImageElement[] = [];
if (typeof window !== 'undefined' && typeof Image !== 'undefined' && PINNED_ICON_CACHE.length === 0) {
  const img = new Image();
  img.decoding = 'sync';
  img.src = serpentisIconUrl;
  PINNED_ICON_CACHE.push(img);

  const bgImg = new Image();
  bgImg.decoding = 'sync';
  bgImg.src = MAIN_MENU_BG_URL;
  PINNED_ICON_CACHE.push(bgImg);
}

const SerpentisTitleLockup: React.FC = React.memo(() => {
  const [srcIdx, setSrcIdx] = useState(0);
  const useSvgFallback = srcIdx >= PINNED_ICON_SOURCES.length;

  return (
    <div
      className="flex items-center gap-3 sm:gap-3.5 select-none"
      aria-label="SERPENTIS"
    >
      <div
        className="relative w-11 h-11 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-md overflow-hidden border-[1.5px] border-[#52e0b6]/55 bg-[#071519] shadow-[0_0_16px_rgba(82,224,182,0.18)] shrink-0"
        style={{ transform: 'translateZ(0)', backfaceVisibility: 'hidden' }}
      >
        {!useSvgFallback ? (
          <img
            src={PINNED_ICON_SOURCES[srcIdx]}
            alt="SERPENTIS icon"
            width={56}
            height={56}
            loading="eager"
            decoding="sync"
            draggable={false}
            onError={() => setSrcIdx((prev) => prev + 1)}
            className="block w-full h-full object-cover"
            style={{ transform: 'translateZ(0)' }}
          />
        ) : (
          <svg
            viewBox="0 0 64 64"
            className="block w-full h-full"
            aria-hidden="true"
          >
            <rect width="64" height="64" fill="#07191e" />
            <path
              d="M16 46 C18 28, 30 16, 46 18 C39 24, 34 31, 44 40 C36 46, 25 48, 16 46 Z"
              fill="#52e0b6"
              fillOpacity="0.88"
            />
            <circle cx="38" cy="24" r="3.2" fill="#ff3b30" />
          </svg>
        )}
      </div>
      <div className="flex flex-col leading-none min-w-0">
        <span
          className="text-[26px] sm:text-[32px] md:text-[38px] font-extrabold text-[#e9f2f4] tracking-[0.14em]"
          style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
        >
          SERPENTIS
        </span>
        <span className="mt-1 text-[9px] sm:text-[10.5px] md:text-[11.5px] font-mono text-[#7fa1a8] tracking-[0.28em] uppercase">
          POOLROOMS HORROR SURVIVAL
        </span>
      </div>
    </div>
  );
});

const WING_LEVELS: LevelSummary[][] = SECTOR_WINGS.map((w) =>
  LEVEL_CATALOG.filter((l) => l.id >= w.startId && l.id <= w.endId)
);

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(1).padStart(4, '0');
  return `${m}:${s}`;
}

export function computeStars(level: Pick<LevelSummary, 'parTimes'>, elapsed: number): number {
  if (elapsed <= level.parTimes[0]) return 3;
  if (elapsed <= level.parTimes[1]) return 2;
  return 1;
}

export function isLevelUnlocked(levelId: number, saveData: SaveData): boolean {
  if (levelId <= 1) return true;
  return Boolean(saveData[levelId]?.completed || saveData[levelId - 1]?.completed);
}

/* ============================================================================
 * MAIN MENU
 * ==========================================================================*/
interface MainMenuProps {
  continueLevelId: number;
  characterId: CharacterId;
  onCharacterChange: (next: CharacterId) => void;
  onPlay: (levelId: number) => void;
  onPlayOpenWorld: () => void;
  onOpenCoop: () => void;
  pendingCoopInviteCount?: number;
  onOpenLevels: () => void;
  onOpenSettings: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = React.memo(({
  continueLevelId,
  characterId,
  onCharacterChange,
  onPlay,
  onPlayOpenWorld,
  onOpenCoop,
  pendingCoopInviteCount = 0,
  onOpenLevels,
  onOpenSettings,
}) => {
  const targetLevel = getLevelSummary(continueLevelId);

  return (
    <>
      <div
        aria-hidden="true"
        className="fixed inset-0 z-10 pointer-events-none select-none overflow-hidden bg-[#07090b]"
      >
        <img
          src={MAIN_MENU_BG_URL}
          alt=""
          loading="eager"
          decoding="sync"
          draggable={false}
          className="block w-full h-full object-cover object-center"
        />
      </div>
      <div
        className="fixed inset-0 z-20 flex flex-col justify-between py-2.5 px-4 sm:py-3.5 sm:px-6 md:py-5 md:px-8 overflow-y-auto pointer-events-none bg-gradient-to-r from-[#070b0d]/72 via-[#0a1013]/38 to-[#070b0d]/30"
        style={{
          paddingTop: 'max(0.625rem, env(safe-area-inset-top))',
          paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))',
          paddingLeft: 'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(1rem, env(safe-area-inset-right))',
        }}
      >
      {/* Top subtle classification tag */}
      <div className="text-[10px] sm:text-[11px] font-mono tracking-[0.22em] text-[#7f9aa1] uppercase shrink-0">
        SUBSURFACE NATATORIUM · FACILITY 09
      </div>

      {/* Horizontal Landscape Split Hero: Title & Actions (left) + Side-by-Side Full-Body Character Cards (right) */}
      <div className="w-full max-w-5xl mx-auto my-auto py-1.5 sm:py-2 grid grid-cols-12 gap-3 sm:gap-5 md:gap-8 items-center pointer-events-auto">
        <div className="col-span-7 flex flex-col gap-2.5 sm:gap-3.5">
          <div className="flex flex-col gap-1.5 sm:gap-2">
            {/* Title Lockup with Official SERPENTIS Icon */}
            <SerpentisTitleLockup />

            <p className="text-[11px] sm:text-xs md:text-sm text-[#a7bec4] leading-snug max-w-sm">
              Cross 100 flooded subterranean pool halls or roam the continuous 100-region
              Open World — something vast is watching from beneath the surface.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onPlay(targetLevel.id)}
              className="min-h-[36px] sm:min-h-[40px] px-4 sm:px-5 py-2 rounded-lg bg-[#52e0b6] hover:bg-[#6ef0c8] text-[#071113] font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2 whitespace-nowrap transition-colors shadow-lg cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {targetLevel.id > 1
                ? `Enter Sector ${targetLevel.id}`
                : 'Enter The Pool'}
            </button>

            <button
              type="button"
              onClick={onPlayOpenWorld}
              className="relative min-h-[36px] sm:min-h-[40px] px-3.5 sm:px-4 py-2 rounded-lg bg-[#112826] hover:bg-[#173633] border border-[#3d9c7e] text-[#8ef5d5] font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Open World</span>
            </button>

            <button
              type="button"
              onClick={onOpenCoop}
              className="relative min-h-[36px] sm:min-h-[40px] px-3.5 sm:px-4 py-2 rounded-lg bg-[#112028] hover:bg-[#18303b] border border-[#3e7d94] text-[#9be4f7] font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Co-Op Open World</span>
              {pendingCoopInviteCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded bg-[#52e0b6] text-[#071113] font-mono text-[10px] font-bold tabular-nums">
                  {pendingCoopInviteCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={onOpenLevels}
              className="min-h-[36px] sm:min-h-[40px] px-3.5 sm:px-4 py-2 rounded-lg bg-[#111b1e]/90 hover:bg-[#19282c] border border-[#455a60] text-[#dce9ec] font-semibold text-xs tracking-wider uppercase flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Grid className="w-3.5 h-3.5" />
              Sectors (1–100)
            </button>

            <button
              type="button"
              onClick={onOpenSettings}
              className="min-h-[36px] sm:min-h-[40px] px-3.5 sm:px-4 py-2 rounded-lg bg-[#111b1e]/90 hover:bg-[#19282c] border border-[#455a60] text-[#dce9ec] font-semibold text-xs tracking-wider uppercase flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              Settings
            </button>
          </div>
        </div>

        {/* Compact side-by-side full-body character cards sized cleanly for horizontal mobile & desktop */}
        <div className="col-span-5 flex justify-end">
          <div className="w-full max-w-[196px] sm:max-w-[236px] md:max-w-[290px] lg:max-w-[340px]">
            <CharacterSelector
              selectedId={characterId}
              onSelect={onCharacterChange}
              size="hero"
            />
          </div>
        </div>
      </div>

      {/* Single flat control-hint line */}
      <div className="text-[10px] sm:text-[11px] font-mono tracking-wider text-[#849da3] shrink-0 truncate">
        WASD Move · Space Jump · Shift Run · Mouse Look · Esc Pause · Touch Joystick Supported
      </div>
      </div>
    </>
  );
});

/* ============================================================================
 * LEVEL SELECT MODAL
 * ==========================================================================*/
interface LevelSelectModalProps {
  saveData: SaveData;
  onSelect: (levelId: number) => void;
  onClose: () => void;
}

export const LevelSelectModal: React.FC<LevelSelectModalProps> = React.memo(({
  saveData,
  onSelect,
  onClose,
}) => {
  const diffColors: Record<LevelSummary['difficulty'], string> = {
    Low: 'text-[#6ce0b8] border-[#6ce0b8]/40 bg-[#122e27]',
    Moderate: 'text-[#e8c668] border-[#e8c668]/40 bg-[#2b2612]',
    High: 'text-[#eb9054] border-[#eb9054]/40 bg-[#2e1d12]',
    Severe: 'text-[#ef6c6c] border-[#ef6c6c]/40 bg-[#301414]',
    Extreme: 'text-[#ff7096] border-[#ff7096]/40 bg-[#33111c]',
  };

  const { totalCleared, totalStars, frontierId, clearedPerWing } = useMemo(() => {
    let cleared = 0;
    let stars = 0;
    let frontier = 1;
    let frontierFound = false;
    const perWing = new Array<number>(SECTOR_WINGS.length).fill(0);
    for (const lvl of LEVEL_CATALOG) {
      const rec = saveData[lvl.id];
      if (rec?.completed) {
        cleared++;
        stars += rec.stars || 0;
        const wIdx = Math.min(SECTOR_WINGS.length - 1, Math.floor((lvl.id - 1) / 10));
        perWing[wIdx]++;
        if (!frontierFound) {
          frontier = lvl.id < TOTAL_LEVELS ? lvl.id + 1 : lvl.id;
        }
      } else if (!frontierFound && isLevelUnlocked(lvl.id, saveData)) {
        frontier = lvl.id;
        frontierFound = true;
      }
    }
    return { totalCleared: cleared, totalStars: stars, frontierId: frontier, clearedPerWing: perWing };
  }, [saveData]);

  const [activeWing, setActiveWing] = useState<number>(() =>
    Math.min(SECTOR_WINGS.length - 1, Math.floor((frontierId - 1) / 10))
  );

  const currentWing = SECTOR_WINGS[activeWing] || SECTOR_WINGS[0];
  const wingLevels = WING_LEVELS[currentWing.index] || WING_LEVELS[0];

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-2.5 sm:p-3.5 bg-[#060a0c]/88"
      style={{
        paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
      }}
    >
      <div className="w-full max-w-3xl max-h-[88dvh] flex flex-col rounded-xl bg-[#0e1518] border border-[#314247] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-3.5 sm:px-4 py-2.5 border-b border-[#243236] shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold tracking-wider uppercase text-[#e6f1f3] truncate">
              Select Sector · 100 Subsurface Chambers
            </h2>
            <p className="text-[10px] sm:text-[11px] font-mono text-[#7c969c] truncate">
              {totalCleared} / 100 CLEARED · {totalStars} / 300 STARS · CLEAR EACH SECTOR TO UNLOCK NEXT
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onSelect(frontierId)}
              className="hidden sm:inline-flex px-3 py-1 rounded-md bg-[#52e0b6] hover:bg-[#6ef0c8] text-[#071113] font-bold text-[11px] uppercase tracking-wider cursor-pointer"
            >
              Play Sector {String(frontierId).padStart(2, '0')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md text-[#8fa7ad] hover:text-white hover:bg-[#1a262a] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 10 Facility Wing Selector Tabs */}
        <div className="px-3 py-1.5 border-b border-[#202d31] bg-[#0a1012] flex gap-1.5 overflow-x-auto shrink-0">
          {SECTOR_WINGS.map((w) => {
            const clearedInWing = clearedPerWing[w.index] || 0;
            const wingUnlocked = isLevelUnlocked(w.startId, saveData);
            const isActive = activeWing === w.index;
            return (
              <button
                key={w.index}
                type="button"
                onClick={() => setActiveWing(w.index)}
                className={`shrink-0 px-2.5 py-1 rounded-md border text-left transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#15282c] border-[#52e0b6] text-[#e8faf5]'
                    : 'bg-[#10181b] border-[#26353a] text-[#8ba4aa] hover:bg-[#162125]'
                }`}
              >
                <div className="flex items-center gap-1 text-[9px] font-mono uppercase">
                  <span>
                    {String(w.startId).padStart(2, '0')}–{String(w.endId).padStart(2, '0')}
                  </span>
                  {!wingUnlocked && <Lock className="w-2.5 h-2.5 text-[#6b7f85]" />}
                </div>
                <div className="text-[11px] font-bold whitespace-nowrap">
                  Wing {w.index + 1} · {clearedInWing}/10
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Wing Banner */}
        <div className="px-3.5 sm:px-4 py-1.5 bg-[#0c1315] border-b border-[#1d282c] flex flex-wrap items-center justify-between gap-1.5 shrink-0">
          <div className="flex items-baseline gap-2 min-w-0">
            <div className="text-[11px] font-mono uppercase tracking-wider shrink-0" style={{ color: currentWing.accentHex }}>
              WING {String(currentWing.index + 1).padStart(2, '0')} · {currentWing.name}
            </div>
            <div className="text-[11px] text-[#8ba5ab] truncate hidden sm:block">{currentWing.subtitle}</div>
          </div>
          <span className="text-[10px] font-mono text-[#739096]">
            SECTORS {currentWing.startId}–{currentWing.endId}
          </span>
        </div>

        {/* 10 Compact Sector Cards for Selected Wing */}
        <div className="p-2.5 sm:p-3 overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-2">
          {wingLevels.map((lvl) => {
            const rec = saveData[lvl.id];
            const stars = rec?.stars || 0;
            const unlocked = isLevelUnlocked(lvl.id, saveData);
            return (
              <button
                key={lvl.id}
                type="button"
                disabled={!unlocked}
                onClick={() => unlocked && onSelect(lvl.id)}
                className={`text-left p-2.5 rounded-lg border transition-colors flex flex-col gap-1 group ${
                  unlocked
                    ? 'bg-[#131d20] hover:bg-[#1a282c] border-[#2a393e] hover:border-[#52e0b6]/70 cursor-pointer'
                    : 'bg-[#0c1214] border-[#1d272a] opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[10px] font-mono text-[#759aa3] flex items-center gap-1">
                    {!unlocked && <Lock className="w-2.5 h-2.5 text-[#82979d]" />}
                    {lvl.code}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase border ${diffColors[lvl.difficulty]}`}
                  >
                    {lvl.difficulty}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-1.5">
                  <h3
                    className={`text-xs sm:text-sm font-bold truncate transition-colors ${
                      unlocked
                        ? 'text-[#e6f1f3] group-hover:text-[#6ef0c8]'
                        : 'text-[#8ba0a6]'
                    }`}
                  >
                    {lvl.name}
                  </h3>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {[1, 2, 3].map((s) => (
                      <Star
                        key={s}
                        className={`w-3 h-3 ${
                          s <= stars
                            ? 'text-[#f0c75e] fill-[#f0c75e]'
                            : 'text-[#314146]'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <p className="text-[11px] text-[#90a8ae] line-clamp-1">{lvl.subtitle}</p>

                <div className="flex items-center justify-between pt-1 border-t border-[#222f33] text-[10px] font-mono text-[#789298]">
                  <span>{lvl.timeLimit}s</span>
                  <span className="truncate ml-2">
                    {!unlocked
                      ? `LOCKED`
                      : rec?.bestTime != null
                        ? `BEST ${formatElapsed(rec.bestTime)}`
                        : 'OPEN'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});

/* ============================================================================
 * SETTINGS MODAL
 * ==========================================================================*/
interface SettingsModalProps {
  settings: GameSettings;
  activeQuality?: ActiveQualityTier;
  characterId: CharacterId;
  onCharacterChange: (next: CharacterId) => void;
  showCustomizeControls?: boolean;
  onOpenCustomizeControls?: () => void;
  onChange: (next: GameSettings) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = React.memo(({
  settings,
  activeQuality,
  characterId,
  onCharacterChange,
  showCustomizeControls = false,
  onOpenCustomizeControls,
  onChange,
  onClose,
}) => {
  const update = <K extends keyof GameSettings>(key: K, val: GameSettings[K]) => {
    onChange({ ...settings, [key]: val });
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-2.5 sm:p-3.5 bg-[#060a0c]/88"
      style={{
        paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
      }}
    >
      <div className="w-full max-w-xl max-h-[88dvh] flex flex-col rounded-xl bg-[#0e1518] border border-[#314247] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#243236] shrink-0">
          <h2 className="text-sm sm:text-base font-bold tracking-wider uppercase text-[#e6f1f3]">
            Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-[#8fa7ad] hover:text-white hover:bg-[#1a262a] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5 flex-1 min-h-0 overflow-y-auto">
          {/* Left Column: Audio */}
          <div className="flex flex-col gap-3">
            {/* Audio */}
            <div className="rounded-lg bg-[#111b1f] border border-[#223136] p-2.5 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono tracking-wider text-[#88a4ab] uppercase">
                  Audio
                </span>
                <button
                  type="button"
                  onClick={() => update('muted', !settings.muted)}
                  className="px-2 py-0.5 rounded bg-[#152024] border border-[#34464c] text-[10px] font-mono text-[#d4e5e8] flex items-center gap-1 cursor-pointer"
                >
                  {settings.muted ? <VolumeX className="w-3 h-3 text-[#e0746a]" /> : <Volume2 className="w-3 h-3" />}
                  {settings.muted ? 'MUTED' : 'ACTIVE'}
                </button>
              </div>

              <label className="flex flex-col gap-1 text-[11px] text-[#b5c8cd]">
                <div className="flex justify-between font-mono">
                  <span>Master Volume</span>
                  <span>{Math.round(settings.masterVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.masterVolume}
                  onChange={(e) => update('masterVolume', parseFloat(e.target.value))}
                  className="horror-slider w-full"
                />
              </label>

              <label className="flex flex-col gap-1 text-[11px] text-[#b5c8cd]">
                <div className="flex justify-between font-mono">
                  <span>Music &amp; Ambience</span>
                  <span>{Math.round(settings.musicVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.musicVolume}
                  onChange={(e) => update('musicVolume', parseFloat(e.target.value))}
                  className="horror-slider w-full"
                />
              </label>

              <label className="flex flex-col gap-1 text-[11px] text-[#b5c8cd]">
                <div className="flex justify-between font-mono">
                  <span>Sound Effects</span>
                  <span>{Math.round(settings.sfxVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.sfxVolume}
                  onChange={(e) => update('sfxVolume', parseFloat(e.target.value))}
                  className="horror-slider w-full"
                />
              </label>
            </div>
          </div>

          {/* Right Column: Controls + Graphics + Character */}
          <div className="flex flex-col gap-3">
            {/* Controls */}
            <div className="rounded-lg bg-[#111b1f] border border-[#223136] p-2.5 flex flex-col gap-2">
              <span className="text-[11px] font-mono tracking-wider text-[#88a4ab] uppercase">
                Camera &amp; Touch
              </span>

              <label className="flex flex-col gap-1 text-[11px] text-[#b5c8cd]">
                <div className="flex justify-between font-mono">
                  <span>Camera Rotation Sensitivity</span>
                  <span>{settings.mouseSensitivity.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min={0.3}
                  max={2.5}
                  step={0.05}
                  value={settings.mouseSensitivity}
                  onChange={(e) => update('mouseSensitivity', parseFloat(e.target.value))}
                  className="horror-slider w-full"
                />
              </label>

              <div className="flex items-center justify-between text-[11px] text-[#b5c8cd]">
                <span className="font-mono">Invert Look Y</span>
                <button
                  type="button"
                  onClick={() => update('invertY', !settings.invertY)}
                  className={`px-2 py-0.5 rounded border font-mono text-[10px] cursor-pointer ${
                    settings.invertY
                      ? 'bg-[#52e0b6]/20 border-[#52e0b6] text-[#8ef5d5]'
                      : 'bg-[#152024] border-[#34464c] text-[#90a8ae]'
                  }`}
                >
                  {settings.invertY ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-[#b5c8cd] gap-2">
                <span className="font-mono">Touch Controls</span>
                <div className="flex gap-1">
                  {(['auto', 'on', 'off'] as TouchControlsMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => update('touchControls', mode)}
                      className={`px-2 py-0.5 rounded border font-mono text-[10px] uppercase cursor-pointer ${
                        settings.touchControls === mode
                          ? 'bg-[#52e0b6]/20 border-[#52e0b6] text-[#8ef5d5]'
                          : 'bg-[#152024] border-[#34464c] text-[#90a8ae]'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {showCustomizeControls && onOpenCustomizeControls && (
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <span className="text-[11px] text-[#9cb5bb] font-mono">
                    Control Layout
                  </span>
                  <button
                    type="button"
                    onClick={onOpenCustomizeControls}
                    className="px-2.5 py-1 rounded-md bg-[#142a2e] hover:bg-[#1b393e] border border-[#458a82] text-[#9cf7e3] font-mono font-bold text-[10px] tracking-wider uppercase flex items-center gap-1 cursor-pointer"
                  >
                    <Sliders className="w-3 h-3" />
                    Customize
                  </button>
                </div>
              )}
            </div>

            {/* Display Quality */}
            <div className="rounded-lg bg-[#111b1f] border border-[#223136] p-2.5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono tracking-wider text-[#88a4ab] uppercase">
                  Display Quality
                </span>
                <span className="text-[10px] font-mono text-[#6e8c94] truncate">
                  {settings.quality === 'auto'
                    ? `Auto (${(activeQuality || 'standard').toUpperCase()})`
                    : settings.quality === 'smooth'
                      ? 'Lowest · Max FPS'
                      : settings.quality === 'standard'
                        ? 'Balanced · Shadows & FX'
                        : 'Highest · Full Detail'}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {(
                  [
                    { id: 'smooth', label: 'Smooth' },
                    { id: 'standard', label: 'Standard' },
                    { id: 'ultra', label: 'Ultra' },
                    { id: 'auto', label: 'Auto' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => update('quality', opt.id)}
                    className={`px-1 py-1 rounded border font-mono text-[9.5px] sm:text-[10px] uppercase cursor-pointer transition-colors truncate ${
                      settings.quality === opt.id
                        ? 'bg-[#52e0b6]/20 border-[#52e0b6] text-[#8ef5d5]'
                        : 'bg-[#152024] border-[#34464c] text-[#90a8ae] hover:border-[#4b656d]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[9.5px] font-mono text-[#6e8c94] leading-tight">
                {((settings.quality === 'auto' ? activeQuality : settings.quality) || 'standard') === 'smooth'
                  ? 'No shadows, simplified water & materials, lowest draw scale.'
                  : ((settings.quality === 'auto' ? activeQuality : settings.quality) || 'standard') === 'ultra'
                    ? 'Full shadows, high-res shaders, bump maps & 8x anisotropy.'
                    : 'Dynamic shadows, caustics, water ripples & bump mapping.'}
              </p>
            </div>

            {/* Visual Survivor Character Selector */}
            <div className="rounded-lg bg-[#111b1f] border border-[#223136] p-2.5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono tracking-wider text-[#88a4ab] uppercase">
                  Character
                </span>
                <span className="text-[10px] font-mono text-[#6e8c94]">
                  Survivor
                </span>
              </div>
              <div className="max-w-[168px]">
                <CharacterSelector
                  selectedId={characterId}
                  onSelect={onCharacterChange}
                  size="compact"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 py-2 border-t border-[#243236] flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-md bg-[#52e0b6] hover:bg-[#6ef0c8] text-[#071113] font-bold text-xs tracking-wider uppercase cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
});

/* ============================================================================
 * PAUSE MODAL
 * ==========================================================================*/
interface PauseModalProps {
  levelCode: string;
  levelName: string;
  isOpenWorld?: boolean;
  regionId?: number;
  checkpointLabel?: string | null;
  coopSessionCode?: string | null;
  coopPlayerCount?: number;
  onOpenCoop?: () => void;
  onLeaveCoop?: () => void;
  onResume: () => void;
  onRestart: () => void;
  onSettings: () => void;
  onLevels: () => void;
  onQuitMenu: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = React.memo(({
  levelCode,
  levelName,
  isOpenWorld = false,
  regionId,
  checkpointLabel,
  coopSessionCode = null,
  coopPlayerCount = 0,
  onOpenCoop,
  onLeaveCoop,
  onResume,
  onRestart,
  onSettings,
  onLevels,
  onQuitMenu,
}) => (
  <div className="fixed inset-0 z-30 flex items-center justify-center p-3 bg-[#060a0c]/85">
    <div className="w-full max-w-[272px] sm:max-w-xs max-h-[90dvh] overflow-y-auto rounded-xl bg-[#0e1518] border border-[#314247] p-4 flex flex-col gap-2.5 shadow-2xl">
      <div className="text-center">
        <div className="text-[10px] font-mono text-[#7a9aa2]">
          {coopSessionCode
            ? `CO-OP ${coopSessionCode} · R${String(regionId ?? 1).padStart(2, '0')} · ${coopPlayerCount}/6`
            : isOpenWorld
              ? `OPEN WORLD · R${String(regionId ?? 1).padStart(2, '0')}`
              : levelCode}
        </div>
        <h2 className="text-base sm:text-lg font-bold tracking-wider uppercase text-[#e6f1f3] truncate">
          Paused · {levelName}
        </h2>
        {isOpenWorld && checkpointLabel && (
          <div className="mt-0.5 text-[10px] font-mono text-[#7fdcc0] truncate">
            CP: {checkpointLabel}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5 pt-1">
        <button
          type="button"
          onClick={onResume}
          className="w-full py-2 rounded-lg bg-[#52e0b6] hover:bg-[#6ef0c8] text-[#071113] font-bold text-xs tracking-wider uppercase cursor-pointer"
        >
          Resume
        </button>
        {coopSessionCode && onOpenCoop && (
          <button
            type="button"
            onClick={onOpenCoop}
            className="w-full py-2 rounded-lg bg-[#112028] hover:bg-[#18303b] border border-[#3e7d94] text-[#9be4f7] font-semibold text-xs tracking-wider uppercase flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Users className="w-3.5 h-3.5" />
            Co-Op Squad & Invites
          </button>
        )}
        {!coopSessionCode && (
          <button
            type="button"
            onClick={onRestart}
            className="w-full py-2 rounded-lg bg-[#152125] hover:bg-[#1d2d32] border border-[#384b50] text-[#dce9ec] font-semibold text-xs tracking-wider uppercase flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {isOpenWorld ? 'Restart Open World' : 'Restart Sector'}
          </button>
        )}
        {!isOpenWorld && (
          <button
            type="button"
            onClick={onLevels}
            className="w-full py-2 rounded-lg bg-[#152125] hover:bg-[#1d2d32] border border-[#384b50] text-[#dce9ec] font-semibold text-xs tracking-wider uppercase cursor-pointer"
          >
            Sector Select
          </button>
        )}
        <button
          type="button"
          onClick={onSettings}
          className="w-full py-2 rounded-lg bg-[#152125] hover:bg-[#1d2d32] border border-[#384b50] text-[#dce9ec] font-semibold text-xs tracking-wider uppercase cursor-pointer"
        >
          Settings
        </button>
        {coopSessionCode && onLeaveCoop ? (
          <button
            type="button"
            onClick={onLeaveCoop}
            className="w-full py-1.5 rounded-lg bg-transparent hover:bg-[#1c1516] border border-[#4a3235] text-[#e09d9d] font-semibold text-xs tracking-wider uppercase cursor-pointer"
          >
            Leave Co-Op Session
          </button>
        ) : (
          <button
            type="button"
            onClick={onQuitMenu}
            className="w-full py-1.5 rounded-lg bg-transparent hover:bg-[#1c1516] border border-[#4a3235] text-[#e09d9d] font-semibold text-xs tracking-wider uppercase cursor-pointer"
          >
            Main Menu
          </button>
        )}
      </div>
    </div>
  </div>
));

/* ============================================================================
 * GAME OVER MODAL
 * ==========================================================================*/
interface GameOverModalProps {
  reason: 'caught' | 'timeout';
  levelCode: string;
  levelName: string;
  hasCheckpoint: boolean;
  onRetry: () => void;
  onCheckpoint: () => void;
  onLevels: () => void;
  onMenu: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = React.memo(({
  reason,
  levelCode,
  levelName,
  hasCheckpoint,
  onRetry,
  onCheckpoint,
  onLevels,
  onMenu,
}) => (
  <div className="fixed inset-0 z-30 flex items-center justify-center p-3 bg-[#120608]/90">
    <div className="w-full max-w-[300px] sm:max-w-sm max-h-[90dvh] overflow-y-auto rounded-xl bg-[#130c0e] border border-[#5e2930] p-4 sm:p-5 flex flex-col gap-3 text-center shadow-2xl">
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-mono tracking-[0.2em] text-[#cf6b73] uppercase">
          {levelCode} · {levelName}
        </span>
        <h2 className="text-xl sm:text-2xl font-black tracking-wider uppercase text-[#ffe5e8]">
          {reason === 'timeout' ? 'TIME EXPIRED' : 'DRAGGED UNDER'}
        </h2>
        <p className="text-xs text-[#c4999e]">
          {reason === 'timeout'
            ? 'The sector bulkhead sealed before you reached the exit.'
            : 'The aquatic stalker caught you in the deep water.'}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={onRetry}
          className="w-full py-2.5 rounded-lg bg-[#d94c57] hover:bg-[#eb5e69] text-white font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Restart Sector
        </button>
        {hasCheckpoint && reason === 'caught' && (
          <button
            type="button"
            onClick={onCheckpoint}
            className="w-full py-2 rounded-lg bg-[#231618] hover:bg-[#321f22] border border-[#6e383f] text-[#ffdce0] font-semibold text-xs tracking-wider uppercase cursor-pointer"
          >
            Resume at Checkpoint
          </button>
        )}
        <button
          type="button"
          onClick={onLevels}
          className="w-full py-2 rounded-lg bg-[#1d1416] hover:bg-[#291b1e] border border-[#4a2c30] text-[#e8d5d7] font-semibold text-xs tracking-wider uppercase cursor-pointer"
        >
          Sector Select
        </button>
        <button
          type="button"
          onClick={onMenu}
          className="w-full py-1.5 rounded-lg bg-transparent hover:bg-[#1d1416] text-[#b0898d] font-semibold text-[11px] tracking-wider uppercase cursor-pointer"
        >
          Return to Main Menu
        </button>
      </div>
    </div>
  </div>
));

/* ============================================================================
 * VICTORY / LEVEL COMPLETE MODAL
 * ==========================================================================*/
interface VictoryModalProps {
  level: LevelSummary;
  elapsed: number;
  hasNextLevel: boolean;
  onNextLevel: () => void;
  onReplay: () => void;
  onLevels: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = React.memo(({
  level,
  elapsed,
  hasNextLevel,
  onNextLevel,
  onReplay,
  onLevels,
}) => {
  const stars = computeStars(level, elapsed);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-3 bg-[#060d0c]/88">
      <div className="w-full max-w-[300px] sm:max-w-sm max-h-[90dvh] overflow-y-auto rounded-xl bg-[#0d1716] border border-[#315c51] p-4 sm:p-5 flex flex-col gap-3 text-center shadow-2xl">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-mono tracking-[0.2em] text-[#68d9b4] uppercase">
            {level.code} CLEARED
          </span>
          <h2 className="text-xl sm:text-2xl font-black tracking-wider uppercase text-[#e8faf4]">
            {hasNextLevel ? 'SECTOR SURVIVED' : 'ESCAPED THE DEEP'}
          </h2>
          <p className="text-xs text-[#98bab0]">{level.name}</p>
        </div>

        {/* Star rating */}
        <div className="flex items-center justify-center gap-1.5">
          {[1, 2, 3].map((s) => (
            <Star
              key={s}
              className={`w-6 h-6 ${
                s <= stars ? 'text-[#f5ca5c] fill-[#f5ca5c]' : 'text-[#253b36]'
              }`}
            />
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-[#091210] border border-[#223d36] font-mono text-[10px]">
          <div className="flex flex-col gap-0.5">
            <span className="text-[#6f968b]">CLEAR TIME</span>
            <span className="text-base font-bold text-[#e6faf3] tabular-nums">
              {formatElapsed(elapsed)}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[#6f968b]">3-STAR TARGET</span>
            <span className="text-base font-bold text-[#89c4b3] tabular-nums">
              {formatElapsed(level.parTimes[0])}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          {hasNextLevel && (
            <button
              type="button"
              onClick={onNextLevel}
              className="w-full py-2.5 rounded-lg bg-[#52e0b6] hover:bg-[#6ef0c8] text-[#071113] font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-1.5 cursor-pointer"
            >
              Next Sector
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onReplay}
            className="w-full py-2 rounded-lg bg-[#13221f] hover:bg-[#1b302c] border border-[#315249] text-[#d7ede6] font-semibold text-xs tracking-wider uppercase flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Replay for Faster Time
          </button>
          <button
            type="button"
            onClick={onLevels}
            className="w-full py-1.5 rounded-lg bg-transparent hover:bg-[#13221f] text-[#8eb3a7] font-semibold text-[11px] tracking-wider uppercase cursor-pointer"
          >
            Sector Select
          </button>
        </div>
      </div>
    </div>
  );
});
