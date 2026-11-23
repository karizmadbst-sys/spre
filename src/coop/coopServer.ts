import crypto from 'node:crypto';
import type http from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import {
  computeOpenWorldSpawnSlot,
  getWorldCheckpointById,
  getWorldRegionAtPos,
  OPEN_WORLD_BOUNDS,
  OPEN_WORLD_SPAWN,
} from '../game/openWorld.ts';
import { normalizeCharacterId, type CharacterId } from '../game/types.ts';
import {
  COOP_MAX_PLAYERS,
  COOP_PLAYER_COLORS,
  COOP_SERVER_RESPAWN_FAILSAFE_MS,
  deriveFriendCode,
  sanitizePlayerName,
  type CoopAnimState,
  type CoopClientMessage,
  type CoopInvite,
  type CoopOnlineUser,
  type CoopPlatform,
  type CoopPlayerSnapshot,
  type CoopRespawnPayload,
  type CoopServerMessage,
  type CoopSessionSnapshot,
} from './types.ts';

const VALID_ANIM_STATES = new Set<CoopAnimState>([
  'idle',
  'walk',
  'run',
  'jump',
  'fall',
  'swim',
]);

function normalizeAnimState(raw: unknown): CoopAnimState {
  return typeof raw === 'string' && VALID_ANIM_STATES.has(raw as CoopAnimState)
    ? (raw as CoopAnimState)
    : 'idle';
}

function normalizePlatform(raw: unknown): CoopPlatform {
  return raw === 'android' ? 'android' : 'pc';
}

function clampWorldCoord(val: unknown, min: number, max: number, fallback: number): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
  return Math.max(min, Math.min(max, val));
}

function finiteOr(val: unknown, fallback: number): number {
  return typeof val === 'number' && Number.isFinite(val) ? val : fallback;
}

interface ConnectedClient {
  ws: WebSocket;
  playerId: string;
  friendCode: string;
  name: string;
  characterId: CharacterId;
  platform: CoopPlatform;
  sessionId: string | null;
  regionId: number;
  lastHeartbeatAt: number;
}

interface CoopPlayerInternal extends CoopPlayerSnapshot {
  respawnTimer: ReturnType<typeof setTimeout> | null;
  lastEatenAt: number;
}

interface CoopSessionInternal {
  sessionId: string;
  sessionCode: string;
  hostId: string;
  maxPlayers: number;
  createdAt: number;
  players: Map<string, CoopPlayerInternal>;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
}

export interface CoopServerOptions {
  maxPlayers?: number;
  respawnFailsafeMs?: number;
  disconnectGraceMs?: number;
}

export class CoopServerManager {
  private readonly wss: WebSocketServer;
  private readonly clientsByWs = new Map<WebSocket, ConnectedClient>();
  private readonly clientsByPlayerId = new Map<string, ConnectedClient>();
  private readonly sessions = new Map<string, CoopSessionInternal>();
  private readonly sessionsByCode = new Map<string, CoopSessionInternal>();
  private readonly invites = new Map<string, CoopInvite>();
  private readonly maxPlayers: number;
  private readonly respawnFailsafeMs: number;
  private readonly disconnectGraceMs: number;
  private presenceBroadcastTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;

  constructor(options: CoopServerOptions = {}) {
    this.maxPlayers = Math.max(2, Math.min(12, options.maxPlayers ?? COOP_MAX_PLAYERS));
    this.respawnFailsafeMs = Math.max(200, options.respawnFailsafeMs ?? COOP_SERVER_RESPAWN_FAILSAFE_MS);
    this.disconnectGraceMs = Math.max(5000, options.disconnectGraceMs ?? 10 * 60 * 1000);
    this.wss = new WebSocketServer({ noServer: true, maxPayload: 32 * 1024 });

    this.wss.on('connection', (ws) => {
      if (this.closed) {
        ws.close();
        return;
      }

      ws.on('message', (data) => {
        try {
          const text = typeof data === 'string' ? data : data.toString('utf8');
          if (text.length > 32768) return;
          const msg = JSON.parse(text) as CoopClientMessage;
          if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return;
          this.handleMessage(ws, msg);
        } catch {
          this.sendWs(ws, {
            type: 'coop:error',
            code: 'INVALID_PAYLOAD',
            message: 'Malformed message payload.',
          });
        }
      });

      ws.on('close', () => {
        this.handleSocketClose(ws);
      });

      ws.on('error', () => {
        this.handleSocketClose(ws);
      });
    });
  }

  public attachToHttpServer(server: http.Server, pathPrefix = '/ws/coop'): void {
    server.on('upgrade', (req, socket, head) => {
      try {
        const rawUrl = req.url || '/';
        const url = new URL(rawUrl, 'http://localhost');
        if (url.pathname !== pathPrefix) {
          return;
        }
        this.wss.handleUpgrade(req, socket, head, (ws) => {
          this.wss.emit('connection', ws, req);
        });
      } catch {
        socket.destroy();
      }
    });
  }

