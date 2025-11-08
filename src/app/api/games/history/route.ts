import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

interface GameHistoryEntry {
  gameId: number;
  dateTime: string;
  team1Players: Array<{ name: string; lastName: string; elo: number; deltaELO: number; goals: number; gameInARow: number }>;
  team1AverageElo: number;
  team2Players: Array<{ name: string; lastName: string; elo: number; deltaELO: number; goals: number; gameInARow: number }>;
  team2AverageElo: number;
  timePlayed: number | null;
  team1Score: number;
  team2Score: number;
}

// GET game history - all finished games sorted by date descending
export async function GET() {
  try {
    const games = await prisma.game.findMany({
      where: {
        timePlayed: {
          not: null, // Only finished games
        },
      },
      include: {
        teamPlayers: {
          include: {
            player: true,
          },
        },
      },
      orderBy: {
        startDateTime: "asc", // Get chronologically to calculate ELOs at time
      },
    });

    // Calculate ELO at each point in time by going through games chronologically
    const playerElos = new Map<number, number>();

    // Initialize all players to 1500
    const allPlayers = await prisma.player.findMany();
    for (const player of allPlayers) {
      playerElos.set(player.id, 1500);
    }

    // Build ELO timeline
    const playerEloAtGameTime = new Map<number, Map<number, number>>(); // gameId -> (playerId -> elo)

    for (const game of games) {
      const gameElos = new Map<number, number>();

      // Store current ELOs for this game
      for (const tp of game.teamPlayers) {
        gameElos.set(tp.playerId, playerElos.get(tp.playerId) || 1500);
      }
      playerEloAtGameTime.set(game.id, gameElos);

      // Apply deltaELOs to update for next game
      for (const tp of game.teamPlayers) {
        const currentElo = playerElos.get(tp.playerId) || 1500;
        playerElos.set(tp.playerId, currentElo + tp.deltaELO);
      }
    }

    // Now map games in reverse order for display, but use computed ELOs
    const gameHistory: GameHistoryEntry[] = games.reverse().map((game) => {
      const gameElos = playerEloAtGameTime.get(game.id) || new Map();

      // Separate HOME and AWAY teams with ELO at time of game and deltaELO
      const homeTeamPlayers = game.teamPlayers
        .filter((tp) => tp.side === "HOME")
        .map((tp) => ({
          name: tp.player.name,
          lastName: tp.player.lastName,
          elo: gameElos.get(tp.playerId) || 1500,
          deltaELO: tp.deltaELO,
          goals: tp.goals,
          gameInARow: tp.gameInARow,
        }));

      const awayTeamPlayers = game.teamPlayers
        .filter((tp) => tp.side === "AWAY")
        .map((tp) => ({
          name: tp.player.name,
          lastName: tp.player.lastName,
          elo: gameElos.get(tp.playerId) || 1500,
          deltaELO: tp.deltaELO,
          goals: tp.goals,
          gameInARow: tp.gameInARow,
        }));

      // Use stored average ELO from time of game (or calculate if not stored)
      const homeAverageElo =
        game.homeTeamAverageElo ||
        (homeTeamPlayers.length > 0
          ? Math.round(
              homeTeamPlayers.reduce((sum, p) => sum + p.elo, 0) /
                homeTeamPlayers.length
            )
          : 0);

      const awayAverageElo =
        game.awayTeamAverageElo ||
        (awayTeamPlayers.length > 0
          ? Math.round(
              awayTeamPlayers.reduce((sum, p) => sum + p.elo, 0) /
                awayTeamPlayers.length
            )
          : 0);

      // Calculate scores
      const homeScore = game.teamPlayers
        .filter((tp) => tp.side === "HOME")
        .reduce((sum, tp) => sum + tp.goals, 0);

      const awayScore = game.teamPlayers
        .filter((tp) => tp.side === "AWAY")
        .reduce((sum, tp) => sum + tp.goals, 0);

      return {
        gameId: game.id,
        dateTime: game.startDateTime.toISOString(),
        team1Players: homeTeamPlayers,
        team1AverageElo: homeAverageElo,
        team2Players: awayTeamPlayers,
        team2AverageElo: awayAverageElo,
        timePlayed: game.timePlayed,
        team1Score: homeScore,
        team2Score: awayScore,
      };
    });

    return NextResponse.json({ gameHistory });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
