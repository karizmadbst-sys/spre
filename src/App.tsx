import { useCallback, useEffect, useRef, useState } from 'react';
import { CoopModal } from './components/CoopModal';
import { GameHud } from './components/GameHud';
import { LandscapeGuard } from './components/LandscapeGuard';
import { LoadingOverlay } from './components/LoadingOverlay';
import {
  computeStars,
  GameOverModal,
  isLevelUnlocked,
  LevelSelectModal,
  MainMenu,
  PauseModal,
  SettingsModal,
  VictoryModal,
} from './components/Modals';
import { TouchControls, TouchControlsCustomizer } from './components/TouchControls';
import {
  CoopClient,
  detectCoopPlatform,
  resolveDefaultCoopWsUrl,
  setStoredCoopServerUrl,
  type CoopPendingAction,
} from './coop/CoopClient';
import {
  deriveFriendCode,
  sanitizePlayerName,
  type CoopConnectionStatus,
  type CoopInvite,
  type CoopOnlineUser,
  type CoopPlayerSnapshot,
  type CoopSessionSnapshot,
} from './coop/types';
import { setCharacterPreviewPaused } from './game/characterPreview';
import { PoolGameEngine } from './game/engine';
import { getLevelSummary, LEVEL_CATALOG, TOTAL_LEVELS } from './game/levels';
import { getWorldCheckpointById, getWorldRegionMeta } from './game/openWorld';
import { requestAndroidFullscreen } from './game/fullscreen';
import serpentisIconUrl from './assets/serpentis-icon.png';
import { preloadCoreAssets, registerSerpentisIconUrl, waitAnimationFrames } from './game/preloader';
import {
  CharacterId,
  DEFAULT_SETTINGS,
  DEFAULT_TOUCH_LAYOUT,
  GamePhase,
  GameSettings,
  HudSnapshot,
  normalizeCharacterId,
  sanitizeGameSettings,
  SaveData,
  TouchControlPlacement,
  TouchLayoutConfig,
} from './game/types';

registerSerpentisIconUrl(serpentisIconUrl);

const STORAGE_SAVE_KEY = 'deep_tile_save_v1';
const STORAGE_SETTINGS_KEY = 'deep_tile_settings_v1';
const STORAGE_TOUCH_LAYOUT_KEY = 'deep_tile_touch_layout_v1';
const STORAGE_CHARACTER_KEY = 'deep_tile_character_v1';
const STORAGE_OPEN_WORLD_CP_KEY = 'serpentis_open_world_cp_v1';
const STORAGE_COOP_PLAYER_ID_KEY = 'serpentis_coop_player_id_v1';
const STORAGE_COOP_NAME_KEY = 'serpentis_coop_name_v1';

function loadOrCreateCoopPlayerId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_COOP_PLAYER_ID_KEY);
    if (existing && existing.length >= 6) return existing;
    const generated =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `srp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(STORAGE_COOP_PLAYER_ID_KEY, generated);
    return generated;
  } catch {
    return `srp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

function loadCoopPlayerName(): string {
  try {
    return sanitizePlayerName(localStorage.getItem(STORAGE_COOP_NAME_KEY));
  } catch {
    return 'Survivor';
  }
}

function saveCoopPlayerName(name: string): string {
  const clean = sanitizePlayerName(name);
  try {
    localStorage.setItem(STORAGE_COOP_NAME_KEY, clean);
  } catch {
    // ignore storage errors
  }
  return clean;
}

function cloneCoopSession(session: CoopSessionSnapshot | null): CoopSessionSnapshot | null {
  if (!session) return null;
  return {
    ...session,
    players: session.players.map((p) => ({ ...p })),
  };
}

function parseInitialCoopParams(): { joinCode: string; hasInviteLink: boolean } {
  if (typeof window === 'undefined' || !window.location) {
    return { joinCode: '', hasInviteLink: false };
  }
  try {
    const url = new URL(window.location.href);
    const serverParam = url.searchParams.get('server')?.trim();
    if (serverParam) {
      setStoredCoopServerUrl(serverParam);
    }
    const rawCode = url.searchParams.get('coop') || '';
    const cleanCode = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (serverParam || rawCode) {
      url.searchParams.delete('coop');
      url.searchParams.delete('server');
      window.history.replaceState?.({}, '', url.toString());
    }
    return {
      joinCode: cleanCode.length >= 4 ? cleanCode : '',
      hasInviteLink: cleanCode.length >= 4,
    };
  } catch {
    return { joinCode: '', hasInviteLink: false };
  }
}

function loadCharacterId(): CharacterId {
  try {
    return normalizeCharacterId(localStorage.getItem(STORAGE_CHARACTER_KEY));
  } catch {
    return 'male';
  }
}

function loadSaveData(): SaveData {
  try {
    const raw = localStorage.getItem(STORAGE_SAVE_KEY);
    return raw ? (JSON.parse(raw) as SaveData) : {};
  } catch {
    return {};
  }
}

function loadSavedOpenWorldCheckpointId(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_OPEN_WORLD_CP_KEY);
    if (!raw) return null;
    return getWorldCheckpointById(raw) ? raw : null;
  } catch {
    return null;
  }
}

