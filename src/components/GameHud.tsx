import React from 'react';
import { Pause, Users, Volume2, VolumeX } from 'lucide-react';
import type { CoopInvite, CoopSessionSnapshot } from '../coop/types';
import { HudSnapshot } from '../game/types';

interface GameHudProps {
  hud: HudSnapshot;
  muted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  coopSession?: CoopSessionSnapshot | null;
  localPlayerId?: string;
  pendingInvites?: CoopInvite[];
  onOpenCoop?: () => void;
  onRespondInvite?: (inviteId: string, accept: boolean) => void;
}

function formatTimer(sec: number): string {
  const clamped = Math.max(0, sec);
  const mins = Math.floor(clamped / 60);
  const secs = Math.floor(clamped % 60);
  const tenths = Math.floor((clamped % 1) * 10);
  return `${mins}:${secs.toString().padStart(2, '0')}.${tenths}`;
}

export const GameHud: React.FC<GameHudProps> = React.memo(
  ({
    hud,
    muted,
    onToggleMute,
    onPause,
    coopSession = null,
    localPlayerId,
    pendingInvites = [],
    onOpenCoop,
    onRespondInvite,
  }) => {
    const isOpenWorld = hud.worldMode === 'open_world';
    const isCoop = Boolean(coopSession && isOpenWorld);
    const isUrgent = !isOpenWorld && hud.timeRemaining <= 15;
    const dangerRatio =
      hud.monsterDist < 22 ? Math.max(0, Math.min(1, 1 - (hud.monsterDist - 3) / 19)) : 0;
    const remoteTeammates = coopSession
      ? coopSession.players.filter((p) => p.playerId !== localPlayerId).slice(0, 5)
      : [];
    const latestInvite = pendingInvites.length > 0 ? pendingInvites[0] : null;

    return (
      <div className="fixed inset-0 pointer-events-none z-10 overflow-hidden">
        {/* Underwater or Monster Danger Edge Vignette (pure CSS gradient, no backdrop-filter) */}
        <div
          className="absolute inset-0 transition-opacity duration-200"
          style={{
            opacity: hud.underwater ? 0.85 : dangerRatio * 0.75,
            background: hud.underwater
              ? 'radial-gradient(circle at center, rgba(14,48,54,0.12) 35%, rgba(6,24,29,0.82) 100%)'
              : 'radial-gradient(circle at center, transparent 52%, rgba(135,18,22,0.58) 100%)',
          }}
        />

        {/* Top-Left: Status Cluster & Action Icons */}
        <div
          className="absolute flex flex-col gap-1 sm:gap-1.5"
          style={{
            top: 'max(0.5rem, env(safe-area-inset-top))',
            left: 'max(0.625rem, env(safe-area-inset-left))',
          }}
        >
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <button
              type="button"
              onClick={onPause}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-md bg-[#0c1315]/85 border border-[#495c61]/70 hover:border-[#9ec5c8] text-[#dce8ea] flex items-center justify-center transition-colors cursor-pointer"
              title="Pause (ESC)"
            >
              <Pause className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onToggleMute}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-md bg-[#0c1315]/85 border border-[#495c61]/70 hover:border-[#9ec5c8] text-[#dce8ea] flex items-center justify-center transition-colors cursor-pointer"
              title={muted ? 'Unmute Audio' : 'Mute Audio'}
            >
              {muted ? (
                <VolumeX className="w-3.5 h-3.5 text-[#e0746a]" />
              ) : (
                <Volume2 className="w-3.5 h-3.5" />
              )}
            </button>
            <div className="px-2 py-1 rounded-md bg-[#0c1315]/85 border border-[#3a4a4e]/70 text-[10px] sm:text-[11px] font-mono tracking-wider text-[#9db4b9]">
              {isCoop
                ? `CO-OP · R${String(hud.regionId ?? 1).padStart(2, '0')}`
                : isOpenWorld
                  ? `OW · R${String(hud.regionId ?? 1).padStart(2, '0')}`
                  : hud.levelCode}
              <span className="hidden md:inline">
                {' '}· {(isOpenWorld ? hud.wingTitle || hud.levelName : hud.levelName).toUpperCase()}
              </span>
            </div>
          </div>

          {/* Stamina & Threat Bars */}
          <div className="w-32 sm:w-40 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-md bg-[#0c1315]/80 border border-[#314044]/70 flex flex-col gap-0.5 sm:gap-1">
            <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-mono text-[#96aeb3]">
              <span>STAMINA</span>
              <span className="tabular-nums">{hud.stamina}%</span>
            </div>
            <div className="h-1 w-full rounded-full bg-[#1a2528] overflow-hidden">
              <div
                className="h-full transition-all duration-100"
                style={{
                  width: `${hud.stamina}%`,
                  backgroundColor: hud.stamina < 25 ? '#d96b52' : '#7dd3c8',
                }}
              />
            </div>

            <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-mono pt-0.5">
              <span className="text-[#879ea3]">
                {hud.inWater ? 'SWIMMING' : 'DRY'}
              </span>
              <span
                className="font-semibold"
                style={{
                  color:
                    hud.monsterAlert === 'chasing'
                      ? '#f06868'
                      : hud.monsterAlert === 'searching'
                        ? '#e8b354'
                        : '#7fa1a8',
                }}
              >
                {hud.monsterAlert === 'chasing'
                  ? 'HUNTING'
                  : hud.monsterAlert === 'searching'
                    ? 'ALERTED'
                    : `${hud.monsterDist}M`}
              </span>
            </div>

            {hud.inWater && (
              <div className="flex flex-col gap-0.5 pt-0.5">
                <div className="flex items-center justify-between text-[9px] font-mono">
                  <span className="text-[#879ea3]">WATER JUMP</span>
                  <span
                    className="tabular-nums font-semibold"
                    style={{
                      color: hud.waterJumpCooldown > 0.05 ? '#e8b354' : '#7dd3c8',
                    }}
                  >
                    {hud.waterJumpCooldown > 0.05
                      ? `${hud.waterJumpCooldown.toFixed(1)}S`
                      : 'READY'}
                  </span>
                </div>
                <div className="h-1 w-full rounded-full bg-[#1a2528] overflow-hidden">
                  <div
                    className="h-full transition-all duration-75"
                    style={{
                      width: `${Math.max(0, Math.min(100, (1 - hud.waterJumpCooldown / 2) * 100))}%`,
                      backgroundColor: hud.waterJumpCooldown > 0.05 ? '#e8b354' : '#7dd3c8',
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Top-Center: Countdown / Elapsed Timer */}
        <div
          className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
          style={{ top: 'max(0.5rem, env(safe-area-inset-top))' }}
        >
          <div
            className={`px-2.5 py-0.5 sm:px-3.5 sm:py-1 rounded-md sm:rounded-lg border font-mono text-sm sm:text-lg font-bold tracking-wider tabular-nums shadow-lg ${
              isUrgent
                ? 'bg-[#2b1012]/90 border-[#e05252] text-[#ff9e9e]'
                : 'bg-[#0c1315]/85 border-[#415358]/80 text-[#e4f0f2]'
            }`}
          >
            {formatTimer(isOpenWorld ? hud.timeElapsed : hud.timeRemaining)}
          </div>
          {isOpenWorld ? (
            <div className="px-1.5 py-0.5 rounded bg-[#0c1315]/80 border border-[#314044]/70 text-[9px] sm:text-[10px] font-mono text-[#8eb3ba] tabular-nums max-w-[240px] truncate">
              {isCoop ? 'CO-OP' : 'OPEN WORLD'} · {(hud.checkpointLabel || 'REGION 01 DOCK').toUpperCase()}
            </div>
          ) : (
            hud.totalCheckpoints > 0 && (
              <div className="px-1.5 py-0.5 rounded bg-[#0c1315]/80 border border-[#314044]/70 text-[9px] sm:text-[10px] font-mono text-[#8eb3ba] tabular-nums">
                CP {hud.checkpointIndex}/{hud.totalCheckpoints}
              </div>
            )
          )}
        </div>

        {/* Top-Right: Mouse Look Hint + Compact Co-Op Squad Strip & Incoming Invite Toast */}
        <div
          className="absolute flex flex-col items-end gap-1"
          style={{
            top: 'max(0.5rem, env(safe-area-inset-top))',
            right: 'max(0.625rem, env(safe-area-inset-right))',
          }}
        >
          <div className="hidden lg:flex px-2.5 py-1 rounded-md bg-[#0c1315]/75 border border-[#314044]/60 text-[10px] font-mono text-[#8ca3a8]">
            {hud.isPointerLocked ? 'ESC TO PAUSE' : 'CLICK SCENE OR DRAG TO LOOK'}
          </div>

          {isCoop && coopSession && (
            <div className="pointer-events-auto flex flex-col items-end gap-1">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={onOpenCoop}
                  className="px-2 py-1 rounded-md bg-[#0c1315]/88 border border-[#365a62] hover:border-[#52e0b6] text-[10px] font-mono text-[#c5e5ea] flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <Users className="w-3 h-3 text-[#52e0b6]" />
                  <span>JOIN CODE: {coopSession.sessionCode}</span>
                  <span className="text-[#85a8b0] tabular-nums">
                    {coopSession.players.length}/{coopSession.maxPlayers}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      void navigator.clipboard?.writeText(coopSession.sessionCode);
                    } catch {
                      // ignore clipboard restrictions
                    }
                  }}
                  title="Copy Join Code"
                  className="px-1.5 py-1 rounded-md bg-[#0c1315]/88 border border-[#365a62] hover:border-[#52e0b6] text-[9.5px] font-mono uppercase text-[#8ef5d5] cursor-pointer"
                >
                  Copy
                </button>
              </div>

              {remoteTeammates.length > 0 && (
                <div className="hidden sm:flex flex-col items-end gap-0.5 px-2 py-1 rounded-md bg-[#0c1315]/80 border border-[#2a3b40]">
                  {remoteTeammates.map((p) => (
                    <div
                      key={p.playerId}
                      className="flex items-center gap-1.5 text-[9.5px] font-mono text-[#b7cfd4] tabular-nums"
                    >
                      <span
                        className="w-2 h-2 rounded-xs shrink-0"
                        style={{ backgroundColor: p.colorHex }}
                      />
                      <span className="max-w-[84px] truncate">{p.name}</span>
                      <span className="text-[#78969d]">R{String(p.regionId).padStart(2, '0')}</span>
                      {!p.connected && <span className="text-[#e8b354]">OFF</span>}
                      {p.connected && !p.alive && <span className="text-[#e0746a]">EATEN</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {latestInvite && onRespondInvite && (
            <div className="pointer-events-auto px-2.5 py-1.5 rounded-md bg-[#0e1e1c]/95 border border-[#3c8d74] flex items-center gap-2 shadow-lg">
              <div className="text-[10px] font-mono text-[#d9f7ee]">
                INVITE: <span className="font-bold">{latestInvite.hostName}</span>
              </div>
              <button
                type="button"
                onClick={() => onRespondInvite(latestInvite.inviteId, true)}
                className="px-1.5 py-0.5 rounded bg-[#52e0b6] hover:bg-[#6ef0c8] text-[#071113] font-bold text-[9.5px] font-mono uppercase cursor-pointer"
              >
                Join
              </button>
              <button
                type="button"
                onClick={() => onRespondInvite(latestInvite.inviteId, false)}
                className="px-1.5 py-0.5 rounded bg-[#231517] border border-[#5e3439] text-[#f2b3b9] text-[9.5px] font-mono uppercase cursor-pointer"
              >
                No
              </button>
            </div>
          )}
        </div>

        {/* Transient Checkpoint Banner */}
        {hud.checkpointNotice && (
          <div className="absolute top-14 sm:top-16 left-1/2 -translate-x-1/2 px-3 py-1 rounded-md bg-[#102923]/92 border border-[#4ef2b8]/80 text-[#9cf7d7] font-mono text-[10px] sm:text-[11px] tracking-widest uppercase shadow-lg">
            {hud.checkpointNotice}
          </div>
        )}
      </div>
    );
  }
);
