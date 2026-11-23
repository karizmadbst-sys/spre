import {
  computeOpenWorldSpawnSlot,
  getWorldCheckpointById,
  getWorldRegionAtPos,
  OPEN_WORLD_BOUNDS,
  OPEN_WORLD_SPAWN,
} from '../../src/game/openWorld.ts';
import { normalizeCharacterId, type CharacterId } from '../../src/game/types.ts';
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
} from '../../src/coop/types.ts';

interface WorkerDurableObjectNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch(input: Request | string, init?: RequestInit): Promise<Response> };
}

interface WorkerDurableObjectState {
  acceptWebSocket?(ws: WebSocket): void;
}

export interface Env {
  COOP_HUB: WorkerDurableObjectNamespace;
  ALLOWED_ORIGINS?: string;
}

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

function buildCorsHeaders(request: Request, allowedOrigins?: string): Headers {
  const headers = new Headers();
  const origin = request.headers.get('Origin') || '*';
  const list = (allowedOrigins || '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (list.includes('*') || list.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin === '*' ? '*' : origin);
  } else {
    headers.set('Access-Control-Allow-Origin', '*');
  }
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Access-Control-Max-Age', '86400');
  return headers;
}

interface EdgeConnectedClient {
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

interface EdgeCoopPlayerInternal extends CoopPlayerSnapshot {
  respawnTimer: ReturnType<typeof setTimeout> | null;
  lastEatenAt: number;
}

interface EdgeCoopSessionInternal {
  sessionId: string;
  sessionCode: string;
  hostId: string;
  maxPlayers: number;
  createdAt: number;
  players: Map<string, EdgeCoopPlayerInternal>;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
}

export class CoopHubDO {
  private readonly clientsByWs = new Map<WebSocket, EdgeConnectedClient>();
  private readonly clientsByPlayerId = new Map<string, EdgeConnectedClient>();
  private readonly sessions = new Map<string, EdgeCoopSessionInternal>();
  private readonly sessionsByCode = new Map<string, EdgeCoopSessionInternal>();
  private readonly invites = new Map<string, CoopInvite>();
  private readonly maxPlayers = COOP_MAX_PLAYERS;
  private readonly respawnFailsafeMs = COOP_SERVER_RESPAWN_FAILSAFE_MS;
  private readonly disconnectGraceMs = 10 * 60 * 1000;
  private presenceBroadcastTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(_state?: WorkerDurableObjectState, _env?: Env) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const cors = buildCorsHeaders(request);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (url.pathname === '/api/health') {
      cors.set('Content-Type', 'application/json');
      return new Response(
        JSON.stringify({
          ok: true,
          coop: true,
          runtime: 'cloudflare-durable-object',
          onlineUsers: this.clientsByPlayerId.size,
          activeSessions: this.sessions.size,
          maxPlayers: this.maxPlayers,
        }),
        { status: 200, headers: cors }
      );
    }

    if (url.pathname.startsWith('/api/coop/session/')) {
      const code = url.pathname
        .slice('/api/coop/session/'.length)
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
      const s = code ? this.sessionsByCode.get(code) : undefined;
      cors.set('Content-Type', 'application/json');
      if (!s) {
        return new Response(JSON.stringify({ ok: true, exists: false }), { status: 404, headers: cors });
      }
      return new Response(
        JSON.stringify({
          ok: true,
          exists: true,
          sessionId: s.sessionId,
          sessionCode: s.sessionCode,
          playerCount: s.players.size,
          maxPlayers: s.maxPlayers,
        }),
        { status: 200, headers: cors }
      );
    }

    if (
      (url.pathname === '/ws/coop' || url.pathname === '/ws') &&
      request.headers.get('Upgrade')?.toLowerCase() === 'websocket'
    ) {
      const WebSocketPairCtor = (globalThis as unknown as { WebSocketPair: new () => { 0: WebSocket; 1: WebSocket } })
        .WebSocketPair;
      const pair = new WebSocketPairCtor();
      const clientWs = pair[0];
      const serverWs = pair[1] as WebSocket & { accept(): void };
      serverWs.accept();
      this.attachSocket(serverWs);

      return new Response(null, {
        status: 101,
        webSocket: clientWs,
      } as unknown as ResponseInit);
    }

