import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'

// Load environment variables from .env.local
config({ path: '.env.local' })

const prisma = new PrismaClient()

async function updateVideoLinks() {
  try {
    // First, let's see what games exist
    const allGames = await prisma.game.findMany({
      select: {
        id: true,
        startDateTime: true,
      },
      orderBy: {
        startDateTime: 'desc',
      },
    })

    console.log('All games in database:')
    allGames.forEach(game => {
      console.log(`Game ${game.id}: ${game.startDateTime}`)
    })

    // Update all games on October 27th, 2025 (any time)
    const result = await prisma.game.updateMany({
      where: {
        startDateTime: {
          gte: new Date('2025-10-27T00:00:00'),
          lt: new Date('2025-10-28T00:00:00'),
        },
      },
      data: {
        videoLink: 'https://youtu.be/fKTALVSL3ho',
      },
    })

    console.log(`\nUpdated ${result.count} game(s) with video link`)
  } catch (error) {
    console.error('Error updating video links:', error)
  } finally {
    await prisma.$disconnect()
  }
}

updateVideoLinks()
