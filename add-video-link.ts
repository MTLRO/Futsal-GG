import { PrismaClient } from '@prisma/client'
import * as readline from 'readline'

const prisma = new PrismaClient()

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve)
  })
}

async function main() {
  try {
    console.log('=== Add Video Link to Games ===\n')

    // Get video link
    const videoLink = await question('Enter the video link: ')
    if (!videoLink.trim()) {
      console.log('Error: Video link cannot be empty')
      rl.close()
      return
    }

    // Get date
    const dateInput = await question('Enter the date (YYYY-MM-DD): ')
    if (!dateInput.trim()) {
      console.log('Error: Date cannot be empty')
      rl.close()
      return
    }

    // Parse the date
    const targetDate = new Date(dateInput)
    if (isNaN(targetDate.getTime())) {
      console.log('Error: Invalid date format. Please use YYYY-MM-DD')
      rl.close()
      return
    }

    // Set time range for the entire day
    const startOfDay = new Date(targetDate)
    startOfDay.setHours(0, 0, 0, 0)

    const endOfDay = new Date(targetDate)
    endOfDay.setHours(23, 59, 59, 999)

    console.log(`\nSearching for games on ${dateInput}...`)

    // Find games on that date
    const games = await prisma.game.findMany({
      where: {
        startDateTime: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: {
        startDateTime: 'asc',
      },
    })

    if (games.length === 0) {
      console.log(`No games found on ${dateInput}`)
      rl.close()
      return
    }

    console.log(`\nFound ${games.length} game(s) on ${dateInput}:`)
    games.forEach((game, index) => {
      const time = game.startDateTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })
      console.log(`  ${index + 1}. Game ID: ${game.id} - Started at ${time}`)
    })

    // Confirm update
    const confirm = await question(`\nUpdate all ${games.length} game(s) with video link? (yes/no): `)
    if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
      console.log('Update cancelled')
      rl.close()
      return
    }

    // Update all games
    const result = await prisma.game.updateMany({
      where: {
        startDateTime: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      data: {
        videoLink: videoLink.trim(),
      },
    })

    console.log(`\n✓ Successfully updated ${result.count} game(s) with video link: ${videoLink}`)
  } catch (error) {
    console.error('Error:', error)
  } finally {
    rl.close()
    await prisma.$disconnect()
  }
}

main()
