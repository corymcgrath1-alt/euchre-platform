import { NextResponse } from "next/server";
import { isProfileSeat } from "@/lib/profiles/profile-detail";
import { loadPlayerProfileProjection } from "@/lib/profiles/profile-service";
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

    return NextResponse.json({ profile: await loadPlayerProfileProjection(seat) });
  } catch (error) {
    return apiError(error);
  }
}
