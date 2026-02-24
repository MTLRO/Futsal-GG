"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { ScoreboardTable } from "@/components/scoreboard-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { RefreshCw, Lock, Unlock, History, UserPlus, Users, Sun, Moon, ShieldCheck } from "lucide-react"
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
  const [password, setPassword] = useState("")
  const [authError, setAuthError] = useState("")
  const [isVerifying, setIsVerifying] = useState(false)
  const [showGameMasterDialog, setShowGameMasterDialog] = useState(false)

  const { data: scoreboard = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: ["scoreboard"],
    queryFn: fetchScoreboard,
    refetchInterval: 30000,
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setIsAuthenticated(true)
        setPassword("")
        setAuthError("")
        setShowGameMasterDialog(false)
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
    <div className="flex flex-col h-screen bg-background">
      {/* Sticky Header */}
      <header className="shrink-0 z-40 bg-black text-white flex items-center justify-between px-4 h-12">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="text-white hover:text-white hover:bg-white/10"
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>

        <h1 className="text-xl font-bold tracking-wide">Futsal GG</h1>

        <Link href="/games/history">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:text-white hover:bg-white/10"
            title="Game History"
          >
            <History className="h-5 w-5" />
          </Button>
        </Link>
      </header>

      {/* Main content — fills remaining height */}
      <div className="flex-1 overflow-hidden flex flex-col p-2 sm:p-4 pb-14 sm:pb-4">
        <div className="flex-1 overflow-hidden w-fit mx-auto flex flex-col gap-2">
          {/* Scoreboard */}
          <main className="flex-1 overflow-hidden">
            {loading ? (
              <div className="flex justify-center items-center h-full">
                <div className="text-muted-foreground">Loading scoreboard...</div>
              </div>
            ) : error ? (
              <div className="flex justify-center items-center h-full">
                <div className="text-red-600">Error: {error.message}</div>
              </div>
            ) : (
              <ScoreboardTable data={scoreboard} />
            )}
          </main>

          {/* Admin Section — desktop only */}
          <div className="hidden sm:flex flex-col gap-2 w-full shrink-0">
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
                <Button onClick={verifyPassword} disabled={isVerifying} variant="default" className="w-full">
                  <Unlock className="mr-2 h-4 w-4" />
                  {isVerifying ? "Verifying..." : "Unlock"}
                </Button>
                {authError && <p className="text-sm text-red-600">{authError}</p>}
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
                <Button onClick={handleLock} variant="outline" className="w-full" title="Lock admin controls">
                  <Lock className="mr-2 h-4 w-4" />
                  Lock
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Fixed Footer — mobile only */}
      <div className="fixed bottom-0 left-0 right-0 sm:hidden bg-black text-white z-40 h-14 flex items-center justify-center px-4">
        {isAuthenticated ? (
          <div className="flex items-center gap-3 w-full justify-center">
            <Link href="/admin/players/add">
              <Button size="sm" variant="ghost" className="text-white hover:text-white hover:bg-white/10 gap-1">
                <UserPlus className="h-4 w-4" />
                Add Player
              </Button>
            </Link>
            <Link href="/admin/teams">
              <Button size="sm" variant="ghost" className="text-white hover:text-white hover:bg-white/10 gap-1">
                <Users className="h-4 w-4" />
                Teams
              </Button>
            </Link>
            <Link href="/admin/games/add">
              <Button size="sm" variant="ghost" className="text-white hover:text-white hover:bg-white/10">
                Add Game
              </Button>
            </Link>
            <Button
              size="sm"
              variant="ghost"
              className="text-white hover:text-white hover:bg-white/10"
              onClick={handleLock}
              title="Lock"
            >
              <Lock className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            className="text-white hover:text-white hover:bg-white/10 gap-2 text-base font-semibold"
            onClick={() => setShowGameMasterDialog(true)}
          >
            <ShieldCheck className="h-5 w-5" />
            Game Master
          </Button>
        )}
      </div>

      {/* Game Master Password Dialog */}
      <Dialog open={showGameMasterDialog} onOpenChange={setShowGameMasterDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Game Master
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-2">
            <Input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handlePasswordKeyDown}
              disabled={isVerifying}
              autoFocus
            />
            <Button onClick={verifyPassword} disabled={isVerifying} className="w-full">
              <Unlock className="mr-2 h-4 w-4" />
              {isVerifying ? "Verifying..." : "Unlock"}
            </Button>
            {authError && <p className="text-sm text-red-600 text-center">{authError}</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
