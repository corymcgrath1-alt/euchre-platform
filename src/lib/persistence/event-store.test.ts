import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalEventStore } from "./local-event-store";
import {
  DuplicateSequenceError,
  GameNotFoundError,
  MoveOrderingError,
  resetEventStoreForTests,
  getEventStore
} from "./event-store";
import { reconstructGameState } from "./replay";
import { firstSeedFromEvents } from "@/lib/euchre";

const testDirs: string[] = [];

afterEach(async () => {
  resetEventStoreForTests(null);
  await Promise.all(testDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("append-only local event store", () => {
  it("appends events in strict sequence order", async () => {
    const store = await createStore();
    const game = await store.createGame({ config: { stickDealer: false, targetScore: 10 } });

    const first = await store.appendMove({
      gameId: game.id,
      expectedSequence: 0,
      action: { type: "START_HAND", seed: 123 }
    });
    const second = await store.appendMove({
      gameId: game.id,
      expectedSequence: 1,
      action: { type: "PASS", player: 1 }
    });

    expect(first.sequenceNumber).toBe(0);
    expect(second.sequenceNumber).toBe(1);
    expect(second.player).toBe(1);
    expect(second.eventType).toBe("PASS");
  });

  it("rejects duplicate sequence numbers per game", async () => {
    const store = await createStore();
    const game = await store.createGame({ config: { stickDealer: false, targetScore: 10 } });

    await store.appendMove({
      gameId: game.id,
      expectedSequence: 0,
      action: { type: "START_HAND", seed: 123 }
    });

    await expect(store.appendMove({
      gameId: game.id,
      expectedSequence: 0,
      action: { type: "PASS", player: 1 }
    })).rejects.toBeInstanceOf(DuplicateSequenceError);
  });

  it("rejects out-of-order gaps", async () => {
    const store = await createStore();
    const game = await store.createGame({ config: { stickDealer: false, targetScore: 10 } });

    await expect(store.appendMove({
      gameId: game.id,
      expectedSequence: 1,
      action: { type: "START_HAND", seed: 123 }
    })).rejects.toBeInstanceOf(MoveOrderingError);
  });

  it("loads move history in deterministic order", async () => {
    const store = await createStore();
    const game = await store.createGame({ config: { stickDealer: false, targetScore: 10 } });

    await store.appendMove({ gameId: game.id, expectedSequence: 0, action: { type: "START_HAND", seed: 456 } });
    await store.appendMove({ gameId: game.id, expectedSequence: 1, action: { type: "PASS", player: 1 } });

    const history = await store.loadMoveHistory(game.id);

    expect(history.map((event) => event.sequenceNumber)).toEqual([0, 1]);
    expect(history.map((event) => event.eventType)).toEqual(["START_HAND", "PASS"]);
  });

  it("keeps the first hand seed available in persisted move history", async () => {
    const store = await createStore();
    const game = await store.createGame({ config: { stickDealer: false, targetScore: 10 } });

    await store.appendMove({ gameId: game.id, expectedSequence: 0, action: { type: "START_HAND", seed: 654321 } });

    const loaded = await store.loadGame(game.id);

    expect(firstSeedFromEvents(loaded.events)).toBe(654321);
    expect(loaded.state.moveLog[0].action).toEqual({ type: "START_HAND", seed: 654321 });
  });

  it("reconstructs game state from stored events", async () => {
    const store = await createStore();
    const game = await store.createGame({ config: { stickDealer: false, targetScore: 10 } });

    await store.appendMove({ gameId: game.id, expectedSequence: 0, action: { type: "START_HAND", seed: 789 } });
    await store.appendMove({ gameId: game.id, expectedSequence: 1, action: { type: "PASS", player: 1 } });
    await store.appendMove({ gameId: game.id, expectedSequence: 2, action: { type: "PASS", player: 2 } });

    const loaded = await store.loadGame(game.id);
    const reconstructed = reconstructGameState(loaded.events, loaded.game.config, loaded.game.id);

    expect(loaded.state).toEqual(reconstructed);
    expect(loaded.state.phase).toBe("ordering");
    expect(loaded.state.activePlayer).toBe(3);
    expect(loaded.state.moveLog).toHaveLength(3);
  });

  it("persists local fallback data across store instances", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "euchre-store-"));
    testDirs.push(dir);
    const filePath = path.join(dir, "events.json");
    const firstStore = new LocalEventStore(filePath);
    const game = await firstStore.createGame({ config: { stickDealer: true, targetScore: 10 } });
    await firstStore.appendMove({ gameId: game.id, expectedSequence: 0, action: { type: "START_HAND", seed: 234 } });

    const secondStore = new LocalEventStore(filePath);
    const loaded = await secondStore.loadGame(game.id);

    expect(loaded.game.config.stickDealer).toBe(true);
    expect(loaded.events).toHaveLength(1);
    expect(loaded.state.phase).toBe("ordering");
  });

  it("defaults missing rule settings for older game configs", async () => {
    const store = await createStore();
    const game = await store.createGame({ config: { stickDealer: false, targetScore: 10 } });
    await store.appendMove({ gameId: game.id, expectedSequence: 0, action: { type: "START_HAND", seed: 123 } });

    const loaded = await store.loadGame(game.id);

    expect(loaded.game.config).toMatchObject({
      botDifficulty: "standard",
      dealerSelection: "default",
      farmersHandMode: "off",
      lonerMode: "aloneOnly"
    });
    expect(loaded.state.config).toMatchObject({
      botDifficulty: "standard",
      dealerSelection: "default",
      farmersHandMode: "off",
      lonerMode: "aloneOnly"
    });
  });

  it("persists selected house rules and reconstructs replay with them", async () => {
    const store = await createStore();
    const game = await store.createGame({
      config: {
        stickDealer: true,
        targetScore: 15,
        botDifficulty: "strong",
        dealerSelection: "seat2",
        farmersHandMode: "replaceThree",
        lonerMode: "withPartnerAllowed"
      }
    });
    await store.appendMove({ gameId: game.id, expectedSequence: 0, action: { type: "START_HAND", seed: 456 } });

    const loaded = await store.loadGame(game.id);
    const reconstructed = reconstructGameState(loaded.events, loaded.game.config, loaded.game.id);

    expect(loaded.game.config).toMatchObject({
      stickDealer: true,
      targetScore: 15,
      botDifficulty: "strong",
      dealerSelection: "seat2",
      farmersHandMode: "replaceThree",
      lonerMode: "withPartnerAllowed"
    });
    expect(loaded.state.config).toMatchObject(loaded.game.config);
    expect(reconstructed.config).toMatchObject(loaded.game.config);
    expect(reconstructed).toEqual(loaded.state);
  });

  it("uses local fallback when Supabase env vars are missing", async () => {
    const originalUrl = process.env.SUPABASE_URL;
    const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    resetEventStoreForTests(null);

    try {
      expect(getEventStore()).toBeInstanceOf(LocalEventStore);
    } finally {
      process.env.SUPABASE_URL = originalUrl;
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
    }
  });

  it("throws when loading a missing game", async () => {
    const store = await createStore();

    await expect(store.loadGame("missing")).rejects.toBeInstanceOf(GameNotFoundError);
  });
});

async function createStore(): Promise<LocalEventStore> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "euchre-store-"));
  testDirs.push(dir);
  return new LocalEventStore(path.join(dir, "events.json"));
}
