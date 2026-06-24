import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyMoveEvent,
  createDefaultBotProfiles,
  createInitialGameState,
  chooseBotAction,
  legalActionsForPlayer,
  teamOf,
  type GameAction,
  type GameConfig,
  type GameState,
  type PlayerIndex,
  type TeamIndex
} from "@/lib/euchre";
import { LocalEventStore } from "@/lib/persistence/event-store";
import { persistedEventToMoveEvent, reconstructGameState } from "@/lib/persistence/replay";
import type { PersistedMoveEventRecord } from "@/lib/persistence/types";
import { buildGameReview, GameReviewUnavailableError } from "./game-review";

const testDirs: string[] = [];
const bots = createDefaultBotProfiles();

afterEach(async () => {
  await Promise.all(testDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("game review stats extraction", () => {
  it("extracts deterministic stats from a completed multi-hand event history", async () => {
    const { loaded } = await createCompletedGame(13_579);
    const review = buildGameReview({
      gameId: loaded.game.id,
      config: loaded.game.config,
      events: loaded.events
    });
    const expected = collectExpectedStats(loaded.events, loaded.game.config);

    expect(review.gameId).toBe(loaded.game.id);
    expect(review.finalScore).toEqual(loaded.state.scores);
    expect(review.winningTeam).toBe(expected.winningTeam);
    expect(review.totalHandsPlayed).toBe(expected.handCount);
    expect(review.totalEvents).toBe(loaded.events.length);
    expect(review.totalTricksPlayed).toBe(expected.totalTricks);
    expect(review.ruleSummary.targetScoreLabel).toBe(String(loaded.game.config.targetScore));
    expect(review.ruleSummary.seedLabel).toBe("13579");
    expect(review.totalEuchres).toBe(expected.euchres);
    expect(review.totalSuccessfulMakerHands).toBe(expected.successfulMakers);
    expect(review.totalFailedMakerHands).toBe(expected.failedMakers);
    expect(review.totalLoneAttempts).toBe(expected.loneAttempts);
    expect(review.totalSuccessfulLoneHands).toBe(expected.successfulLoners);
    expect(review.totalDealerPickups).toBe(expected.dealerPickups);
    expect(review.totalPassedHands).toBe(expected.passedHands);
    expect(review.longestScoringStreakByTeam).toEqual(expected.longestStreak);
    expect(review.hands).toHaveLength(expected.handCount);
    expect(review.hands.every((hand) => hand.tricks.length === 5 || hand.passed)).toBe(true);
  }, 30_000);

  it("adds hand-by-hand bidding, scoring, and trick details", async () => {
    const { loaded } = await createOrderedUpCompletedGame({ alone: false });
    const review = buildGameReview({
      gameId: loaded.game.id,
      config: loaded.game.config,
      events: loaded.events
    });
    const hand = review.hands[0];

    expect(hand.handNumber).toBe(1);
    expect(hand.dealer).toBe(0);
    expect(hand.upcard).toBeDefined();
    expect(hand.trumpSuit).toBe(hand.upcard?.suit);
    expect(hand.maker).toBe(1);
    expect(hand.makerTeam).toBe(teamOf(1));
    expect(hand.defendingTeam).toBe(teamOf(1) === 0 ? 1 : 0);
    expect(hand.roundOneBids).toEqual([
      expect.objectContaining({ player: 1, round: 1, decision: "order-up", suit: hand.upcard?.suit })
    ]);
    expect(hand.roundTwoBids).toEqual([]);
    expect(hand.dealerPickup).toEqual({ orderedBy: 1, dealer: 0, upcard: hand.upcard });
    expect(hand.dealerDiscard).toEqual(expect.objectContaining({ dealer: 0 }));
    expect(hand.pointsAwarded).toEqual(loaded.state.handResult?.pointsAwarded);
    expect(hand.teamScoreAfterHand).toEqual(loaded.state.scores);
    expect(hand.makerTricks).toBe(loaded.state.handResult?.tricksWon[hand.makerTeam ?? 0]);
    expect(hand.defenderTricks).toBe(5 - hand.makerTricks);
    expect(hand.makersSucceeded).toBe(!loaded.state.handResult?.euchred);
    expect(hand.defendersEuchredMakers).toBe(Boolean(loaded.state.handResult?.euchred));
  });

  it("adds five trick reviews with winner, suit, trump, and caller relation data", async () => {
    const { loaded } = await createOrderedUpCompletedGame({ alone: false });
    const review = buildGameReview({
      gameId: loaded.game.id,
      config: loaded.game.config,
      events: loaded.events
    });
    const hand = review.hands[0];

    expect(hand.tricks).toHaveLength(5);
    hand.tricks.forEach((trick, index) => {
      const engineTrick = loaded.state.completedTricks[index];
      expect(trick.handNumber).toBe(1);
      expect(trick.trickNumber).toBe(index + 1);
      expect(trick.leader).toBe(engineTrick.leader);
      expect(trick.winningSeat).toBe(engineTrick.winner);
      expect(trick.winningTeam).toBe(teamOf(engineTrick.winner as PlayerIndex));
      expect(trick.trumpSuit).toBe(hand.trumpSuit);
      expect(trick.cardsPlayed).toHaveLength(4);
      expect(trick.cardsPlayed.map((play) => play.player)).toEqual(engineTrick.plays.map((play) => play.player));
      expect(trick.cardsPlayed.every((play) => play.sequenceNumber >= 0)).toBe(true);
      expect(["caller", "partner", "opponent"]).toContain(trick.winnerRelationToCaller);
      expect(trick.winnerUsedTrump).toBe(
        trick.cardsPlayed.find((play) => play.player === trick.winningSeat)?.playedTrump
      );
    });
  });

  it("represents lone attempts in hand review details", async () => {
    const { loaded } = await createOrderedUpCompletedGame({ alone: true });
    const review = buildGameReview({
      gameId: loaded.game.id,
      config: loaded.game.config,
      events: loaded.events
    });
    const hand = review.hands[0];

    expect(hand.aloneDeclared).toBe(true);
    expect(hand.lone).toBe(true);
    expect(hand.roundOneBids[0]).toEqual(expect.objectContaining({ alone: true }));
    expect(hand.loneSucceeded).toBe(Boolean(loaded.state.handResult?.lone && loaded.state.handResult.march));
  });

  it("extracts per-team and per-seat caller and trick counts from replay", async () => {
    const { loaded } = await createCompletedGame(13_579);
    const review = buildGameReview({
      gameId: loaded.game.id,
      config: loaded.game.config,
      events: loaded.events
    });
    const expected = collectExpectedStats(loaded.events, loaded.game.config);

    for (const team of [0, 1] as TeamIndex[]) {
      expect(review.teams[team].pointsScored).toBe(loaded.state.scores[team]);
      expect(review.teams[team].makerHands).toBe(expected.teamMakerHands[team]);
      expect(review.teams[team].tricksWon).toBe(expected.teamTricks[team]);
      expect(review.teams[team].defenderEuchres).toBe(expected.teamDefenderEuchres[team]);
    }

    for (const seat of [0, 1, 2, 3] as PlayerIndex[]) {
      expect(review.seats[seat].seat).toBe(seat);
      expect(review.seats[seat].team).toBe(teamOf(seat));
      expect(review.seats[seat].handsDealt).toBe(expected.deals[seat]);
      expect(review.seats[seat].timesCaller).toBe(expected.callers[seat]);
      expect(review.seats[seat].tricksWon).toBe(expected.seatTricks[seat]);
      expect(review.seats[seat].cardsPlayed).toBe(expected.cardsPlayed[seat]);
      expect(review.seats[seat].firstTricksWon).toBe(expected.firstTricks[seat]);
      expect(review.seats[seat].finalTricksWon).toBe(expected.finalTricks[seat]);
    }
  }, 30_000);

  it("is deterministic across repeated runs", async () => {
    const { loaded } = await createCompletedGame(24_601);
    const first = buildGameReview({
      gameId: loaded.game.id,
      config: loaded.game.config,
      events: loaded.events
    });
    const second = buildGameReview({
      gameId: loaded.game.id,
      config: loaded.game.config,
      events: loaded.events
    });

    expect(second).toEqual(first);
    expect(reconstructGameState(loaded.events, loaded.game.config, loaded.game.id)).toEqual(loaded.state);
  }, 30_000);

  it("rejects incomplete game histories", async () => {
    const store = await createStore();
    const game = await store.createGame({ config: { stickDealer: false, targetScore: 10 } });
    await store.appendMove({ gameId: game.id, expectedSequence: 0, action: { type: "START_HAND", seed: 1 } });
    const loaded = await store.loadGame(game.id);

    expect(() => buildGameReview({
      gameId: loaded.game.id,
      config: loaded.game.config,
      events: loaded.events
    })).toThrow(GameReviewUnavailableError);
  });
});

async function createCompletedGame(seed: number) {
  const store = await createStore();
  const game = await store.createGame({ config: { stickDealer: false, targetScore: 4 } });
  await store.appendMove({ gameId: game.id, expectedSequence: 0, action: { type: "START_HAND", seed } });

  let loaded = await store.loadGame(game.id);
  for (let index = 0; index < 700 && loaded.state.phase !== "gameComplete"; index += 1) {
    const action = loaded.state.phase === "handComplete"
      ? { type: "NEXT_HAND", seed: seed + loaded.state.handNumber } as GameAction
      : chooseNextAction(loaded.state);

    expect(action).not.toBeNull();
    await store.appendMove({
      gameId: game.id,
      expectedSequence: loaded.events.length,
      action: action as GameAction
    });
    loaded = await store.loadGame(game.id);
  }

  expect(loaded.state.phase).toBe("gameComplete");
  expect(loaded.state.handNumber).toBeGreaterThan(1);
  return { store, loaded };
}

async function createOrderedUpCompletedGame({ alone }: { alone: boolean }) {
  const store = await createStore();
  const game = await store.createGame({ config: { stickDealer: false, targetScore: 1 } });
  await store.appendMove({ gameId: game.id, expectedSequence: 0, action: { type: "START_HAND", seed: 42 } });
  let loaded = await store.loadGame(game.id);
  await store.appendMove({
    gameId: game.id,
    expectedSequence: loaded.events.length,
    action: { type: "ORDER_UP", player: 1, alone }
  });
  loaded = await store.loadGame(game.id);
  await store.appendMove({
    gameId: game.id,
    expectedSequence: loaded.events.length,
    action: { type: "DISCARD", player: loaded.state.dealer, card: loaded.state.hands[loaded.state.dealer][0] }
  });
  loaded = await store.loadGame(game.id);

  for (let index = 0; index < 40 && loaded.state.phase === "playing"; index += 1) {
    const player = loaded.state.activePlayer;
    const card = legalActionsForPlayer(loaded.state, player).playableCards[0];
    await store.appendMove({
      gameId: game.id,
      expectedSequence: loaded.events.length,
      action: { type: "PLAY_CARD", player, card }
    });
    loaded = await store.loadGame(game.id);
  }

  expect(loaded.state.phase).toBe("gameComplete");
  return { store, loaded };
}

function chooseNextAction(state: GameState): GameAction | null {
  const bot = bots.find((candidate) => candidate.seat === state.activePlayer);
  if (bot) {
    return chooseBotAction(state, bot);
  }

  const legal = legalActionsForPlayer(state, 0);
  if (state.phase === "ordering" && legal.canPass) {
    return { type: "PASS", player: 0 };
  }

  if (state.phase === "calling") {
    if (legal.canPass) {
      return { type: "PASS", player: 0 };
    }

    const suit = legal.callableSuits[0];
    return suit ? { type: "CALL_TRUMP", player: 0, suit } : null;
  }

  if (state.phase === "discarding") {
    const card = state.hands[0][0];
    return card ? { type: "DISCARD", player: 0, card } : null;
  }

  if (state.phase === "playing") {
    const card = legal.playableCards[0];
    return card ? { type: "PLAY_CARD", player: 0, card } : null;
  }

  return null;
}

function collectExpectedStats(events: PersistedMoveEventRecord[], config: GameConfig) {
  let state = createInitialGameState(config);
  const deals: [number, number, number, number] = [0, 0, 0, 0];
  const callers: [number, number, number, number] = [0, 0, 0, 0];
  const seatTricks: [number, number, number, number] = [0, 0, 0, 0];
  const cardsPlayed: [number, number, number, number] = [0, 0, 0, 0];
  const firstTricks: [number, number, number, number] = [0, 0, 0, 0];
  const finalTricks: [number, number, number, number] = [0, 0, 0, 0];
  const teamTricks: [number, number] = [0, 0];
  const teamMakerHands: [number, number] = [0, 0];
  const teamDefenderEuchres: [number, number] = [0, 0];
  const longestStreak: [number, number] = [0, 0];
  let currentScoringTeam: TeamIndex | null = null;
  let currentStreak = 0;
  let handCount = 0;
  let totalTricks = 0;
  let euchres = 0;
  let successfulMakers = 0;
  let failedMakers = 0;
  let loneAttempts = 0;
  let successfulLoners = 0;
  let dealerPickups = 0;
  let passedHands = 0;

  for (const event of events) {
    const before = state;
    const move = persistedEventToMoveEvent(event);
    state = applyMoveEvent(state, move);

    if (event.eventType === "START_HAND" || event.eventType === "NEXT_HAND") {
      deals[state.dealer] += 1;
    }

    if (event.eventType === "ORDER_UP") {
      dealerPickups += 1;
    }

    if (event.eventType === "PLAY_CARD" && event.player !== undefined) {
      cardsPlayed[event.player] += 1;
    }

    if (before.phase !== "handComplete" && before.phase !== "gameComplete" && (state.phase === "handComplete" || state.phase === "gameComplete")) {
      handCount += 1;
      if (!state.handResult) {
        passedHands += 1;
        currentScoringTeam = null;
        currentStreak = 0;
        continue;
      }

      const result = state.handResult;
      callers[result.maker] += 1;
      teamMakerHands[result.makers] += 1;
      teamTricks[0] += result.tricksWon[0];
      teamTricks[1] += result.tricksWon[1];
      totalTricks += result.tricksWon[0] + result.tricksWon[1];
      euchres += result.euchred ? 1 : 0;
      successfulMakers += result.euchred ? 0 : 1;
      failedMakers += result.euchred ? 1 : 0;
      loneAttempts += result.lone ? 1 : 0;
      successfulLoners += result.lone && result.march ? 1 : 0;
      if (result.euchred) {
        teamDefenderEuchres[result.makers === 0 ? 1 : 0] += 1;
      }

      for (const trick of state.completedTricks) {
        if (trick.winner !== undefined) {
          seatTricks[trick.winner] += 1;
        }
      }

      const firstWinner = state.completedTricks[0]?.winner;
      if (firstWinner !== undefined) {
        firstTricks[firstWinner] += 1;
      }

      const finalWinner = state.completedTricks[state.completedTricks.length - 1]?.winner;
      if (finalWinner !== undefined) {
        finalTricks[finalWinner] += 1;
      }

      const scoringTeam = result.pointsAwarded[0] > 0 ? 0 : 1;
      currentStreak = currentScoringTeam === scoringTeam ? currentStreak + 1 : 1;
      currentScoringTeam = scoringTeam;
      longestStreak[scoringTeam] = Math.max(longestStreak[scoringTeam], currentStreak);
    }
  }

  return {
    winningTeam: state.scores[0] >= config.targetScore ? 0 : 1,
    handCount,
    totalTricks,
    euchres,
    successfulMakers,
    failedMakers,
    loneAttempts,
    successfulLoners,
    dealerPickups,
    passedHands,
    longestStreak,
    teamTricks,
    teamMakerHands,
    teamDefenderEuchres,
    deals,
    callers,
    seatTricks,
    cardsPlayed,
    firstTricks,
    finalTricks
  };
}

async function createStore(): Promise<LocalEventStore> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "euchre-review-store-"));
  testDirs.push(dir);
  return new LocalEventStore(path.join(dir, "events.json"));
}
