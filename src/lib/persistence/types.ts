import type { GameAction, GameConfig, GameState, PlayerIndex } from "@/lib/euchre";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface PersistedGameRecord {
  id: string;
  status: "active" | "complete" | "abandoned";
  config: GameConfig;
  targetScore: number;
  teamZeroScore: number;
  teamOneScore: number;
  metadata: JsonValue;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface PersistedHandRecord {
  id: string;
  gameId: string;
  handNumber: number;
  dealer: PlayerIndex;
  seed: number;
  result?: JsonValue;
  createdAt: string;
  completedAt?: string;
}

export interface PersistedMoveEventRecord {
  id: string;
  gameId: string;
  handId?: string;
  sequenceNumber: number;
  player?: PlayerIndex;
  eventType: GameAction["type"];
  payload: GameAction;
  createdAt: string;
}

export interface CreateGameInput {
  config: Partial<GameConfig>;
  metadata?: JsonValue;
}

export interface AppendMoveInput {
  gameId: string;
  expectedSequence: number;
  action: GameAction;
}

export interface LoadedGame {
  game: PersistedGameRecord;
  events: PersistedMoveEventRecord[];
  state: GameState;
}

export interface EventStore {
  createGame(input: CreateGameInput): Promise<PersistedGameRecord>;
  appendMove(input: AppendMoveInput): Promise<PersistedMoveEventRecord>;
  listGames(status?: PersistedGameRecord["status"]): Promise<PersistedGameRecord[]>;
  loadGame(gameId: string): Promise<LoadedGame>;
  loadMoveHistory(gameId: string): Promise<PersistedMoveEventRecord[]>;
  clear?(): Promise<void>;
}

export class DuplicateSequenceError extends Error {
  constructor(gameId: string, sequence: number) {
    super(`Move sequence ${sequence} already exists for game ${gameId}`);
    this.name = "DuplicateSequenceError";
  }
}

export class MoveOrderingError extends Error {
  constructor(expected: number, received: number) {
    super(`Expected move sequence ${expected}, received ${received}`);
    this.name = "MoveOrderingError";
  }
}

export class GameNotFoundError extends Error {
  constructor(gameId: string) {
    super(`Game ${gameId} was not found`);
    this.name = "GameNotFoundError";
  }
}
