import type { PlayerAnimState } from '../game/entities.ts';
import type { CharacterId } from '../game/types.ts';
import {
  deriveFriendCode,
  sanitizePlayerName,
  type CoopCheckpointConfirmedPayload,
  type CoopClientMessage,
  type CoopConnectionStatus,
  type CoopInvite,
  type CoopOnlineUser,
  type CoopPlatform,
  type CoopPlayerEatenBroadcast,
  type CoopPlayerMoveBroadcast,
  type CoopPlayerSnapshot,
  type CoopRespawnPayload,
  type CoopServerMessage,
  type CoopSessionSnapshot,
} from './types.ts';

export interface CoopClientCallbacks {
  onStatusChange?: (status: CoopConnectionStatus) => void;
  onWelcome?: (info: { playerId: string; friendCode: string; name: string; maxPlayers: number }) => void;
  onPresenceUpdate?: (users: CoopOnlineUser[]) => void;
  onInviteReceived?: (invite: CoopInvite) => void;
  onInviteSent?: (invite: CoopInvite) => void;
  onInviteDeclined?: (info: { inviteId: string; targetPlayerId: string; targetName: string }) => void;
  onSessionState?: (
    session: CoopSessionSnapshot,
    you: CoopPlayerSnapshot,
    reconnectRestore?: boolean
  ) => void;
  onPlayerJoined?: (player: CoopPlayerSnapshot, hostId: string) => void;
  onPlayerLeft?: (playerId: string, hostId: string) => void;
  onPlayerConnection?: (playerId: string, connected: boolean) => void;
  onPlayerMoved?: (move: CoopPlayerMoveBroadcast) => void;
  onCheckpointConfirmed?: (checkpoint: CoopCheckpointConfirmedPayload) => void;
  onPlayerCheckpoint?: (info: {
    playerId: string;
    checkpointId: string;
    checkpointRegionId: number;
    checkpointLabel: string;
  }) => void;
  onPlayerEaten?: (event: CoopPlayerEatenBroadcast) => void;
  onPlayerRespawn?: (respawn: CoopRespawnPayload) => void;
  onError?: (err: { code: string; message: string }) => void;
}

export interface CoopClientOptions {
  playerId: string;
  name: string;
  characterId: CharacterId;
  platform: CoopPlatform;
  wsUrl?: string;
  webSocketFactory?: (url: string) => WebSocket;
  callbacks?: CoopClientCallbacks;
}

