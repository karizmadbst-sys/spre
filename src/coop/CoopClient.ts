import type { CharacterId } from '../game/types.ts';
import {
  deriveFriendCode,
  sanitizePlayerName,
  type CoopAnimState,
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

export type CoopPendingAction = 'create' | 'join' | 'invite' | null;

export interface CoopClientCallbacks {
  onStatusChange?: (status: CoopConnectionStatus) => void;
  onPendingActionChange?: (action: CoopPendingAction) => void;
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
  connectTimeoutMs?: number;
  actionTimeoutMs?: number;
  webSocketFactory?: (url: string) => WebSocket;
  callbacks?: CoopClientCallbacks;
}

export const STORAGE_COOP_SERVER_URL_KEY = 'serpentis_coop_server_url_v1';

export function normalizeCoopWsUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/\/+$/, '');
  if (!trimmed) return '';

  const withScheme = /^wss?:\/\//i.test(trimmed)
    ? trimmed
    : /^https:\/\//i.test(trimmed)
      ? trimmed.replace(/^https:\/\//i, 'wss://')
      : /^http:\/\//i.test(trimmed)
        ? trimmed.replace(/^http:\/\//i, 'ws://')
        : `wss://${trimmed}`;

  try {
    const parsed = new URL(withScheme);
    const cleanPath = parsed.pathname.replace(/\/+$/, '');
    if (!cleanPath || cleanPath === '/') {
      parsed.pathname = '/ws/coop';
    } else if (cleanPath === '/ws') {
      parsed.pathname = '/ws/coop';
    } else if (!cleanPath.endsWith('/ws/coop')) {
      parsed.pathname = `${cleanPath}/ws/coop`;
    }
    return parsed.toString();
  } catch {
    if (withScheme.endsWith('/ws/coop')) return withScheme;
    if (withScheme.endsWith('/ws')) return `${withScheme}/coop`;
    return `${withScheme}/ws/coop`;
  }
}

export function getStoredCoopServerUrl(): string {
  try {
    if (typeof localStorage === 'undefined') return '';
    return localStorage.getItem(STORAGE_COOP_SERVER_URL_KEY)?.trim() || '';
  } catch {
    return '';
  }
}

export function setStoredCoopServerUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  const normalized = trimmed ? normalizeCoopWsUrl(trimmed) : '';
  try {
    if (typeof localStorage !== 'undefined') {
      if (normalized) {
        localStorage.setItem(STORAGE_COOP_SERVER_URL_KEY, normalized);
      } else {
        localStorage.removeItem(STORAGE_COOP_SERVER_URL_KEY);
      }
    }
  } catch {
    // ignore storage errors
  }
  return normalized;
}

export function isPackagedNativeHost(): boolean {
  if (typeof window === 'undefined' || !window.location) return false;
  const host = (window.location.hostname || '').toLowerCase();
  const proto = (window.location.protocol || '').toLowerCase();
  if (proto === 'capacitor:' || proto === 'tauri:' || proto === 'file:') return true;
  if (host === 'tauri.localhost') return true;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) {
    return true;
  }
  return false;
}

