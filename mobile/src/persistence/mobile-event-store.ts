import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from "idb";
import { normalizeGameConfig, reduceGameAction, type GameState } from "@/lib/euchre";
import {
  DuplicateSequenceError,
  GameNotFoundError,
  MoveOrderingError,
  type AppendMoveInput,
  type CreateGameInput,
  type EventStore,
  type JsonValue,
  type LoadedGame,
  type PersistedGameRecord,
  type PersistedMoveEventRecord
} from "@/lib/persistence/types";
import { eventPlayer, eventType, reconstructGameState } from "@/lib/persistence/replay";
import { z } from "zod";

export const MOBILE_DATABASE_VERSION = 2;
export const DEFAULT_MOBILE_DATABASE_NAME = "euchre-club-offline-v1";

export type AnimationLevel = "full" | "reduced" | "none";

export interface MobileSettings {
  readonly haptics: boolean;
  readonly animationLevel: AnimationLevel;
  readonly confirmCardPlay: boolean;
  readonly autoDealNextHand: boolean;
}

export const DEFAULT_MOBILE_SETTINGS: MobileSettings = {
  haptics: true,
  animationLevel: "full",
  confirmCardPlay: false,
  autoDealNextHand: false
};

interface MobileMetaRecord {
  key: "activeGameId" | "schemaVersion";
  value: string | number | null;
}

interface MobileSettingsRecord {
  key: "settings";
  value: MobileSettings;
}

interface MobileDatabase extends DBSchema {
  games: {
    key: string;
    value: PersistedGameRecord;
    indexes: {
      "by-status": PersistedGameRecord["status"];
      "by-updated-at": string;
    };
  };
  events: {
    key: string;
    value: PersistedMoveEventRecord;
    indexes: {
      "by-game": string;
      "by-game-sequence": [string, number];
    };
  };
  meta: {
    key: MobileMetaRecord["key"];
    value: MobileMetaRecord;
  };
  settings: {
    key: MobileSettingsRecord["key"];
    value: MobileSettingsRecord;
  };
}

export class CorruptMobileDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CorruptMobileDataError";
  }
}

export class MobileEventStore implements EventStore {
  private database?: Promise<IDBPDatabase<MobileDatabase>>;

  constructor(readonly databaseName = DEFAULT_MOBILE_DATABASE_NAME) {}

  async createGame(input: CreateGameInput): Promise<PersistedGameRecord> {
    const db = await this.open();
    const transaction = db.transaction(["games", "meta"], "readwrite");
    const now = new Date().toISOString();
    const config = normalizeGameConfig(input.config);
    const game: PersistedGameRecord = {
      id: randomId("game"),
      status: "active",
      config,
      targetScore: config.targetScore,
      teamZeroScore: 0,
      teamOneScore: 0,
      metadata: cloneJson(input.metadata ?? {}),
      createdAt: now,
      updatedAt: now
    };

    await transaction.objectStore("games").add(game);
    await transaction.objectStore("meta").put({ key: "activeGameId", value: game.id });
    await transaction.done;
    return cloneGame(game);
  }

  async appendMove(input: AppendMoveInput): Promise<PersistedMoveEventRecord> {
    const db = await this.open();
    const transaction = db.transaction(["games", "events", "meta"], "readwrite");
    const gameStore = transaction.objectStore("games");
    const eventStore = transaction.objectStore("events");
    const game = parseGame(await gameStore.get(input.gameId));

    if (!game) {
      throw new GameNotFoundError(input.gameId);
    }

    const events = parseEvents(await eventStore.index("by-game").getAll(input.gameId));
    const expectedSequence = events.length;
    if (input.expectedSequence !== expectedSequence) {
      if (events.some((event) => event.sequenceNumber === input.expectedSequence)) {
        throw new DuplicateSequenceError(input.gameId, input.expectedSequence);
      }
      throw new MoveOrderingError(expectedSequence, input.expectedSequence);
    }

    const currentState = reconstructGameState(events, game.config, game.id);
    const nextState = reduceGameAction(currentState, cloneAction(input.action));
    const createdAt = new Date().toISOString();
    const event: PersistedMoveEventRecord = {
      id: randomId("event"),
      gameId: input.gameId,
      sequenceNumber: input.expectedSequence,
      player: eventPlayer(input.action),
      eventType: eventType(input.action),
      payload: cloneAction(input.action),
      createdAt
    };

    updateGameFromState(game, nextState, createdAt);
    await eventStore.add(event);
    await gameStore.put(game);
    if (game.status === "complete") {
      await transaction.objectStore("meta").put({ key: "activeGameId", value: null });
    }
    await transaction.done;
    return cloneEvent(event);
  }

