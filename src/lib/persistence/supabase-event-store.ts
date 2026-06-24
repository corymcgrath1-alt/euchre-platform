import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeGameConfig, reduceGameAction } from "@/lib/euchre";
import {
  DuplicateSequenceError,
  GameNotFoundError,
  MoveOrderingError,
  type AppendMoveInput,
  type CreateGameInput,
  type EventStore,
  type LoadedGame,
  type PersistedGameRecord,
  type PersistedMoveEventRecord
} from "./types";
import { eventPlayer, eventType, reconstructGameState } from "./replay";

type DbGame = {
  id: string;
  status: "active" | "complete" | "abandoned";
  config: PersistedGameRecord["config"];
  target_score: number;
  team_zero_score: number;
  team_one_score: number;
  metadata: PersistedGameRecord["metadata"];
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

type DbMoveEvent = {
  id: string;
  game_id: string;
  hand_id: string | null;
  sequence_number: number;
  player: number | null;
  event_type: PersistedMoveEventRecord["eventType"];
  payload: PersistedMoveEventRecord["payload"];
  created_at: string;
};

export class SupabaseEventStore implements EventStore {
  constructor(private readonly client: SupabaseClient) {}

  static fromEnv(): SupabaseEventStore | null {
    const url = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRoleKey) {
      return null;
    }

    return new SupabaseEventStore(createClient(url, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }));
  }

  async createGame(input: CreateGameInput): Promise<PersistedGameRecord> {
    const config = normalizeGameConfig(input.config);
    const { data, error } = await this.client
      .from("euchre_games")
      .insert({
        config,
        target_score: config.targetScore,
        metadata: input.metadata ?? {}
      })
      .select("*")
      .single<DbGame>();

    if (error || !data) {
      throw new Error(error?.message ?? "Failed to create game");
    }

    return mapGame(data);
  }

  async appendMove(input: AppendMoveInput): Promise<PersistedMoveEventRecord> {
    const game = await this.fetchGame(input.gameId);
    const events = await this.loadMoveHistory(input.gameId);
    const expectedSequence = events.length;
    if (input.expectedSequence !== expectedSequence) {
      if (events.some((event) => event.sequenceNumber === input.expectedSequence)) {
        throw new DuplicateSequenceError(input.gameId, input.expectedSequence);
      }
      throw new MoveOrderingError(expectedSequence, input.expectedSequence);
    }

    const currentState = reconstructGameState(events, game.config);
    const handId = await this.getOrCreateHand(input.gameId, currentState.handNumber, currentState.dealer, input.action);
    const nextState = reduceGameAction(currentState, input.action);
    const completedAt = nextState.phase === "gameComplete" ? new Date().toISOString() : null;

    const { data, error } = await this.client
      .from("euchre_move_events")
      .insert({
        game_id: input.gameId,
        hand_id: handId,
        sequence_number: input.expectedSequence,
        player: eventPlayer(input.action) ?? null,
        event_type: eventType(input.action),
        payload: input.action
      })
      .select("*")
      .single<DbMoveEvent>();

    if (error) {
      if (error.code === "23505") {
        throw new DuplicateSequenceError(input.gameId, input.expectedSequence);
      }
      throw new Error(error.message);
    }
    if (!data) {
      throw new Error("Failed to append move event");
    }

    await this.client
      .from("euchre_games")
      .update({
        status: nextState.phase === "gameComplete" ? "complete" : "active",
        team_zero_score: nextState.scores[0],
        team_one_score: nextState.scores[1],
        updated_at: new Date().toISOString(),
        completed_at: completedAt
      })
      .eq("id", input.gameId);

    return mapEvent(data);
  }

  async loadGame(gameId: string): Promise<LoadedGame> {
    const game = await this.fetchGame(gameId);
    const events = await this.loadMoveHistory(gameId);
    return {
      game,
      events,
      state: reconstructGameState(events, game.config, game.id)
    };
  }

  async listGames(status?: PersistedGameRecord["status"]): Promise<PersistedGameRecord[]> {
    let query = this.client
      .from("euchre_games")
      .select("*")
      .order("created_at", { ascending: true });

    if (status !== undefined) {
      query = query.eq("status", status);
    }

    const { data, error } = await query.returns<DbGame[]>();
    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map(mapGame);
  }

  async loadMoveHistory(gameId: string): Promise<PersistedMoveEventRecord[]> {
    const { data, error } = await this.client
      .from("euchre_move_events")
      .select("*")
      .eq("game_id", gameId)
      .order("sequence_number", { ascending: true })
      .returns<DbMoveEvent[]>();

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map(mapEvent);
  }

  private async fetchGame(gameId: string): Promise<PersistedGameRecord> {
    const { data, error } = await this.client
      .from("euchre_games")
      .select("*")
      .eq("id", gameId)
      .single<DbGame>();

    if (error || !data) {
      throw new GameNotFoundError(gameId);
    }

    return mapGame(data);
  }

  private async getOrCreateHand(
    gameId: string,
    currentHandNumber: number,
    currentDealer: PersistedMoveEventRecord["player"],
    action: AppendMoveInput["action"]
  ): Promise<string | null> {
    const handNumber = action.type === "START_HAND" || action.type === "NEXT_HAND"
      ? currentHandNumber + 1
      : currentHandNumber;

    if (handNumber < 1) {
      return null;
    }

    const { data: existing } = await this.client
      .from("euchre_hands")
      .select("id")
      .eq("game_id", gameId)
      .eq("hand_number", handNumber)
      .maybeSingle<{ id: string }>();

    if (existing) {
      return existing.id;
    }

    const seed = action.type === "START_HAND" || action.type === "NEXT_HAND" ? action.seed : 0;
    const dealer = action.type === "NEXT_HAND" ? ((Number(currentDealer ?? 0) + 1) % 4) : Number(currentDealer ?? 0);
    const { data, error } = await this.client
      .from("euchre_hands")
      .insert({
        game_id: gameId,
        hand_number: handNumber,
        dealer,
        seed
      })
      .select("id")
      .single<{ id: string }>();

    if (error || !data) {
      throw new Error(error?.message ?? "Failed to create hand");
    }

    return data.id;
  }
}

function mapGame(row: DbGame): PersistedGameRecord {
  const config = normalizeGameConfig(row.config);
  return {
    id: row.id,
    status: row.status,
    config,
    targetScore: row.target_score,
    teamZeroScore: row.team_zero_score,
    teamOneScore: row.team_one_score,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? undefined
  };
}

function mapEvent(row: DbMoveEvent): PersistedMoveEventRecord {
  return {
    id: row.id,
    gameId: row.game_id,
    handId: row.hand_id ?? undefined,
    sequenceNumber: row.sequence_number,
    player: row.player === null ? undefined : row.player as PersistedMoveEventRecord["player"],
    eventType: row.event_type,
    payload: row.payload,
    createdAt: row.created_at
  };
}
