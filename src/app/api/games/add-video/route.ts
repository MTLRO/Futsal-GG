import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

interface GameUpdate {
  gameId: number;
  timestamp: number;
}

/**
 * POST /api/games/add-video
 *
 * Add YouTube URL to games with manual timestamps
 *
 * Request body:
 * {
 *   youtubeUrl: string,
 *   gameUpdates: Array<{gameId: number, timestamp: number}>
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { youtubeUrl, gameUpdates } = body;

    // Validate input
    if (!youtubeUrl || !Array.isArray(gameUpdates) || gameUpdates.length === 0) {
      return NextResponse.json(
        { error: "YouTube URL and gameUpdates array are required" },
        { status: 400 }
      );
    }

    // Process each game and add timestamped YouTube URLs
    for (const update of gameUpdates) {
      const { gameId, timestamp } = update as GameUpdate;

      // Build the YouTube URL with timestamp
      let videoUrl = youtubeUrl;

      // Add timestamp parameter
      if (timestamp > 0) {
        const separator = youtubeUrl.includes("?") ? "&" : "?";
        videoUrl = `${youtubeUrl}${separator}t=${timestamp}`;
      } else {
        // If zero or negative, set to t=0
        const separator = youtubeUrl.includes("?") ? "&" : "?";
        videoUrl = `${youtubeUrl}${separator}t=0`;
      }

      // Update the game with the video link
      await prisma.game.update({
        where: { id: gameId },
        data: { videoLink: videoUrl },
      });
    }

    return NextResponse.json(
      {
        success: true,
        gamesUpdated: gameUpdates.length,
        message: `Successfully added video to ${gameUpdates.length} game(s)`
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error adding video to games:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