export function resolveDefaultCoopWsUrl(): string {
  const stored = getStoredCoopServerUrl();
  if (stored) {
    return normalizeCoopWsUrl(stored);
  }

  const metaEnv =
    typeof import.meta !== 'undefined'
      ? (import.meta as { env?: Record<string, string | undefined> }).env
      : undefined;
  const envWs = metaEnv?.VITE_WS_BASE_URL;
  if (envWs && typeof envWs === 'string' && envWs.trim()) {
    return normalizeCoopWsUrl(envWs);
  }
  const envApi = metaEnv?.VITE_API_BASE_URL;
  if (envApi && typeof envApi === 'string' && envApi.trim()) {
    return normalizeCoopWsUrl(envApi);
  }

  if (typeof window === 'undefined' || !window.location) {
    return 'ws://127.0.0.1:3000/ws/coop';
  }
  if (isPackagedNativeHost()) {
    return '';
  }
  if (window.location.protocol !== 'http:' && window.location.protocol !== 'https:') {
    return '';
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
  public pendingAction: CoopPendingAction = null;
  public session: CoopSessionSnapshot | null = null;
  public lastKnownCheckpointId: string | null = null;
  public onlineUsers: CoopOnlineUser[] = [];

  private wsUrl: string;
  private readonly connectTimeoutMs: number;
  private readonly actionTimeoutMs: number;
  private readonly webSocketFactory?: (url: string) => WebSocket;
  private callbacks: CoopClientCallbacks;
  private ws: WebSocket | null = null;
  private intentionallyClosed = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private actionTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pendingCheckpoint: { checkpointId: string; x: number; y: number; z: number } | null = null;
  private pendingRespawnSeq: number | null = null;
  private pendingQueuedMessages: CoopClientMessage[] = [];
  private openedSinceAttempt = false;
  private reportedConnectionError = false;

  constructor(options: CoopClientOptions) {
    this.playerId = options.playerId;
    this.friendCode = deriveFriendCode(options.playerId);
    this.name = sanitizePlayerName(options.name);
    this.characterId = options.characterId;
    this.platform = options.platform;
    this.wsUrl = options.wsUrl ? normalizeCoopWsUrl(options.wsUrl) : resolveDefaultCoopWsUrl();
    this.connectTimeoutMs = Math.max(1500, options.connectTimeoutMs ?? 7000);
    this.actionTimeoutMs = Math.max(2000, options.actionTimeoutMs ?? 8500);
    this.webSocketFactory = options.webSocketFactory;
    this.callbacks = options.callbacks ?? {};
  }

  public getWsUrl(): string {
    return this.wsUrl;
  }

  public setCallbacks(callbacks: CoopClientCallbacks): void {
    this.callbacks = callbacks;
  }

  public setWsUrl(nextRawUrl: string): string {
    const normalized = nextRawUrl.trim() ? normalizeCoopWsUrl(nextRawUrl) : resolveDefaultCoopWsUrl();
    this.wsUrl = normalized;
    this.reportedConnectionError = false;
    this.reconnectAttempts = 0;
    if (this.ws) {
      const sock = this.ws;
      this.ws = null;
      this.stopPing();
      this.clearConnectTimeout();
      try {
        sock.close();
      } catch {
        // ignore
      }
    }
    if (this.wsUrl) {
      this.connect();
    } else {
      this.setStatus('disconnected');
    }
    return this.wsUrl;
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
    if (!this.wsUrl) {
      this.clearPendingAction();
      this.setStatus('disconnected');
      if (!this.reportedConnectionError) {
        this.reportedConnectionError = true;
        this.callbacks.onError?.({
          code: 'SERVER_URL_MISSING',
          message:
            'No Co-Op server URL is configured for this app build. Enter your Co-Op server URL in Server Settings below to play online.',
        });
      }
      return;
    }

    if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)) {
      return;
    }
    this.intentionallyClosed = false;
    this.openedSinceAttempt = false;
    this.clearReconnectTimer();
    this.clearConnectTimeout();
    this.setStatus(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');

    let ws: WebSocket;
    try {
      ws = this.webSocketFactory
        ? this.webSocketFactory(this.wsUrl)
        : new WebSocket(this.wsUrl);
    } catch {
      this.setStatus('disconnected');
      this.failPendingAction(
        'CONNECTION_FAILED',
        `Cannot open Co-Op connection to ${this.wsUrl}. Verify the server address and internet access.`
      );
      return;
    }
    this.ws = ws;

    this.connectTimeoutTimer = setTimeout(() => {
      this.connectTimeoutTimer = null;
      if (this.ws !== ws || this.openedSinceAttempt) return;
      try {
        ws.close();
      } catch {
        // ignore
      }
      this.failPendingAction(
        'CONNECTION_TIMEOUT',
        'Timed out connecting to Co-Op server. Check your internet connection or server address and tap Retry.'
      );
      if (!this.reportedConnectionError) {
        this.reportedConnectionError = true;
        this.callbacks.onError?.({
          code: 'CONNECTION_TIMEOUT',
          message: 'Timed out connecting to Co-Op server. Check your connection and tap Retry.',
        });
      }
    }, this.connectTimeoutMs);
    if (typeof (this.connectTimeoutTimer as unknown as { unref?: () => void }).unref === 'function') {
      (this.connectTimeoutTimer as unknown as { unref: () => void }).unref();
    }

    const handleOpen = () => {
      if (this.ws !== ws) return;
      this.openedSinceAttempt = true;
      this.reportedConnectionError = false;
      this.reconnectAttempts = 0;
      this.clearConnectTimeout();
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
      this.clearConnectTimeout();
      if (this.intentionallyClosed) {
        this.clearPendingAction();
        this.setStatus('disconnected');
        return;
      }

      if (!this.openedSinceAttempt) {
        if (this.pendingAction) {
          this.failPendingAction(
            'CONNECTION_FAILED',
            'Unable to reach the Co-Op server. Check your internet connection or server URL and tap Retry.'
          );
        } else if (!this.reportedConnectionError) {
          this.reportedConnectionError = true;
          this.callbacks.onError?.({
            code: 'CONNECTION_FAILED',
            message: 'Unable to reach the Co-Op server. Check your internet connection and tap Retry.',
          });
        }
      }

      if (this.reconnectAttempts >= 6 && !this.session) {
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
        // close event will run reconnect & notify
      });
    } else {
      const nodeWs = ws as unknown as {
        on: (ev: string, cb: (...args: unknown[]) => void) => void;
      };
      nodeWs.on('open', handleOpen);
      nodeWs.on('message', (buf: unknown) => handleMessage(buf));
      nodeWs.on('close', handleClose);
      nodeWs.on('error', () => {
        // close event handles cleanup
      });
    }
  }

  public disconnect(preserveSessionForReconnect = false): void {
    this.intentionallyClosed = true;
    this.clearReconnectTimer();
    this.clearConnectTimeout();
    this.clearPendingAction();
    this.stopPing();
    this.pendingQueuedMessages = [];
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
    this.clearConnectTimeout();
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

  public retryConnect(): void {
    this.reportedConnectionError = false;
    this.reconnectAttempts = 0;
    this.clearReconnectTimer();
    this.connect();
  }

  public createSession(savedCheckpointId?: string | null): void {
    if (!this.wsUrl) {
      this.connect();
      return;
    }
    this.reportedConnectionError = false;
    this.reconnectAttempts = 0;
    this.beginPendingAction(
      'create',
      'Timed out creating Co-Op session. Please verify connection and try again.'
    );
    this.connect();
    const msg: CoopClientMessage = {
      type: 'coop:create_session',
      savedCheckpointId: savedCheckpointId ?? null,
    };
    this.pendingQueuedMessages = this.pendingQueuedMessages.filter(
      (m) => m.type !== 'coop:create_session' && m.type !== 'coop:join_session'
    );
    if (!this.send(msg)) {
      this.pendingQueuedMessages.push(msg);
    }
  }

  public joinSession(params: {
    sessionId?: string;
    sessionCode?: string;
    savedCheckpointId?: string | null;
  }): void {
    const cleanCode = params.sessionCode?.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!params.sessionId && (!cleanCode || cleanCode.length < 4)) {
      this.callbacks.onError?.({
        code: 'INVALID_CODE',
        message: 'Enter a valid 6-character Join Code.',
      });
      return;
    }
    if (!this.wsUrl) {
      this.connect();
      return;
    }
    this.reportedConnectionError = false;
    this.reconnectAttempts = 0;
    this.beginPendingAction(
      'join',
      'Timed out joining Co-Op session. Verify the Join Code and connection, then try again.'
    );
    this.connect();
    const msg: CoopClientMessage = {
      type: 'coop:join_session',
      sessionId: params.sessionId,
      sessionCode: cleanCode,
      savedCheckpointId: params.savedCheckpointId ?? null,
    };
    this.pendingQueuedMessages = this.pendingQueuedMessages.filter(
      (m) => m.type !== 'coop:create_session' && m.type !== 'coop:join_session'
    );
    if (!this.send(msg)) {
      this.pendingQueuedMessages.push(msg);
    }
  }

  public leaveSession(): void {
    this.clearPendingAction();
    this.pendingQueuedMessages = this.pendingQueuedMessages.filter(
      (m) => m.type !== 'coop:create_session' && m.type !== 'coop:join_session' && m.type !== 'coop:invite_friend'
    );
    this.send({ type: 'coop:leave_session' });
    this.session = null;
    this.pendingCheckpoint = null;
    this.pendingRespawnSeq = null;
  }

  public inviteFriend(target: { playerId?: string; friendCode?: string }): void {
    if (!this.wsUrl) {
      this.connect();
      return;
    }
    this.beginPendingAction('invite', 'Timed out sending invite.');
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
    if (!this.wsUrl) {
      this.connect();
      return;
    }
    if (accept) {
      this.beginPendingAction('join', 'Timed out accepting Co-Op invite.');
    }
    this.connect();
    const msg: CoopClientMessage = {
      type: 'coop:invite_respond',
      inviteId,
      accept,
      savedCheckpointId: savedCheckpointId ?? null,
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
    animState: CoopAnimState;
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

  private setPendingAction(next: CoopPendingAction): void {
    if (this.pendingAction === next) return;
    this.pendingAction = next;
    this.callbacks.onPendingActionChange?.(next);
  }

  private beginPendingAction(kind: Exclude<CoopPendingAction, null>, timeoutMsg: string): void {
    this.clearPendingAction();
    this.setPendingAction(kind);
    this.actionTimeoutTimer = setTimeout(() => {
      this.actionTimeoutTimer = null;
      this.failPendingAction('REQUEST_TIMEOUT', timeoutMsg);
    }, this.actionTimeoutMs);
    if (typeof (this.actionTimeoutTimer as unknown as { unref?: () => void }).unref === 'function') {
      (this.actionTimeoutTimer as unknown as { unref: () => void }).unref();
    }
  }

  private clearPendingAction(): void {
    if (this.actionTimeoutTimer) {
      clearTimeout(this.actionTimeoutTimer);
      this.actionTimeoutTimer = null;
    }
    this.setPendingAction(null);
  }

  private failPendingAction(code: string, message: string): void {
    const hadAction = Boolean(this.pendingAction);
    this.pendingQueuedMessages = this.pendingQueuedMessages.filter(
      (m) => m.type !== 'coop:create_session' && m.type !== 'coop:join_session' && m.type !== 'coop:invite_friend'
    );
    this.clearPendingAction();
    if (hadAction) {
      this.callbacks.onError?.({ code, message });
    }
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

  private clearConnectTimeout(): void {
    if (this.connectTimeoutTimer) {
      clearTimeout(this.connectTimeoutTimer);
      this.connectTimeoutTimer = null;
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
        if (this.pendingAction === 'invite') {
          this.clearPendingAction();
        }
        this.callbacks.onInviteSent?.(msg.invite);
        break;
      }

      case 'coop:invite_declined': {
        this.callbacks.onInviteDeclined?.(msg);
        break;
      }

      case 'coop:session_state': {
        this.clearPendingAction();
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
        this.clearPendingAction();
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
