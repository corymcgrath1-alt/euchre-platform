import type { GameAction, GameConfig, HandResult, MoveEvent, PlayerIndex, TeamIndex } from "./types";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface GameRecord {
  id: string;
  status: "active" | "complete" | "abandoned";
  config: GameConfig;
  targetScore: number;
  teamZeroScore: number;
  teamOneScore: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  metadata: JsonValue;
}

export interface GameParticipantRecord {
  id: string;
  gameId: string;
  userId?: string;
  displayName: string;
  seat: PlayerIndex;
  team: TeamIndex;
  isBot: boolean;
  createdAt: string;
}

export interface HandRecord {
  id: string;
  gameId: string;
  handNumber: number;
  dealer: PlayerIndex;
  seed: number;
  result?: HandResult;
  createdAt: string;
  completedAt?: string;
}

export interface MoveEventRecord {
  id: string;
  gameId: string;
  handId?: string;
  sequence: number;
  player?: PlayerIndex;
  actionType: GameAction["type"];
  actionPayload: GameAction;
  event: MoveEvent;
  createdAt: string;
}

export const postgresModelNotes = {
  games: "Store one row per game; config and metadata map cleanly to jsonb in Postgres.",
  participants: "Seat and team are stable for a game; authenticated user ids can be nullable for local games.",
  hands: "Seed plus move log makes each hand replayable without persisting derived state.",
  moveEvents: "Append-only action ledger; realtime multiplayer should broadcast and persist this exact shape."
} as const;
