import {
  chooseBotAction,
  createDefaultBotProfiles,
  type GameAction,
  type GameConfig,
  type PlayerIndex
} from "@/lib/euchre";
import {
  DuplicateSequenceError,
  MoveOrderingError,
  type LoadedGame,
  type PersistedGameRecord
} from "@/lib/persistence/types";
import { buildClubTableView, type ClubTableView } from "@/lib/presentation/club/table";
import { buildGameReview, type GameReview } from "@/lib/review/game-review";
import {
  MobileEventStore,
  type MobileSettings
} from "../persistence/mobile-event-store";

export const HUMAN_SEAT: PlayerIndex = 0;

export interface NewSoloGameOptions {
  readonly config: Partial<GameConfig>;
  readonly seed: number;
}

export interface SoloGameSnapshot {
  readonly loaded: LoadedGame;
  readonly table: ClubTableView;
}

export interface CompletedGameListItem {
  readonly game: PersistedGameRecord;
  readonly review: GameReview;
  readonly seed?: number;
}

export class SoloGameService {
  private readonly bots = createDefaultBotProfiles();

  constructor(readonly store: MobileEventStore) {}

  async createGame(options: NewSoloGameOptions): Promise<SoloGameSnapshot> {
    const game = await this.store.createGame({
      config: options.config,
      metadata: {
        source: "mobile-solo",
        initialSeed: options.seed
      }
    });
    await this.store.appendMove({
      gameId: game.id,
      expectedSequence: 0,
      action: { type: "START_HAND", seed: options.seed }
    });
    return this.load(game.id);
  }

  async resumeActiveGame(): Promise<SoloGameSnapshot | null> {
    const gameId = await this.store.getActiveGameId();
    return gameId ? this.load(gameId) : null;
  }

  async load(gameId: string, showLatestCompletedTrick = false): Promise<SoloGameSnapshot> {
    const loaded = await this.store.loadGame(gameId);
    return {
      loaded,
      table: buildClubTableView(loaded.state, HUMAN_SEAT, { showLatestCompletedTrick })
    };
  }

  async submitHumanAction(gameId: string, action: GameAction): Promise<SoloGameSnapshot> {
    if ("player" in action && action.player !== HUMAN_SEAT) {
      throw new Error("The mobile player may act only from the South seat.");
    }
    const loaded = await this.store.loadGame(gameId);
    try {
      await this.store.appendMove({
        gameId,
        expectedSequence: loaded.events.length,
        action
      });
      return this.load(gameId, action.type === "PLAY_CARD");
    } catch (error) {
      if (error instanceof DuplicateSequenceError || error instanceof MoveOrderingError) {
        return this.load(gameId);
      }
      throw error;
    }
  }

  async runOneBotTurn(gameId: string): Promise<SoloGameSnapshot> {
    const loaded = await this.store.loadGame(gameId);
    if (loaded.state.activePlayer === HUMAN_SEAT) return this.snapshot(loaded);
    const bot = this.bots.find((candidate) => candidate.enabled && candidate.seat === loaded.state.activePlayer);
    const action = bot ? chooseBotAction(loaded.state, bot, loaded.state.config.botDifficulty) : null;
    if (!action) return this.snapshot(loaded);

    try {
      await this.store.appendMove({
        gameId,
        expectedSequence: loaded.events.length,
        action
      });
      return this.load(gameId, action.type === "PLAY_CARD");
    } catch (error) {
      if (error instanceof DuplicateSequenceError || error instanceof MoveOrderingError) {
        return this.load(gameId);
      }
      throw error;
    }
  }

  async dealNextHand(gameId: string): Promise<SoloGameSnapshot> {
    const loaded = await this.store.loadGame(gameId);
    const seed = nextHandSeed(loaded.game, loaded.state.handNumber + 1);
    await this.store.appendMove({
      gameId,
      expectedSequence: loaded.events.length,
      action: { type: "NEXT_HAND", seed }
    });
    return this.load(gameId);
  }

  async abandon(gameId: string): Promise<void> {
    await this.store.abandonGame(gameId);
  }

  async completedGames(): Promise<CompletedGameListItem[]> {
    const games = await this.store.listGames("complete");
    return Promise.all(games.map(async (game) => {
      const events = await this.store.loadMoveHistory(game.id);
      return {
        game,
        review: buildGameReview({ gameId: game.id, config: game.config, events }),
        seed: initialSeed(game)
      };
    }));
  }

  async review(gameId: string): Promise<GameReview> {
    const loaded = await this.store.loadGame(gameId);
    return buildGameReview({
      gameId,
      config: loaded.game.config,
      events: loaded.events
    });
  }

  async settings(): Promise<MobileSettings> {
    return this.store.getSettings();
  }

  async saveSettings(settings: MobileSettings): Promise<MobileSettings> {
    return this.store.saveSettings(settings);
  }

  private snapshot(loaded: LoadedGame): SoloGameSnapshot {
    return {
      loaded,
      table: buildClubTableView(loaded.state, HUMAN_SEAT)
    };
  }
}

export function initialSeed(game: PersistedGameRecord): number | undefined {
  if (!game.metadata || Array.isArray(game.metadata) || typeof game.metadata !== "object") return undefined;
  const value = game.metadata.initialSeed;
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}

export function nextHandSeed(game: PersistedGameRecord, handNumber: number): number {
  const base = initialSeed(game) ?? 1;
  return Math.abs((base + handNumber * 7_919) % 1_000_000);
}

export function resultShareText(item: CompletedGameListItem): string {
  const result = item.review.winningTeam === 0 ? "won" : "lost";
  const seedText = item.seed === undefined ? "" : ` Practice seed: ${item.seed}.`;
  return `Euchre Club: I ${result} ${item.review.finalScore[0]}-${item.review.finalScore[1]} in ${item.review.totalHandsPlayed} hands.${seedText}`;
}
