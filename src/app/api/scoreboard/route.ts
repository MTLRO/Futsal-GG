import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

interface ScoreboardEntry {
  playerId: number;
  name: string;
  lastName: string;
  gamesPlayed: number;
  goalsScored: number;
  elo: number; // Weighted average ELO
  playerElo: number; // Regular player ELO
  gkElo: number; // Goalkeeper ELO
  playerGames: number; // Games played as regular player
  gkGames: number; // Games played as goalkeeper
  last5GamesDeltaELO: number;
}

// GET scoreboard - computed from database with optimized queries
export async function GET() {
  try {
    // Single query: Get all players with their team player stats aggregated
    const players = await prisma.player.findMany({
      orderBy: { id: "asc" },
      include: {
        teamPlayers: {
          select: {
            gameId: true,
            goals: true,
            deltaELO: true,
            goalkeeper: true,
          },
          orderBy: { gameId: "desc" },
        },
      },
    });

    const scoreboard: ScoreboardEntry[] = players.map((player) => {
      const teamPlayers = player.teamPlayers;

      // Count unique games
      const uniqueGameIds = new Set(teamPlayers.map((tp) => tp.gameId));
      const gamesPlayed = uniqueGameIds.size;

      // Count games by position
      const gkGames = teamPlayers.filter(tp => tp.goalkeeper).length;
      const playerGames = teamPlayers.filter(tp => !tp.goalkeeper).length;

      // Calculate weighted average ELO
      const weightedElo = gamesPlayed === 0
        ? 1500
        : Math.round((player.gkElo * gkGames + player.elo * playerGames) / gamesPlayed);

      // Calculate total goals scored
      const goalsScored = teamPlayers.reduce((sum, tp) => sum + tp.goals, 0);

      // Get last 5 games' deltaELO (already ordered by gameId desc)
      const last5GamesDeltaELO = teamPlayers
        .slice(0, 5)
        .reduce((sum, tp) => sum + tp.deltaELO, 0);

      return {
        playerId: player.id,
        name: player.name,
        lastName: player.lastName,
        gamesPlayed,
        goalsScored,
        elo: weightedElo,
        playerElo: player.elo,
        gkElo: player.gkElo,
        playerGames,
        gkGames,
        last5GamesDeltaELO,
      };
    });

    return NextResponse.json({ scoreboard });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
