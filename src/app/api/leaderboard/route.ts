import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Fetch all players from the database, ordered by ELO descending
    const players = await prisma.player.findMany({
      include: {
        teamPlayers: {
          include: {
            game: true,
          },
        },
      },
      orderBy: {
        elo: 'desc'
      }
    })

    // Transform the data to match the expected format
    const leaderboard = players.map(player => {
      const games = player.teamPlayers.map((tp) => tp.game);
      const gamesPlayed = new Set(games.map((g) => g.id)).size;

      return {
        id: player.id,
        playerName: `${player.name} ${player.lastName.charAt(0)}.`,
        currentElo: player.elo,
        gamesPlayed,
      }
    })

    return NextResponse.json(leaderboard)
  } catch (error) {
    console.error('Error fetching leaderboard:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard', details: errorMessage },
      { status: 500 }
    )
  }
}