export function resolveDefaultCoopWsUrl(): string {
  const envWs =
    typeof import.meta !== 'undefined' &&
    (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_WS_BASE_URL;
  if (envWs && typeof envWs === 'string' && envWs.trim()) {
    const trimmed = envWs.trim().replace(/\/+$/, '');
    return trimmed.endsWith('/coop') ? trimmed : `${trimmed}/coop`;
  }
  if (typeof window === 'undefined' || !window.location) {
    return 'ws://127.0.0.1:3000/ws/coop';
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws/coop`;
}

export function detectCoopPlatform(): CoopPlatform {
  if (typeof navigator === 'undefined') return 'pc';
  const ua = navigator.userAgent || '';
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return 'android';
  if (typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 1)) {
    return 'android';
  }
  return 'pc';
}

export class CoopClient {
  public readonly playerId: string;
  public friendCode: string;
  public name: string;
  public characterId: CharacterId;
  public platform: CoopPlatform;
  public status: CoopConnectionStatus = 'disconnected';
  public session: CoopSessionSnapshot | null = null;
  public lastKnownCheckpointId: string | null = null;
  public onlineUsers: CoopOnlineUser[] = [];

  private readonly wsUrl: string;
  private readonly webSocketFactory?: (url: string) => WebSocket;
  private callbacks: CoopClientCallbacks;
  private ws: WebSocket | null = null;
  private intentionallyClosed = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pendingCheckpoint: { checkpointId: string; x: number; y: number; z: number } | null = null;
  private pendingRespawnSeq: number | null = null;
  private pendingQueuedMessages: CoopClientMessage[] = [];

  constructor(options: CoopClientOptions) {
    this.playerId = options.playerId;
    this.friendCode = deriveFriendCode(options.playerId);
    this.name = sanitizePlayerName(options.name);
    this.characterId = options.characterId;
    this.platform = options.platform;
    this.wsUrl = options.wsUrl || resolveDefaultCoopWsUrl();
    this.webSocketFactory = options.webSocketFactory;
    this.callbacks = options.callbacks ?? {};
  }

  public setCallbacks(callbacks: CoopClientCallbacks): void {
    this.callbacks = callbacks;
  }

  public updateLocalProfile(next: { name?: string; characterId?: CharacterId }): void {
    if (next.name !== undefined) this.name = sanitizePlayerName(next.name);
    if (next.characterId !== undefined) this.characterId = next.characterId;
    this.send({
      type: 'update_profile',
      name: this.name,
      characterId: this.characterId,
    });
  }

  public connect(): void {
    if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)) {
      return;
    }
    this.intentionallyClosed = false;
    this.clearReconnectTimer();
    this.setStatus(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');

    const ws = this.webSocketFactory
      ? this.webSocketFactory(this.wsUrl)
      : new WebSocket(this.wsUrl);
    this.ws = ws;

    const handleOpen = () => {
      if (this.ws !== ws) return;
      this.reconnectAttempts = 0;
      this.setStatus('connected');
      this.startPing();

      if (this.session) {
        this.send({
          type: 'coop:reconnect_session',
          sessionId: this.session.sessionId,
          playerId: this.playerId,
          name: this.name,
          characterId: this.characterId,
          platform: this.platform,
          lastKnownCheckpointId: this.lastKnownCheckpointId,
        });
      } else {
        this.send({
          type: 'hello',
          playerId: this.playerId,
          name: this.name,
          characterId: this.characterId,
          platform: this.platform,
        });
      }
      if (this.pendingQueuedMessages.length > 0) {
        const queued = this.pendingQueuedMessages.splice(0);
        for (const qMsg of queued) {
          this.send(qMsg);
        }
      }
    };

    const handleMessage = (rawData: unknown) => {
      if (this.ws !== ws) return;
      try {
        const text =
          typeof rawData === 'string'
            ? rawData
            : rawData && typeof (rawData as { toString?: () => string }).toString === 'function'
              ? (rawData as { toString: () => string }).toString()
              : '';
        if (!text) return;
        const msg = JSON.parse(text) as CoopServerMessage;
        this.handleServerMessage(msg);
      } catch {
        // ignore malformed packets
      }
    };

    const handleClose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.stopPing();
      if (this.intentionallyClosed) {
        this.setStatus('disconnected');
        return;
      }
      this.scheduleReconnect();
    };

    if (typeof (ws as unknown as { addEventListener?: unknown }).addEventListener === 'function') {
      ws.addEventListener('open', handleOpen);
      ws.addEventListener('message', (ev) => handleMessage((ev as MessageEvent).data));
      ws.addEventListener('close', handleClose);
      ws.addEventListener('error', () => {
        // close event will trigger reconnect
      });
    } else {
      const nodeWs = ws as unknown as {
        on: (ev: string, cb: (...args: unknown[]) => void) => void;
      };
      nodeWs.on('open', handleOpen);
      nodeWs.on('message', (buf: unknown) => handleMessage(buf));
      nodeWs.on('close', handleClose);
      nodeWs.on('error', () => {
        // ignore
      });
    }
  }

  public disconnect(preserveSessionForReconnect = false): void {
    this.intentionallyClosed = true;
    this.clearReconnectTimer();
    this.stopPing();
    if (!preserveSessionForReconnect) {
      this.session = null;
      this.pendingCheckpoint = null;
      this.pendingRespawnSeq = null;
    }
    if (this.ws) {
      const sock = this.ws;
      this.ws = null;
      try {
        sock.close();
      } catch {
        // ignore
      }
    }
    this.setStatus('disconnected');
  }

  /**
   * Simulates or triggers a temporary network drop that automatically reconnects
   * and restores the active co-op session & independent checkpoint.
   */
  public forceReconnect(): void {
    if (this.ws) {
      const sock = this.ws;
      this.ws = null;
      this.stopPing();
      try {
        sock.close();
      } catch {
        // ignore
      }
    }
    this.intentionallyClosed = false;
    this.reconnectAttempts = 1;
    this.scheduleReconnect(60);
  }

  public createSession(savedCheckpointId?: string | null): void {
    this.connect();
    const msg: CoopClientMessage = {
      type: 'coop:create_session',
      savedCheckpointId: savedCheckpointId ?? this.lastKnownCheckpointId,
    };
    if (!this.send(msg)) {
      this.pendingQueuedMessages.push(msg);
    }
  }

  public joinSession(params: {
    sessionId?: string;
    sessionCode?: string;
    savedCheckpointId?: string | null;
  }): void {
    this.connect();
    const msg: CoopClientMessage = {
      type: 'coop:join_session',
      sessionId: params.sessionId,
      sessionCode: params.sessionCode,
      savedCheckpointId: params.savedCheckpointId ?? this.lastKnownCheckpointId,
    };
    if (!this.send(msg)) {
      this.pendingQueuedMessages.push(msg);
    }
  }

  public leaveSession(): void {
    this.pendingQueuedMessages = this.pendingQueuedMessages.filter(
      (m) => m.type !== 'coop:create_session' && m.type !== 'coop:join_session' && m.type !== 'coop:invite_friend'
    );
    this.send({ type: 'coop:leave_session' });
    this.session = null;
    this.pendingCheckpoint = null;
    this.pendingRespawnSeq = null;
  }

  public inviteFriend(target: { playerId?: string; friendCode?: string }): void {
    this.connect();
    const msg: CoopClientMessage = {
      type: 'coop:invite_friend',
      targetPlayerId: target.playerId,
      targetFriendCode: target.friendCode,
    };
    if (!this.send(msg)) {
      this.pendingQueuedMessages.push(msg);
    }
  }

  public respondToInvite(inviteId: string, accept: boolean, savedCheckpointId?: string | null): void {
    this.connect();
    const msg: CoopClientMessage = {
      type: 'coop:invite_respond',
      inviteId,
      accept,
      savedCheckpointId: savedCheckpointId ?? this.lastKnownCheckpointId,
    };
    if (!this.send(msg)) {
      this.pendingQueuedMessages.push(msg);
    }
  }

  public sendPlayerState(state: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    animState: PlayerAnimState;
    horizSpeed: number;
    regionId: number;
    inWater: boolean;
  }): void {
    this.send({
      type: 'coop:player_state',
      ...state,
    });
  }

  public sendActivateCheckpoint(checkpointId: string, x: number, y: number, z: number): void {
    this.lastKnownCheckpointId = checkpointId;
    if (!this.send({ type: 'coop:activate_checkpoint', checkpointId, x, y, z })) {
      this.pendingCheckpoint = { checkpointId, x, y, z };
    }
  }

  public sendPlayerEaten(payload: {
    deathSeq: number;
    monsterId: string;
    monsterX: number;
    monsterY: number;
    monsterZ: number;
    playerX: number;
    playerY: number;
    playerZ: number;
    playerYaw: number;
  }): void {
    this.send({
      type: 'coop:player_eaten',
      ...payload,
    });
  }

  public sendRequestRespawn(deathSeq: number): void {
    if (!this.send({ type: 'coop:request_respawn', deathSeq })) {
      this.pendingRespawnSeq = deathSeq;
    }
  }

  private send(msg: CoopClientMessage): boolean {
    if (!this.ws || this.ws.readyState !== 1) return false;
    this.ws.send(JSON.stringify(msg));
    return true;
  }

  private setStatus(next: CoopConnectionStatus): void {
    if (this.status === next) return;
    this.status = next;
    this.callbacks.onStatusChange?.(next);
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      this.send({ type: 'ping', t: Date.now() });
    }, 15000);
    if (typeof (this.pingTimer as unknown as { unref?: () => void }).unref === 'function') {
      (this.pingTimer as unknown as { unref: () => void }).unref();
    }
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private scheduleReconnect(overrideDelayMs?: number): void {
    this.clearReconnectTimer();
    const attempt = ++this.reconnectAttempts;
    const delayMs = overrideDelayMs ?? Math.min(4000, 320 * Math.pow(1.75, Math.min(5, attempt - 1)));
    this.setStatus('reconnecting');
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.intentionallyClosed) {
        this.connect();
      }
    }, delayMs);
    if (typeof (this.reconnectTimer as unknown as { unref?: () => void }).unref === 'function') {
      (this.reconnectTimer as unknown as { unref: () => void }).unref();
    }
  }

  private flushPendingOnSessionReady(): void {
    if (this.pendingCheckpoint) {
      const cp = this.pendingCheckpoint;
      this.pendingCheckpoint = null;
      this.send({ type: 'coop:activate_checkpoint', ...cp });
    }
    if (this.pendingRespawnSeq !== null) {
      const seq = this.pendingRespawnSeq;
      this.pendingRespawnSeq = null;
      this.send({ type: 'coop:request_respawn', deathSeq: seq });
    }
  }

  private handleServerMessage(msg: CoopServerMessage): void {
    switch (msg.type) {
      case 'welcome': {
        this.friendCode = msg.friendCode;
        this.name = msg.name;
        this.callbacks.onWelcome?.(msg);
        break;
      }

      case 'presence:update': {
        this.onlineUsers = msg.users;
        this.callbacks.onPresenceUpdate?.(msg.users);
        break;
      }

      case 'coop:invite_received': {
        this.callbacks.onInviteReceived?.(msg.invite);
        break;
      }

      case 'coop:invite_sent': {
        this.callbacks.onInviteSent?.(msg.invite);
        break;
      }

      case 'coop:invite_declined': {
        this.callbacks.onInviteDeclined?.(msg);
        break;
      }

      case 'coop:session_state': {
        this.session = msg.session;
        this.lastKnownCheckpointId = msg.you.checkpointId;
        this.flushPendingOnSessionReady();
        this.callbacks.onSessionState?.(msg.session, msg.you, msg.reconnectRestore);
        break;
      }

      case 'coop:player_joined': {
        if (this.session) {
          this.session.hostId = msg.hostId;
          const idx = this.session.players.findIndex((p) => p.playerId === msg.player.playerId);
          if (idx >= 0) {
            this.session.players[idx] = msg.player;
          } else {
            this.session.players.push(msg.player);
          }
        }
        this.callbacks.onPlayerJoined?.(msg.player, msg.hostId);
        break;
      }

      case 'coop:player_left': {
        if (this.session) {
          this.session.hostId = msg.hostId;
          this.session.players = this.session.players.filter((p) => p.playerId !== msg.playerId);
        }
        this.callbacks.onPlayerLeft?.(msg.playerId, msg.hostId);
        break;
      }

      case 'coop:player_connection': {
        if (this.session) {
          const p = this.session.players.find((pl) => pl.playerId === msg.playerId);
          if (p) p.connected = msg.connected;
        }
        this.callbacks.onPlayerConnection?.(msg.playerId, msg.connected);
        break;
      }

      case 'coop:player_moved': {
        if (this.session) {
          const p = this.session.players.find((pl) => pl.playerId === msg.move.playerId);
          if (p) {
            p.x = msg.move.x;
            p.y = msg.move.y;
            p.z = msg.move.z;
            p.yaw = msg.move.yaw;
            p.animState = msg.move.animState;
            p.horizSpeed = msg.move.horizSpeed;
            p.regionId = msg.move.regionId;
            p.inWater = msg.move.inWater;
            p.alive = msg.move.alive;
          }
        }
        this.callbacks.onPlayerMoved?.(msg.move);
        break;
      }

      case 'coop:checkpoint_confirmed': {
        this.lastKnownCheckpointId = msg.checkpoint.checkpointId;
        if (this.session) {
          const p = this.session.players.find((pl) => pl.playerId === msg.checkpoint.playerId);
          if (p) {
            p.checkpointId = msg.checkpoint.checkpointId;
            p.checkpointRegionId = msg.checkpoint.regionId;
            p.checkpointLabel = msg.checkpoint.label;
            p.checkpointX = msg.checkpoint.x;
            p.checkpointY = msg.checkpoint.y;
            p.checkpointZ = msg.checkpoint.z;
            p.checkpointYaw = msg.checkpoint.yaw;
          }
        }
        this.callbacks.onCheckpointConfirmed?.(msg.checkpoint);
        break;
      }

      case 'coop:player_checkpoint': {
        if (this.session) {
          const p = this.session.players.find((pl) => pl.playerId === msg.playerId);
          if (p) {
            p.checkpointId = msg.checkpointId;
            p.checkpointRegionId = msg.checkpointRegionId;
            p.checkpointLabel = msg.checkpointLabel;
          }
        }
        this.callbacks.onPlayerCheckpoint?.(msg);
        break;
      }

      case 'coop:player_eaten_broadcast': {
        if (this.session) {
          const p = this.session.players.find((pl) => pl.playerId === msg.event.playerId);
          if (p) {
            p.alive = false;
            p.deathSeq = msg.event.deathSeq;
          }
        }
        this.callbacks.onPlayerEaten?.(msg.event);
        break;
      }

      case 'coop:player_respawn': {
        if (this.session) {
          const p = this.session.players.find((pl) => pl.playerId === msg.respawn.playerId);
          if (p) {
            p.alive = true;
            p.deathSeq = Math.max(p.deathSeq, msg.respawn.deathSeq);
            p.x = msg.respawn.x;
            p.y = msg.respawn.y;
            p.z = msg.respawn.z;
            p.yaw = msg.respawn.yaw;
            p.regionId = msg.respawn.regionId;
            p.checkpointId = msg.respawn.checkpointId;
            p.checkpointRegionId = msg.respawn.checkpointRegionId;
            p.checkpointLabel = msg.respawn.checkpointLabel;
            p.checkpointX = msg.respawn.x;
            p.checkpointY = msg.respawn.y;
            p.checkpointZ = msg.respawn.z;
            p.checkpointYaw = msg.respawn.yaw;
          }
        }
        if (msg.respawn.playerId === this.playerId) {
          this.pendingRespawnSeq = null;
          this.lastKnownCheckpointId = msg.respawn.checkpointId;
        }
        this.callbacks.onPlayerRespawn?.(msg.respawn);
        break;
      }

      case 'coop:error': {
        if (msg.code === 'SESSION_EXPIRED' || msg.code === 'SESSION_NOT_FOUND') {
          this.session = null;
        }
        this.callbacks.onError?.({ code: msg.code, message: msg.message });
        break;
      }

      case 'pong':
        break;
    }
  }
}
