import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const sessionId = parseInt(params.id)

        const session = await prisma.session.findUnique({
            where: { id: sessionId },
            include: {
                games: {
                    include: {
                        gamePlayers: {
                            include: {
                                player: true,
                            },
                        },
                    },
                    orderBy: { id: 'desc' },
                },
            },
        })

        if (!session) {
            return NextResponse.json(
                { error: 'Session not found' },
                { status: 404 }
            )
        }

        // Get player details for each team
        const team1Players = await prisma.player.findMany({
            where: { id: { in: session.team1PlayerIds } },
        })
        const team2Players = await prisma.player.findMany({
            where: { id: { in: session.team2PlayerIds } },
        })
        const team3Players = await prisma.player.findMany({
            where: { id: { in: session.team3PlayerIds } },
        })

        return NextResponse.json({
            ...session,
            team1Players,
            team2Players,
            team3Players,
        })
    } catch (error) {
        console.error('Error fetching session:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json(
            { error: 'Failed to fetch session', details: errorMessage },
            { status: 500 }
        )
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const sessionId = parseInt(params.id)
        const body = await request.json()

        // Check that session is SCHEDULED
        const session = await prisma.session.findUnique({
            where: { id: sessionId },
        })

        if (!session) {
            return NextResponse.json(
                { error: 'Session not found' },
                { status: 404 }
            )
        }

        if (session.status !== 'SCHEDULED') {
            return NextResponse.json(
                { error: 'Can only update SCHEDULED sessions' },
                { status: 400 }
            )
        }

        // Update session
        const updatedSession = await prisma.session.update({
            where: { id: sessionId },
            data: {
                date: body.date ? new Date(body.date) : undefined,
                gameLengthMinutes: body.gameLengthMinutes,
                team1PlayerIds: body.team1PlayerIds,
                team2PlayerIds: body.team2PlayerIds,
                team3PlayerIds: body.team3PlayerIds,
            },
        })

        return NextResponse.json(updatedSession)
    } catch (error) {
        console.error('Error updating session:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json(
            { error: 'Failed to update session', details: errorMessage },
            { status: 500 }
        )
    }
}
