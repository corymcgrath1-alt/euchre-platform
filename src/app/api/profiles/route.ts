import { NextResponse } from "next/server";
import { loadProfileAggregateSummary } from "@/lib/profiles/profile-service";
import { apiError } from "../_shared";

export async function GET() {
  try {
    return NextResponse.json({ profiles: await loadProfileAggregateSummary() });
  } catch (error) {
    return apiError(error);
  }
}