  public getStats(): { onlineUsers: number; activeSessions: number; maxPlayers: number } {
    return {
      onlineUsers: this.clientsByPlayerId.size,
      activeSessions: this.sessions.size,
      maxPlayers: this.maxPlayers,
    };
  }

  public getSessionSnapshot(sessionId: string): CoopSessionSnapshot | null {
    const s = this.sessions.get(sessionId);
    return s ? this.toSessionSnapshot(s) : null;
  }

  public getSessionSnapshotByCode(sessionCode: string): CoopSessionSnapshot | null {
    const normalized = sessionCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const s = normalized ? this.sessionsByCode.get(normalized) : undefined;
    return s ? this.toSessionSnapshot(s) : null;
  }

  public async close(): Promise<void> {
    this.closed = true;
    if (this.presenceBroadcastTimer) {
      clearTimeout(this.presenceBroadcastTimer);
      this.presenceBroadcastTimer = null;
    }
    for (const s of this.sessions.values()) {
      if (s.cleanupTimer) {
        clearTimeout(s.cleanupTimer);
        s.cleanupTimer = null;
      }
      for (const p of s.players.values()) {
        if (p.respawnTimer) {
          clearTimeout(p.respawnTimer);
          p.respawnTimer = null;
        }
      }
    }
    this.sessions.clear();
    this.sessionsByCode.clear();
    this.invites.clear();
    for (const ws of this.clientsByWs.keys()) {
      try {
        ws.terminate();
      } catch {
        // ignore
      }
    }
    this.clientsByWs.clear();
    this.clientsByPlayerId.clear();
    await new Promise<void>((resolve) => this.wss.close(() => resolve()));
  }

