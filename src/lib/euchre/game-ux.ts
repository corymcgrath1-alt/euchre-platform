import { cardLabel, effectiveSuit } from "./cards";
import { partnerOf } from "./deck";
import { FARMERS_HAND_QUALIFIER_TEXT } from "./rule-summary";
import type { GameState, HandResult, MoveEvent, PlayerIndex, Suit, TeamIndex } from "./types";

const PLAYER_NAMES: Record<PlayerIndex, string> = {
  0: "South",
  1: "West",
  2: "North",
  3: "East"
};

export interface TurnPrompt {
  title: string;
  body: string;
  actor: PlayerIndex;
  humanTurn: boolean;
}

export interface LegalActionExplanation {
  primary: string;
  details: string[];
}

export interface AvailableGameControls {
  canStartNextHand: boolean;
  canReviewGame: boolean;
  canStartNewGame: boolean;
  warning?: string;
}

export interface HandExplanationInput {
  maker?: PlayerIndex;
  makerTeam?: TeamIndex;
  defendingTeam?: TeamIndex;
  trumpSuit?: Suit;
  makerTricks?: number;
  defenderTricks?: number;
  pointsAwarded?: [number, number];
  teamScoreAfterHand?: [number, number];
  lone?: boolean;
  loneSucceeded?: boolean;
  euchred?: boolean;
  passed?: boolean;
}

export function buildTurnPrompt(state: GameState, perspectiveSeat: PlayerIndex): TurnPrompt {
  const humanTurn = state.activePlayer === perspectiveSeat;
  const actorName = playerName(state.activePlayer);

  if (state.phase === "idle") {
    return {
      title: "Ready to start",
      body: "Choose setup options, then start a persisted game.",
      actor: perspectiveSeat,
      humanTurn: true
    };
  }

  if (state.phase === "farmersHand") {
    return {
      title: humanTurn ? "Your Farmer's Hand decision" : `${actorName} is checking Farmer's Hand`,
      body: humanTurn
        ? "Choose 1-3 eligible low cards to replace, claim a redeal if enabled, or decline."
        : `${actorName} is deciding whether the hand qualifies before bidding begins.`,
      actor: state.activePlayer,
      humanTurn
    };
  }

  if (state.phase === "ordering") {
    const upcard = state.upcard ? cardLabel(state.upcard) : "the upcard";
    const suit = state.upcard?.suit ?? "trump";
    return {
      title: humanTurn ? "Your order-up decision" : `${actorName} is bidding`,
      body: humanTurn
        ? `Order the dealer to pick up ${upcard} and make ${suit} trump, or pass.`
        : `${actorName} is deciding whether to order up ${suit}.`,
      actor: state.activePlayer,
      humanTurn
    };
  }

  if (state.phase === "calling") {
    return {
      title: humanTurn ? "Your trump call" : `${actorName} is choosing trump`,
      body: humanTurn
        ? "Call a legal trump suit or pass if allowed."
        : `${actorName} is deciding whether to call trump in round two.`,
      actor: state.activePlayer,
      humanTurn
    };
  }

  if (state.phase === "discarding") {
    return {
      title: humanTurn ? "Your discard" : "Dealer is discarding",
      body: `${actorName} must discard back to five cards after picking up the upcard.`,
      actor: state.activePlayer,
      humanTurn
    };
  }

  if (state.phase === "playing") {
    return {
      title: humanTurn ? "Your play" : `${actorName} is playing`,
      body: humanTurn ? buildCardPlayExplanation(state, perspectiveSeat).primary : "Bot is choosing a legal card.",
      actor: state.activePlayer,
      humanTurn
    };
  }

  if (state.phase === "handComplete") {
    return {
      title: "Hand complete",
      body: buildHandResultExplanation(state),
      actor: state.activePlayer,
      humanTurn: false
    };
  }

  return {
    title: "Game complete",
    body: `Team ${gameWinner(state)} wins ${state.scores[0]}-${state.scores[1]}. Completed games remain available in profiles and review history.`,
    actor: state.activePlayer,
    humanTurn: false
  };
}

