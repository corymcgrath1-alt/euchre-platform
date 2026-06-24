import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeGameConfig, reduceGameAction, type GameState, type PlayerIndex } from "@/lib/euchre";
import {
  DuplicateSequenceError,
  GameNotFoundError,
  MoveOrderingError,
  type AppendMoveInput,
  type CreateGameInput,
  type EventStore,
  type LoadedGame,
  type PersistedGameRecord,
  type PersistedHandRecord,
  type PersistedMoveEventRecord
} from "./types";
import { eventPlayer, eventType, reconstructGameState } from "./replay";

interface LocalEventStoreData {
  games: PersistedGameRecord[];
  hands: PersistedHandRecord[];
  events: PersistedMoveEventRecord[];
}

const DEFAULT_DATA: LocalEventStoreData = {
  games: [],
  hands: [],
  events: []
};

export class LocalEventStore implements EventStore {
  constructor(private readonly filePath = defaultStorePath()) {}

  async createGame(input: CreateGameInput): Promise<PersistedGameRecord> {
    const data = await this.readData();
    const now = new Date().toISOString();
    const config = normalizeGameConfig(input.config);
    const game: PersistedGameRecord = {
      id: randomId("game"),
      status: "active",
      config,
      targetScore: config.targetScore,
      teamZeroScore: 0,
      teamOneScore: 0,
      metadata: input.metadata ?? {},
      createdAt: now,
      updatedAt: now
    };

    data.games.push(game);
    await this.writeData(data);
    return game;
  }

  async appendMove(input: AppendMoveInput): Promise<PersistedMoveEventRecord> {
    const data = await this.readData();
    const game = data.games.find((candidate) => candidate.id === input.gameId);
    if (!game) {
      throw new GameNotFoundError(input.gameId);
    }

    const gameEvents = data.events
      .filter((event) => event.gameId === input.gameId)
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    const expectedSequence = gameEvents.length;
    if (input.expectedSequence !== expectedSequence) {
      if (gameEvents.some((event) => event.sequenceNumber === input.expectedSequence)) {
        throw new DuplicateSequenceError(input.gameId, input.expectedSequence);
      }
      throw new MoveOrderingError(expectedSequence, input.expectedSequence);
    }

    if (gameEvents.some((event) => event.sequenceNumber === input.expectedSequence)) {
      throw new DuplicateSequenceError(input.gameId, input.expectedSequence);
    }

    const currentState = reconstructGameState(gameEvents, game.config);
    const hand = getOrCreateHand(data, input.gameId, currentState, input.action);
    const createdAt = new Date().toISOString();
    const event: PersistedMoveEventRecord = {
      id: randomId("event"),
      gameId: input.gameId,
      handId: hand?.id,
      sequenceNumber: input.expectedSequence,
      player: eventPlayer(input.action),
      eventType: eventType(input.action),
      payload: input.action,
      createdAt
    };

    const nextState = reduceGameAction(currentState, input.action);
    data.events.push(event);
    updateGameFromState(game, nextState, createdAt);
    updateHandFromState(hand, nextState, createdAt);
    await this.writeData(data);
    return event;
  }

  async loadGame(gameId: string): Promise<LoadedGame> {
    const data = await this.readData();
    const game = data.games.find((candidate) => candidate.id === gameId);
    if (!game) {
      throw new GameNotFoundError(gameId);
    }

    const events = await this.loadMoveHistory(gameId);
    return {
      game,
      events,
      state: reconstructGameState(events, game.config, game.id)
    };
  }

  async listGames(status?: PersistedGameRecord["status"]): Promise<PersistedGameRecord[]> {
    const data = await this.readData();
    return data.games
      .filter((game) => status === undefined || game.status === status)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async loadMoveHistory(gameId: string): Promise<PersistedMoveEventRecord[]> {
    const data = await this.readData();
    if (!data.games.some((candidate) => candidate.id === gameId)) {
      throw new GameNotFoundError(gameId);
    }

    return data.events
      .filter((event) => event.gameId === gameId)
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  }

  async clear(): Promise<void> {
    await rm(this.filePath, { force: true });
  }

  private async readData(): Promise<LocalEventStoreData> {
    try {
      const raw = await readFile(this.filePath, "utf-8");
      const parsed = JSON.parse(raw) as LocalEventStoreData;
      return {
        games: (parsed.games ?? []).map(normalizePersistedGame),
        hands: parsed.hands ?? [],
        events: parsed.events ?? []
      };
    } catch {
      return { ...DEFAULT_DATA, games: [], hands: [], events: [] };
    }
  }

  private async writeData(data: LocalEventStoreData): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(data, null, 2), "utf-8");
  }
}

function normalizePersistedGame(game: PersistedGameRecord): PersistedGameRecord {
  const config = normalizeGameConfig(game.config);
  return {
    ...game,
    config,
    targetScore: game.targetScore ?? config.targetScore
  };
}

function getOrCreateHand(
  data: LocalEventStoreData,
  gameId: string,
  state: GameState,
  action: AppendMoveInput["action"]
): PersistedHandRecord | undefined {
  const nextHandNumber = action.type === "START_HAND" || action.type === "NEXT_HAND"
    ? state.handNumber + 1
    : state.handNumber;

  if (nextHandNumber < 1) {
    return undefined;
  }

  const existing = data.hands.find((hand) => hand.gameId === gameId && hand.handNumber === nextHandNumber);
  if (existing) {
    return existing;
  }

  const seed = action.type === "START_HAND" || action.type === "NEXT_HAND" ? action.seed : 0;
  const dealer = action.type === "NEXT_HAND" ? ((state.dealer + 1) % 4) as PlayerIndex : state.dealer;
  const hand: PersistedHandRecord = {
    id: randomId("hand"),
    gameId,
    handNumber: nextHandNumber,
    dealer,
    seed,
    createdAt: new Date().toISOString()
  };
  data.hands.push(hand);
  return hand;
}

function updateGameFromState(game: PersistedGameRecord, state: GameState, updatedAt: string): void {
  game.status = state.phase === "gameComplete" ? "complete" : "active";
  game.teamZeroScore = state.scores[0];
  game.teamOneScore = state.scores[1];
  game.updatedAt = updatedAt;
  if (state.phase === "gameComplete") {
    game.completedAt = updatedAt;
  }
}

function updateHandFromState(hand: PersistedHandRecord | undefined, state: GameState, updatedAt: string): void {
  if (!hand || state.handNumber !== hand.handNumber) {
    return;
  }

  if (state.handResult || state.phase === "handComplete" || state.phase === "gameComplete") {
    hand.result = state.handResult ? JSON.parse(JSON.stringify(state.handResult)) : null;
    hand.completedAt = updatedAt;
  }
}

function defaultStorePath(): string {
  return path.join(process.cwd(), ".data", "local-event-store.json");
}

function randomId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}
