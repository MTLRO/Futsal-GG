"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { ScoreboardTable } from "@/components/scoreboard-table"
import { AddPlayerModal } from "@/components/add-player-modal"
import { ChangeTeamsModal } from "@/components/change-teams-modal"
import { AddGameModal } from "@/components/add-game-modal"
import { GameHistoryModal } from "@/components/game-history-modal"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"

interface ScoreboardEntry {
  playerId: number
  name: string
  lastName: string
  gamesPlayed: number
  goalsScored: number
  elo: number
  last5GamesDeltaELO: number
}

const fetchScoreboard = async (): Promise<ScoreboardEntry[]> => {
  const response = await fetch("/api/scoreboard")
  if (!response.ok) {
    throw new Error("Failed to fetch scoreboard")
  }
  const data = await response.json()
  return data.scoreboard
}

export default function Home() {
  const queryClient = useQueryClient()
  const { data: scoreboard = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: ["scoreboard"],
    queryFn: fetchScoreboard,
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  })

  const recomputeEloMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/elo/compute", {
        method: "POST",
      })
      if (!response.ok) {
        throw new Error("Failed to recompute ELO")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scoreboard"] })
      refetch()
    },
  })

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-primary mb-2">
            Futsal-GG
          </h1>
          <p className="text-muted-foreground">Scoreboard</p>
        </header>

        {/* Game History Button */}
        <div className="mb-4 flex justify-center">
          <GameHistoryModal />
        </div>

        {/* Scoreboard */}
        <main className="mb-8">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="text-muted-foreground">Loading scoreboard...</div>
            </div>
          ) : error ? (
            <div className="flex justify-center items-center py-20">
              <div className="text-red-600">
                Error: {error.message}
              </div>
            </div>
          ) : (
            <ScoreboardTable data={scoreboard} />
          )}
        </main>

        {/* Action Buttons */}
        <div className="flex justify-center gap-4 flex-wrap">
          <AddPlayerModal onPlayerAdded={() => refetch()} />
          <ChangeTeamsModal />
          <AddGameModal />
          <Button
            onClick={() => recomputeEloMutation.mutate()}
            disabled={recomputeEloMutation.isPending}
            variant="outline"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {recomputeEloMutation.isPending ? "Computing..." : "Recompute ELO"}
          </Button>
        </div>
      </div>
    </div>
  )
}
