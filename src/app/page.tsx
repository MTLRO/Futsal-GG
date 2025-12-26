"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { ScoreboardTable } from "@/components/scoreboard-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RefreshCw, Lock, Unlock, History, UserPlus, Users, Sun, Moon, Search, X } from "lucide-react"
import { useAdmin } from "@/contexts/admin-context"
import { useTheme } from "@/contexts/theme-context"

interface ScoreboardEntry {
  playerId: number
  name: string
  lastName: string
  gamesPlayed: number
  goalsScored: number
  elo: number
  playerElo: number
  gkElo: number
  playerGames: number
  gkGames: number
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
  const { isAuthenticated, setIsAuthenticated, logout } = useAdmin()
  const { theme, toggleTheme } = useTheme()
  const [searchQuery, setSearchQuery] = useState("")
  const [password, setPassword] = useState("")
  const [authError, setAuthError] = useState("")
  const [isVerifying, setIsVerifying] = useState(false)

  const { data: scoreboard = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: ["scoreboard"],
    queryFn: fetchScoreboard,
    refetchInterval: 30000, // Auto-refresh every 30 seconds (reduced from 5s)
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
    } catch {
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

  const handleLock = async () => {
    await logout()
    setPassword("")
    setAuthError("")
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-8 text-center relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="absolute right-0 top-0"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>
          <h1 className="text-4xl sm:text-5xl font-bold text-primary mb-2">
            Futsal GG
          </h1>
        </header>

        {/* Game History Button */}
        <div className="mb-4 flex justify-center">
          <Link href="/games/history">
            <Button variant="outline">
              <History className="mr-2 h-4 w-4" />
              Game History
            </Button>
          </Link>
        </div>

        {/* Scoreboard and Admin Section Container */}
        <div className="w-fit mx-auto">
          {/* Scoreboard */}
          <main className="mb-4">
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
              <ScoreboardTable data={scoreboard} searchQuery={searchQuery} />
            )}
          </main>

          {/* Search Bar - Under Scoreboard */}
          <div className="relative w-full mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search players..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm pl-9 pr-8"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-lpignore="true"
              data-form-type="other"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

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
                <Link href="/admin/players/add">
                  <Button size="lg" className="gap-2 min-h-[48px] w-full">
                    <UserPlus className="h-5 w-5" />
                    Add Player
                  </Button>
                </Link>
                <Link href="/admin/teams">
                  <Button size="lg" className="gap-2 min-h-[48px] w-full">
                    <Users className="h-5 w-5" />
                    Change Teams
                  </Button>
                </Link>
                <Link href="/admin/games/add">
                  <Button size="lg" className="gap-2 min-h-[48px] w-full">
                    Add Game
                  </Button>
                </Link>
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
