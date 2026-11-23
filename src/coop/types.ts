import type { PlayerAnimState } from '../game/entities.ts';
import type { CharacterId } from '../game/types.ts';

export const COOP_MAX_PLAYERS = 6;
export const COOP_EAT_DURATION_MS = 2300;
export const COOP_SERVER_RESPAWN_FAILSAFE_MS = 2650;
export const COOP_PLAYER_COLORS = [
  '#52e0b6',
  '#6cb8ff',
  '#f2b657',
  '#f27d8b',
  '#b58eff',
  '#8be870',
] as const;

export type CoopPlatform = 'pc' | 'android';

export type CoopConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting';

export interface CoopOnlineUser {
  playerId: string;
  friendCode: string;
  name: string;
  characterId: CharacterId;
  platform: CoopPlatform;
  status: 'online' | 'in_coop';
  sessionId: string | null;
  regionId: number;
}

export interface CoopInvite {
  inviteId: string;
  sessionId: string;
  sessionCode: string;
  hostId: string;
  hostName: string;
  targetPlayerId: string;
  createdAt: number;
  expiresAt: number;
}

export interface CoopPlayerSnapshot {
  playerId: string;
  friendCode: string;
  name: string;
  characterId: CharacterId;
  platform: CoopPlatform;
  connected: boolean;
  alive: boolean;
  deathSeq: number;
  slotIndex: number;
  colorHex: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  animState: PlayerAnimState;
  horizSpeed: number;
  regionId: number;
  inWater: boolean;
  checkpointId: string | null;
  checkpointRegionId: number;
  checkpointLabel: string;
  checkpointX: number;
  checkpointY: number;
  checkpointZ: number;
  checkpointYaw: number;
}

export interface CoopSessionSnapshot {
  sessionId: string;
  sessionCode: string;
  hostId: string;
  maxPlayers: number;
  players: CoopPlayerSnapshot[];
}

export interface CoopRespawnPayload {
  playerId: string;
  deathSeq: number;
  checkpointId: string | null;
  checkpointRegionId: number;
  checkpointLabel: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  regionId: number;
}

export interface CoopPlayerEatenBroadcast {
  playerId: string;
  deathSeq: number;
  monsterId: string;
  monsterX: number;
  monsterY: number;
  monsterZ: number;
  playerX: number;
  playerY: number;
  playerZ: number;
  playerYaw: number;
}

export interface CoopPlayerMoveBroadcast {
  playerId: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  animState: PlayerAnimState;
  horizSpeed: number;
  regionId: number;
  inWater: boolean;
  alive: boolean;
}

export interface CoopCheckpointConfirmedPayload {
  playerId: string;
  checkpointId: string;
  regionId: number;
  label: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export type CoopClientMessage =
  | {
      type: 'hello';
      playerId: string;
      name: string;
      characterId: CharacterId;
      platform: CoopPlatform;
    }
  | {
      type: 'update_profile';
      name?: string;
      characterId?: CharacterId;
    }
  | {
      type: 'coop:create_session';
      savedCheckpointId?: string | null;
    }
  | {
      type: 'coop:join_session';
      sessionId?: string;
      sessionCode?: string;
      savedCheckpointId?: string | null;
    }
  | {
      type: 'coop:reconnect_session';
      sessionId: string;
      playerId: string;
      name: string;
      characterId: CharacterId;
      platform: CoopPlatform;
      lastKnownCheckpointId?: string | null;
    }
  | {
      type: 'coop:leave_session';
    }
  | {
      type: 'coop:invite_friend';
      targetPlayerId?: string;
      targetFriendCode?: string;
    }
  | {
      type: 'coop:invite_respond';
      inviteId: string;
      accept: boolean;
      savedCheckpointId?: string | null;
    }
  | {
      type: 'coop:player_state';
      x: number;
      y: number;
      z: number;
      yaw: number;
      animState: PlayerAnimState;
      horizSpeed: number;
      regionId: number;
      inWater: boolean;
    }
  | {
      type: 'coop:activate_checkpoint';
      checkpointId: string;
      x: number;
      y: number;
      z: number;
    }
  | {
      type: 'coop:player_eaten';
      deathSeq: number;
      monsterId: string;
      monsterX: number;
      monsterY: number;
      monsterZ: number;
      playerX: number;
      playerY: number;
      playerZ: number;
      playerYaw: number;
    }
  | {
      type: 'coop:request_respawn';
      deathSeq: number;
    }
  | {
      type: 'ping';
      t: number;
    };

export type CoopServerMessage =
  | {
      type: 'welcome';
      playerId: string;
      friendCode: string;
      name: string;
      maxPlayers: number;
    }
  | {
      type: 'presence:update';
      users: CoopOnlineUser[];
    }
  | {
      type: 'coop:invite_received';
      invite: CoopInvite;
    }
  | {
      type: 'coop:invite_sent';
      invite: CoopInvite;
    }
  | {
      type: 'coop:invite_declined';
      inviteId: string;
      targetPlayerId: string;
      targetName: string;
    }
  | {
      type: 'coop:session_state';
      session: CoopSessionSnapshot;
      you: CoopPlayerSnapshot;
      reconnectRestore?: boolean;
    }
  | {
      type: 'coop:player_joined';
      player: CoopPlayerSnapshot;
      hostId: string;
    }
  | {
      type: 'coop:player_left';
      playerId: string;
      hostId: string;
    }
  | {
      type: 'coop:player_connection';
      playerId: string;
      connected: boolean;
    }
  | {
      type: 'coop:player_moved';
      move: CoopPlayerMoveBroadcast;
    }
  | {
      type: 'coop:checkpoint_confirmed';
      checkpoint: CoopCheckpointConfirmedPayload;
    }
  | {
      type: 'coop:player_checkpoint';
      playerId: string;
      checkpointId: string;
      checkpointRegionId: number;
      checkpointLabel: string;
    }
  | {
      type: 'coop:player_eaten_broadcast';
      event: CoopPlayerEatenBroadcast;
    }
  | {
      type: 'coop:player_respawn';
      respawn: CoopRespawnPayload;
    }
  | {
      type: 'coop:error';
      code: string;
      message: string;
    }
  | {
      type: 'pong';
      t: number;
    };

export function sanitizePlayerName(raw: unknown): string {
  if (typeof raw !== 'string') return 'Survivor';
  const cleaned = raw.replace(/[\r\n\t<>]/g, '').trim().slice(0, 18);
  return cleaned.length >= 2 ? cleaned : 'Survivor';
}

export function deriveFriendCode(playerId: string): string {
  let hash = 2166136261;
  for (let i = 0; i < playerId.length; i++) {
    hash ^= playerId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const code = (hash >>> 0).toString(36).toUpperCase().padStart(6, '0').slice(0, 6);
  return `SRP-${code}`;
}
