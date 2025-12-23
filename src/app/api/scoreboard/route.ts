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

// GET scoreboard - computed from database
export async function GET() {
  try {
    const players = await prisma.player.findMany({
      orderBy: {
        id: "asc",
      },
    });

    const scoreboard: ScoreboardEntry[] = await Promise.all(
      players.map(async (player) => {
        // Get all TeamPlayer entries for this player
        const teamPlayers = await prisma.teamPlayer.findMany({
          where: { playerId: player.id },
        });

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

        // Get last 5 TeamPlayer entries (ordered by gameId descending)
        const last5TeamPlayers = await prisma.teamPlayer.findMany({
          where: { playerId: player.id },
          orderBy: { gameId: "desc" },
          take: 5,
        });

        // Sum the deltaELO for last 5 games
        const last5GamesDeltaELO = last5TeamPlayers.reduce((sum, tp) => sum + tp.deltaELO, 0);

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
      })
    );

    return NextResponse.json({ scoreboard });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