    return new Response('Not found', { status: 404, headers: cors });
  }

  private attachSocket(ws: WebSocket): void {
    ws.addEventListener('message', (ev) => {
      try {
        const raw = typeof ev.data === 'string' ? ev.data : '';
        if (!raw || raw.length > 32768) return;
        const msg = JSON.parse(raw) as CoopClientMessage;
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

    ws.addEventListener('close', () => {
      this.handleSocketClose(ws);
    });
    ws.addEventListener('error', () => {
      this.handleSocketClose(ws);
    });
  }

  private sendWs(ws: WebSocket, msg: CoopServerMessage): void {
    if (ws.readyState === 1) {
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
    session: EdgeCoopSessionInternal,
    msg: CoopServerMessage,
    excludePlayerId?: string
  ): void {
    const raw = JSON.stringify(msg);
    for (const p of session.players.values()) {
      if (excludePlayerId && p.playerId === excludePlayerId) continue;
      if (!p.connected) continue;
      const c = this.clientsByPlayerId.get(p.playerId);
      if (c && c.ws.readyState === 1) {
        c.ws.send(raw);
      }
    }
  }

  private schedulePresenceBroadcast(): void {
    if (this.presenceBroadcastTimer) return;
    this.presenceBroadcastTimer = setTimeout(() => {
      this.presenceBroadcastTimer = null;
      this.broadcastPresenceNow();
    }, 35);
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
      if (c.ws.readyState === 1) {
        c.ws.send(raw);
      }
    }
  }

  private toPlayerSnapshot(p: EdgeCoopPlayerInternal): CoopPlayerSnapshot {
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

  private toSessionSnapshot(session: EdgeCoopSessionInternal): CoopSessionSnapshot {
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
  ): EdgeConnectedClient {
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
      this.clientsByWs.delete(prevSocketClient.ws);
      try {
        prevSocketClient.ws.close(4001, 'Replaced by new connection');
      } catch {
        // ignore
      }
    }

    const client: EdgeConnectedClient = {
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
      this.handleReconnectSession(client, msg.sessionId, msg.lastKnownCheckpointId ?? null);
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
        if (msg.characterId !== undefined) client.characterId = normalizeCharacterId(msg.characterId);
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
      case 'coop:create_session':
        this.createSession(client, msg.savedCheckpointId ?? null);
        break;
      case 'coop:join_session':
        this.joinSessionByIdentifier(client, msg.sessionId, msg.sessionCode, msg.savedCheckpointId ?? null);
        break;
      case 'coop:leave_session':
        this.leaveSession(client);
        break;
      case 'coop:invite_friend':
        this.sendInvite(client, msg.targetPlayerId, msg.targetFriendCode);
        break;
      case 'coop:invite_respond':
        this.respondInvite(client, msg.inviteId, msg.accept, msg.savedCheckpointId ?? null);
        break;
      case 'coop:player_state':
        this.handlePlayerState(client, msg);
        break;
      case 'coop:activate_checkpoint':
        this.handleActivateCheckpoint(client, msg);
        break;
      case 'coop:player_eaten':
        this.handlePlayerEaten(client, msg);
        break;
      case 'coop:request_respawn':
        this.handleRequestRespawn(client, msg.deathSeq);
        break;
    }
  }

  private generateUniqueSessionCode(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let attempt = 0; attempt < 24; attempt++) {
      let code = '';
      const bytes = new Uint8Array(6);
      crypto.getRandomValues(bytes);
      for (let i = 0; i < 6; i++) {
        code += alphabet[bytes[i] % alphabet.length];
      }
      if (!this.sessionsByCode.has(code)) return code;
    }
    return crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
  }

  private createInitialPlayerState(
    client: EdgeConnectedClient,
    slotIndex: number,
    totalSlots: number,
    savedCheckpointId: string | null
  ): EdgeCoopPlayerInternal {
    const cp = savedCheckpointId ? getWorldCheckpointById(savedCheckpointId) : null;
    const slotSpawn = computeOpenWorldSpawnSlot(slotIndex, totalSlots);
    const startPos = cp
      ? { x: cp.x, y: cp.y + 0.5, z: cp.z, yaw: cp.yaw, regionId: cp.regionId }
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

  private createSession(client: EdgeConnectedClient, savedCheckpointId: string | null): void {
    if (client.sessionId) {
      this.leaveSession(client);
    }
    const sessionId = crypto.randomUUID();
    const sessionCode = this.generateUniqueSessionCode();
    const session: EdgeCoopSessionInternal = {
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

  private allocateSlotIndex(session: EdgeCoopSessionInternal): number {
    const used = new Set<number>();
    for (const p of session.players.values()) used.add(p.slotIndex);
    for (let i = 0; i < session.maxPlayers; i++) {
      if (!used.has(i)) return i;
    }
    return session.players.size;
  }

  private joinSessionByIdentifier(
    client: EdgeConnectedClient,
    sessionId?: string,
    sessionCode?: string,
    savedCheckpointId: string | null = null
  ): boolean {
    let targetSession: EdgeCoopSessionInternal | undefined;
    if (sessionId) targetSession = this.sessions.get(sessionId);
    if (!targetSession && sessionCode) {
      const normalized = sessionCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      targetSession = this.sessionsByCode.get(normalized);
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
    client: EdgeConnectedClient,
    session: EdgeCoopSessionInternal,
    savedCheckpointId: string | null
  ): boolean {
    if (client.sessionId && client.sessionId !== session.sessionId) {
      this.leaveSession(client);
    }
    if (session.cleanupTimer) {
      clearTimeout(session.cleanupTimer);
      session.cleanupTimer = null;
    }

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
        { type: 'coop:player_connection', playerId: client.playerId, connected: true },
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
    const player = this.createInitialPlayerState(client, slotIndex, session.players.size + 1, savedCheckpointId);
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
      { type: 'coop:player_joined', player: this.toPlayerSnapshot(player), hostId: session.hostId },
      client.playerId
    );
    this.schedulePresenceBroadcast();
    return true;
  }

  private handleReconnectSession(
    client: EdgeConnectedClient,
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
      { type: 'coop:player_connection', playerId: client.playerId, connected: true },
      client.playerId
    );
    this.schedulePresenceBroadcast();
  }

  private leaveSession(client: EdgeConnectedClient): void {
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

  private destroySession(session: EdgeCoopSessionInternal): void {
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
      if (inv.sessionId === session.sessionId) this.invites.delete(invId);
    }
  }

  private sendInvite(client: EdgeConnectedClient, targetPlayerId?: string, targetFriendCode?: string): void {
    if (!client.sessionId) this.createSession(client, null);
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

    let target: EdgeConnectedClient | undefined;
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
    this.sendWs(target.ws, { type: 'coop:invite_received', invite });
    this.sendWs(client.ws, { type: 'coop:invite_sent', invite });
  }

  private respondInvite(
    client: EdgeConnectedClient,
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
    client: EdgeConnectedClient,
    msg: Extract<CoopClientMessage, { type: 'coop:player_state' }>
  ): void {
    if (!client.sessionId) return;
    const session = this.sessions.get(client.sessionId);
    const player = session?.players.get(client.playerId);
    if (!session || !player || !player.alive) return;

    const x = clampWorldCoord(msg.x, OPEN_WORLD_BOUNDS.minX - 4, OPEN_WORLD_BOUNDS.maxX + 4, player.x);
    const y = clampWorldCoord(msg.y, OPEN_WORLD_BOUNDS.floorY - 2, OPEN_WORLD_BOUNDS.ceilingY + 4, player.y);
    const z = clampWorldCoord(msg.z, OPEN_WORLD_BOUNDS.minZ - 4, OPEN_WORLD_BOUNDS.maxZ + 4, player.z);
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
    if (regionChanged) this.schedulePresenceBroadcast();
  }

  private handleActivateCheckpoint(
    client: EdgeConnectedClient,
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

    const cx = finiteOr(msg.x, player.x);
    const cy = finiteOr(msg.y, player.y);
    const cz = finiteOr(msg.z, player.z);
    if (Math.hypot(cx - cp.x, cz - cp.z) > 10.5 || Math.abs(cy - cp.y) > 7.5) {
      this.sendWs(client.ws, {
        type: 'coop:error',
        code: 'CHECKPOINT_OUT_OF_RANGE',
        message: 'Player must be near checkpoint to activate it.',
      });
      return;
    }

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
    client: EdgeConnectedClient,
    msg: Extract<CoopClientMessage, { type: 'coop:player_eaten' }>
  ): void {
    if (!client.sessionId) return;
    const session = this.sessions.get(client.sessionId);
    const player = session?.players.get(client.playerId);
    if (!session || !player) return;

    const seq = Math.max(1, Math.floor(finiteOr(msg.deathSeq, player.deathSeq + 1)));
    if ((!player.alive && seq <= player.deathSeq) || seq < player.deathSeq) return;

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

    player.respawnTimer = setTimeout(() => {
      player.respawnTimer = null;
      this.resolvePlayerRespawn(session, player, seq);
    }, this.respawnFailsafeMs);
  }

  private handleRequestRespawn(client: EdgeConnectedClient, rawDeathSeq: number): void {
    if (!client.sessionId) return;
    const session = this.sessions.get(client.sessionId);
    const player = session?.players.get(client.playerId);
    if (!session || !player) return;
    const reqSeq = Math.max(0, Math.floor(finiteOr(rawDeathSeq, player.deathSeq)));
    if (player.alive && reqSeq <= player.deathSeq) {
      this.sendWs(client.ws, {
        type: 'coop:player_respawn',
        respawn: this.buildAuthoritativeRespawnPayload(player, player.deathSeq),
      });
      return;
    }
    if (!player.alive && reqSeq >= player.deathSeq) {
      this.resolvePlayerRespawn(session, player, player.deathSeq);
    }
  }

  private buildAuthoritativeRespawnPayload(
    player: EdgeCoopPlayerInternal,
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
    session: EdgeCoopSessionInternal,
    player: EdgeCoopPlayerInternal,
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

    this.broadcastToSession(session, { type: 'coop:player_respawn', respawn });
  }

  private handleSocketClose(ws: WebSocket): void {
    const client = this.clientsByWs.get(ws);
    if (!client) return;
    this.clientsByWs.delete(ws);

    const activeForPlayer = this.clientsByPlayerId.get(client.playerId);
    if (activeForPlayer && activeForPlayer.ws === ws) {
      this.clientsByPlayerId.delete(client.playerId);
      if (client.sessionId) {
        const session = this.sessions.get(client.sessionId);
        const player = session?.players.get(client.playerId);
        if (session && player) {
          player.connected = false;
          this.broadcastToSession(
            session,
            { type: 'coop:player_connection', playerId: client.playerId, connected: false },
            client.playerId
          );
          const anyConnected = Array.from(session.players.values()).some((p) => p.connected);
          if (!anyConnected && !session.cleanupTimer) {
            session.cleanupTimer = setTimeout(() => {
              session.cleanupTimer = null;
              const stillEmpty = Array.from(session.players.values()).every((p) => !p.connected);
              if (stillEmpty) this.destroySession(session);
            }, this.disconnectGraceMs);
            if (typeof (session.cleanupTimer as unknown as { unref?: () => void }).unref === 'function') {
              (session.cleanupTimer as unknown as { unref: () => void }).unref();
            }
          }
        }
      }
      this.schedulePresenceBroadcast();
    }
  }

  public destroy(): void {
    if (this.presenceBroadcastTimer) {
      clearTimeout(this.presenceBroadcastTimer);
      this.presenceBroadcastTimer = null;
    }
    for (const session of this.sessions.values()) {
      this.destroySession(session);
    }
    this.invites.clear();
    this.clientsByWs.clear();
    this.clientsByPlayerId.clear();
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: buildCorsHeaders(request, env.ALLOWED_ORIGINS) });
    }
    const stub = env.COOP_HUB.get(env.COOP_HUB.idFromName('global-coop-hub'));
    return stub.fetch(request);
  },
};
