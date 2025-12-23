import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * GET /api/games/live/current
 *
 * Get the current live game (game with endDateTime null and started today in EST)
 */
export async function GET() {
  try {
    // Get current time in EST
    const now = new Date();
    const estOffset = -5 * 60; // EST is UTC-5
    const estNow = new Date(now.getTime() + estOffset * 60 * 1000);

    // Get start of today in EST
    const startOfTodayEST = new Date(estNow);
    startOfTodayEST.setHours(0, 0, 0, 0);

    // Convert back to UTC for database query
    const startOfTodayUTC = new Date(startOfTodayEST.getTime() - estOffset * 60 * 1000);

    // Find a game that:
    // 1. Has no endDateTime (still ongoing)
    // 2. Started today (in EST)
    const liveGame = await prisma.game.findFirst({
      where: {
        endDateTime: null,
        startDateTime: {
          gte: startOfTodayUTC,
        },
      },
      include: {
        teamPlayers: {
          include: {
            player: true,
            goalDetails: true,
          },
        },
      },
      orderBy: {
        startDateTime: "desc",
      },
    });

    if (!liveGame) {
      return NextResponse.json({ liveGame: null }, { status: 200 });
    }

    return NextResponse.json({ liveGame }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
