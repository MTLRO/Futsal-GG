import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * POST /api/games/live/end
 *
 * End the current live game and trigger ridge regression recomputation
 *
 * Request body:
 * {
 *   gameId: number
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { gameId } = body;

    if (!gameId) {
      return NextResponse.json(
        { error: "gameId is required" },
        { status: 400 }
      );
    }

    // Find the game
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        teamPlayers: {
          include: {
            player: true,
          },
        },
      },
    });

    if (!game) {
      return NextResponse.json(
        { error: "Game not found" },
        { status: 404 }
      );
    }

    if (game.endDateTime !== null) {
      return NextResponse.json(
        { error: "Game has already ended" },
        { status: 400 }
      );
    }

    // Calculate actual duration
    const endTime = new Date();
    const startTime = new Date(game.startDateTime);
    const actualDuration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000); // in seconds

    // Update the game with endDateTime and actual duration
    const updatedGame = await prisma.game.update({
      where: { id: gameId },
      data: {
        endDateTime: endTime,
        timePlayed: actualDuration,
      },
      include: {
        teamPlayers: {
          include: {
            player: true,
          },
        },
      },
    });

    // Trigger ridge regression recomputation for all games
    // This will recalculate all player ratings from scratch
    try {
      const computeUrl = new URL('/api/elo/compute', request.url);
      const computeResponse = await fetch(computeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!computeResponse.ok) {
        console.error('Failed to recompute ridge regression ratings');
        const errorData = await computeResponse.json();
        console.error('Recomputation error:', errorData);
      } else {
        const result = await computeResponse.json();
        console.log('Ridge regression recomputation successful:', result);
      }
    } catch (recomputeError) {
      console.error('Error triggering ridge regression recomputation:', recomputeError);
      // Don't fail the game end if recomputation fails
      // The admin can manually trigger recomputation later
    }

    return NextResponse.json({ game: updatedGame }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