  private sendWs(ws: WebSocket, msg: CoopServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  private sendToPlayer(playerId: string, msg: CoopServerMessage): void {
    const client = this.clientsByPlayerId.get(playerId);
    if (client) {
      this.sendWs(client.ws, msg);
    }
  }

  private broadcastToSession(
    session: CoopSessionInternal,
    msg: CoopServerMessage,
    excludePlayerId?: string
  ): void {
    const raw = JSON.stringify(msg);
    for (const p of session.players.values()) {
      if (excludePlayerId && p.playerId === excludePlayerId) continue;
      if (!p.connected) continue;
      const c = this.clientsByPlayerId.get(p.playerId);
      if (c && c.ws.readyState === WebSocket.OPEN) {
        c.ws.send(raw);
      }
    }
  }

  private schedulePresenceBroadcast(): void {
    if (this.closed || this.presenceBroadcastTimer) return;
    this.presenceBroadcastTimer = setTimeout(() => {
      this.presenceBroadcastTimer = null;
      this.broadcastPresenceNow();
    }, 35);
    this.presenceBroadcastTimer.unref?.();
  }

  private broadcastPresenceNow(): void {
    const users: CoopOnlineUser[] = [];
    for (const c of this.clientsByPlayerId.values()) {
      users.push({
        playerId: c.playerId,
        friendCode: c.friendCode,
        name: c.name,
        characterId: c.characterId,
        platform: c.platform,
        status: c.sessionId ? 'in_coop' : 'online',
        sessionId: c.sessionId,
        regionId: c.regionId,
      });
    }
    const raw = JSON.stringify({ type: 'presence:update', users } satisfies CoopServerMessage);
    for (const c of this.clientsByPlayerId.values()) {
      if (c.ws.readyState === WebSocket.OPEN) {
        c.ws.send(raw);
      }
    }
  }

  private toPlayerSnapshot(p: CoopPlayerInternal): CoopPlayerSnapshot {
    return {
      playerId: p.playerId,
      friendCode: p.friendCode,
      name: p.name,
      characterId: p.characterId,
      platform: p.platform,
      connected: p.connected,
      alive: p.alive,
      deathSeq: p.deathSeq,
      slotIndex: p.slotIndex,
      colorHex: p.colorHex,
      x: p.x,
      y: p.y,
      z: p.z,
      yaw: p.yaw,
      animState: p.animState,
      horizSpeed: p.horizSpeed,
      regionId: p.regionId,
      inWater: p.inWater,
      checkpointId: p.checkpointId,
      checkpointRegionId: p.checkpointRegionId,
      checkpointLabel: p.checkpointLabel,
      checkpointX: p.checkpointX,
      checkpointY: p.checkpointY,
      checkpointZ: p.checkpointZ,
      checkpointYaw: p.checkpointYaw,
    };
  }

  private toSessionSnapshot(session: CoopSessionInternal): CoopSessionSnapshot {
    return {
      sessionId: session.sessionId,
      sessionCode: session.sessionCode,
      hostId: session.hostId,
      maxPlayers: session.maxPlayers,
      players: Array.from(session.players.values()).map((p) => this.toPlayerSnapshot(p)),
    };
  }

  private registerOrUpdateClient(
    ws: WebSocket,
    rawPlayerId: unknown,
    rawName: unknown,
    rawCharacterId: unknown,
    rawPlatform: unknown
  ): ConnectedClient {
    const existingByWs = this.clientsByWs.get(ws);
    const cleanId =
      typeof rawPlayerId === 'string' && rawPlayerId.trim().length >= 3
        ? rawPlayerId.trim().slice(0, 64)
        : existingByWs?.playerId || crypto.randomUUID();
    const cleanName = sanitizePlayerName(rawName);
    const charId = normalizeCharacterId(rawCharacterId);
    const platform = normalizePlatform(rawPlatform);
    const friendCode = deriveFriendCode(cleanId);

    const prevSocketClient = this.clientsByPlayerId.get(cleanId);
    if (prevSocketClient && prevSocketClient.ws !== ws) {
      // Replace stale socket for the same playerId without losing session membership
      this.clientsByWs.delete(prevSocketClient.ws);
      try {
        prevSocketClient.ws.close(4001, 'Replaced by new connection');
      } catch {
        // ignore
      }
    }

    const client: ConnectedClient = {
      ws,
      playerId: cleanId,
      friendCode,
      name: cleanName,
      characterId: charId,
      platform,
      sessionId: existingByWs?.sessionId ?? prevSocketClient?.sessionId ?? null,
      regionId: existingByWs?.regionId ?? prevSocketClient?.regionId ?? 1,
      lastHeartbeatAt: Date.now(),
    };
    this.clientsByWs.set(ws, client);
    this.clientsByPlayerId.set(cleanId, client);
    return client;
  }

  private handleMessage(ws: WebSocket, msg: CoopClientMessage): void {
    if (msg.type === 'ping') {
      const c = this.clientsByWs.get(ws);
      if (c) c.lastHeartbeatAt = Date.now();
      this.sendWs(ws, { type: 'pong', t: finiteOr(msg.t, Date.now()) });
      return;
    }

    if (msg.type === 'hello') {
      const client = this.registerOrUpdateClient(
        ws,
        msg.playerId,
        msg.name,
        msg.characterId,
        msg.platform
      );
      this.sendWs(ws, {
        type: 'welcome',
        playerId: client.playerId,
        friendCode: client.friendCode,
        name: client.name,
        maxPlayers: this.maxPlayers,
      });
      this.schedulePresenceBroadcast();
      return;
    }

    if (msg.type === 'coop:reconnect_session') {
      const client = this.registerOrUpdateClient(
        ws,
        msg.playerId,
        msg.name,
        msg.characterId,
        msg.platform
      );
      this.sendWs(ws, {
        type: 'welcome',
        playerId: client.playerId,
        friendCode: client.friendCode,
        name: client.name,
        maxPlayers: this.maxPlayers,
      });
      this.handleReconnectSession(
        client,
        msg.sessionId,
        msg.lastKnownCheckpointId ?? null
      );
      return;
    }

    const client = this.clientsByWs.get(ws);
    if (!client) {
      this.sendWs(ws, {
        type: 'coop:error',
        code: 'HANDSHAKE_REQUIRED',
        message: 'Register with hello before sending session messages.',
      });
      return;
    }
    client.lastHeartbeatAt = Date.now();

    switch (msg.type) {
      case 'update_profile': {
        if (msg.name !== undefined) client.name = sanitizePlayerName(msg.name);
        if (msg.characterId !== undefined) {
          client.characterId = normalizeCharacterId(msg.characterId);
        }
        if (client.sessionId) {
          const s = this.sessions.get(client.sessionId);
          const p = s?.players.get(client.playerId);
          if (s && p) {
            p.name = client.name;
            p.characterId = client.characterId;
            this.broadcastToSession(s, {
              type: 'coop:player_joined',
              player: this.toPlayerSnapshot(p),
              hostId: s.hostId,
            });
          }
        }
        this.schedulePresenceBroadcast();
        break;
      }

      case 'coop:create_session': {
        this.createSession(client, msg.savedCheckpointId ?? null);
        break;
      }

      case 'coop:join_session': {
        this.joinSessionByIdentifier(
          client,
          msg.sessionId,
          msg.sessionCode,
          msg.savedCheckpointId ?? null
        );
        break;
      }

      case 'coop:leave_session': {
        this.leaveSession(client);
        break;
      }

      case 'coop:invite_friend': {
        this.sendInvite(client, msg.targetPlayerId, msg.targetFriendCode);
        break;
      }

      case 'coop:invite_respond': {
        this.respondInvite(client, msg.inviteId, msg.accept, msg.savedCheckpointId ?? null);
        break;
      }

      case 'coop:player_state': {
        this.handlePlayerState(client, msg);
        break;
      }

      case 'coop:activate_checkpoint': {
        this.handleActivateCheckpoint(client, msg);
        break;
      }

      case 'coop:player_eaten': {
        this.handlePlayerEaten(client, msg);
        break;
      }

      case 'coop:request_respawn': {
        this.handleRequestRespawn(client, msg.deathSeq);
        break;
      }
    }
  }

  private generateUniqueSessionCode(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let attempt = 0; attempt < 16; attempt++) {
      let code = '';
      const bytes = crypto.randomBytes(6);
      for (let i = 0; i < 6; i++) {
        code += alphabet[bytes[i] % alphabet.length];
      }
      if (!this.sessionsByCode.has(code)) return code;
    }
    return crypto.randomBytes(3).toString('hex').toUpperCase();
  }