  async listGames(status?: PersistedGameRecord["status"]): Promise<PersistedGameRecord[]> {
    const db = await this.open();
    const records = status
      ? await db.getAllFromIndex("games", "by-status", status)
      : await db.getAll("games");
    return records
      .map((record) => parseGame(record))
      .filter((record): record is PersistedGameRecord => Boolean(record))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map(cloneGame);
  }

  async loadGame(gameId: string): Promise<LoadedGame> {
    const db = await this.open();
    const game = parseGame(await db.get("games", gameId));
    if (!game) {
      throw new GameNotFoundError(gameId);
    }
    const events = await this.loadMoveHistory(gameId);
    return {
      game: cloneGame(game),
      events,
      state: reconstructGameState(events, game.config, game.id)
    };
  }

  async loadMoveHistory(gameId: string): Promise<PersistedMoveEventRecord[]> {
    const db = await this.open();
    const game = parseGame(await db.get("games", gameId));
    if (!game) {
      throw new GameNotFoundError(gameId);
    }
    return parseEvents(await db.getAllFromIndex("events", "by-game", gameId)).map(cloneEvent);
  }

  async getActiveGameId(): Promise<string | null> {
    const db = await this.open();
    const record = await db.get("meta", "activeGameId");
    if (!record || record.value === null) return null;
    if (typeof record.value !== "string") {
      throw new CorruptMobileDataError("The active-game pointer is invalid.");
    }
    const game = parseGame(await db.get("games", record.value));
    if (!game || game.status !== "active") {
      await db.put("meta", { key: "activeGameId", value: null });
      return null;
    }
    return game.id;
  }

  async setActiveGameId(gameId: string | null): Promise<void> {
    const db = await this.open();
    if (gameId !== null) {
      const game = parseGame(await db.get("games", gameId));
      if (!game || game.status !== "active") {
        throw new GameNotFoundError(gameId);
      }
    }
    await db.put("meta", { key: "activeGameId", value: gameId });
  }

  async abandonGame(gameId: string): Promise<void> {
    const db = await this.open();
    const transaction = db.transaction(["games", "meta"], "readwrite");
    const game = parseGame(await transaction.objectStore("games").get(gameId));
    if (!game) {
      throw new GameNotFoundError(gameId);
    }
    game.status = "abandoned";
    game.updatedAt = new Date().toISOString();
    await transaction.objectStore("games").put(game);
    await transaction.objectStore("meta").put({ key: "activeGameId", value: null });
    await transaction.done;
  }

  async getSettings(): Promise<MobileSettings> {
    const db = await this.open();
    const record = await db.get("settings", "settings");
    if (!record) return { ...DEFAULT_MOBILE_SETTINGS };
    const result = mobileSettingsSchema.safeParse(record.value);
    if (!result.success) {
      throw new CorruptMobileDataError("Saved settings are invalid.");
    }
    return { ...result.data };
  }

  async saveSettings(settings: MobileSettings): Promise<MobileSettings> {
    const parsed = mobileSettingsSchema.parse(settings);
    const db = await this.open();
    await db.put("settings", { key: "settings", value: parsed });
    return { ...parsed };
  }

  async deleteCompletedHistory(): Promise<void> {
    const db = await this.open();
    const transaction = db.transaction(["games", "events"], "readwrite");
    const completedGames = await transaction.objectStore("games").index("by-status").getAll("complete");
    for (const game of completedGames) {
      const eventKeys = await transaction.objectStore("events").index("by-game").getAllKeys(game.id);
      for (const key of eventKeys) {
        await transaction.objectStore("events").delete(key);
      }
      await transaction.objectStore("games").delete(game.id);
    }
    await transaction.done;
  }

  async clear(): Promise<void> {
    const db = await this.open();
    db.close();
    this.database = undefined;
    await deleteDB(this.databaseName);
  }

  async close(): Promise<void> {
    if (!this.database) return;
    const db = await this.database;
    db.close();
    this.database = undefined;
  }

  private open(): Promise<IDBPDatabase<MobileDatabase>> {
    this.database ??= openDB<MobileDatabase>(this.databaseName, MOBILE_DATABASE_VERSION, {
      upgrade(database, oldVersion, _newVersion, transaction) {
        if (oldVersion < 1) {
          const games = database.createObjectStore("games", { keyPath: "id" });
          games.createIndex("by-status", "status");
          games.createIndex("by-updated-at", "updatedAt");
          const events = database.createObjectStore("events", { keyPath: "id" });
          events.createIndex("by-game", "gameId");
          events.createIndex("by-game-sequence", ["gameId", "sequenceNumber"], { unique: true });
        }
        if (oldVersion < 2) {
          database.createObjectStore("meta", { keyPath: "key" });
          database.createObjectStore("settings", { keyPath: "key" });
          transaction.objectStore("meta").put({ key: "schemaVersion", value: MOBILE_DATABASE_VERSION });
        }
      },
      blocked() {
        throw new CorruptMobileDataError("Local storage upgrade is blocked by another open Euchre Club window.");
      }
    });
    return this.database;
  }
}