export function buildLegalActionExplanation(state: GameState, perspectiveSeat: PlayerIndex): LegalActionExplanation {
  if (state.phase === "farmersHand") {
    return buildFarmersHandExplanation(state, perspectiveSeat);
  }

  if (state.phase === "ordering" || state.phase === "calling") {
    return buildBiddingExplanation(state, perspectiveSeat);
  }

  if (state.phase === "playing" || state.phase === "discarding") {
    return buildCardPlayExplanation(state, perspectiveSeat);
  }

  if (state.phase === "handComplete" || state.phase === "gameComplete") {
    return {
      primary: buildTurnPrompt(state, perspectiveSeat).body,
      details: []
    };
  }

  return {
    primary: "No action is required right now.",
    details: []
  };
}

export function buildCardPlayExplanation(state: GameState, perspectiveSeat: PlayerIndex): LegalActionExplanation {
  if (state.phase === "discarding") {
    return {
      primary: "Dealer must discard one card after pickup.",
      details: [`Dealer: ${playerName(state.dealer)}`]
    };
  }

  if (state.phase !== "playing" || !state.currentTrick || !state.trump) {
    return {
      primary: "No card play is available right now.",
      details: []
    };
  }

  const hand = state.hands[perspectiveSeat] ?? [];
  if (state.currentTrick.plays.length === 0) {
    return {
      primary: "You are leading this trick.",
      details: [`Trump is ${state.trump}.`]
    };
  }

  const ledSuit = effectiveSuit(state.currentTrick.plays[0].card, state.trump);
  const canFollow = hand.some((card) => effectiveSuit(card, state.trump) === ledSuit);

  return {
    primary: canFollow
      ? `You must follow ${ledSuit} if possible.`
      : "You are void in the led suit; any card is legal.",
    details: [`Led suit: ${ledSuit}.`, `Trump: ${state.trump}.`]
  };
}

export function buildBiddingExplanation(state: GameState, perspectiveSeat: PlayerIndex): LegalActionExplanation {
  const dealerRelation = state.dealer === perspectiveSeat
    ? "you"
    : partnerOf(perspectiveSeat) === state.dealer
      ? "your partner"
      : "an opponent";
  const details = [
    `Dealer: ${playerName(state.dealer)} (${dealerRelation}).`
  ];

  if (state.phase === "ordering") {
    details.push(`Upcard: ${state.upcard ? cardLabel(state.upcard) : "none"}.`);
    details.push(`Upcard suit: ${state.upcard?.suit ?? "unknown"}.`);
    return {
      primary: "Order up the upcard suit or pass.",
      details
    };
  }

  if (state.phase === "calling") {
    details.push(`Turned-down suit: ${state.turnedDownSuit ?? "unknown"}.`);
    return {
      primary: "Call a suit other than the turned-down suit, or pass if legal.",
      details
    };
  }

  return {
    primary: "Bidding is not active.",
    details
  };
}

export function buildFarmersHandExplanation(state: GameState, perspectiveSeat: PlayerIndex): LegalActionExplanation {
  const eligibleCount = state.hands[perspectiveSeat]?.filter((card) => card.rank === "9" || card.rank === "10").length ?? 0;
  return {
    primary: state.config.farmersHandMode === "replaceThree"
      ? "Choose 1-3 eligible low cards to replace, or decline Farmer's Hand."
      : "Claim the configured Farmer's Hand action if eligible, or decline.",
    details: [
      `Qualifier: ${FARMERS_HAND_QUALIFIER_TEXT}`,
      `Eligible low cards in your hand: ${eligibleCount}.`
    ]
  };
}

