import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import {
  createDefaultBotProfiles,
  legalActionsForPlayer,
  type Card,
  type GameAction,
  type GameState
} from "@/lib/euchre";
import { reconstructGameState } from "@/lib/persistence/replay";
import { DuplicateSequenceError } from "@/lib/persistence/types";
import { SoloGameService } from "../game/solo-game-service";
import {
  CorruptMobileDataError,
  DEFAULT_MOBILE_SETTINGS,
  MOBILE_DATABASE_VERSION,
  MobileEventStore
} from "./mobile-event-store";

const stores: MobileEventStore[] = [];

afterEach(async () => {
  for (const store of stores.splice(0)) {
    await store.clear();
  }
});

describe("MobileEventStore", () => {
  it("creates, appends, reloads, and deterministically reconstructs a game", async () => {
    const store = makeStore();
    const game = await store.createGame({ config: { stickDealer: true, targetScore: 5 } });
    const event = await store.appendMove({
      gameId: game.id,
      expectedSequence: 0,
      action: { type: "START_HAND", seed: 12345 }
    });
    const loaded = await store.loadGame(game.id);

    expect(event.sequenceNumber).toBe(0);
    expect(await store.getActiveGameId()).toBe(game.id);
    expect(loaded.events).toHaveLength(1);
    expect(loaded.state).toEqual(reconstructGameState(loaded.events, loaded.game.config, game.id));
    expect(loaded.state.hands[0]).toHaveLength(5);
  });

  it("rejects duplicate move sequences without changing persisted state", async () => {
    const store = makeStore();
    const game = await store.createGame({ config: {} });
    await store.appendMove({
      gameId: game.id,
      expectedSequence: 0,
      action: { type: "START_HAND", seed: 77 }
    });

    await expect(store.appendMove({
      gameId: game.id,
      expectedSequence: 0,
      action: { type: "START_HAND", seed: 78 }
    })).rejects.toBeInstanceOf(DuplicateSequenceError);
    expect((await store.loadMoveHistory(game.id))).toHaveLength(1);
  });

  it("restores an interrupted game and resolves competing bot resumes once", async () => {
    const store = makeStore();
    const service = new SoloGameService(store);
    const created = await service.createGame({ config: { targetScore: 5 }, seed: 2026 });

    await Promise.all([
      service.runOneBotTurn(created.loaded.game.id),
      service.runOneBotTurn(created.loaded.game.id)
    ]);

    const events = await store.loadMoveHistory(created.loaded.game.id);
    expect(events).toHaveLength(2);
    const resumed = await new SoloGameService(store).resumeActiveGame();
    expect(resumed?.loaded.events).toHaveLength(2);
    expect(resumed?.loaded.state).toEqual(reconstructGameState(events, created.loaded.game.config, created.loaded.game.id));
  });

  it("completes a seeded game, clears the active pointer, and exposes immutable local history", async () => {
    const store = makeStore();
    const service = new SoloGameService(store);
    const created = await service.createGame({
      config: { targetScore: 5, stickDealer: true, botDifficulty: "standard" },
      seed: 90210
    });
    const finished = await finishGame(service, created.loaded.game.id);

    expect(finished.phase).toBe("gameComplete");
    expect(await store.getActiveGameId()).toBeNull();
    const history = await service.completedGames();
    expect(history).toHaveLength(1);
    expect(history[0].review.finalScore).toEqual(finished.scores);
    expect(history[0].review.totalEvents).toBe((await store.loadMoveHistory(created.loaded.game.id)).length);
  });

  it("migrates a version-one database and supplies versioned settings defaults", async () => {
    const name = uniqueName("migration");
    await createVersionOneDatabase(name);
    const store = new MobileEventStore(name);
    stores.push(store);

    expect(await store.getSettings()).toEqual(DEFAULT_MOBILE_SETTINGS);
    expect(await store.saveSettings({
      ...DEFAULT_MOBILE_SETTINGS,
      confirmCardPlay: true,
      animationLevel: "reduced"
    })).toMatchObject({ confirmCardPlay: true, animationLevel: "reduced" });
    expect(await databaseVersion(name, store)).toBe(MOBILE_DATABASE_VERSION);
  });

  it("fails safely without erasing corrupt persisted records", async () => {
    const store = makeStore();
    const game = await store.createGame({ config: {} });
    await store.close();
    await replaceGameWithCorruptRecord(store.databaseName, game.id);

    await expect(store.loadGame(game.id)).rejects.toBeInstanceOf(CorruptMobileDataError);
    await expect(store.getActiveGameId()).rejects.toBeInstanceOf(CorruptMobileDataError);
  });
});

async function finishGame(service: SoloGameService, gameId: string): Promise<GameState> {
  for (let step = 0; step < 2_000; step += 1) {
    const snapshot = await service.load(gameId);
    const state = snapshot.loaded.state;
    if (state.phase === "gameComplete") return state;
    if (state.phase === "handComplete") {
      await service.dealNextHand(gameId);
      continue;
    }
    if (state.activePlayer === 0) {
      await service.submitHumanAction(gameId, chooseHumanAction(state));
    } else {
      await service.runOneBotTurn(gameId);
    }
  }
  throw new Error("Seeded mobile game did not finish within the action limit.");
}

function chooseHumanAction(state: GameState): GameAction {
  const legal = legalActionsForPlayer(state, 0);
  if (state.phase === "farmersHand") {
    return { type: "FARMERS_HAND_DECLINE", player: 0 };
  }
  if (state.phase === "ordering") {
    return legal.canOrderUp
      ? { type: "ORDER_UP", player: 0, alone: false }
      : { type: "PASS", player: 0 };
  }
  if (state.phase === "calling") {
    if (legal.callableSuits.length) {
      return { type: "CALL_TRUMP", player: 0, suit: legal.callableSuits[0], alone: false };
    }
    return { type: "PASS", player: 0 };
  }
  if (state.phase === "discarding") {
    return { type: "DISCARD", player: 0, card: cloneCard(state.hands[0][0]) };
  }
  if (state.phase === "playing" && legal.playableCards.length) {
    return { type: "PLAY_CARD", player: 0, card: cloneCard(legal.playableCards[0]) };
  }
  const bot = createDefaultBotProfiles().find((candidate) => candidate.seat === state.activePlayer);
  throw new Error(`No human action for ${state.phase}; active bot ${bot?.name ?? "unknown"}.`);
}

function cloneCard(card: Card): Card {
  return { rank: card.rank, suit: card.suit };
}

function makeStore(): MobileEventStore {
  const store = new MobileEventStore(uniqueName("store"));
  stores.push(store);
  return store;
}

function uniqueName(label: string): string {
  return `euchre-mobile-${label}-${crypto.randomUUID()}`;
}

async function createVersionOneDatabase(name: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => {
      const games = request.result.createObjectStore("games", { keyPath: "id" });
      games.createIndex("by-status", "status");
      games.createIndex("by-updated-at", "updatedAt");
      const events = request.result.createObjectStore("events", { keyPath: "id" });
      events.createIndex("by-game", "gameId");
      events.createIndex("by-game-sequence", ["gameId", "sequenceNumber"], { unique: true });
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
  });
}

async function databaseVersion(name: string, store: MobileEventStore): Promise<number> {
  await store.close();
  return new Promise<number>((resolve, reject) => {
    const request = indexedDB.open(name);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const version = request.result.version;
      request.result.close();
      resolve(version);
    };
  });
}

async function replaceGameWithCorruptRecord(name: string, gameId: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(name);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction("games", "readwrite");
      transaction.objectStore("games").put({ id: gameId, status: "active", config: "invalid" });
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    };
  });
}
