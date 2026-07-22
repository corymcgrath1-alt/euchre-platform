import { NextResponse } from "next/server";
import {
  chooseBotAction,
  createDefaultBotProfiles,
  InvalidGameActionError,
  type GameAction,
  type GameState,
  type PlayerIndex
} from "@/lib/euchre";
import { getEventStore } from "@/lib/persistence/event-store";
import { buildClubReplayView } from "@/lib/presentation/club/replay";
import { buildClubTableView } from "@/lib/presentation/club/table";
import { buildGameReview } from "@/lib/review/game-review";
import { apiError, gameActionSchema, parseJsonBody } from "../../../_shared";

const VIEWER_SEAT: PlayerIndex = 0;

export async function GET(
  _request: Request,
  context: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await context.params;
    return NextResponse.json(await loadPracticeProjection(gameId));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await context.params;
    const body = await parseJsonBody(request) as {
      expectedSequence?: unknown;
      command?: unknown;
      action?: unknown;
    };
    const expectedSequence = Number(body.expectedSequence);
    const loaded = await getEventStore().loadGame(gameId);
    if (expectedSequence !== loaded.events.length) {
      throw new InvalidGameActionError(`Expected sequence ${loaded.events.length}, received ${expectedSequence}`);
    }

    const command = body.command === "BOT_MOVE" ? "BOT_MOVE" : "VIEWER_ACTION";
    const action = command === "BOT_MOVE"
      ? chooseServerBotAction(loaded.state)
      : validateViewerAction(gameActionSchema.parse(body.action));

    await getEventStore().appendMove({ gameId, expectedSequence, action });
    return NextResponse.json(await loadPracticeProjection(gameId), { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

function chooseServerBotAction(state: GameState): GameAction {
  if (state.activePlayer === VIEWER_SEAT) {
    throw new InvalidGameActionError("Viewer actions must be submitted explicitly");
  }
  const profile = createDefaultBotProfiles().find((bot) => bot.enabled && bot.seat === state.activePlayer);
  const action = profile ? chooseBotAction(state, profile) : null;
  if (!action) {
    throw new InvalidGameActionError("No legal bot action is available for the current table state");
  }
  return action;
}

function validateViewerAction(action: GameAction): GameAction {
  if ("player" in action && action.player !== VIEWER_SEAT) {
    throw new InvalidGameActionError("Practice presentation may act only for the local viewer seat");
  }
  if (action.type === "RESET_GAME") {
    throw new InvalidGameActionError("Reset is a local presentation action and is not persisted");
  }
  return action;
}

async function loadPracticeProjection(gameId: string) {
  const loaded = await getEventStore().loadGame(gameId);
  const replay = loaded.state.phase === "gameComplete"
    ? buildClubReplayView(buildGameReview({
        gameId: loaded.game.id,
        config: loaded.game.config,
        events: loaded.events
      }))
    : null;

  return {
    gameId: loaded.game.id,
    status: loaded.game.status,
    eventCount: loaded.events.length,
    table: buildClubTableView(loaded.state, VIEWER_SEAT),
    replay
  };
}