  private createInitialPlayerState(
    client: ConnectedClient,
    slotIndex: number,
    totalSlots: number,
    savedCheckpointId: string | null
  ): CoopPlayerInternal {
    const cp = savedCheckpointId ? getWorldCheckpointById(savedCheckpointId) : null;
    const slotSpawn = computeOpenWorldSpawnSlot(slotIndex, totalSlots);
    const startPos = cp
      ? {
          x: cp.x,
          y: cp.y + 0.5,
          z: cp.z,
          yaw: cp.yaw,
          regionId: cp.regionId,
        }
      : slotSpawn;

    return {
      playerId: client.playerId,
      friendCode: client.friendCode,
      name: client.name,
      characterId: client.characterId,
      platform: client.platform,
      connected: true,
      alive: true,
      deathSeq: 0,
      slotIndex,
      colorHex: COOP_PLAYER_COLORS[slotIndex % COOP_PLAYER_COLORS.length],
      x: startPos.x,
      y: startPos.y,
      z: startPos.z,
      yaw: startPos.yaw,
      animState: 'idle',
      horizSpeed: 0,
      regionId: startPos.regionId,
      inWater: false,
      checkpointId: cp ? cp.id : null,
      checkpointRegionId: cp ? cp.regionId : 1,
      checkpointLabel: cp ? cp.label : 'Region 01 Entry Dock',
      checkpointX: cp ? cp.x : OPEN_WORLD_SPAWN.x,
      checkpointY: cp ? cp.y + 0.5 : OPEN_WORLD_SPAWN.y,
      checkpointZ: cp ? cp.z : OPEN_WORLD_SPAWN.z,
      checkpointYaw: cp ? cp.yaw : OPEN_WORLD_SPAWN.yaw,
      respawnTimer: null,
      lastEatenAt: 0,
    };
  }

  private createSession(client: ConnectedClient, savedCheckpointId: string | null): void {
    if (client.sessionId) {
      this.leaveSession(client);
    }

    const sessionId = crypto.randomUUID();
    const sessionCode = this.generateUniqueSessionCode();
    const session: CoopSessionInternal = {
      sessionId,
      sessionCode,
      hostId: client.playerId,
      maxPlayers: this.maxPlayers,
      createdAt: Date.now(),
      players: new Map(),
      cleanupTimer: null,
    };

    const hostPlayer = this.createInitialPlayerState(client, 0, 1, savedCheckpointId);
    session.players.set(client.playerId, hostPlayer);
    this.sessions.set(sessionId, session);
    this.sessionsByCode.set(sessionCode, session);

    client.sessionId = sessionId;
    client.regionId = hostPlayer.regionId;

    this.sendWs(client.ws, {
      type: 'coop:session_state',
      session: this.toSessionSnapshot(session),
      you: this.toPlayerSnapshot(hostPlayer),
    });
    this.schedulePresenceBroadcast();
  }

  private allocateSlotIndex(session: CoopSessionInternal): number {
    const used = new Set<number>();
    for (const p of session.players.values()) {
      used.add(p.slotIndex);
    }
    for (let i = 0; i < session.maxPlayers; i++) {
      if (!used.has(i)) return i;
    }
    return session.players.size;
  }

  private joinSessionByIdentifier(
    client: ConnectedClient,
    sessionId?: string,
    sessionCode?: string,
    savedCheckpointId: string | null = null
  ): boolean {
    let targetSession: CoopSessionInternal | undefined;
    if (sessionId) {
      targetSession = this.sessions.get(sessionId);
    }
    if (!targetSession && sessionCode) {
      const normalized = sessionCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      targetSession = normalized ? this.sessionsByCode.get(normalized) : undefined;
    }
    if (!targetSession) {
      this.sendWs(client.ws, {
        type: 'coop:error',
        code: 'SESSION_NOT_FOUND',
        message: 'Co-op session not found or has expired.',
      });
      return false;
    }
    return this.joinSessionInternal(client, targetSession, savedCheckpointId);
  }

