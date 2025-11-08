"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

interface Player {
  id: number
  name: string
  lastName: string
  elo: number
}

interface Game {
  id: number
  timePlayed: number | null
  startDateTime: string
  teamPlayers: Array<{
    id: number
    side: string
    playerId: number
    goals: number
    deltaELO: number
  }>
}

export default function GameMasterPage() {
  const queryClient = useQueryClient()
  const [password, setPassword] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError("")

    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })

      if (response.ok) {
        setIsAuthenticated(true)
        setPassword("")
      } else {
        setPasswordError("Invalid password")
      }
    } catch {
      setPasswordError("Failed to verify password")
    }
  }

  const { data: currentGame } = useQuery<{ game: Game | null }>({
    queryKey: ["currentGame"],
    queryFn: async () => {
      const res = await fetch("/api/games")
      if (!res.ok) throw new Error("Failed to fetch current game")
      return res.json()
    },
    enabled: isAuthenticated,
    refetchInterval: 2000,
  })

  const { data: allPlayers = [] } = useQuery<Player[]>({
    queryKey: ["players"],
    queryFn: async () => {
      const res = await fetch("/api/players")
      if (!res.ok) throw new Error("Failed to fetch players")
      const data = await res.json()
      return data.players || []
    },
    enabled: isAuthenticated,
  })

  const startGameMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error("Failed to start game")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentGame"] })
    },
  })

  const endGameMutation = useMutation({
    mutationFn: async (gameId: number) => {
      const res = await fetch(`/api/games/${gameId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timePlayed: Math.floor(
            (new Date().getTime() -
              new Date(currentGame?.game?.startDateTime || 0).getTime()) /
              1000
          ),
        }),
      })
      if (!res.ok) throw new Error("Failed to end game")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentGame"] })
    },
  })

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Game Master Access</CardTitle>
            <CardDescription>Enter the game master password to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <Input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {passwordError && <div className="text-sm text-red-600">{passwordError}</div>}
              <Button type="submit" className="w-full">
                Unlock
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Game Master</h1>

        {/* Current Game */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Current Game</CardTitle>
          </CardHeader>
          <CardContent>
            {currentGame?.game ? (
              <div className="space-y-4">
                <p className="text-muted-foreground">Game in progress</p>
                <Button
                  onClick={() => endGameMutation.mutate(currentGame.game!.id)}
                  disabled={endGameMutation.isPending}
                  variant="secondary"
                >
                  {endGameMutation.isPending ? "Ending..." : "End Game"}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-muted-foreground">No active game</p>
                <Button
                  onClick={() => startGameMutation.mutate()}
                  disabled={startGameMutation.isPending}
                >
                  {startGameMutation.isPending ? "Starting..." : "Start Live Game"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Players */}
        <Card>
          <CardHeader>
            <CardTitle>Players ({allPlayers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {allPlayers.length === 0 ? (
              <p className="text-muted-foreground">No players yet. Add players from the home page.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {allPlayers
                  .sort((a, b) => b.elo - a.elo)
                  .map((player) => (
                    <div key={player.id} className="flex justify-between items-center p-2 border rounded">
                      <span>
                        {player.name}
                      </span>
                      <Badge>{player.elo} ELO</Badge>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
