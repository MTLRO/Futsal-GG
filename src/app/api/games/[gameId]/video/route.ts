import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Helper function to get EST day boundaries from a UTC date
function getESTDayBoundaries(utcDate: Date): { start: Date; end: Date } {
  // Get the EST date components
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(utcDate);
  const estYear = parts.find((p) => p.type === "year")!.value;
  const estMonth = parts.find((p) => p.type === "month")!.value;
  const estDay = parts.find((p) => p.type === "day")!.value;

  // Create dates for start and end of the EST day
  // We use a reference point: create a date at noon on this EST day
  const noonESTMillis = Date.UTC(
    parseInt(estYear),
    parseInt(estMonth) - 1,
    parseInt(estDay),
    12,
    0,
    0
  );

  // Find the offset between UTC and EST at this time
  // by comparing the actual time to what it would be in EST
  const testDate = new Date(noonESTMillis);
  const testParts = formatter.formatToParts(testDate);
  const testHour = parseInt(testParts.find((p) => p.type === "hour")!.value);

  // Calculate offset hours (if testHour is 7, offset is -5; if 8, offset is -4)
  const offsetHours = testHour - 12;

  // Start of day: midnight EST (00:00:00)
  const startUTC = Date.UTC(
    parseInt(estYear),
    parseInt(estMonth) - 1,
    parseInt(estDay),
    -offsetHours,
    0,
    0,
    0
  );

  // End of day: 23:59:59.999 EST
  const endUTC = Date.UTC(
    parseInt(estYear),
    parseInt(estMonth) - 1,
    parseInt(estDay),
    -offsetHours + 23,
    59,
    59,
    999
  );

  return { start: new Date(startUTC), end: new Date(endUTC) };
}

// PATCH - Update game video link and timestamp
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const resolvedParams = await params;
  try {
    const gameId = parseInt(resolvedParams.gameId);
    const body = await request.json();
    const { videoLink, videoTimestamp } = body;

    // Validate that at least one field is provided
    if (videoLink === undefined && videoTimestamp === undefined) {
      return NextResponse.json(
        { error: "Must provide videoLink or videoTimestamp" },
        { status: 400 }
      );
    }

    // Build update data object
    const updateData: { videoLink?: string | null; videoTimestamp?: number | null } = {};
    if (videoLink !== undefined) updateData.videoLink = videoLink;
    if (videoTimestamp !== undefined) updateData.videoTimestamp = videoTimestamp;

    // Update the current game
    const game = await prisma.game.update({
      where: { id: gameId },
      data: updateData,
    });

    // If a video link is being added (not removed), update other games on the same EST day
    if (videoLink && videoLink.trim() !== "") {
      // Get the EST day boundaries for this game
      const { start, end } = getESTDayBoundaries(game.startDateTime);

      // Find all other games on the same EST day that don't have a video link
      const sameDayGames = await prisma.game.findMany({
        where: {
          AND: [
            { id: { not: gameId } }, // Exclude the current game
            { startDateTime: { gte: start } },
            { startDateTime: { lte: end } },
            {
              OR: [
                { videoLink: null },
                { videoLink: "" },
              ],
            },
          ],
        },
      });

      // Update all games without videos on the same day
      if (sameDayGames.length > 0) {
        await prisma.game.updateMany({
          where: {
            id: {
              in: sameDayGames.map(g => g.id),
            },
          },
          data: {
            videoLink: videoLink,
            videoTimestamp: videoTimestamp,
          },
        });
      }
    }

    return NextResponse.json({ game });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