  private joinSessionInternal(
    client: ConnectedClient,
    session: CoopSessionInternal,
    savedCheckpointId: string | null
  ): boolean {
    if (client.sessionId && client.sessionId !== session.sessionId) {
      this.leaveSession(client);
    }

    if (session.cleanupTimer) {
      clearTimeout(session.cleanupTimer);
      session.cleanupTimer = null;
    }

    // Re-attaching existing player in same session preserves their independent checkpoint!
    const existing = session.players.get(client.playerId);
    if (existing) {
      existing.connected = true;
      existing.name = client.name;
      existing.characterId = client.characterId;
      existing.platform = client.platform;
      client.sessionId = session.sessionId;
      client.regionId = existing.regionId;

      this.sendWs(client.ws, {
        type: 'coop:session_state',
        session: this.toSessionSnapshot(session),
        you: this.toPlayerSnapshot(existing),
        reconnectRestore: true,
      });
      this.broadcastToSession(
        session,
        {
          type: 'coop:player_connection',
          playerId: client.playerId,
          connected: true,
        },
        client.playerId
      );
      this.schedulePresenceBroadcast();
      return true;
    }

    if (session.players.size >= session.maxPlayers) {
      this.sendWs(client.ws, {
        type: 'coop:error',
        code: 'SESSION_FULL',
        message: `Co-op session is full (max ${session.maxPlayers} players).`,
      });
      return false;
    }

    const slotIndex = this.allocateSlotIndex(session);
    const player = this.createInitialPlayerState(
      client,
      slotIndex,
      session.players.size + 1,
      savedCheckpointId
    );
    session.players.set(client.playerId, player);
    client.sessionId = session.sessionId;
    client.regionId = player.regionId;

    this.sendWs(client.ws, {
      type: 'coop:session_state',
      session: this.toSessionSnapshot(session),
      you: this.toPlayerSnapshot(player),
    });

    this.broadcastToSession(
      session,
      {
        type: 'coop:player_joined',
        player: this.toPlayerSnapshot(player),
        hostId: session.hostId,
      },
      client.playerId
    );
    this.schedulePresenceBroadcast();
    return true;
  }

  private handleReconnectSession(
    client: ConnectedClient,
    sessionId: string,
    lastKnownCheckpointId: string | null
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.sendWs(client.ws, {
        type: 'coop:error',
        code: 'SESSION_EXPIRED',
        message: 'Previous Co-op session expired.',
      });
      this.schedulePresenceBroadcast();
      return;
    }

    if (session.cleanupTimer) {
      clearTimeout(session.cleanupTimer);
      session.cleanupTimer = null;
    }

    const existing = session.players.get(client.playerId);
    if (!existing) {
      this.joinSessionInternal(client, session, lastKnownCheckpointId);
      return;
    }

    existing.connected = true;
    existing.name = client.name;
    existing.characterId = client.characterId;
    existing.platform = client.platform;

    // If client reached a valid checkpoint right before disconnecting and server had none, reconcile safely
    if (!existing.checkpointId && lastKnownCheckpointId) {
      const cp = getWorldCheckpointById(lastKnownCheckpointId);
      if (cp) {
        existing.checkpointId = cp.id;
        existing.checkpointRegionId = cp.regionId;
        existing.checkpointLabel = cp.label;
        existing.checkpointX = cp.x;
        existing.checkpointY = cp.y + 0.5;
        existing.checkpointZ = cp.z;
        existing.checkpointYaw = cp.yaw;
      }
    }

    // Never leave a reconnecting player stuck in dead/eating state if eating duration has elapsed
    if (!existing.alive && Date.now() - existing.lastEatenAt >= this.respawnFailsafeMs - 400) {
      this.resolvePlayerRespawn(session, existing, existing.deathSeq);
    }

    client.sessionId = session.sessionId;
    client.regionId = existing.regionId;

