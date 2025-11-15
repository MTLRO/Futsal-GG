import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * POST /api/games/add-video
 *
 * Add YouTube URL to all games on a specific date with timestamps
 *
 * Request body:
 * {
 *   youtubeUrl: string,
 *   date: string (YYYY-MM-DD),
 *   videoStartOffset: number (seconds, can be negative)
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { youtubeUrl, date, videoStartOffset } = body;

    // Validate input
    if (!youtubeUrl || !date) {
      return NextResponse.json(
        { error: "YouTube URL and date are required" },
        { status: 400 }
      );
    }

    // Parse the date and create Eastern Time range for that day
    // Eastern Time is UTC-5 (EST) or UTC-4 (EDT)
    const dateObj = new Date(date + "T00:00:00");

    // Convert to Eastern Time
    // We'll search for games that fall on this date in Eastern time
    // To do this properly, we need to create a date range
    const startOfDayET = new Date(date + "T00:00:00-05:00"); // Assume EST for start
    const endOfDayET = new Date(date + "T23:59:59-05:00"); // Assume EST for end

    // Find all games on this date
    const gamesOnDate = await prisma.game.findMany({
      where: {
        startDateTime: {
          gte: startOfDayET,
          lte: endOfDayET,
        },
      },
      orderBy: {
        startDateTime: "asc",
      },
    });

    if (gamesOnDate.length === 0) {
      return NextResponse.json(
        { error: "No games found on this date" },
        { status: 404 }
      );
    }

    // Process each game and add timestamped YouTube URLs
    const offset = parseInt(String(videoStartOffset)) || 0;
    const firstGameStartTime = new Date(gamesOnDate[0].startDateTime).getTime();

    for (let i = 0; i < gamesOnDate.length; i++) {
      const game = gamesOnDate[i];

      // Calculate timestamp for this game in the video
      // Time elapsed from first game start + user's offset
      const gameStartTime = new Date(game.startDateTime).getTime();
      const elapsedSeconds = Math.floor((gameStartTime - firstGameStartTime) / 1000);
      const videoTimestamp = offset + elapsedSeconds;

      // Build the YouTube URL with timestamp
      let videoUrl = youtubeUrl;

      // Add timestamp parameter if we have a positive time
      if (videoTimestamp > 0) {
        const separator = youtubeUrl.includes("?") ? "&" : "?";
        videoUrl = `${youtubeUrl}${separator}t=${videoTimestamp}`;
      } else if (videoTimestamp <= 0) {
        // If zero or negative, set to t=0
        const separator = youtubeUrl.includes("?") ? "&" : "?";
        videoUrl = `${youtubeUrl}${separator}t=0`;
      }

      // Update the game with the video link
      await prisma.game.update({
        where: { id: game.id },
        data: { videoLink: videoUrl },
      });
    }

    return NextResponse.json(
      {
        success: true,
        gamesUpdated: gamesOnDate.length,
        message: `Successfully added video to ${gamesOnDate.length} game(s)`
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error adding video to games:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
