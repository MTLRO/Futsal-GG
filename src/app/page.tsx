"use client"

import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { LeaderboardTable } from "@/components/leaderboard-table"
import { Button } from "@/components/ui/button"
import { Shield } from "lucide-react"


const fetchLeaderboard = async (): Promise<any[]> => {
  const response = await fetch("/api/leaderboard")
  if (!response.ok) {
    throw new Error("Failed to fetch leaderboard")
  }
  return response.json()
}

export default function Home() {
  const router = useRouter()

  const { data: leaderboard = [], isLoading: loading, error } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: fetchLeaderboard,
  })

  const handlePlayerClick = (playerId: number) => {
    router.push(`/player/${playerId}`)
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-primary mb-2">
            Futsal-GG
          </h1>
          <p className="text-muted-foreground">Leaderboard (last updated: ...)</p>
        </header>

        {/* Leaderboard */}
        <main className="mb-8">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="text-muted-foreground">Loading leaderboard...</div>
            </div>
          ) : error ? (
            <div className="flex justify-center items-center py-20">
              <div className="text-red-600">
                Error: {error.message}
              </div>
            </div>
          ) : (
            <LeaderboardTable data={leaderboard} onPlayerClick={handlePlayerClick} />
          )}
        </main>

        {/* Admin Button */}
        <footer className="flex justify-center">
          <Button
            size="lg"
            onClick={() => router.push("/game-master")}
            className="gap-2 min-h-[48px]"
          >
            <Shield className="h-5 w-5" />
            Game Master
          </Button>
        </footer>
      </div>
    </div>
  )
}
