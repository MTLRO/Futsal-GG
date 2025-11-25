import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcrypt'

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()

    if (!password) {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      )
    }

    // Get the video password from database
    const gameMaster = await prisma.gameMaster.findFirst()

    if (!gameMaster) {
      return NextResponse.json(
        { error: 'No game master configured' },
        { status: 500 }
      )
    }

    if (!gameMaster.videoPasswordHash) {
      return NextResponse.json(
        { error: 'Video password not configured' },
        { status: 500 }
      )
    }

    // Compare password with hashed password
    const isValid = await bcrypt.compare(password, gameMaster.videoPasswordHash)

    if (isValid) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      )
    }
  } catch (error) {
    console.error('Error verifying video password:', error)
    return NextResponse.json(
      { error: 'Failed to verify password' },
      { status: 500 }
    )
  }
}
