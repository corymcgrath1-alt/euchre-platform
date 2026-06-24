import { NextResponse } from "next/server";
import { getEventStore } from "@/lib/persistence/event-store";
import { buildPlayerProfileDetail, isProfileSeat, type ProfileReviewSource } from "@/lib/profiles/profile-detail";
import { buildGameReview } from "@/lib/review/game-review";
import { apiError } from "../../_shared";

interface RouteContext {
  params: Promise<{
    seat: string;
  }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { seat: seatParam } = await context.params;
    const seat = Number(seatParam);
    if (!Number.isInteger(seat) || !isProfileSeat(seat)) {
      return NextResponse.json({ error: "Invalid profile seat" }, { status: 400 });
    }

    const store = getEventStore();
    const games = await store.listGames("complete");
    const sources: ProfileReviewSource[] = await Promise.all(
      games.map(async (game) => ({
        review: buildGameReview({
          gameId: game.id,
          config: game.config,
          events: await store.loadMoveHistory(game.id)
        }),
        createdAt: game.createdAt,
        completedAt: game.completedAt
      }))
    );

    return NextResponse.json({ profile: buildPlayerProfileDetail(sources, seat) });
  } catch (error) {
    return apiError(error);
  }
}
