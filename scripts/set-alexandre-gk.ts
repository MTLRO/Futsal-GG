import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  try {
    // Find Alexandre
    const alexandre = await prisma.player.findFirst({
      where: {
        name: "Alexandre",
      },
    });

    if (!alexandre) {
      console.log("Alexandre not found. Searching by name (case-insensitive)...");
      const players = await prisma.player.findMany({
        where: {
          name: {
            contains: "Alexandre",
            mode: "insensitive",
          },
        },
      });
      if (players.length > 0) {
        console.log("Found players:", players);
      } else {
        console.log("No players found with 'Alexandre' in name");
      }
      return;
    }

    console.log(`Found Alexandre with ID: ${alexandre.id}`);

    // Update all TeamPlayer records for Alexandre to set goalkeeper = true
    const updated = await prisma.teamPlayer.updateMany({
      where: {
        playerId: alexandre.id,
      },
      data: {
        goalkeeper: true,
      },
    });

    console.log(`Updated ${updated.count} game records for Alexandre to goalkeeper`);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
