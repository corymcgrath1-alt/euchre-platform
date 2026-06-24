import { NextResponse } from "next/server";
import { getEventStore } from "@/lib/persistence/event-store";
import { buildGameReview } from "@/lib/review/game-review";
import { apiError } from "../../../_shared";

export async function GET(
  _request: Request,
  context: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await context.params;
    const loaded = await getEventStore().loadGame(gameId);
    const review = buildGameReview({
      gameId: loaded.game.id,
      config: loaded.game.config,
      events: loaded.events
    });

    return NextResponse.json({ review });
  } catch (error) {
    return apiError(error);
  }
}
