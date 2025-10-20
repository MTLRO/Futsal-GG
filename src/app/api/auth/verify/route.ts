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

    // Get the game master password from database
    const gameMaster = await prisma.gameMaster.findFirst()

    if (!gameMaster) {
      return NextResponse.json(
        { error: 'No game master configured' },
        { status: 500 }
      )
    }

    // Compare password with hashed password
    const isValid = await bcrypt.compare(password, gameMaster.passwordHash)

    if (isValid) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      )
    }
  } catch (error) {
    console.error('Error verifying password:', error)
    return NextResponse.json(
      { error: 'Failed to verify password' },
      { status: 500 }
    )
  }
}
