"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { ScoreboardTable } from "@/components/scoreboard-table"
import { AddPlayerModal } from "@/components/add-player-modal"
import { ChangeTeamsModal } from "@/components/change-teams-modal"
import { AddGameModal } from "@/components/add-game-modal"
import { AddVideoModal } from "@/components/add-video-modal"
import { GameHistoryModal } from "@/components/game-history-modal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RefreshCw, Lock, Unlock } from "lucide-react"

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
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState("")
  const [authError, setAuthError] = useState("")
  const [isVerifying, setIsVerifying] = useState(false)

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

  const verifyPassword = async () => {
    if (!password.trim()) {
      setAuthError("Please enter a password")
      return
    }

    setIsVerifying(true)
    setAuthError("")

    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setIsAuthenticated(true)
        setPassword("")
        setAuthError("")
      } else {
        setAuthError("Invalid password")
      }
    } catch (err) {
      setAuthError("Failed to verify password")
    } finally {
      setIsVerifying(false)
    }
  }

  const handlePasswordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      verifyPassword()
    }
  }

  const handleLock = () => {
    setIsAuthenticated(false)
    setPassword("")
    setAuthError("")
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-primary mb-2">
            Futsal GG
          </h1>
        </header>

        {/* Game History Button */}
        <div className="mb-4 flex justify-center">
          <GameHistoryModal />
        </div>

        {/* Scoreboard and Admin Section Container */}
        <div className="w-fit mx-auto">
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

          {/* Admin Section */}
          <div className="flex flex-col gap-2 w-full">
            {!isAuthenticated ? (
              <div className="flex flex-col gap-2 w-full">
                <Input
                  type="password"
                  placeholder="Enter admin password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handlePasswordKeyDown}
                  disabled={isVerifying}
                  className="w-full"
                />
                <Button
                  onClick={verifyPassword}
                  disabled={isVerifying}
                  variant="default"
                  className="w-full"
                >
                  <Unlock className="mr-2 h-4 w-4" />
                  {isVerifying ? "Verifying..." : "Unlock"}
                </Button>
                {authError && (
                  <p className="text-sm text-red-600">{authError}</p>
                )}
              </div>
            ) : (
              <>
                <AddPlayerModal onPlayerAdded={() => refetch()} />
                <ChangeTeamsModal />
                <AddGameModal />
                <AddVideoModal />
                <Button
                  onClick={() => recomputeEloMutation.mutate()}
                  disabled={recomputeEloMutation.isPending}
                  variant="outline"
                  className="w-full"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {recomputeEloMutation.isPending ? "Computing..." : "Recompute ELO"}
                </Button>
                <Button
                  onClick={handleLock}
                  variant="outline"
                  className="w-full"
                  title="Lock admin controls"
                >
                  <Lock className="mr-2 h-4 w-4" />
                  Lock
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
