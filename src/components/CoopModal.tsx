import React, { useState } from 'react';
import {
  Check,
  Copy,
  LogOut,
  Play,
  RefreshCw,
  Send,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type {
  CoopConnectionStatus,
  CoopInvite,
  CoopOnlineUser,
  CoopSessionSnapshot,
} from '../coop/types';

interface CoopModalProps {
  status: CoopConnectionStatus;
  localPlayerId: string;
  localFriendCode: string;
  localName: string;
  session: CoopSessionSnapshot | null;
  onlineUsers: CoopOnlineUser[];
  pendingInvites: CoopInvite[];
  errorBanner: string | null;
  noticeBanner: string | null;
  inActiveCoopPlay: boolean;
  onNameChange: (name: string) => void;
  onReconnect: () => void;
  onCreateSession: () => void;
  onJoinSessionByCode: (sessionCode: string) => void;
  onLeaveSession: () => void;
  onEnterCoopWorld: () => void;
  onInviteByFriendCode: (friendCode: string) => void;
  onInviteUser: (playerId: string) => void;
  onRespondInvite: (inviteId: string, accept: boolean) => void;
  onDismissError: () => void;
  onClose: () => void;
}

export const CoopModal: React.FC<CoopModalProps> = React.memo(({
  status,
  localPlayerId,
  localFriendCode,
  localName,
  session,
  onlineUsers,
  pendingInvites,
  errorBanner,
  noticeBanner,
  inActiveCoopPlay,
  onNameChange,
  onReconnect,
  onCreateSession,
  onJoinSessionByCode,
  onLeaveSession,
  onEnterCoopWorld,
  onInviteByFriendCode,
  onInviteUser,
  onRespondInvite,
  onDismissError,
  onClose,
}) => {
  const [nameDraft, setNameDraft] = useState(localName);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [friendCodeInput, setFriendCodeInput] = useState('');
  const [copiedKey, setCopiedKey] = useState<'friend' | 'session' | null>(null);

  const handleCopy = (value: string, kind: 'friend' | 'session') => {
    try {
      void navigator.clipboard?.writeText(value);
      setCopiedKey(kind);
      window.setTimeout(() => setCopiedKey((cur) => (cur === kind ? null : cur)), 1400);
    } catch {
      // ignore clipboard errors inside restricted iframes
    }
  };

  const commitName = () => {
    const trimmed = nameDraft.trim();
    if (trimmed.length >= 2 && trimmed !== localName) {
      onNameChange(trimmed);
    } else if (trimmed.length < 2) {
      setNameDraft(localName);
    }
  };

  const otherOnlineUsers = onlineUsers.filter((u) => u.playerId !== localPlayerId);
  const statusLabel =
    status === 'connected'
      ? 'CONNECTED'
      : status === 'reconnecting'
        ? 'RECONNECTING'
        : status === 'connecting'
          ? 'CONNECTING'
          : 'OFFLINE';

  const statusColor =
    status === 'connected'
      ? '#52e0b6'
      : status === 'disconnected'
        ? '#e0746a'
        : '#e8b354';

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-2.5 sm:p-4 bg-[#070b0d]/92">
      <div className="w-full max-w-3xl max-h-[92dvh] overflow-y-auto rounded-xl bg-[#0e1518] border border-[#314247] p-3.5 sm:p-5 flex flex-col gap-3 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-[#233236] pb-2.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#52e0b6] shrink-0" />
              <h2 className="text-sm sm:text-base font-bold tracking-wider uppercase text-[#e6f1f3] truncate">
                Co-Op Open World · Facility 09
              </h2>
            </div>
            <div className="mt-0.5 text-[10px] font-mono tracking-wider text-[#88a4ab] flex flex-wrap items-center gap-1.5">
              <span style={{ color: statusColor }}>{statusLabel}</span>
              <span>·</span>
              <span>UP TO 6 SURVIVORS</span>
              <span>·</span>
              <span>INDEPENDENT CHECKPOINTS</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {status !== 'connected' && (
              <button
                type="button"
                onClick={onReconnect}
                className="px-2.5 py-1.5 rounded-md bg-[#152125] hover:bg-[#1e2f34] border border-[#384b50] text-[10px] font-mono uppercase text-[#bce3dc] flex items-center gap-1 whitespace-nowrap cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-[#152125] hover:bg-[#1e2e33] text-[#9cb3b8] cursor-pointer"
              aria-label="Close Co-Op Lobby"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Transient status / error banners */}
        {(errorBanner || noticeBanner) && (
          <div className="flex flex-col gap-1.5">
            {errorBanner && (
              <div className="px-3 py-1.5 rounded-lg bg-[#291316] border border-[#6e333a] text-[#ffbfc4] text-[11px] font-mono flex items-center justify-between gap-2">
                <span>{errorBanner}</span>
                <button
                  type="button"
                  onClick={onDismissError}
                  className="text-[#ff9ea7] hover:text-white cursor-pointer"
                  aria-label="Dismiss error"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {noticeBanner && (
              <div className="px-3 py-1.5 rounded-lg bg-[#102923] border border-[#36886f] text-[#a7f7dc] text-[11px] font-mono">
                {noticeBanner}
              </div>
            )}
          </div>
        )}

        {/* Profile & Friend Code Row */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 p-2.5 rounded-lg bg-[#0a1012] border border-[#223035]">
          <div className="sm:col-span-7 flex flex-col gap-1">
            <label className="text-[10px] font-mono uppercase tracking-wider text-[#7e9ba2]">
              Survivor Callsign
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={nameDraft}
                maxLength={18}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  }
                }}
                placeholder="Survivor"
                className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md bg-[#121c1f] border border-[#33454b] text-xs text-[#e7f3f5] focus:outline-none focus:border-[#52e0b6]"
              />
              <button
                type="button"
                onClick={commitName}
                className="px-2.5 py-1.5 rounded-md bg-[#162428] hover:bg-[#1f3339] border border-[#395057] text-[10px] font-mono uppercase text-[#cde2e6] whitespace-nowrap cursor-pointer"
              >
                Apply
              </button>
            </div>
          </div>

          <div className="sm:col-span-5 flex flex-col gap-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#7e9ba2]">
              Your Friend Code
            </span>
            <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-[#121c1f] border border-[#33454b]">
              <span className="font-mono text-xs font-bold tracking-widest text-[#52e0b6] tabular-nums">
                {localFriendCode}
              </span>
              <button
                type="button"
                onClick={() => handleCopy(localFriendCode, 'friend')}
                className="text-[10px] font-mono uppercase text-[#9eb8be] hover:text-white flex items-center gap-1 whitespace-nowrap cursor-pointer"
              >
                {copiedKey === 'friend' ? (
                  <>
                    <Check className="w-3 h-3 text-[#52e0b6]" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Two-column main workspace */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Left Column: Session Controls or Active Squad */}
          <div className="md:col-span-7 flex flex-col gap-2.5 p-3 rounded-lg bg-[#0b1214] border border-[#243439]">
            {!session ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-[#9db6bc]">
                    Co-Op Session
                  </span>
                  <span className="text-[10px] font-mono text-[#739198]">OPEN WORLD R01–R100</span>
                </div>

                <button
                  type="button"
                  onClick={onCreateSession}
                  className="w-full py-2.5 px-3 rounded-lg bg-[#52e0b6] hover:bg-[#6ef0c8] text-[#071113] font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Create Co-Op Session
                </button>

                <div className="pt-1 border-t border-[#1d2a2e] flex flex-col gap-1.5">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-[#7e9ba2]">
                    Join by 6-Character Session Code
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={joinCodeInput}
                      maxLength={8}
                      onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && joinCodeInput.trim().length >= 4) {
                          onJoinSessionByCode(joinCodeInput.trim());
                        }
                      }}
                      placeholder="E.G. K7M9Q2"
                      className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md bg-[#121c1f] border border-[#33454b] font-mono text-xs uppercase tracking-widest text-[#e7f3f5] placeholder:text-[#557077] focus:outline-none focus:border-[#52e0b6]"
                    />
                    <button
                      type="button"
                      disabled={joinCodeInput.trim().length < 4}
                      onClick={() => onJoinSessionByCode(joinCodeInput.trim())}
                      className="px-3.5 py-1.5 rounded-md bg-[#162925] hover:bg-[#1f3b35] disabled:opacity-45 disabled:cursor-not-allowed border border-[#3a806c] text-xs font-bold uppercase tracking-wider text-[#8ef5d5] whitespace-nowrap cursor-pointer"
                    >
                      Join
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase text-[#7e9ba2]">
                      Session Code
                    </span>
                    <span className="font-mono text-sm font-bold tracking-widest text-[#52e0b6] tabular-nums">
                      {session.sessionCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(session.sessionCode, 'session')}
                      className="px-1.5 py-0.5 rounded bg-[#142024] hover:bg-[#1d2d32] border border-[#31444a] text-[10px] font-mono text-[#b3ccd1] flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'session' ? (
                        <Check className="w-3 h-3 text-[#52e0b6]" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      {copiedKey === 'session' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <span className="text-[10px] font-mono text-[#94b1b7] tabular-nums">
                    SQUAD {session.players.length}/{session.maxPlayers}
                  </span>
                </div>

                {/* Squad Roster */}
                <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto pr-0.5">
                  {session.players.map((p) => {
                    const isSelf = p.playerId === localPlayerId;
                    const isHost = p.playerId === session.hostId;
                    return (
                      <div
                        key={p.playerId}
                        className="px-2.5 py-1.5 rounded-md bg-[#10191c] border border-[#223136] flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-sm shrink-0"
                            style={{ backgroundColor: p.colorHex }}
                          />
                          <span className="font-semibold text-[#e6f1f3] truncate">
                            {p.name}
                            {isSelf ? ' (You)' : ''}
                          </span>
                          <span className="text-[10px] font-mono text-[#7fa0a8] uppercase shrink-0">
                            {isHost ? 'HOST · ' : ''}
                            {p.platform === 'android' ? 'MOBILE' : 'PC'}
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-[#94b0b6] shrink-0 tabular-nums">
                          {p.connected ? `R${String(p.regionId).padStart(2, '0')}` : 'RECONNECTING'}
                          {' · '}
                          <span className={p.alive ? 'text-[#52e0b6]' : 'text-[#e0746a]'}>
                            {p.alive ? 'ALIVE' : 'EATEN'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onEnterCoopWorld}
                    className="flex-1 min-w-[140px] py-2 px-3 rounded-lg bg-[#52e0b6] hover:bg-[#6ef0c8] text-[#071113] font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    {inActiveCoopPlay ? 'Resume Co-Op World' : 'Enter Co-Op World'}
                  </button>
                  <button
                    type="button"
                    onClick={onLeaveSession}
                    className="px-3 py-2 rounded-lg bg-[#231517] hover:bg-[#311d20] border border-[#5e3439] text-[#f2b3b9] font-semibold text-xs tracking-wider uppercase flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Leave
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Right Column: Invites & Online Survivors */}
          <div className="md:col-span-5 flex flex-col gap-2.5 p-3 rounded-lg bg-[#0b1214] border border-[#243439]">
            {/* Invite by Friend Code */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono uppercase tracking-wider text-[#7e9ba2]">
                Invite by Friend Code
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={friendCodeInput}
                  maxLength={12}
                  onChange={(e) => setFriendCodeInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && friendCodeInput.trim().length >= 4) {
                      onInviteByFriendCode(friendCodeInput.trim());
                      setFriendCodeInput('');
                    }
                  }}
                  placeholder="SRP-XXXXXX"
                  className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md bg-[#121c1f] border border-[#33454b] font-mono text-xs uppercase text-[#e7f3f5] placeholder:text-[#557077] focus:outline-none focus:border-[#52e0b6]"
                />
                <button
                  type="button"
                  disabled={friendCodeInput.trim().length < 4}
                  onClick={() => {
                    onInviteByFriendCode(friendCodeInput.trim());
                    setFriendCodeInput('');
                  }}
                  className="px-2.5 py-1.5 rounded-md bg-[#162428] hover:bg-[#1f3339] disabled:opacity-45 disabled:cursor-not-allowed border border-[#3a5259] text-xs font-semibold uppercase text-[#d8ecef] flex items-center gap-1 whitespace-nowrap cursor-pointer"
                >
                  <Send className="w-3 h-3" />
                  Send
                </button>
              </div>
            </div>

            {/* Incoming Invites */}
            {pendingInvites.length > 0 && (
              <div className="flex flex-col gap-1.5 border-t border-[#1d2a2e] pt-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#8ef5d5]">
                  Incoming Invites ({pendingInvites.length})
                </span>
                <div className="flex flex-col gap-1 max-h-28 overflow-y-auto">
                  {pendingInvites.map((inv) => (
                    <div
                      key={inv.inviteId}
                      className="p-2 rounded-md bg-[#102420] border border-[#2f7560] flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#e6faf3] truncate">
                          {inv.hostName}
                        </div>
                        <div className="text-[10px] font-mono text-[#8bd9c0]">
                          CODE {inv.sessionCode}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onRespondInvite(inv.inviteId, true)}
                          className="px-2 py-1 rounded bg-[#52e0b6] hover:bg-[#6ef0c8] text-[#071113] font-bold text-[10px] uppercase cursor-pointer"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => onRespondInvite(inv.inviteId, false)}
                          className="px-2 py-1 rounded bg-[#231517] hover:bg-[#311d20] border border-[#5e3439] text-[#f2b3b9] font-semibold text-[10px] uppercase cursor-pointer"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Live Online Survivors */}
            <div className="flex flex-col gap-1.5 border-t border-[#1d2a2e] pt-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#7e9ba2]">
                  Online Survivors
                </span>
                <span className="text-[10px] font-mono text-[#739198] tabular-nums">
                  {otherOnlineUsers.length} ONLINE
                </span>
              </div>
              {otherOnlineUsers.length === 0 ? (
                <div className="py-3 text-center text-[11px] font-mono text-[#627e85]">
                  Share your Friend Code or Session Code to invite teammates.
                </div>
              ) : (
                <div className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-0.5">
                  {otherOnlineUsers.map((u) => {
                    const alreadyInSession = Boolean(
                      session && session.players.some((p) => p.playerId === u.playerId)
                    );
                    return (
                      <div
                        key={u.playerId}
                        className="px-2 py-1.5 rounded-md bg-[#10191c] border border-[#223136] flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-[#dce9ec] truncate">
                            {u.name}
                          </div>
                          <div className="text-[9.5px] font-mono text-[#7a9aa2] tabular-nums">
                            {u.friendCode} · {u.platform === 'android' ? 'MOBILE' : 'PC'}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={alreadyInSession}
                          onClick={() => onInviteUser(u.playerId)}
                          className="px-2 py-1 rounded bg-[#152528] hover:bg-[#1f373c] disabled:opacity-45 disabled:cursor-not-allowed border border-[#36535a] text-[10px] font-mono uppercase text-[#9cebd4] flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          <UserPlus className="w-3 h-3" />
                          {alreadyInSession ? 'Joined' : 'Invite'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