function saveOpenWorldCheckpointId(checkpointId: string | null): void {
  try {
    if (checkpointId) {
      localStorage.setItem(STORAGE_OPEN_WORLD_CP_KEY, checkpointId);
    } else {
      localStorage.removeItem(STORAGE_OPEN_WORLD_CP_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(STORAGE_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return sanitizeGameSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function sanitizePlacement(
  raw: Partial<TouchControlPlacement> | undefined,
  fallback: TouchControlPlacement
): TouchControlPlacement {
  const num = (v: unknown, def: number, min: number, max: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : def;
  return {
    xPct: num(raw?.xPct, fallback.xPct, 5, 95),
    yPct: num(raw?.yPct, fallback.yPct, 14, 93),
    scale: num(raw?.scale, fallback.scale, 0.65, 1.45),
    opacity: num(raw?.opacity, fallback.opacity, 0.3, 1),
  };
}

function loadTouchLayout(): TouchLayoutConfig {
  try {
    const raw = localStorage.getItem(STORAGE_TOUCH_LAYOUT_KEY);
    if (!raw) return DEFAULT_TOUCH_LAYOUT;
    const parsed = JSON.parse(raw) as Partial<TouchLayoutConfig>;
    return {
      joystick: sanitizePlacement(parsed.joystick, DEFAULT_TOUCH_LAYOUT.joystick),
      autoRun: sanitizePlacement(parsed.autoRun, DEFAULT_TOUCH_LAYOUT.autoRun),
      jump: sanitizePlacement(parsed.jump, DEFAULT_TOUCH_LAYOUT.jump),
    };
  } catch {
    return DEFAULT_TOUCH_LAYOUT;
  }
}

const INITIAL_LEVEL_META = getLevelSummary(1);

const INITIAL_HUD: HudSnapshot = {
  levelId: 1,
  levelCode: INITIAL_LEVEL_META.code,
  levelName: INITIAL_LEVEL_META.name,
  worldMode: 'sector',
  timeRemaining: INITIAL_LEVEL_META.timeLimit,
  timeElapsed: 0,
  stamina: 100,
  inWater: false,
  underwater: false,
  waterJumpCooldown: 0,
  monsterDist: 30,
  monsterAlert: 'calm',
  checkpointIndex: 0,
  totalCheckpoints: 1,
  checkpointNotice: null,
  activeQuality: 'standard',
  fps: 60,
  isPointerLocked: false,
  deathReason: null,
};

export default function App() {
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<PoolGameEngine | null>(null);
  const coopClientRef = useRef<CoopClient | null>(null);

  const [initialCoopParams] = useState(() => parseInitialCoopParams());
  const [coopPlayerId] = useState<string>(() => loadOrCreateCoopPlayerId());
  const [coopName, setCoopName] = useState<string>(() => loadCoopPlayerName());
  const [coopFriendCode, setCoopFriendCode] = useState<string>(() => deriveFriendCode(coopPlayerId));
  const [coopStatus, setCoopStatus] = useState<CoopConnectionStatus>('disconnected');
  const [coopPendingAction, setCoopPendingAction] = useState<CoopPendingAction>(null);
  const [coopServerUrl, setCoopServerUrl] = useState<string>(() => resolveDefaultCoopWsUrl());
  const [coopSession, setCoopSession] = useState<CoopSessionSnapshot | null>(null);
  const [coopOnlineUsers, setCoopOnlineUsers] = useState<CoopOnlineUser[]>([]);
  const [coopInvites, setCoopInvites] = useState<CoopInvite[]>([]);
  const [coopError, setCoopError] = useState<string | null>(null);
  const [coopNotice, setCoopNotice] = useState<string | null>(null);

  const [phase, setPhase] = useState<GamePhase>('menu');
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());
  const [characterId, setCharacterId] = useState<CharacterId>(() => loadCharacterId());
  const [touchLayout, setTouchLayout] = useState<TouchLayoutConfig>(() => loadTouchLayout());
  const [saveData, setSaveData] = useState<SaveData>(() => loadSaveData());
  const [showLevels, setShowLevels] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCoop, setShowCoop] = useState(() => initialCoopParams.hasInviteLink);
  const [showTouchCustomizer, setShowTouchCustomizer] = useState(false);
  const [returnToSettingsAfterCustomize, setReturnToSettingsAfterCustomize] = useState(false);
  const [deathReason, setDeathReason] = useState<'caught' | 'timeout'>('caught');
  const [victoryElapsed, setVictoryElapsed] = useState(0);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [isPortraitBlocked, setIsPortraitBlocked] = useState(false);

  // Loading & seamless scene transition overlay state
  const [loadingOverlay, setLoadingOverlay] = useState<{
    visible: boolean;
    fadingOut: boolean;
    progress: number;
    label: string;
    sublabel?: string;
  }>({
    visible: true,
    fadingOut: false,
    progress: 12,
    label: 'INITIALIZING FACILITY 09...',
    sublabel: 'LOADING INTERFACE & ASSETS',
  });
  const [isTransitioningToPlay, setIsTransitioningToPlay] = useState(false);

  const activeLevelIdRef = useRef<number>(1);
  const activeWorldModeRef = useRef<'sector' | 'open_world'>('sector');
  const activeCoopSessionIdRef = useRef<string | null>(null);
  const coopLaunchIntentRef = useRef<'stay_in_lobby' | 'auto_enter'>('auto_enter');
  const phaseRef = useRef<GamePhase>('menu');
  const transitionTokenRef = useRef<number>(0);
  const fadeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const clearFadeTimer = useCallback(() => {
    if (fadeTimerRef.current !== null) {
      window.clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  }, []);

  const beginLoadingTransition = useCallback(
    (label: string, sublabel?: string, initialProgress = 14): number => {
      clearFadeTimer();
      transitionTokenRef.current += 1;
      const token = transitionTokenRef.current;
      setLoadingOverlay({
        visible: true,
        fadingOut: false,
        progress: initialProgress,
        label,
        sublabel,
      });
      return token;
    },
    [clearFadeTimer]
  );

  const updateLoadingProgress = useCallback((token: number, progress: number, label?: string) => {
    if (transitionTokenRef.current !== token) return;
    setLoadingOverlay((prev) => ({
      ...prev,
      progress: Math.max(prev.progress, progress),
      label: label ?? prev.label,
    }));
  }, []);

  const finishLoadingTransition = useCallback(
    (token: number) => {
      if (transitionTokenRef.current !== token) return;
      clearFadeTimer();
      setLoadingOverlay((prev) => ({
        ...prev,
        progress: 100,
        fadingOut: true,
      }));
      fadeTimerRef.current = window.setTimeout(() => {
        fadeTimerRef.current = null;
        if (transitionTokenRef.current !== token) return;
        setLoadingOverlay((prev) => ({ ...prev, visible: false, fadingOut: false }));
      }, 220);
    },
    [clearFadeTimer]
  );

  const abortLoadingTransition = useCallback(() => {
    clearFadeTimer();
    transitionTokenRef.current += 1;
    setIsTransitioningToPlay(false);
    setLoadingOverlay((prev) => (prev.visible ? { ...prev, visible: false, fadingOut: false } : prev));
  }, [clearFadeTimer]);

  const launchCoopWorld = useCallback(
    (session: CoopSessionSnapshot, you: CoopPlayerSnapshot) => {
      void requestAndroidFullscreen(false);
      activeCoopSessionIdRef.current = session.sessionId;
      const token = beginLoadingTransition(
        `ENTERING CO-OP ${session.sessionCode}...`,
        'SYNCHRONIZING 100 OPEN WORLD REGIONS',
        16
      );
      setIsTransitioningToPlay(true);

      void (async () => {
        try {
          await waitAnimationFrames(1);
          if (transitionTokenRef.current !== token) return;

          await preloadCoreAssets();
          if (transitionTokenRef.current !== token) return;

          const engine = engineRef.current;
          if (engine) {
            const latestSession = coopClientRef.current?.session;
            const latestPlayers =
              latestSession && latestSession.sessionId === session.sessionId
                ? latestSession.players
                : session.players;
            const latestYou = latestPlayers.find((p) => p.playerId === you.playerId) ?? you;

            await engine.prepareCoopOpenWorldAsync(
              latestYou,
              latestPlayers,
              (pct, label) => updateLoadingProgress(token, pct, label)
            );
            if (transitionTokenRef.current !== token) return;

            const postPreloadSession = coopClientRef.current?.session;
            if (postPreloadSession && postPreloadSession.sessionId === session.sessionId) {
              engine.syncCoopPlayers(postPreloadSession.players);
            }
          }
          if (transitionTokenRef.current !== token) return;

          activeWorldModeRef.current = 'open_world';
          setShowCoop(false);
          setShowLevels(false);
          setShowSettings(false);
          setPhase('playing');
          setIsTransitioningToPlay(false);

          await waitAnimationFrames(2);
          finishLoadingTransition(token);
        } catch (err) {
          console.error('[SERPENTIS][COOP] Failed to enter Co-Op Open World', err);
          if (transitionTokenRef.current === token) {
            abortLoadingTransition();
          }
          setCoopError('Failed to initialize the Co-Op Open World scene. Please try again.');
          setShowCoop(true);
        }
      })();
    },
    [beginLoadingTransition, updateLoadingProgress, finishLoadingTransition, abortLoadingTransition]
  );

  useEffect(() => {
    return () => clearFadeTimer();
  }, [clearFadeTimer]);

  useEffect(() => {
    const hasTouch =
      'ontouchstart' in window || navigator.maxTouchPoints > 0;
    setIsTouchDevice(hasTouch);
  }, []);

  // Mount Three.js engine once in isolated container
  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;

    const engine = new PoolGameEngine(host, settings, {
      onHudUpdate: (snapshot) => {
        activeLevelIdRef.current = snapshot.levelId;
        activeWorldModeRef.current = snapshot.worldMode === 'open_world' ? 'open_world' : 'sector';
        setHud(snapshot);
      },
      onPhaseChange: (nextPhase, extra) => {
        setPhase(nextPhase);
        if (extra?.deathReason) {
          setDeathReason(extra.deathReason);
        }
        if (nextPhase === 'victory' && extra?.elapsed != null && activeWorldModeRef.current !== 'open_world') {
          const lvlId = activeLevelIdRef.current;
          const lvl = getLevelSummary(lvlId);
          const stars = computeStars(lvl, extra.elapsed);
          setVictoryElapsed(extra.elapsed);

          setSaveData((prev) => {
            const existing = prev[lvlId];
            const bestTime =
              existing?.bestTime != null
                ? Math.min(existing.bestTime, extra.elapsed!)
                : extra.elapsed!;
            const nextSave: SaveData = {
              ...prev,
              [lvlId]: {
                completed: true,
                bestTime,
                stars: Math.max(existing?.stars || 0, stars),
              },
            };
            try {
              localStorage.setItem(STORAGE_SAVE_KEY, JSON.stringify(nextSave));
            } catch {
              // ignore quota errors
            }
            return nextSave;
          });
        }
      },
      onOpenWorldCheckpoint: (checkpointId, _regionId, _label, x, y, z) => {
        saveOpenWorldCheckpointId(checkpointId);
        const client = coopClientRef.current;
        if (client?.session && typeof x === 'number' && typeof y === 'number' && typeof z === 'number') {
          client.sendActivateCheckpoint(checkpointId, x, y, z);
        }
      },
      onCoopStateEmit: (state) => {
        coopClientRef.current?.sendPlayerState(state);
      },
      onCoopPlayerEaten: (event) => {
        coopClientRef.current?.sendPlayerEaten(event);
      },
      onCoopRequestRespawn: (deathSeq) => {
        coopClientRef.current?.sendRequestRespawn(deathSeq);
      },
    }, characterId);

    engineRef.current = engine;

    const bootToken = transitionTokenRef.current;
    void (async () => {
      await preloadCoreAssets((pct, label) => {
        updateLoadingProgress(bootToken, pct, label);
      });
      if (transitionTokenRef.current !== bootToken) return;
      engine.renderImmediateReadyFrame();
      await waitAnimationFrames(2);
      finishLoadingTransition(bootToken);
    })();

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mount Co-Op WebSocket client for live presence, invites, sessions, and Open World sync
  useEffect(() => {
    const client = new CoopClient({
      playerId: coopPlayerId,
      name: coopName,
      characterId,
      platform: detectCoopPlatform(),
      callbacks: {
        onStatusChange: (status) => {
          setCoopStatus(status);
        },
        onPendingActionChange: (action) => {
          setCoopPendingAction(action);
        },
        onWelcome: (info) => {
          setCoopFriendCode(info.friendCode);
          setCoopName(info.name);
        },
        onPresenceUpdate: (users) => {
          setCoopOnlineUsers(users);
        },
        onInviteReceived: (invite) => {
          setCoopInvites((prev) => {
            const filtered = prev.filter((i) => i.inviteId !== invite.inviteId);
            return [invite, ...filtered];
          });
        },
        onInviteSent: (invite) => {
          setCoopNotice(`Invite sent for session ${invite.sessionCode}`);
          window.setTimeout(() => setCoopNotice(null), 2800);
        },
        onInviteDeclined: (info) => {
          setCoopNotice(`${info.targetName} declined the squad invite`);
          window.setTimeout(() => setCoopNotice(null), 2800);
        },
        onSessionState: (session, you, reconnectRestore) => {
          setCoopError(null);
          setCoopInvites([]);
          const cloned = cloneCoopSession(session);
          setCoopSession(cloned);
          const engine = engineRef.current;
          const alreadyInThisCoop =
            Boolean(engine?.isCoopMode()) &&
            activeWorldModeRef.current === 'open_world' &&
            activeCoopSessionIdRef.current === session.sessionId &&
            (phaseRef.current === 'playing' || phaseRef.current === 'paused' || phaseRef.current === 'jumpscare');

          if (reconnectRestore && alreadyInThisCoop && engine) {
            engine.setCoopMode(true, you.playerId);
            engine.syncCoopPlayers(session.players);
            return;
          }

          if (!reconnectRestore && coopLaunchIntentRef.current === 'stay_in_lobby') {
            coopLaunchIntentRef.current = 'auto_enter';
            setCoopNotice(`Online Co-Op Room ${session.sessionCode} ready — share your Join Code!`);
            window.setTimeout(() => setCoopNotice(null), 4200);
            return;
          }

          coopLaunchIntentRef.current = 'auto_enter';
          launchCoopWorld(session, you);
        },
        onPlayerJoined: () => {
          setCoopSession(cloneCoopSession(client.session));
          if (client.session && engineRef.current?.isCoopMode()) {
            engineRef.current.syncCoopPlayers(client.session.players);
          }
        },
        onPlayerLeft: () => {
          setCoopSession(cloneCoopSession(client.session));
          if (client.session && engineRef.current?.isCoopMode()) {
            engineRef.current.syncCoopPlayers(client.session.players);
          }
        },
        onPlayerConnection: (playerId, connected) => {
          setCoopSession(cloneCoopSession(client.session));
          engineRef.current?.applyCoopPlayerConnection(playerId, connected);
        },
        onPlayerMoved: (move) => {
          engineRef.current?.updateCoopPlayerMove(move);
          setCoopSession((prev) => {
            if (!prev) return prev;
            const target = prev.players.find((p) => p.playerId === move.playerId);
            if (!target) return prev;
            if (target.regionId === move.regionId && target.alive === move.alive) {
              return prev;
            }
            return {
              ...prev,
              players: prev.players.map((p) =>
                p.playerId === move.playerId
                  ? { ...p, regionId: move.regionId, alive: move.alive }
                  : p
              ),
            };
          });
        },
        onCheckpointConfirmed: (cp) => {
          saveOpenWorldCheckpointId(cp.checkpointId);
          setCoopSession(cloneCoopSession(client.session));
        },
        onPlayerCheckpoint: () => {
          setCoopSession(cloneCoopSession(client.session));
        },
        onPlayerEaten: (event) => {
          setCoopSession(cloneCoopSession(client.session));
          engineRef.current?.applyCoopPlayerEaten(event);
        },
        onPlayerRespawn: (respawn) => {
          if (respawn.playerId === client.playerId) {
            saveOpenWorldCheckpointId(respawn.checkpointId);
          }
          setCoopSession(cloneCoopSession(client.session));
          engineRef.current?.applyCoopPlayerRespawn(respawn);
        },
        onError: (err) => {
          setCoopError(err.message);
          if (err.code === 'SESSION_EXPIRED' || err.code === 'SESSION_NOT_FOUND') {
            activeCoopSessionIdRef.current = null;
            setCoopSession(null);
            engineRef.current?.setCoopMode(false);
          }
        },
      },
    });
    coopClientRef.current = client;
    client.connect();

    return () => {
      client.disconnect(false);
      if (coopClientRef.current === client) {
        coopClientRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coopPlayerId, launchCoopWorld]);

  // Pause 3D rendering whenever full-screen modals or portrait orientation lock completely occlude the viewport
  useEffect(() => {
    const occluded =
      !isTransitioningToPlay &&
      (isPortraitBlocked || showLevels || showSettings || showTouchCustomizer || showCoop);
    engineRef.current?.setOverlayOccluded(occluded);
  }, [isTransitioningToPlay, isPortraitBlocked, showLevels, showSettings, showTouchCustomizer, showCoop]);

  // Never allow offscreen character-preview WebGL rendering to run during active gameplay
  useEffect(() => {
    setCharacterPreviewPaused(phase === 'playing' || phase === 'jumpscare');
  }, [phase]);

  // Auto-pause active single-player run if mobile device rotates to portrait
  useEffect(() => {
    if (isPortraitBlocked && phase === 'playing') {
      setPhase('paused');
      engineRef.current?.setPhase('paused');
    }
  }, [isPortraitBlocked, phase]);

  const handleSettingsChange = useCallback((next: GameSettings) => {
    const sanitized = sanitizeGameSettings(next);
    setSettings(sanitized);
    engineRef.current?.updateSettings(sanitized);
    try {
      localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(sanitized));
    } catch {
      // ignore
    }
  }, []);

  const handleCharacterChange = useCallback((next: CharacterId) => {
    const normalized = normalizeCharacterId(next);
    setCharacterId(normalized);
    engineRef.current?.setCharacter(normalized);
    coopClientRef.current?.updateLocalProfile({ characterId: normalized });
    try {
      localStorage.setItem(STORAGE_CHARACTER_KEY, normalized);
    } catch {
      // ignore
    }
  }, []);

  const handleCoopNameChange = useCallback((nextName: string) => {
    const clean = saveCoopPlayerName(nextName);
    setCoopName(clean);
    coopClientRef.current?.updateLocalProfile({ name: clean });
  }, []);

  const handleToggleMute = useCallback(() => {
    handleSettingsChange({ ...settings, muted: !settings.muted });
  }, [settings, handleSettingsChange]);

  const exitActiveCoopIfNeeded = useCallback(() => {
    if (coopClientRef.current?.session) {
      coopClientRef.current.leaveSession();
    }
    activeCoopSessionIdRef.current = null;
    setCoopSession(null);
    engineRef.current?.setCoopMode(false);
  }, []);

  const handleStartLevel = useCallback(
    (levelId: number) => {
      exitActiveCoopIfNeeded();
      void requestAndroidFullscreen(false);
      const targetId = isLevelUnlocked(levelId, saveData) ? levelId : 1;
      const lvl = getLevelSummary(targetId);
      const token = beginLoadingTransition(
        `PREPARING ${lvl.code}...`,
        lvl.name.toUpperCase(),
        14
      );
      setIsTransitioningToPlay(true);

      void (async () => {
        try {
          await waitAnimationFrames(1);
          if (transitionTokenRef.current !== token) return;

          await preloadCoreAssets();
          if (transitionTokenRef.current !== token) return;

          const engine = engineRef.current;
          if (engine) {
            await engine.prepareLevelAsync(targetId, (pct, label) =>
              updateLoadingProgress(token, pct, label)
            );
          }
          if (transitionTokenRef.current !== token) return;

          activeWorldModeRef.current = 'sector';
          setShowCoop(false);
          setShowLevels(false);
          setShowSettings(false);
          setPhase('playing');
          setIsTransitioningToPlay(false);

          await waitAnimationFrames(2);
          finishLoadingTransition(token);
        } catch (err) {
          console.error('[SERPENTIS] Failed to launch sector', err);
          if (transitionTokenRef.current === token) {
            abortLoadingTransition();
          }
        }
      })();
    },
    [saveData, exitActiveCoopIfNeeded, beginLoadingTransition, updateLoadingProgress, finishLoadingTransition, abortLoadingTransition]
  );

  const handleStartOpenWorld = useCallback(() => {
    exitActiveCoopIfNeeded();
    void requestAndroidFullscreen(false);
    const savedCheckpointId = loadSavedOpenWorldCheckpointId();
    const token = beginLoadingTransition(
      'ENTERING OPEN WORLD...',
      '100 CONNECTED SUBSURFACE REGIONS',
      14
    );
    setIsTransitioningToPlay(true);

    void (async () => {
      try {
        await waitAnimationFrames(1);
        if (transitionTokenRef.current !== token) return;

        await preloadCoreAssets();
        if (transitionTokenRef.current !== token) return;

        const engine = engineRef.current;
        if (engine) {
          await engine.prepareOpenWorldAsync(
            (pct, label) => updateLoadingProgress(token, pct, label),
            savedCheckpointId
          );
        }
        if (transitionTokenRef.current !== token) return;

        activeWorldModeRef.current = 'open_world';
        setShowCoop(false);
        setShowLevels(false);
        setShowSettings(false);
        setPhase('playing');
        setIsTransitioningToPlay(false);

        await waitAnimationFrames(2);
        finishLoadingTransition(token);
      } catch (err) {
        console.error('[SERPENTIS] Failed to launch Open World', err);
        if (transitionTokenRef.current === token) {
          abortLoadingTransition();
        }
      }
    })();
  }, [exitActiveCoopIfNeeded, beginLoadingTransition, updateLoadingProgress, finishLoadingTransition, abortLoadingTransition]);

  const handleRestart = useCallback(() => {
    void requestAndroidFullscreen(false);
    const isOW = activeWorldModeRef.current === 'open_world';
    const lvl = getLevelSummary(activeLevelIdRef.current);
    const token = beginLoadingTransition(
      isOW ? 'RESTARTING OPEN WORLD...' : `RESTARTING ${lvl.code}...`,
      isOW ? 'REGION 01 ENTRY DOCK' : lvl.name.toUpperCase(),
      20
    );
    setIsTransitioningToPlay(true);

    void (async () => {
      try {
        await waitAnimationFrames(1);
        if (transitionTokenRef.current !== token) return;

        const engine = engineRef.current;
        if (engine) {
          if (isOW) {
            saveOpenWorldCheckpointId(null);
            await engine.restartOpenWorldAsync((pct, label) =>
              updateLoadingProgress(token, pct, label)
            );
          } else {
            await engine.restartLevelAsync((pct, label) =>
              updateLoadingProgress(token, pct, label)
            );
          }
        }
        if (transitionTokenRef.current !== token) return;

        setPhase('playing');
        setIsTransitioningToPlay(false);

        await waitAnimationFrames(2);
        finishLoadingTransition(token);
      } catch (err) {
        console.error('[SERPENTIS] Failed to restart', err);
        if (transitionTokenRef.current === token) {
          abortLoadingTransition();
        }
      }
    })();
  }, [beginLoadingTransition, updateLoadingProgress, finishLoadingTransition, abortLoadingTransition]);

  const handleRespawnCheckpoint = useCallback(() => {
    void requestAndroidFullscreen(false);
    setPhase('playing');
    engineRef.current?.respawnAtCheckpoint();
  }, []);

  const handlePause = useCallback(() => {
    setPhase('paused');
    engineRef.current?.setPhase('paused');
  }, []);

  const handleResume = useCallback(() => {
    void requestAndroidFullscreen(false);
    setShowCoop(false);
    setShowSettings(false);
    setShowLevels(false);
    setPhase('playing');
    engineRef.current?.setPhase('playing');
  }, []);

  const handleQuitToMenu = useCallback(() => {
    abortLoadingTransition();
    exitActiveCoopIfNeeded();
    activeWorldModeRef.current = 'sector';
    setShowCoop(false);
    setShowSettings(false);
    setShowLevels(false);
    setPhase('menu');
    engineRef.current?.showMenuBackdrop(1);
  }, [abortLoadingTransition, exitActiveCoopIfNeeded]);

  const handleLeaveCoopSession = useCallback(() => {
    exitActiveCoopIfNeeded();
    if (phaseRef.current !== 'menu') {
      abortLoadingTransition();
      activeWorldModeRef.current = 'sector';
      setShowCoop(false);
      setShowSettings(false);
      setShowLevels(false);
      setPhase('menu');
      engineRef.current?.showMenuBackdrop(1);
    }
  }, [abortLoadingTransition, exitActiveCoopIfNeeded]);

  const handleCreateCoopSession = useCallback(() => {
    setCoopError(null);
    coopLaunchIntentRef.current = 'stay_in_lobby';
    coopClientRef.current?.createSession(null);
  }, []);

  const handleJoinCoopByCode = useCallback((sessionCode: string) => {
    setCoopError(null);
    coopLaunchIntentRef.current = 'auto_enter';
    coopClientRef.current?.joinSession({
      sessionCode,
      savedCheckpointId: null,
    });
  }, []);

  const handleInviteByFriendCode = useCallback((friendCode: string) => {
    setCoopError(null);
    coopClientRef.current?.inviteFriend({ friendCode });
  }, []);

  const handleInviteUser = useCallback((playerId: string) => {
    setCoopError(null);
    coopClientRef.current?.inviteFriend({ playerId });
  }, []);

  const handleRespondCoopInvite = useCallback((inviteId: string, accept: boolean) => {
    setCoopError(null);
    setCoopInvites((prev) => prev.filter((i) => i.inviteId !== inviteId));
    coopLaunchIntentRef.current = accept ? 'auto_enter' : 'stay_in_lobby';
    coopClientRef.current?.respondToInvite(inviteId, accept, null);
  }, []);

  const handleEnterCoopWorld = useCallback(() => {
    const client = coopClientRef.current;
    const session = client?.session;
    if (!session) return;
    const you = session.players.find((p) => p.playerId === client.playerId);
    if (!you) return;
    if (
      engineRef.current?.isCoopMode() &&
      activeCoopSessionIdRef.current === session.sessionId &&
      activeWorldModeRef.current === 'open_world' &&
      (phaseRef.current === 'paused' || phaseRef.current === 'playing')
    ) {
      setShowCoop(false);
      setPhase('playing');
      engineRef.current.setPhase('playing');
      return;
    }
    launchCoopWorld(session, you);
  }, [launchCoopWorld]);

  const handleOpenCoop = useCallback(() => {
    if (phaseRef.current === 'playing') {
      setPhase('paused');
      engineRef.current?.setPhase('paused');
    }
    setCoopError(null);
    coopClientRef.current?.connect();
    setShowCoop(true);
  }, []);

  const handleCloseCoop = useCallback(() => setShowCoop(false), []);
  const handleReconnectCoop = useCallback(() => {
    setCoopError(null);
    coopClientRef.current?.retryConnect();
  }, []);

  const handleSaveCoopServerUrl = useCallback((url: string) => {
    setCoopError(null);
    setStoredCoopServerUrl(url);
    const nextUrl = coopClientRef.current?.setWsUrl(url) ?? resolveDefaultCoopWsUrl();
    setCoopServerUrl(nextUrl);
  }, []);

  const handleVirtualMove = useCallback((x: number, y: number, run: boolean) => {
    engineRef.current?.setVirtualInput(x, y, run);
  }, []);

  const handleVirtualAutoRun = useCallback((enabled: boolean) => {
    engineRef.current?.setVirtualAutoRun(enabled);
  }, []);

  const handleVirtualJump = useCallback(() => {
    engineRef.current?.triggerJump();
  }, []);

  const handleVirtualCamDelta = useCallback((dx: number, dy: number) => {
    engineRef.current?.rotateCameraByDelta(dx, dy);
  }, []);

  const handleOpenCustomizeControls = useCallback(() => {
    setReturnToSettingsAfterCustomize(true);
    setShowSettings(false);
    setShowTouchCustomizer(true);
  }, []);

  const handleSaveTouchLayout = useCallback(
    (nextLayout: TouchLayoutConfig) => {
      setTouchLayout(nextLayout);
      try {
        localStorage.setItem(STORAGE_TOUCH_LAYOUT_KEY, JSON.stringify(nextLayout));
      } catch {
        // ignore quota errors
      }
      setShowTouchCustomizer(false);
      if (returnToSettingsAfterCustomize) {
        setShowSettings(true);
        setReturnToSettingsAfterCustomize(false);
      }
    },
    [returnToSettingsAfterCustomize]
  );

  const handleCancelTouchLayout = useCallback(() => {
    setShowTouchCustomizer(false);
    if (returnToSettingsAfterCustomize) {
      setShowSettings(true);
      setReturnToSettingsAfterCustomize(false);
    }
  }, [returnToSettingsAfterCustomize]);

  const handleOpenLevels = useCallback(() => setShowLevels(true), []);
  const handleCloseLevels = useCallback(() => setShowLevels(false), []);
  const handleOpenSettings = useCallback(() => setShowSettings(true), []);
  const handleCloseSettings = useCallback(() => setShowSettings(false), []);
  const handleOpenLevelsFromPause = useCallback(() => setShowLevels(true), []);

  // Determine current unlocked frontier sector for Main Menu CTA
  const continueLevelId = (() => {
    for (const lvl of LEVEL_CATALOG) {
      if (!saveData[lvl.id]?.completed && isLevelUnlocked(lvl.id, saveData)) return lvl.id;
    }
    return TOTAL_LEVELS;
  })();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement | null)?.tagName;
      if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || targetTag === 'SELECT') return;
      if (loadingOverlay.visible && !loadingOverlay.fadingOut) return;
      if (showLevels || showSettings || showTouchCustomizer || showCoop) return;
      if (phase === 'menu' && (e.code === 'Enter' || e.code === 'Space')) {
        e.preventDefault();
        handleStartLevel(continueLevelId);
      } else if (phase === 'gameover' && (e.code === 'KeyR' || e.code === 'Enter')) {
        e.preventDefault();
        handleRestart();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    phase,
    loadingOverlay.visible,
    loadingOverlay.fadingOut,
    showLevels,
    showSettings,
    showTouchCustomizer,
    showCoop,
    continueLevelId,
    handleStartLevel,
    handleRestart,
  ]);

  const currentLevel = getLevelSummary(hud.levelId);
  const isOpenWorldHud = hud.worldMode === 'open_world';
  const pauseRegionMeta = isOpenWorldHud ? getWorldRegionMeta(hud.regionId ?? hud.levelId) : null;
  const showTouch =
    phase === 'playing' &&
    !showCoop &&
    !showLevels &&
    !showSettings &&
    !showTouchCustomizer &&
    (settings.touchControls === 'on' ||
      (settings.touchControls === 'auto' && isTouchDevice));

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden bg-[#0b1012]">
      {/* Isolated WebGL Canvas Host */}
      <div ref={canvasHostRef} className="game-canvas-host absolute inset-0 z-0" />

      {/* Main Menu */}
      {phase === 'menu' && (
        <MainMenu
          continueLevelId={continueLevelId}
          characterId={characterId}
          onCharacterChange={handleCharacterChange}
          onPlay={handleStartLevel}
          onPlayOpenWorld={handleStartOpenWorld}
          onOpenCoop={handleOpenCoop}
          pendingCoopInviteCount={coopInvites.length}
          onOpenLevels={handleOpenLevels}
          onOpenSettings={handleOpenSettings}
        />
      )}

      {/* Active Gameplay HUD */}
      {phase === 'playing' && (
        <GameHud
          hud={hud}
          muted={settings.muted}
          onToggleMute={handleToggleMute}
          onPause={handlePause}
          coopSession={coopSession}
          localPlayerId={coopPlayerId}
          pendingInvites={coopInvites}
          onOpenCoop={handleOpenCoop}
          onRespondInvite={handleRespondCoopInvite}
        />
      )}

      {/* Mobile / Tablet Touch Controls */}
      {showTouch && (
        <TouchControls
          key={hud.worldMode === 'open_world' ? 'open_world' : hud.levelId}
          inWater={hud.inWater}
          waterJumpCooldown={hud.waterJumpCooldown}
          layout={touchLayout}
          onMove={handleVirtualMove}
          onAutoRunChange={handleVirtualAutoRun}
          onJump={handleVirtualJump}
          onCameraDelta={handleVirtualCamDelta}
        />
      )}

      {/* Jumpscare / Eating Impact Peripheral Horror Vignette */}
      {phase === 'jumpscare' && (
        <div
          className="fixed inset-0 z-25 pointer-events-none"
          style={{
            background:
              deathReason === 'caught'
                ? 'radial-gradient(ellipse 68% 64% at 50% 48%, rgba(0,0,0,0) 24%, rgba(36,2,6,0.44) 68%, rgba(2,2,4,0.92) 100%), radial-gradient(circle at 50% 50%, rgba(165,12,18,0.06) 15%, rgba(110,0,8,0.34) 88%, rgba(6,0,2,0.85) 100%)'
                : 'radial-gradient(ellipse 68% 64% at 50% 50%, rgba(255,40,40,0.08) 18%, rgba(120,0,10,0.68) 82%, rgba(4,0,2,0.94) 100%)',
          }}
        />
      )}

      {/* Pause Menu */}
      {phase === 'paused' && !showCoop && !showLevels && !showSettings && !showTouchCustomizer && (
        <PauseModal
          levelCode={currentLevel.code}
          levelName={isOpenWorldHud && pauseRegionMeta ? pauseRegionMeta.name : currentLevel.name}
          isOpenWorld={isOpenWorldHud}
          regionId={hud.regionId ?? hud.levelId}
          checkpointLabel={hud.checkpointLabel}
          coopSessionCode={coopSession?.sessionCode ?? null}
          coopPlayerCount={coopSession?.players.length ?? 0}
          onOpenCoop={handleOpenCoop}
          onLeaveCoop={handleLeaveCoopSession}
          onResume={handleResume}
          onRestart={handleRestart}
          onSettings={handleOpenSettings}
          onLevels={handleOpenLevelsFromPause}
          onQuitMenu={handleQuitToMenu}
        />
      )}

      {/* Single-player Game Over */}
      {phase === 'gameover' && !showLevels && (
        <GameOverModal
          reason={deathReason}
          levelCode={isOpenWorldHud ? `OW · R${String(hud.regionId ?? 1).padStart(2, '0')}` : currentLevel.code}
          levelName={isOpenWorldHud && pauseRegionMeta ? pauseRegionMeta.name : currentLevel.name}
          hasCheckpoint={isOpenWorldHud || hud.checkpointIndex > 0}
          onRetry={handleRestart}
          onCheckpoint={handleRespawnCheckpoint}
          onLevels={handleOpenLevels}
          onMenu={handleQuitToMenu}
        />
      )}

      {/* Single-player Victory */}
      {phase === 'victory' && !showLevels && (
        <VictoryModal
          level={currentLevel}
          elapsed={victoryElapsed}
          hasNextLevel={currentLevel.id < TOTAL_LEVELS}
          onNextLevel={() => handleStartLevel(currentLevel.id + 1)}
          onReplay={handleRestart}
          onLevels={handleOpenLevels}
        />
      )}

      {/* Co-Op Lobby Modal */}
      {showCoop && (
        <CoopModal
          status={coopStatus}
          pendingAction={coopPendingAction}
          serverUrl={coopServerUrl}
          initialJoinCode={initialCoopParams.joinCode}
          localPlayerId={coopPlayerId}
          localFriendCode={coopFriendCode}
          localName={coopName}
          session={coopSession}
          onlineUsers={coopOnlineUsers}
          pendingInvites={coopInvites}
          errorBanner={coopError}
          noticeBanner={coopNotice}
          inActiveCoopPlay={Boolean(coopSession && isOpenWorldHud)}
          onNameChange={handleCoopNameChange}
          onSaveServerUrl={handleSaveCoopServerUrl}
          onReconnect={handleReconnectCoop}
          onCreateSession={handleCreateCoopSession}
          onJoinSessionByCode={handleJoinCoopByCode}
          onLeaveSession={handleLeaveCoopSession}
          onEnterCoopWorld={handleEnterCoopWorld}
          onInviteByFriendCode={handleInviteByFriendCode}
          onInviteUser={handleInviteUser}
          onRespondInvite={handleRespondCoopInvite}
          onDismissError={() => setCoopError(null)}
          onClose={handleCloseCoop}
        />
      )}

      {/* Level Select Modal */}
      {showLevels && (
        <LevelSelectModal
          saveData={saveData}
          onSelect={handleStartLevel}
          onClose={handleCloseLevels}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          settings={settings}
          activeQuality={hud.activeQuality}
          characterId={characterId}
          onCharacterChange={handleCharacterChange}
          showCustomizeControls={isTouchDevice || settings.touchControls !== 'off'}
          onOpenCustomizeControls={handleOpenCustomizeControls}
          onChange={handleSettingsChange}
          onClose={handleCloseSettings}
        />
      )}

      {/* Mobile Touch Controls Customizer */}
      {showTouchCustomizer && (
        <TouchControlsCustomizer
          savedLayout={touchLayout}
          onSave={handleSaveTouchLayout}
          onCancel={handleCancelTouchLayout}
        />
      )}

      {/* Smooth Scene & Asset Preload Transition Overlay */}
      <LoadingOverlay
        visible={loadingOverlay.visible}
        fadingOut={loadingOverlay.fadingOut}
        progress={loadingOverlay.progress}
        label={loadingOverlay.label}
        sublabel={loadingOverlay.sublabel}
      />

      {/* Mandatory Mobile Landscape-Only Enforcement Guard */}
      <LandscapeGuard onPortraitBlockChange={setIsPortraitBlocked} />
    </div>
  );
}
