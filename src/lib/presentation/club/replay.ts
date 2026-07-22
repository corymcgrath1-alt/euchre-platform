import { cardId, cardLabel, type PlayerIndex, type Suit, type TeamIndex } from "@/lib/euchre";
import type { GameReview } from "@/lib/review/game-review";

export interface ClubReplayBidView {
  sequenceNumber: number;
  round: 1 | 2;
  player: PlayerIndex;
  decision: "pass" | "order-up" | "call";
  suit?: Suit;
  alone: boolean;
}

export interface ClubReplayTrickView {
  trickNumber: number;
  leader: PlayerIndex;
  winningSeat: PlayerIndex;
  winningTeam: TeamIndex;
  cards: Array<{
    sequenceNumber: number;
    order: number;
    player: PlayerIndex;
    cardId: string;
    cardLabel: string;
    effectiveSuit: Suit;
    playedTrump: boolean;
  }>;
}

export interface ClubReplayHandView {
  handNumber: number;
  dealer: PlayerIndex;
  trump?: Suit;
  maker?: PlayerIndex;
  makerTeam?: TeamIndex;
  alone: boolean;
  passed: boolean;
  scoringResult: GameReview["hands"][number]["scoringResult"];
  pointsAwarded: [number, number];
  scoreAfterHand: [number, number];
  bids: ClubReplayBidView[];
  tricks: ClubReplayTrickView[];
}

export interface ClubReplayView {
  gameId: string;
  winningTeam: TeamIndex;
  finalScore: [number, number];
  totalHands: number;
  totalEvents: number;
  hands: ClubReplayHandView[];
}

export function buildClubReplayView(review: GameReview): ClubReplayView {
  return {
    gameId: review.gameId,
    winningTeam: review.winningTeam,
    finalScore: [...review.finalScore],
    totalHands: review.totalHandsPlayed,
    totalEvents: review.totalEvents,
    hands: review.hands.map((hand) => ({
      handNumber: hand.handNumber,
      dealer: hand.dealer,
      trump: hand.trumpSuit,
      maker: hand.maker,
      makerTeam: hand.makerTeam,
      alone: hand.lone,
      passed: hand.passed,
      scoringResult: hand.scoringResult,
      pointsAwarded: [...hand.pointsAwarded],
      scoreAfterHand: [...hand.teamScoreAfterHand],
      bids: [...hand.roundOneBids, ...hand.roundTwoBids].map((bid) => ({ ...bid })),
      tricks: hand.tricks.map((trick) => ({
        trickNumber: trick.trickNumber,
        leader: trick.leader,
        winningSeat: trick.winningSeat,
        winningTeam: trick.winningTeam,
        cards: trick.cardsPlayed.map((play) => ({
          sequenceNumber: play.sequenceNumber,
          order: play.order,
          player: play.player,
          cardId: cardId(play.card),
          cardLabel: cardLabel(play.card),
          effectiveSuit: play.effectiveSuit,
          playedTrump: play.playedTrump
        }))
      }))
    }))
  };
}
