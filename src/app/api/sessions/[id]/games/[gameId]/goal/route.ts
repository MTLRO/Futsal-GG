import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const sessionId = parseInt(params.id)
        const body = await request.json()
        const { gameId, playerId } = body

        if (!gameId || !playerId) {
            return NextResponse.json(
                { error: 'gameId and playerId are required' },
                { status: 400 }
            )
        }

        // Check if game exists and is in progress
        const game = await prisma.game.findUnique({
            where: {
                sessionId_id: {
                    sessionId,
                    id: gameId,
                },
            },
        })

        if (!game) {
            return NextResponse.json(
                { error: 'Game not found' },
                { status: 404 }
            )
        }

        if (game.status !== 'IN_PROGRESS') {
            return NextResponse.json(
                { error: 'Cannot add goals to a game that is not in progress' },
                { status: 400 }
            )
        }

        // Check if player is in this game
        const gamePlayer = await prisma.gamePlayer.findUnique({
            where: {
                sessionId_gameId_playerId: {
                    sessionId,
                    gameId,
                    playerId,
                },
            },
        })

        if (!gamePlayer) {
            return NextResponse.json(
                { error: 'Player is not in this game' },
                { status: 404 }
            )
        }

        // Increment the player's goals
        const updatedGamePlayer = await prisma.gamePlayer.update({
            where: {
                sessionId_gameId_playerId: {
                    sessionId,
                    gameId,
                    playerId,
                },
            },
            data: {
                goals: { increment: 1 },
            },
            include: {
                player: true,
            },
        })

        return NextResponse.json(updatedGamePlayer)
    } catch (error) {
        console.error('Error adding goal:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json(
            { error: 'Failed to add goal', details: errorMessage },
            { status: 500 }
        )
    }
}