    this.sendWs(client.ws, {
      type: 'coop:session_state',
      session: this.toSessionSnapshot(session),
      you: this.toPlayerSnapshot(existing),
      reconnectRestore: true,
    });
    this.broadcastToSession(
      session,
      {
        type: 'coop:player_connection',
        playerId: client.playerId,
        connected: true,
      },
      client.playerId
    );
    this.schedulePresenceBroadcast();
  }

  private leaveSession(client: ConnectedClient): void {
    const sessionId = client.sessionId;
    client.sessionId = null;
    if (!sessionId) {
      this.schedulePresenceBroadcast();
      return;
    }
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.schedulePresenceBroadcast();
      return;
    }

    const player = session.players.get(client.playerId);
    if (player?.respawnTimer) {
      clearTimeout(player.respawnTimer);
      player.respawnTimer = null;
    }
    session.players.delete(client.playerId);

    if (session.players.size === 0) {
      this.destroySession(session);
    } else {
      if (session.hostId === client.playerId) {
        const nextConnected =
          Array.from(session.players.values()).find((p) => p.connected) ||
          Array.from(session.players.values())[0];
        if (nextConnected) session.hostId = nextConnected.playerId;
      }
      this.broadcastToSession(session, {
        type: 'coop:player_left',
        playerId: client.playerId,
        hostId: session.hostId,
      });
    }
    this.schedulePresenceBroadcast();
  }

  private destroySession(session: CoopSessionInternal): void {
    if (session.cleanupTimer) {
      clearTimeout(session.cleanupTimer);
      session.cleanupTimer = null;
    }
    for (const p of session.players.values()) {
      if (p.respawnTimer) {
        clearTimeout(p.respawnTimer);
        p.respawnTimer = null;
      }
    }
    this.sessions.delete(session.sessionId);
    this.sessionsByCode.delete(session.sessionCode);
    for (const [invId, inv] of this.invites.entries()) {
      if (inv.sessionId === session.sessionId) {
        this.invites.delete(invId);
      }
    }
  }

  private sendInvite(
    client: ConnectedClient,
    targetPlayerId?: string,
    targetFriendCode?: string
  ): void {
    if (!client.sessionId) {
      this.createSession(client, null);
    }
    const session = client.sessionId ? this.sessions.get(client.sessionId) : undefined;
    if (!session) return;

    if (session.players.size >= session.maxPlayers) {
      this.sendWs(client.ws, {
        type: 'coop:error',
        code: 'SESSION_FULL',
        message: `Session already reached the ${session.maxPlayers}-player limit.`,
      });
      return;
    }

    let target: ConnectedClient | undefined;
    if (targetPlayerId) {
      target = this.clientsByPlayerId.get(targetPlayerId);
    } else if (targetFriendCode) {
      const normalized = targetFriendCode.trim().toUpperCase();
      for (const c of this.clientsByPlayerId.values()) {
        if (c.friendCode.toUpperCase() === normalized) {
          target = c;
          break;
        }
      }
    }

    if (!target) {
      this.sendWs(client.ws, {
        type: 'coop:error',
        code: 'FRIEND_OFFLINE',
        message: 'Friend is currently offline.',
      });
      return;
    }
    if (target.playerId === client.playerId) {
      this.sendWs(client.ws, {
        type: 'coop:error',
        code: 'CANNOT_INVITE_SELF',
        message: 'You cannot invite yourself.',
      });
      return;
    }

    const now = Date.now();
    const invite: CoopInvite = {
      inviteId: crypto.randomUUID(),
      sessionId: session.sessionId,
      sessionCode: session.sessionCode,
      hostId: client.playerId,
      hostName: client.name,
      targetPlayerId: target.playerId,
      createdAt: now,
      expiresAt: now + 5 * 60 * 1000,
    };
    this.invites.set(invite.inviteId, invite);

    this.sendWs(target.ws, {
      type: 'coop:invite_received',
      invite,
    });
    this.sendWs(client.ws, {
      type: 'coop:invite_sent',
      invite,
    });
  }

  private respondInvite(
    client: ConnectedClient,
    inviteId: string,
    accept: boolean,
    savedCheckpointId: string | null
  ): void {
    const invite = this.invites.get(inviteId);
    if (!invite || invite.targetPlayerId !== client.playerId) {
      this.sendWs(client.ws, {
        type: 'coop:error',
        code: 'INVITE_INVALID',
        message: 'Invitation expired or not found.',
      });
      return;
    }
    this.invites.delete(inviteId);

    if (Date.now() > invite.expiresAt) {
      this.sendWs(client.ws, {
        type: 'coop:error',
        code: 'INVITE_EXPIRED',
        message: 'Invitation has expired.',
      });
      return;
    }

    if (!accept) {
      this.sendToPlayer(invite.hostId, {
        type: 'coop:invite_declined',
        inviteId,
        targetPlayerId: client.playerId,
        targetName: client.name,
      });
      return;
    }

    const session = this.sessions.get(invite.sessionId);
    if (!session) {
      this.sendWs(client.ws, {
        type: 'coop:error',
        code: 'SESSION_NOT_FOUND',
        message: 'Host closed the Open World session.',
      });
      return;
    }

    this.joinSessionInternal(client, session, savedCheckpointId);
  }

  private handlePlayerState(
    client: ConnectedClient,
    msg: Extract<CoopClientMessage, { type: 'coop:player_state' }>
  ): void {
    if (!client.sessionId) return;
    const session = this.sessions.get(client.sessionId);
    const player = session?.players.get(client.playerId);
    if (!session || !player) return;

    // Ignore movement state updates briefly while devour cinematic plays until respawn completes
    if (!player.alive) return;

    const x = clampWorldCoord(
      msg.x,
      OPEN_WORLD_BOUNDS.minX - 4,
      OPEN_WORLD_BOUNDS.maxX + 4,
      player.x
    );
    const y = clampWorldCoord(
      msg.y,
      OPEN_WORLD_BOUNDS.floorY - 2,
      OPEN_WORLD_BOUNDS.ceilingY + 4,
      player.y
    );
    const z = clampWorldCoord(
      msg.z,
      OPEN_WORLD_BOUNDS.minZ - 4,
      OPEN_WORLD_BOUNDS.maxZ + 4,
      player.z
    );
    const yaw = finiteOr(msg.yaw, player.yaw);
    const animState = normalizeAnimState(msg.animState);
    const horizSpeed = Math.max(0, Math.min(30, finiteOr(msg.horizSpeed, 0)));
    const regionId = getWorldRegionAtPos(x, z).regionId;
    const inWater = Boolean(msg.inWater);

    const regionChanged = player.regionId !== regionId;
    player.x = x;
    player.y = y;
    player.z = z;
    player.yaw = yaw;
    player.animState = animState;
    player.horizSpeed = horizSpeed;
    player.regionId = regionId;
    player.inWater = inWater;
    client.regionId = regionId;

    this.broadcastToSession(
      session,
      {
        type: 'coop:player_moved',
        move: {
          playerId: player.playerId,
          x,
          y,
          z,
          yaw,
          animState,
          horizSpeed,
          regionId,
          inWater,
          alive: player.alive,
        },
      },
      client.playerId
    );

    if (regionChanged) {
      this.schedulePresenceBroadcast();
    }
  }

  private handleActivateCheckpoint(
    client: ConnectedClient,
    msg: Extract<CoopClientMessage, { type: 'coop:activate_checkpoint' }>
  ): void {
    if (!client.sessionId) return;
    const session = this.sessions.get(client.sessionId);
    const player = session?.players.get(client.playerId);
    if (!session || !player) return;

    const cp = getWorldCheckpointById(msg.checkpointId);
    if (!cp) {
      this.sendWs(client.ws, {
        type: 'coop:error',
        code: 'INVALID_CHECKPOINT',
        message: 'Unknown Open World checkpoint.',
      });
      return;
    }

    // Authoritative proximity validation against both submitted position & server player coords
    const cx = finiteOr(msg.x, player.x);
    const cy = finiteOr(msg.y, player.y);
    const cz = finiteOr(msg.z, player.z);
    const distFromClientPos = Math.hypot(cx - cp.x, cz - cp.z);
    const vertFromClientPos = Math.abs(cy - cp.y);

    if (distFromClientPos > 10.5 || vertFromClientPos > 7.5) {
      this.sendWs(client.ws, {
        type: 'coop:error',
        code: 'CHECKPOINT_OUT_OF_RANGE',
        message: 'Player must be near checkpoint to activate it.',
      });
      return;
    }

    // Update ONLY this player's independent checkpoint state
    player.checkpointId = cp.id;
    player.checkpointRegionId = cp.regionId;
    player.checkpointLabel = cp.label;
    player.checkpointX = cp.x;
    player.checkpointY = cp.y + 0.5;
    player.checkpointZ = cp.z;
    player.checkpointYaw = cp.yaw;
    player.x = cx;
    player.y = cy;
    player.z = cz;
    player.regionId = cp.regionId;
    client.regionId = cp.regionId;

    this.sendWs(client.ws, {
      type: 'coop:checkpoint_confirmed',
      checkpoint: {
        playerId: player.playerId,
        checkpointId: cp.id,
        regionId: cp.regionId,
        label: cp.label,
        x: cp.x,
        y: cp.y + 0.5,
        z: cp.z,
        yaw: cp.yaw,
      },
    });

    this.broadcastToSession(
      session,
      {
        type: 'coop:player_checkpoint',
        playerId: player.playerId,
        checkpointId: cp.id,
        checkpointRegionId: cp.regionId,
        checkpointLabel: cp.label,
      },
      client.playerId
    );
  }

  private handlePlayerEaten(
    client: ConnectedClient,
    msg: Extract<CoopClientMessage, { type: 'coop:player_eaten' }>
  ): void {
    if (!client.sessionId) return;
    const session = this.sessions.get(client.sessionId);
    const player = session?.players.get(client.playerId);
    if (!session || !player) return;

    const seq = Math.max(1, Math.floor(finiteOr(msg.deathSeq, player.deathSeq + 1)));

    // Idempotency guard: duplicate or stale death events cannot reset or block respawn
    if (!player.alive && seq <= player.deathSeq) {
      return;
    }
    if (seq < player.deathSeq) {
      return;
    }

    if (player.respawnTimer) {
      clearTimeout(player.respawnTimer);
      player.respawnTimer = null;
    }

    player.alive = false;
    player.deathSeq = seq;
    player.lastEatenAt = Date.now();
    const px = clampWorldCoord(msg.playerX, OPEN_WORLD_BOUNDS.minX - 4, OPEN_WORLD_BOUNDS.maxX + 4, player.x);
    const py = clampWorldCoord(msg.playerY, OPEN_WORLD_BOUNDS.floorY - 2, OPEN_WORLD_BOUNDS.ceilingY + 4, player.y);
    const pz = clampWorldCoord(msg.playerZ, OPEN_WORLD_BOUNDS.minZ - 4, OPEN_WORLD_BOUNDS.maxZ + 4, player.z);
    const pyaw = finiteOr(msg.playerYaw, player.yaw);
    player.x = px;
    player.y = py;
    player.z = pz;
    player.yaw = pyaw;

    this.broadcastToSession(
      session,
      {
        type: 'coop:player_eaten_broadcast',
        event: {
          playerId: player.playerId,
          deathSeq: seq,
          monsterId: typeof msg.monsterId === 'string' ? msg.monsterId.slice(0, 64) : 'serpent',
          monsterX: finiteOr(msg.monsterX, px),
          monsterY: finiteOr(msg.monsterY, py),
          monsterZ: finiteOr(msg.monsterZ, pz),
          playerX: px,
          playerY: py,
          playerZ: pz,
          playerYaw: pyaw,
        },
      },
      client.playerId
    );

    // Authoritative automatic respawn failsafe so player ALWAYS respawns even if client packet drops
    player.respawnTimer = setTimeout(() => {
      player.respawnTimer = null;
      this.resolvePlayerRespawn(session, player, seq);
    }, this.respawnFailsafeMs);
    player.respawnTimer.unref?.();
  }

  private handleRequestRespawn(client: ConnectedClient, rawDeathSeq: number): void {
    if (!client.sessionId) return;
    const session = this.sessions.get(client.sessionId);
    const player = session?.players.get(client.playerId);
    if (!session || !player) return;

    const reqSeq = Math.max(0, Math.floor(finiteOr(rawDeathSeq, player.deathSeq)));

    // Idempotent recovery: if already respawned for this or later sequence, re-send authoritative respawn
    if (player.alive && reqSeq <= player.deathSeq) {
      const respawn = this.buildAuthoritativeRespawnPayload(player, player.deathSeq);
      this.sendWs(client.ws, { type: 'coop:player_respawn', respawn });
      return;
    }

    if (!player.alive && reqSeq >= player.deathSeq) {
      this.resolvePlayerRespawn(session, player, player.deathSeq);
    }
  }

  private buildAuthoritativeRespawnPayload(
    player: CoopPlayerInternal,
    deathSeq: number
  ): CoopRespawnPayload {
    const cp = player.checkpointId ? getWorldCheckpointById(player.checkpointId) : null;
    if (cp) {
      return {
        playerId: player.playerId,
        deathSeq,
        checkpointId: cp.id,
        checkpointRegionId: cp.regionId,
        checkpointLabel: cp.label,
        x: cp.x,
        y: cp.y + 0.5,
        z: cp.z,
        yaw: cp.yaw,
        regionId: cp.regionId,
      };
    }

    return {
      playerId: player.playerId,
      deathSeq,
      checkpointId: null,
      checkpointRegionId: OPEN_WORLD_SPAWN.regionId,
      checkpointLabel: 'Region 01 Entry Dock',
      x: OPEN_WORLD_SPAWN.x,
      y: OPEN_WORLD_SPAWN.y,
      z: OPEN_WORLD_SPAWN.z,
      yaw: OPEN_WORLD_SPAWN.yaw,
      regionId: OPEN_WORLD_SPAWN.regionId,
    };
  }

  private resolvePlayerRespawn(
    session: CoopSessionInternal,
    player: CoopPlayerInternal,
    deathSeq: number
  ): void {
    if (player.alive && deathSeq <= player.deathSeq) return;
    if (player.respawnTimer) {
      clearTimeout(player.respawnTimer);
      player.respawnTimer = null;
    }

    const respawn = this.buildAuthoritativeRespawnPayload(player, deathSeq);
    player.alive = true;
    player.x = respawn.x;
    player.y = respawn.y;
    player.z = respawn.z;
    player.yaw = respawn.yaw;
    player.regionId = respawn.regionId;
    player.animState = 'idle';
    player.horizSpeed = 0;
    player.inWater = false;

    const c = this.clientsByPlayerId.get(player.playerId);
    if (c) c.regionId = respawn.regionId;

    this.broadcastToSession(session, {
      type: 'coop:player_respawn',
      respawn,
    });
  }

  private handleSocketClose(ws: WebSocket): void {
    const client = this.clientsByWs.get(ws);
    if (!client) return;
    this.clientsByWs.delete(ws);

    const activeForPlayer = this.clientsByPlayerId.get(client.playerId);
    if (activeForPlayer && activeForPlayer.ws === ws) {
      this.clientsByPlayerId.delete(client.playerId);

      // Preserve player slot & checkpoint in session across temporary network disconnections
      if (client.sessionId) {
        const session = this.sessions.get(client.sessionId);
        const player = session?.players.get(client.playerId);
        if (session && player) {
          player.connected = false;
          this.broadcastToSession(
            session,
            {
              type: 'coop:player_connection',
              playerId: client.playerId,
              connected: false,
            },
            client.playerId
          );

          const anyConnected = Array.from(session.players.values()).some((p) => p.connected);
          if (!anyConnected && !session.cleanupTimer) {
            session.cleanupTimer = setTimeout(() => {
              session.cleanupTimer = null;
              const stillEmpty = Array.from(session.players.values()).every((p) => !p.connected);
              if (stillEmpty) {
                this.destroySession(session);
              }
            }, this.disconnectGraceMs);
            session.cleanupTimer.unref?.();
          }
        }
      }
      this.schedulePresenceBroadcast();
    }
  }
}
