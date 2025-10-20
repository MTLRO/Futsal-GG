"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type Player = {
  id: number
  firstName: string
  lastName: string
  elo: number
  totalGoals: number
}

type GamePlayer = {
  playerId: number
  goals: number
  player: Player
}

type Game = {
  id: number
  sessionId: number
  homeTeamNumber: string
  awayTeamNumber: string
  homeScore: number
  awayScore: number
  status: string
  startedAt: string
  durationSeconds?: number
  gamePlayers: GamePlayer[]
}

type Session = {
  id: number
  date: string
  status: string
  gameLengthMinutes: number
  team1PlayerIds: number[]
  team2PlayerIds: number[]
  team3PlayerIds: number[]
  team1Players: Player[]
  team2Players: Player[]
  team3Players: Player[]
  games: Game[]
}

export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const sessionId = parseInt(resolvedParams.id)
  const router = useRouter()
  const queryClient = useQueryClient()

  const [startGameDialogOpen, setStartGameDialogOpen] = useState(false)
  const [selectedHomeTeam, setSelectedHomeTeam] = useState<string | null>(null)
  const [selectedAwayTeam, setSelectedAwayTeam] = useState<string | null>(null)
  const [gameStartTime, setGameStartTime] = useState<number | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  const { data: session, isLoading } = useQuery<Session>({
    queryKey: ["session", sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/sessions/${sessionId}`)
      if (!res.ok) throw new Error("Failed to fetch session")
      return res.json()
    },
    refetchInterval: 2000, // Refetch every 2 seconds for live updates
  })

  const currentGame = session?.games?.[0]
  const isGameInProgress = currentGame?.status === "IN_PROGRESS"

  // Timer for current game
  useEffect(() => {
    if (isGameInProgress && currentGame) {
      setGameStartTime(new Date(currentGame.startedAt).getTime())
    } else {
      setGameStartTime(null)
      setElapsedSeconds(0)
    }
  }, [isGameInProgress, currentGame])

  useEffect(() => {
    if (gameStartTime) {
      const interval = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - gameStartTime) / 1000))
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [gameStartTime])

  const gameLengthSeconds = (session?.gameLengthMinutes || 7) * 60
  const timeRemaining = Math.max(0, gameLengthSeconds - elapsedSeconds)
  const isWarningTime = timeRemaining <= 30 && timeRemaining > 0
  const isOvertime = elapsedSeconds > gameLengthSeconds

  const startGameMutation = useMutation({
    mutationFn: async ({ homeTeam, awayTeam }: { homeTeam: string; awayTeam: string }) => {
      const res = await fetch(`/api/sessions/${sessionId}/games/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ homeTeam, awayTeam }),
      })
      if (!res.ok) throw new Error("Failed to start game")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session", sessionId] })
      setStartGameDialogOpen(false)
      setSelectedHomeTeam(null)
      setSelectedAwayTeam(null)
    },
  })

  const endGameMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/sessions/${sessionId}/games/${currentGame!.id}/end`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: currentGame!.id,
          durationSeconds: elapsedSeconds,
        }),
      })
      if (!res.ok) throw new Error("Failed to end game")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session", sessionId] })
    },
  })

  const addGoalMutation = useMutation({
    mutationFn: async (playerId: number) => {
      const res = await fetch(`/api/sessions/${sessionId}/games/${currentGame!.id}/goal`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: currentGame!.id,
          playerId,
        }),
      })
      if (!res.ok) throw new Error("Failed to add goal")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session", sessionId] })
    },
  })

  if (isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>
  }

  if (!session) {
    return <div className="min-h-screen bg-background flex items-center justify-center">Session not found</div>
  }

  const getTeamPlayers = (teamNumber: string): Player[] => {
    switch (teamNumber) {
      case "TEAM_1":
        return session.team1Players
      case "TEAM_2":
        return session.team2Players
      case "TEAM_3":
        return session.team3Players
      default:
        return []
    }
  }

  const getTeamName = (teamNumber: string): string => {
    const players = getTeamPlayers(teamNumber)
    if (players.length === 0) return teamNumber
    const topPlayer = players.reduce((max, p) => (p.elo > max.elo ? p : max), players[0])
    return `${topPlayer.firstName}'s Team`
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  // SCHEDULED SESSION - Show teams and start button
  if (session.status === "SCHEDULED") {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto">
          <Button variant="outline" onClick={() => router.push("/game-master")} className="mb-4">
            ← Back
          </Button>

          <h1 className="text-2xl font-bold mb-6">
            {new Date(session.date).toLocaleString()}
          </h1>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {["TEAM_1", "TEAM_2", "TEAM_3"].map((teamNum) => (
              <Card key={teamNum}>
                <CardHeader>
                  <CardTitle className="text-lg">{getTeamName(teamNum)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {getTeamPlayers(teamNum).map((player) => (
                      <div key={player.id} className="flex justify-between text-sm">
                        <span>{player.firstName} {player.lastName.charAt(0)}.</span>
                        <Badge variant="outline">{player.elo}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Dialog open={startGameDialogOpen} onOpenChange={setStartGameDialogOpen}>
            <Button onClick={() => setStartGameDialogOpen(true)} className="w-full" size="lg">
              Start Session
            </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Select Starting Teams</DialogTitle>
                <DialogDescription>Choose which two teams will play first</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                {["TEAM_1", "TEAM_2", "TEAM_3"].map((teamNum) => (
                  <div
                    key={teamNum}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedHomeTeam === teamNum || selectedAwayTeam === teamNum
                        ? "border-primary bg-primary/10"
                        : "hover:border-primary/50"
                    }`}
                    onClick={() => {
                      if (!selectedHomeTeam) {
                        setSelectedHomeTeam(teamNum)
                      } else if (!selectedAwayTeam && selectedHomeTeam !== teamNum) {
                        setSelectedAwayTeam(teamNum)
                      } else {
                        setSelectedHomeTeam(teamNum)
                        setSelectedAwayTeam(null)
                      }
                    }}
                  >
                    <div className="font-medium">{getTeamName(teamNum)}</div>
                    <div className="text-sm text-muted-foreground">
                      {getTeamPlayers(teamNum).map(p => `${p.firstName} ${p.lastName.charAt(0)}.`).join(", ")}
                    </div>
                  </div>
                ))}
                <Button
                  onClick={() => {
                    if (selectedHomeTeam && selectedAwayTeam) {
                      startGameMutation.mutate({ homeTeam: selectedHomeTeam, awayTeam: selectedAwayTeam })
                    }
                  }}
                  disabled={!selectedHomeTeam || !selectedAwayTeam || startGameMutation.isPending}
                  className="w-full"
                >
                  {startGameMutation.isPending ? "Starting..." : "Start Game"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    )
  }

  // IN_PROGRESS SESSION - Show live game interface
  if (session.status === "IN_PROGRESS") {
    const homePlayers = currentGame.gamePlayers.filter(gp => gp.player && getTeamPlayers(currentGame.homeTeamNumber).some(p => p.id === gp.playerId))
    const awayPlayers = currentGame.gamePlayers.filter(gp => gp.player && getTeamPlayers(currentGame.awayTeamNumber).some(p => p.id === gp.playerId))

    return (
      <div className={`min-h-screen p-4 transition-colors ${isOvertime ? "bg-red-100" : isWarningTime ? "bg-yellow-100" : "bg-background"}`}>
        <div className="max-w-2xl mx-auto">
          {/* Home Team */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-center">{getTeamName(currentGame.homeTeamNumber)}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {homePlayers.map((gp) => (
                  <div
                    key={gp.playerId}
                    className="p-3 border rounded cursor-pointer hover:bg-accent active:bg-primary/20"
                    onDoubleClick={() => addGoalMutation.mutate(gp.playerId)}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium">
                        {gp.player.firstName} {gp.player.lastName.charAt(0)}.
                      </span>
                      <Badge variant={gp.goals > 0 ? "default" : "outline"}>
                        {gp.goals} {gp.goals === 1 ? "goal" : "goals"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Middle Section - Timer and Controls */}
          <Card className="mb-4">
            <CardContent className="py-6">
              <div className="text-center space-y-4">
                <div className={`text-5xl font-bold ${isOvertime ? "text-red-600" : isWarningTime ? "text-yellow-600" : ""}`}>
                  {formatTime(timeRemaining)}
                </div>
                <div className="text-2xl font-semibold">
                  {currentGame.homeScore} - {currentGame.awayScore}
                </div>
                <div className="flex gap-2 justify-center">
                  <Button
                    onClick={() => endGameMutation.mutate()}
                    disabled={endGameMutation.isPending}
                    size="lg"
                  >
                    {endGameMutation.isPending ? "Ending..." : "End Game"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Away Team */}
          <Card>
            <CardHeader>
              <CardTitle className="text-center">{getTeamName(currentGame.awayTeamNumber)}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {awayPlayers.map((gp) => (
                  <div
                    key={gp.playerId}
                    className="p-3 border rounded cursor-pointer hover:bg-accent active:bg-primary/20"
                    onDoubleClick={() => addGoalMutation.mutate(gp.playerId)}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium">
                        {gp.player.firstName} {gp.player.lastName.charAt(0)}.
                      </span>
                      <Badge variant={gp.goals > 0 ? "default" : "outline"}>
                        {gp.goals} {gp.goals === 1 ? "goal" : "goals"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // COMPLETED SESSION or between games
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <Button variant="outline" onClick={() => router.push("/game-master")} className="mb-4">
          ← Back
        </Button>

        <h1 className="text-2xl font-bold mb-6">
          {new Date(session.date).toLocaleString()}
        </h1>

        {session.status === "IN_PROGRESS" && !isGameInProgress && (
          <Button
            onClick={() => startGameMutation.mutate({ homeTeam: "", awayTeam: "" })}
            className="w-full mb-6"
            size="lg"
          >
            Start Next Game
          </Button>
        )}

        {session.status === "COMPLETED" && (
          <Button
            onClick={() => router.push("/")}
            className="w-full mb-6"
            size="lg"
          >
            View Leaderboard
          </Button>
        )}

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Games Played: {session.games.length}</h2>
          {session.games.slice().reverse().map((game) => (
            <Card key={game.id}>
              <CardContent className="py-4">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">{getTeamName(game.homeTeamNumber)} vs {getTeamName(game.awayTeamNumber)}</div>
                    <div className="text-sm text-muted-foreground">
                      {game.durationSeconds ? formatTime(game.durationSeconds) : "In Progress"}
                    </div>
                  </div>
                  <div className="text-2xl font-bold">
                    {game.homeScore} - {game.awayScore}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
