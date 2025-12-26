import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcrypt'

const SESSION_COOKIE_NAME = 'futsal_admin_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days in seconds

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
      // Create a simple session token (hash of password hash + timestamp)
      const sessionToken = Buffer.from(`${gameMaster.id}:${Date.now()}`).toString('base64')

      const response = NextResponse.json({ success: true })

      // Set HTTP-only cookie for session persistence
      response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: SESSION_MAX_AGE,
        path: '/',
      })

      return response
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

// GET endpoint to check current auth status
export async function GET(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)

  if (!sessionCookie?.value) {
    return NextResponse.json({ authenticated: false })
  }

  try {
    // Decode and validate session token
    const decoded = Buffer.from(sessionCookie.value, 'base64').toString()
    const [gameMasterId] = decoded.split(':')

    if (gameMasterId) {
      const gameMaster = await prisma.gameMaster.findFirst({
        where: { id: parseInt(gameMasterId) }
      })

      if (gameMaster) {
        return NextResponse.json({ authenticated: true })
      }
    }
  } catch {
    // Invalid token format
  }

  return NextResponse.json({ authenticated: false })
}

// DELETE endpoint to logout
export async function DELETE() {
  const response = NextResponse.json({ success: true })

  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0, // Expire immediately
    path: '/',
  })

  return response
}
