export const SUITS = ["clubs", "diamonds", "hearts", "spades"] as const;
export const RANKS = ["9", "10", "J", "Q", "K", "A"] as const;

export type Suit = (typeof SUITS)[number];
export type Rank = (typeof RANKS)[number];
export type PlayerIndex = 0 | 1 | 2 | 3;
export type TeamIndex = 0 | 1;
export const BOT_DIFFICULTIES = ["easy", "standard", "strong"] as const;
export type BotDifficulty = (typeof BOT_DIFFICULTIES)[number];
export const TARGET_SCORES = [5, 10, 15, 21] as const;
export type TargetScore = (typeof TARGET_SCORES)[number];
export const DEALER_SELECTIONS = ["default", "human", "seat0", "seat1", "seat2", "seat3"] as const;
export type DealerSelection = (typeof DEALER_SELECTIONS)[number];
export const FARMERS_HAND_MODES = ["off", "redeal", "replaceThree"] as const;
export type FarmersHandMode = (typeof FARMERS_HAND_MODES)[number];
export const LONER_MODES = ["aloneOnly", "withPartnerAllowed"] as const;
export type LonerMode = (typeof LONER_MODES)[number];
export type Phase =
  | "idle"
  | "farmersHand"
  | "ordering"
  | "discarding"
  | "calling"
  | "playing"
  | "handComplete"
  | "gameComplete";

export interface Card {
  suit: Suit;
  rank: Rank;
}

export interface GameConfig {
  stickDealer: boolean;
  targetScore: number;
  botDifficulty: BotDifficulty;
  dealerSelection: DealerSelection;
  farmersHandMode: FarmersHandMode;
  lonerMode: LonerMode;
}

export interface Play {
  player: PlayerIndex;
  card: Card;
}

export interface Trick {
  leader: PlayerIndex;
  plays: Play[];
  winner?: PlayerIndex;
}

export interface BidDecision {
  round: 1 | 2;
  player: PlayerIndex;
  decision: "pass" | "order-up" | "call";
  suit?: Suit;
  alone?: boolean;
}

export interface HandResult {
  makers: TeamIndex;
  maker: PlayerIndex;
  trump: Suit;
  tricksWon: [number, number];
  pointsAwarded: [number, number];
  lone: boolean;
  euchred: boolean;
  march: boolean;
}

export type GameAction =
  | { type: "START_HAND"; seed: number }
  | { type: "FARMERS_HAND_DECLINE"; player: PlayerIndex }
  | { type: "FARMERS_HAND_REDEAL"; player: PlayerIndex; seed: number }
  | { type: "FARMERS_HAND_REPLACE"; player: PlayerIndex; cards: Card[] }
  | { type: "PASS"; player: PlayerIndex }
  | { type: "ORDER_UP"; player: PlayerIndex; alone?: boolean }
  | { type: "CALL_TRUMP"; player: PlayerIndex; suit: Suit; alone?: boolean }
  | { type: "DISCARD"; player: PlayerIndex; card: Card }
  | { type: "PLAY_CARD"; player: PlayerIndex; card: Card }
  | { type: "NEXT_HAND"; seed: number }
  | { type: "RESET_GAME" };

export interface MoveEvent {
  id: string;
  sequence: number;
  action: GameAction;
  player?: PlayerIndex;
  createdAt: string;
}

export interface GameState {
  id: string;
  config: GameConfig;
  phase: Phase;
  handNumber: number;
  dealer: PlayerIndex;
  activePlayer: PlayerIndex;
  scores: [number, number];
  hands: Record<PlayerIndex, Card[]>;
  kitty: Card[];
  upcard?: Card;
  turnedDownSuit?: Suit;
  trump?: Suit;
  maker?: PlayerIndex;
  makerTeam?: TeamIndex;
  lonePlayer?: PlayerIndex;
  farmersHandDeclines: PlayerIndex[];
  bids: BidDecision[];
  currentTrick: Trick | null;
  completedTricks: Trick[];
  tricksWon: [number, number];
  handResult?: HandResult;
  moveLog: MoveEvent[];
}

export interface LegalActionSummary {
  canClaimFarmersHand: boolean;
  canDeclineFarmersHand: boolean;
  farmersHandReplaceableCards: Card[];
  canPass: boolean;
  canOrderUp: boolean;
  callableSuits: Suit[];
  playableCards: Card[];
  mustDiscard: boolean;
}
