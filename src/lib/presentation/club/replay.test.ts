import { describe, expect, it } from "vitest";
import { buildRuleSummary } from "@/lib/euchre";
import type { GameReview } from "@/lib/review/game-review";
import { buildClubReplayView } from "./replay";

describe("Club replay presentation", () => {
  it("maps immutable review facts without recomputing outcomes", () => {
    const review = makeReview();
    const before = JSON.stringify(review);

    const view = buildClubReplayView(review);

    expect(view).toMatchObject({
      gameId: "review-game",
      winningTeam: 1,
      finalScore: [8, 10],
      totalHands: 1,
      totalEvents: 9,
      hands: [{
        handNumber: 1,
        dealer: 0,
        trump: "spades",
        maker: 1,
        makerTeam: 1,
        alone: false,
        scoringResult: "makers-point",
        pointsAwarded: [0, 1],
        scoreAfterHand: [8, 10]
      }]
    });
    expect(view.hands[0].bids).toEqual([
      { sequenceNumber: 2, round: 1, player: 1, decision: "order-up", suit: "spades", alone: false }
    ]);
    expect(view.hands[0].tricks[0]).toEqual({
      trickNumber: 1,
      leader: 1,
      winningSeat: 1,
      winningTeam: 1,
      cards: [{
        sequenceNumber: 3,
        order: 1,
        player: 1,
        cardId: "A-spades",
        cardLabel: "AS",
        effectiveSuit: "spades",
        playedTrump: true
      }]
    });
    expect(JSON.stringify(review)).toBe(before);
  });

  it("does not expose a hidden dealer discard from the source review", () => {
    const serialized = JSON.stringify(buildClubReplayView(makeReview()));

    expect(serialized).not.toContain("discard");
    expect(serialized).not.toContain("9D");
  });
});

function makeReview(): GameReview {
  return {
    gameId: "review-game",
    winningTeam: 1,
    finalScore: [8, 10],
    totalHandsPlayed: 1,
    totalEvents: 9,
    totalTricksPlayed: 1,
    totalEuchres: 0,
    totalSuccessfulMakerHands: 1,
    totalFailedMakerHands: 0,
    totalLoneAttempts: 0,
    totalSuccessfulLoneHands: 0,
    totalDealerPickups: 1,
    totalPassedHands: 0,
    longestScoringStreakByTeam: [0, 1],
    teams: [teamStats(0), teamStats(1)],
    seats: [seatStats(0), seatStats(1), seatStats(2), seatStats(3)],
    hands: [{
      handNumber: 1,
      dealer: 0,
      upcard: { rank: "J", suit: "spades" },
      trumpSuit: "spades",
      maker: 1,
      makerTeam: 1,
      defendingTeam: 0,
      aloneDeclared: false,
      dealerDiscard: { dealer: 0, card: { rank: "9", suit: "diamonds" } },
      roundOneBids: [{
        sequenceNumber: 2,
        round: 1,
        player: 1,
        decision: "order-up",
        suit: "spades",
        alone: false
      }],
      roundTwoBids: [],
      tricks: [{
        handNumber: 1,
        trickNumber: 1,
        leader: 1,
        cardsPlayed: [{
          sequenceNumber: 3,
          order: 1,
          player: 1,
          team: 1,
          card: { rank: "A", suit: "spades" },
          effectiveSuit: "spades",
          playedTrump: true
        }],
        winningSeat: 1,
        winningTeam: 1,
        ledSuit: "spades",
        trumpSuit: "spades",
        trumpPlayed: true,
        winnerUsedTrump: true,
        winnerRelationToCaller: "caller"
      }],
      makerTricks: 3,
      defenderTricks: 2,
      scoringResult: "makers-point",
      pointsAwarded: [0, 1],
      teamScoreAfterHand: [8, 10],
      tricksWon: [2, 3],
      makersSucceeded: true,
      defendersEuchredMakers: false,
      euchred: false,
      lone: false,
      loneSucceeded: false,
      passed: false
    }],
    ruleSummary: buildRuleSummary()
  };
}

function teamStats(team: 0 | 1) {
  return {
    team,
    pointsScored: 0,
    handsWon: 0,
    makerHands: 0,
    successfulMakerHands: 0,
    failedMakerHands: 0,
    defenderEuchres: 0,
    tricksWon: 0,
    loneAttempts: 0,
    successfulLoners: 0
  };
}

function seatStats(seat: 0 | 1 | 2 | 3) {
  return {
    seat,
    team: seat % 2 as 0 | 1,
    handsDealt: 0,
    timesDealer: 0,
    timesCaller: 0,
    successfulCalls: 0,
    failedCalls: 0,
    loneAttempts: 0,
    successfulLoners: 0,
    tricksWon: 0,
    cardsPlayed: 0,
    firstTricksWon: 0,
    finalTricksWon: 0
  };
}
