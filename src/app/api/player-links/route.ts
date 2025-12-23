import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * GET /api/player-links
 *
 * Fetches all player links with their win/loss/draw statistics.
 * Returns links normalized so player1Id < player2Id (undirected graph).
 */
export async function GET() {
  try {
    const links = await prisma.playerLink.findMany({
      include: {
        player1: {
          select: {
            id: true,
            name: true,
            lastName: true,
          },
        },
        player2: {
          select: {
            id: true,
            name: true,
            lastName: true,
          },
        },
      },
    });

    // Transform links to include calculated synergy score
    const transformedLinks = links.map((link) => {
      const totalGames = link.wins + link.losses + link.draws;
      // Calculate synergy: wins = 1, draws = 0.5, losses = 0
      // Result is a value between 0 and 1
      const synergy = totalGames > 0
        ? (link.wins + link.draws * 0.5) / totalGames
        : 0.5; // Default to neutral if no games together

      return {
        player1Id: link.player1Id,
        player2Id: link.player2Id,
        player1Name: link.player1.name,
        player2Name: link.player2.name,
        wins: link.wins,
        losses: link.losses,
        draws: link.draws,
        totalGames,
        synergy, // 0 = always lose together, 0.5 = balanced, 1 = always win together
      };
    });

    return NextResponse.json({ links: transformedLinks });
  } catch (error) {
    console.error("Player Links Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