export function buildHandResultExplanation(source: GameState | HandExplanationInput): string {
  const input = handExplanationInput(source);
  if (input.passed) {
    return `Hand passed out. Score remains ${formatScore(input.teamScoreAfterHand)}.`;
  }

  if (input.makerTeam === undefined || input.maker === undefined || !input.trumpSuit) {
    return "Hand complete. Scoring details are unavailable for this older or incomplete hand.";
  }

  const makerTricks = input.makerTricks ?? 0;
  const defenderTricks = input.defenderTricks ?? 0;
  const pointsAwarded = input.pointsAwarded ?? [0, 0];
  const scoringTeam = pointsAwarded[0] > 0 ? 0 : 1;
  const points = pointsAwarded[scoringTeam];
  const reason = input.euchred
    ? `Defenders euchred the makers with ${defenderTricks} tricks.`
    : input.lone && input.loneSucceeded
      ? "Lone hand succeeded with all 5 tricks."
      : makerTricks === 5
        ? "Makers swept all 5 tricks."
        : `Makers made ${makerTricks} tricks.`;

  return `Team ${input.makerTeam} made trump (${input.trumpSuit}) by ${playerName(input.maker)}. Makers won ${makerTricks}, defenders won ${defenderTricks}. ${reason} Team ${scoringTeam} scored ${points} point${points === 1 ? "" : "s"}. Score: ${formatScore(input.teamScoreAfterHand)}.`;
}

export function getAvailableGameControls(state: GameState): AvailableGameControls {
  if (state.phase === "handComplete") {
    return {
      canStartNextHand: true,
      canReviewGame: false,
      canStartNewGame: true,
      warning: "Starting a new game clears only the active table view; persisted history remains."
    };
  }

  if (state.phase === "gameComplete") {
    return {
      canStartNextHand: false,
      canReviewGame: true,
      canStartNewGame: true,
      warning: "Completed games remain available in profile history and review."
    };
  }

  return {
    canStartNextHand: false,
    canReviewGame: false,
    canStartNewGame: state.phase !== "idle",
    warning: state.phase === "idle" ? undefined : "Starting a new game clears only the active table view; persisted events are not deleted."
  };
}

export function getRecentBotActions(events: MoveEvent[], limit: number): string[] {
  return [...events]
    .reverse()
    .filter((event) => event.player !== undefined && event.player !== 0)
    .slice(0, limit)
    .map((event) => formatRecentBotAction(event))
    .reverse();
}

export function formatRecentBotAction(event: MoveEvent): string {
  const action = event.action;
  const actor = "player" in action ? playerName(action.player) : "Bot";

  switch (action.type) {
    case "PASS":
      return `${actor} passed.`;
    case "ORDER_UP":
      return `${actor} ordered up${action.alone ? " alone" : ""}.`;
    case "CALL_TRUMP":
      return `${actor} called ${action.suit}${action.alone ? " alone" : ""}.`;
    case "DISCARD":
      return `${actor} discarded ${cardLabel(action.card)}.`;
    case "PLAY_CARD":
      return `${actor} played ${cardLabel(action.card)}.`;
    case "FARMERS_HAND_DECLINE":
      return `${actor} declined Farmer's Hand.`;
    case "FARMERS_HAND_REDEAL":
      return `${actor} claimed Farmer's Hand redeal.`;
    case "FARMERS_HAND_REPLACE":
      return `${actor} replaced ${action.cards.map(cardLabel).join(", ")} for Farmer's Hand.`;
    default:
      return `${actor} made a move.`;
  }
}

function handExplanationInput(source: GameState | HandExplanationInput): HandExplanationInput {
  if ("phase" in source) {
    const result: HandResult | undefined = source.handResult;
    if (!result) {
      return {
        passed: true,
        teamScoreAfterHand: [...source.scores]
      };
    }

    const makerTeam = result.makers;
    const defenderTeam = makerTeam === 0 ? 1 : 0;
    return {
      maker: result.maker,
      makerTeam,
      defendingTeam: defenderTeam,
      trumpSuit: result.trump,
      makerTricks: result.tricksWon[makerTeam],
      defenderTricks: result.tricksWon[defenderTeam],
      pointsAwarded: [...result.pointsAwarded],
      teamScoreAfterHand: [...source.scores],
      lone: result.lone,
      loneSucceeded: result.lone && result.march,
      euchred: result.euchred,
      passed: false
    };
  }

  return source;
}

function formatScore(score: [number, number] | undefined): string {
  return score ? `${score[0]}-${score[1]}` : "unavailable";
}

function gameWinner(state: GameState): TeamIndex {
  return state.scores[0] >= state.config.targetScore ? 0 : 1;
}

function playerName(player: PlayerIndex): string {
  return PLAYER_NAMES[player];
}