const cardSchema = z.object({
  rank: z.enum(["9", "10", "J", "Q", "K", "A"]),
  suit: z.enum(["clubs", "diamonds", "hearts", "spades"])
}).strict();

const gameActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("START_HAND"), seed: z.number().int() }).strict(),
  z.object({ type: z.literal("FARMERS_HAND_DECLINE"), player: playerSchema() }).strict(),
  z.object({ type: z.literal("FARMERS_HAND_REDEAL"), player: playerSchema(), seed: z.number().int() }).strict(),
  z.object({ type: z.literal("FARMERS_HAND_REPLACE"), player: playerSchema(), cards: z.array(cardSchema) }).strict(),
  z.object({ type: z.literal("PASS"), player: playerSchema() }).strict(),
  z.object({ type: z.literal("ORDER_UP"), player: playerSchema(), alone: z.boolean().optional() }).strict(),
  z.object({ type: z.literal("CALL_TRUMP"), player: playerSchema(), suit: cardSchema.shape.suit, alone: z.boolean().optional() }).strict(),
  z.object({ type: z.literal("DISCARD"), player: playerSchema(), card: cardSchema }).strict(),
  z.object({ type: z.literal("PLAY_CARD"), player: playerSchema(), card: cardSchema }).strict(),
  z.object({ type: z.literal("NEXT_HAND"), seed: z.number().int() }).strict(),
  z.object({ type: z.literal("RESET_GAME") }).strict()
]);

const gameConfigSchema = z.object({
  stickDealer: z.boolean(),
  targetScore: z.number().int().positive(),
  botDifficulty: z.enum(["easy", "standard", "strong"]),
  dealerSelection: z.enum(["default", "human", "seat0", "seat1", "seat2", "seat3"]),
  farmersHandMode: z.enum(["off", "redeal", "replaceThree"]),
  lonerMode: z.enum(["aloneOnly", "withPartnerAllowed"])
}).strict();

const persistedGameSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["active", "complete", "abandoned"]),
  config: gameConfigSchema,
  targetScore: z.number().int().positive(),
  teamZeroScore: z.number().int().nonnegative(),
  teamOneScore: z.number().int().nonnegative(),
  metadata: z.unknown(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional()
}).strict();

const persistedEventSchema = z.object({
  id: z.string().min(1),
  gameId: z.string().min(1),
  handId: z.string().optional(),
  sequenceNumber: z.number().int().nonnegative(),
  player: playerSchema().optional(),
  eventType: z.string(),
  payload: gameActionSchema,
  createdAt: z.string().datetime()
}).strict();

const mobileSettingsSchema = z.object({
  haptics: z.boolean(),
  animationLevel: z.enum(["full", "reduced", "none"]),
  confirmCardPlay: z.boolean(),
  autoDealNextHand: z.boolean()
}).strict();

function playerSchema() {
  return z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);
}

function parseGame(value: unknown): PersistedGameRecord | undefined {
  if (value === undefined) return undefined;
  const result = persistedGameSchema.safeParse(value);
  if (!result.success) {
    throw new CorruptMobileDataError("A saved game record is invalid.");
  }
  return {
    ...result.data,
    config: result.data.config,
    metadata: result.data.metadata as JsonValue
  };
}

function parseEvents(values: unknown[]): PersistedMoveEventRecord[] {
  const events = values.map((value) => {
    const result = persistedEventSchema.safeParse(value);
    if (!result.success) {
      throw new CorruptMobileDataError("A saved move event is invalid.");
    }
    return result.data as PersistedMoveEventRecord;
  }).sort((left, right) => left.sequenceNumber - right.sequenceNumber);

  for (let index = 0; index < events.length; index += 1) {
    if (events[index].sequenceNumber !== index) {
      throw new CorruptMobileDataError("Saved move events are not contiguous.");
    }
  }
  return events;
}

function updateGameFromState(game: PersistedGameRecord, state: GameState, updatedAt: string): void {
  game.status = state.phase === "gameComplete" ? "complete" : "active";
  game.teamZeroScore = state.scores[0];
  game.teamOneScore = state.scores[1];
  game.updatedAt = updatedAt;
  game.completedAt = state.phase === "gameComplete" ? updatedAt : undefined;
}

function cloneGame(game: PersistedGameRecord): PersistedGameRecord {
  return structuredClone(game);
}

function cloneEvent(event: PersistedMoveEventRecord): PersistedMoveEventRecord {
  return structuredClone(event);
}

function cloneAction(action: AppendMoveInput["action"]): AppendMoveInput["action"] {
  return structuredClone(action);
}

function cloneJson(value: JsonValue): JsonValue {
  return structuredClone(value);
}

function randomId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}
