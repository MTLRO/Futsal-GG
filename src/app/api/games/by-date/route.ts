import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * GET /api/games/by-date?date=YYYY-MM-DD
 *
 * Get all games on a specific date (in Eastern Time)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    if (!date) {
      return NextResponse.json(
        { error: "Date parameter is required" },
        { status: 400 }
      );
    }

    // Parse the date and create Eastern Time range for that day
    const startOfDayET = new Date(date + "T00:00:00-05:00");
    const endOfDayET = new Date(date + "T23:59:59-05:00");

    // Find all games on this date
    const games = await prisma.game.findMany({
      where: {
        startDateTime: {
          gte: startOfDayET,
          lte: endOfDayET,
        },
      },
      orderBy: {
        startDateTime: "asc",
      },
      select: {
        id: true,
        startDateTime: true,
        timePlayed: true,
        videoLink: true,
      },
    });

    return NextResponse.json({ games }, { status: 200 });
  } catch (error) {
    console.error("Error fetching games by date:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
