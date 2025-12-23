"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Plus, Minus, Clock, Calendar } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

interface Player {
  id: number
  name: string
  lastName: string
  elo: number
}

interface TeamsData {
  teamA: number[]
  teamB: number[]
  teamC: number[]
}

interface GamePlayer {
  playerId: number
  goals: number
  goalkeeper: boolean
}

interface LiveGame {
  id: number
  startDateTime: string
  timePlayed: number | null
  teamPlayers: Array<{
    id: number
    playerId: number
    goals: number
    goalkeeper: boolean
    side: "HOME" | "AWAY"
    player: Player
  }>
}

type GameMode = "select" | "live" | "finished"

export default function AddGamePage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [gameMode, setGameMode] = useState<GameMode>("select")
  const [homeTeam, setHomeTeam] = useState<"A" | "B" | "C" | null>(null)
  const [awayTeam, setAwayTeam] = useState<"A" | "B" | "C" | null>(null)
  const [startDateTime, setStartDateTime] = useState("")
  const [duration, setDuration] = useState("6")
  const [homeTeamGoals, setHomeTeamGoals] = useState<Record<number, number>>({})
  const [awayTeamGoals, setAwayTeamGoals] = useState<Record<number, number>>({})
  const [homeTeamGoalkeepers, setHomeTeamGoalkeepers] = useState<Set<number>>(new Set())
  const [awayTeamGoalkeepers, setAwayTeamGoalkeepers] = useState<Set<number>>(new Set())
  const [liveGameId, setLiveGameId] = useState<number | null>(null)
  const [liveGameStartTime, setLiveGameStartTime] = useState<Date | null>(null)
  const [liveGameStarted, setLiveGameStarted] = useState(false)

  // Time remaining prompt
  const [showTimePrompt, setShowTimePrompt] = useState(false)
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null)
  const [timeRemainingInput, setTimeRemainingInput] = useState("")

  const { data: allPlayers = [] } = useQuery<Player[]>({
    queryKey: ["players"],
    queryFn: async () => {
      const res = await fetch("/api/players")
      if (!res.ok) throw new Error("Failed to fetch players")
      const data = await res.json()
      return data.players || []
    },
  })

  const { data: teamsData } = useQuery<TeamsData>({
    queryKey: ["teams"],
    queryFn: async () => {
      const res = await fetch("/api/teams")
      if (!res.ok) throw new Error("Failed to fetch teams")
      return res.json()
    },
  })

  // Check for existing live game on mount
  const { data: liveGameData, refetch: refetchLiveGame } = useQuery({
    queryKey: ["liveGame"],
    queryFn: async () => {
      const res = await fetch("/api/games/live/current")
      if (!res.ok) throw new Error("Failed to fetch live game")
      return res.json()
    },
  })

  useEffect(() => {
    if (liveGameData?.liveGame) {
      const game: LiveGame = liveGameData.liveGame
      setGameMode("live")
      setLiveGameId(game.id)
      setLiveGameStartTime(new Date(game.startDateTime))
      setLiveGameStarted(true)

      // Determine teams from the game data
      const homeTeamPlayers = game.teamPlayers.filter(tp => tp.side === "HOME")
      const awayTeamPlayers = game.teamPlayers.filter(tp => tp.side === "AWAY")

      // Find which team letters these correspond to
      if (teamsData) {
        const homePlayerIds = homeTeamPlayers.map(tp => tp.playerId)
        const awayPlayerIds = awayTeamPlayers.map(tp => tp.playerId)

        const findTeamLetter = (playerIds: number[]): "A" | "B" | "C" | null => {
          if (playerIds.every(id => teamsData.teamA.includes(id))) return "A"
          if (playerIds.every(id => teamsData.teamB.includes(id))) return "B"
          if (playerIds.every(id => teamsData.teamC.includes(id))) return "C"
          return null
        }

        setHomeTeam(findTeamLetter(homePlayerIds))
        setAwayTeam(findTeamLetter(awayPlayerIds))

        // Set goals and goalkeepers from existing game
        const homeGoals: Record<number, number> = {}
        const awayGoals: Record<number, number> = {}
        const homeGKs = new Set<number>()
        const awayGKs = new Set<number>()

        homeTeamPlayers.forEach(tp => {
          homeGoals[tp.playerId] = tp.goals
          if (tp.goalkeeper) homeGKs.add(tp.playerId)
        })

        awayTeamPlayers.forEach(tp => {
          awayGoals[tp.playerId] = tp.goals
          if (tp.goalkeeper) awayGKs.add(tp.playerId)
        })

        setHomeTeamGoals(homeGoals)
        setAwayTeamGoals(awayGoals)
        setHomeTeamGoalkeepers(homeGKs)
        setAwayTeamGoalkeepers(awayGKs)
      }
    }
  }, [liveGameData, teamsData])

  // Set current date/time when page loads (for finished games)
  useEffect(() => {
    if (!startDateTime && gameMode === "finished") {
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      const hours = String(now.getHours()).padStart(2, '0')
      const minutes = String(now.getMinutes()).padStart(2, '0')
      setStartDateTime(`${year}-${month}-${day}T${hours}:${minutes}`)
    }
  }, [startDateTime, gameMode])

  // Initialize goals for all players
  useEffect(() => {
    if (!teamsData || gameMode === "live") return

    const initGoals: Record<number, number> = {}
    ;[...teamsData.teamA, ...teamsData.teamB, ...teamsData.teamC].forEach((id) => {
      initGoals[id] = 0
    })

    setHomeTeamGoals(initGoals)
    setAwayTeamGoals(initGoals)
  }, [teamsData, gameMode])

  const startLiveGameMutation = useMutation({
    mutationFn: async () => {
      if (!homeTeam || !awayTeam || !duration) {
        throw new Error("Missing required fields")
      }

      const getTeamPlayers = (teamLetter: "A" | "B" | "C", isHome: boolean): GamePlayer[] => {
        const teamPlayers =
          teamLetter === "A" ? teamsData!.teamA : teamLetter === "B" ? teamsData!.teamB : teamsData!.teamC
        const goalkeepers = isHome ? homeTeamGoalkeepers : awayTeamGoalkeepers
        const goals = isHome ? homeTeamGoals : awayTeamGoals

        return teamPlayers.map((playerId) => ({
          playerId,
          goals: goals[playerId] || 0,
          goalkeeper: goalkeepers.has(playerId),
        }))
      }

      const res = await fetch("/api/games/live/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          homeTeamPlayers: getTeamPlayers(homeTeam, true),
          awayTeamPlayers: getTeamPlayers(awayTeam, false),
          expectedDuration: parseInt(duration) * 60, // Convert minutes to seconds
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to start live game")
      }

      return res.json()
    },
    onSuccess: (data) => {
      setLiveGameId(data.game.id)
      setLiveGameStartTime(new Date(data.game.startDateTime))
      setLiveGameStarted(true)
      queryClient.invalidateQueries({ queryKey: ["liveGame"] })
    },
  })

  const endLiveGameMutation = useMutation({
    mutationFn: async () => {
      if (!liveGameId) {
        throw new Error("No live game to end")
      }

      // First, update the goalkeeper status for all players
      const getTeamPlayers = (teamLetter: "A" | "B" | "C", isHome: boolean): GamePlayer[] => {
        const teamPlayers =
          teamLetter === "A" ? teamsData!.teamA : teamLetter === "B" ? teamsData!.teamB : teamsData!.teamC
        const goalkeepers = isHome ? homeTeamGoalkeepers : awayTeamGoalkeepers
        const goals = isHome ? homeTeamGoals : awayTeamGoals

        return teamPlayers.map((playerId) => ({
          playerId,
          goals: goals[playerId] || 0,
          goalkeeper: goalkeepers.has(playerId),
        }))
      }

      // Update each player's goalkeeper status
      if (homeTeam && awayTeam) {
        const homeTeamPlayers = getTeamPlayers(homeTeam, true)
        const awayTeamPlayers = getTeamPlayers(awayTeam, false)

        for (const player of [...homeTeamPlayers, ...awayTeamPlayers]) {
          await fetch(`/api/games/${liveGameId}/player`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              playerId: player.playerId,
              goalkeeper: player.goalkeeper,
            }),
          })
        }
      }

      // End the game
      const res = await fetch("/api/games/live/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: liveGameId,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to end live game")
      }

      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scoreboard"] })
      queryClient.invalidateQueries({ queryKey: ["liveGame"] })
      router.back()
    },
  })

  const addFinishedGameMutation = useMutation({
    mutationFn: async () => {
      if (!homeTeam || !awayTeam || !startDateTime || !duration) {
        throw new Error("Missing required fields")
      }

      const getTeamPlayers = (teamLetter: "A" | "B" | "C", isHome: boolean): GamePlayer[] => {
        const teamPlayers =
          teamLetter === "A" ? teamsData!.teamA : teamLetter === "B" ? teamsData!.teamB : teamsData!.teamC
        const goalkeepers = isHome ? homeTeamGoalkeepers : awayTeamGoalkeepers
        const goals = isHome ? homeTeamGoals : awayTeamGoals

        return teamPlayers.map((playerId) => ({
          playerId,
          goals: goals[playerId] || 0,
          goalkeeper: goalkeepers.has(playerId),
        }))
      }

      const res = await fetch("/api/games/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          homeTeamPlayers: getTeamPlayers(homeTeam, true),
          awayTeamPlayers: getTeamPlayers(awayTeam, false),
          startDateTime: new Date(startDateTime).toISOString(),
          duration: parseInt(duration) * 60, // Convert minutes to seconds
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to add game")
      }

      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scoreboard"] })
      router.back()
    },
  })

  const addGoalMutation = useMutation({
    mutationFn: async ({ playerId, timestamp }: { playerId: number; timestamp: number }) => {
      if (!liveGameId) throw new Error("No live game")

      const res = await fetch(`/api/games/${liveGameId}/goal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          timestamp,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to add goal")
      }

      return res.json()
    },
    onSuccess: () => {
      refetchLiveGame()
    },
  })

  const getPlayerName = (playerId: number): string => {
    const player = allPlayers.find((p) => p.id === playerId)
    return player ? `${player.name} ${player.lastName}` : "Unknown"
  }

  const getHighestEloPlayerName = (playerIds: number[]): string | null => {
    if (playerIds.length === 0) return null

    let highestEloPlayer: Player | null = null
    let highestElo = -1

    for (const playerId of playerIds) {
      const player = allPlayers.find((p) => p.id === playerId)
      if (player && player.elo > highestElo) {
        highestElo = player.elo
        highestEloPlayer = player
      }
    }

    return highestEloPlayer ? highestEloPlayer.name : null
  }

  const getTeamDisplayName = (teamLetter: "A" | "B" | "C"): string => {
    if (!teamsData) return `Team ${teamLetter}`

    const teamPlayers =
      teamLetter === "A" ? teamsData.teamA :
      teamLetter === "B" ? teamsData.teamB :
      teamsData.teamC

    const highestEloPlayerName = getHighestEloPlayerName(teamPlayers)
    return highestEloPlayerName ? `Team ${highestEloPlayerName}` : `Team ${teamLetter}`
  }

  const toggleGoalkeeper = (playerId: number, isHome: boolean) => {
    if (isHome) {
      setHomeTeamGoalkeepers(prev => {
        const newSet = new Set(prev)
        if (newSet.has(playerId)) {
          newSet.delete(playerId)
        } else {
          newSet.add(playerId)
        }
        return newSet
      })
    } else {
      setAwayTeamGoalkeepers(prev => {
        const newSet = new Set(prev)
        if (newSet.has(playerId)) {
          newSet.delete(playerId)
        } else {
          newSet.add(playerId)
        }
        return newSet
      })
    }
  }

  const handleAddGoalClick = (playerId: number) => {
    setSelectedPlayerId(playerId)
    setShowTimePrompt(true)
    setTimeRemainingInput("")
  }

  const handleTimeRemainingSubmit = () => {
    if (!selectedPlayerId || !timeRemainingInput) return

    // Parse M:SS format
    const parts = timeRemainingInput.split(":")
    if (parts.length !== 2) {
      alert("Invalid format. Please use M:SS (e.g., 5:30)")
      return
    }

    const minutes = parseInt(parts[0])
    const seconds = parseInt(parts[1])

    if (isNaN(minutes) || isNaN(seconds) || seconds >= 60 || seconds < 0) {
      alert("Invalid time. Seconds must be between 0-59")
      return
    }

    // Calculate timestamp: game time (duration in seconds) - time remaining
    const gameDurationSeconds = parseInt(duration) * 60
    const timeRemainingSeconds = minutes * 60 + seconds
    const goalTimestamp = gameDurationSeconds - timeRemainingSeconds

    // Add the goal via API
    addGoalMutation.mutate({ playerId: selectedPlayerId, timestamp: goalTimestamp })

    setShowTimePrompt(false)
    setSelectedPlayerId(null)
    setTimeRemainingInput("")
  }

  const updateGoals = (playerId: number, delta: number, isHome: boolean) => {
    const goalsMap = isHome ? homeTeamGoals : awayTeamGoals
    const setGoalsMap = isHome ? setHomeTeamGoals : setAwayTeamGoals

    const current = goalsMap[playerId] || 0
    const newGoals = Math.max(0, current + delta)
    setGoalsMap((prev) => ({ ...prev, [playerId]: newGoals }))
  }

  const TeamColumn = ({
    teamLetter,
    isHome,
  }: {
    teamLetter: "A" | "B" | "C"
    isHome: boolean
  }) => {
    if (!teamsData) return null

    const teamPlayers =
      teamLetter === "A" ? teamsData.teamA : teamLetter === "B" ? teamsData.teamB : teamsData.teamC
    const goalsMap = isHome ? homeTeamGoals : awayTeamGoals
    const goalkeepers = isHome ? homeTeamGoalkeepers : awayTeamGoalkeepers

    const highestEloPlayerName = getHighestEloPlayerName(teamPlayers)
    const teamDisplayName = highestEloPlayerName ? `Team ${highestEloPlayerName}` : `Team ${teamLetter}`

    const isLiveGameInProgress = gameMode === "live" && liveGameStarted
    const isFinishedGame = gameMode === "finished"

    return (
      <div className="flex flex-col gap-2">
        <h3 className="font-bold text-lg text-center">
          {teamDisplayName}
        </h3>
        <div className="border-2 border-dashed border-primary rounded-lg p-4 min-h-[400px] bg-secondary/50">
          <div className="space-y-3">
            {teamPlayers.map((playerId) => (
              <div key={playerId} className="flex items-center gap-2 bg-white p-3 rounded border border-gray-200">
                <Button
                  size="sm"
                  variant={goalkeepers.has(playerId) ? "default" : "outline"}
                  onClick={() => toggleGoalkeeper(playerId, isHome)}
                  disabled={gameMode === "live" && liveGameStarted}
                  className="h-8 w-8 p-0 shrink-0"
                  title="Toggle goalkeeper"
                >
                  🧤
                </Button>
                <span className="flex-1 font-medium">
                  {getPlayerName(playerId)}
                </span>

                {/* Live game: show soccer ball button */}
                {isLiveGameInProgress && (
                  <div className="flex items-center gap-2">
                    <span className="w-8 text-center font-bold">{goalsMap[playerId] || 0}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAddGoalClick(playerId)}
                      className="h-8 w-8 p-0"
                      title="Add goal"
                    >
                      ⚽
                    </Button>
                  </div>
                )}

                {/* Finished game: show +/- buttons */}
                {isFinishedGame && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateGoals(playerId, -1, isHome)}
                      className="h-8 w-8 p-0"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center font-bold">{goalsMap[playerId] || 0}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateGoals(playerId, 1, isHome)}
                      className="h-8 w-8 p-0"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const [elapsedTime, setElapsedTime] = useState(0)

  useEffect(() => {
    if (gameMode === "live" && liveGameStartTime && liveGameStarted) {
      const interval = setInterval(() => {
        const now = new Date()
        const elapsed = Math.floor((now.getTime() - liveGameStartTime.getTime()) / 1000)
        setElapsedTime(elapsed)
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [gameMode, liveGameStartTime, liveGameStarted])

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 rounded-full hover:bg-slate-100 active:bg-slate-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <h1 className="text-lg font-bold text-slate-800">
            {gameMode === "live" ? "Live Game" : "Record a Game"}
          </h1>
          {gameMode === "live" && liveGameStarted && (
            <div className="ml-auto flex items-center gap-2 bg-red-100 text-red-700 px-3 py-1 rounded-full">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="font-mono font-bold">{formatTime(elapsedTime)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 max-w-6xl mx-auto">
        <div className="space-y-4 sm:space-y-6">
          {/* Mode Selection (only show if no live game exists) */}
          {gameMode === "select" && (
            <div className="space-y-3">
              <h3 className="font-bold text-base sm:text-lg">Select Mode</h3>
              <div className="grid grid-cols-2 gap-4">
                <Button
                  onClick={() => setGameMode("live")}
                  variant="outline"
                  className="h-24 flex flex-col gap-2"
                  size="lg"
                >
                  <Clock className="h-8 w-8" />
                  <span>Start Live Game</span>
                </Button>
                <Button
                  onClick={() => setGameMode("finished")}
                  variant="outline"
                  className="h-24 flex flex-col gap-2"
                  size="lg"
                >
                  <Calendar className="h-8 w-8" />
                  <span>Add Finished Game</span>
                </Button>
              </div>
            </div>
          )}

          {/* Team Selection */}
          {gameMode !== "select" && (
            <>
              <div className="space-y-3">
                <h3 className="font-bold text-base sm:text-lg">Select Teams</h3>
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="text-sm font-medium block mb-2">Home Team</label>
                    <div className="flex gap-2">
                      {["A", "B", "C"].map((team) => (
                        <Button
                          key={team}
                          onClick={() => setHomeTeam(team as "A" | "B" | "C")}
                          variant={homeTeam === team ? "default" : "outline"}
                          disabled={awayTeam === team || (gameMode === "live" && liveGameStarted)}
                          className="flex-1 min-h-[44px]"
                        >
                          {getTeamDisplayName(team as "A" | "B" | "C")}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-2">Away Team</label>
                    <div className="flex gap-2">
                      {["A", "B", "C"].map((team) => (
                        <Button
                          key={team}
                          onClick={() => setAwayTeam(team as "A" | "B" | "C")}
                          variant={awayTeam === team ? "default" : "outline"}
                          disabled={homeTeam === team || (gameMode === "live" && liveGameStarted)}
                          className="flex-1 min-h-[44px]"
                        >
                          {getTeamDisplayName(team as "A" | "B" | "C")}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Teams Grid */}
              {homeTeam && awayTeam && homeTeam !== awayTeam && (
                <div className="flex flex-col gap-4 sm:gap-6">
                  <TeamColumn teamLetter={homeTeam} isHome={true} />
                  <TeamColumn teamLetter={awayTeam} isHome={false} />
                </div>
              )}

              {/* Duration and Date/Time (only for non-live games or when starting a live game) */}
              {gameMode === "finished" && (
                <div className="flex flex-col gap-4 bg-secondary/30 p-3 sm:p-4 rounded-lg">
                  <div>
                    <label className="text-sm font-medium block mb-2">Start Date & Time</label>
                    <Input
                      type="datetime-local"
                      value={startDateTime}
                      onChange={(e) => setStartDateTime(e.target.value)}
                      className="min-h-[44px]"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-2">Duration (minutes)</label>
                    <Input
                      type="number"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      placeholder="6"
                      min="1"
                      className="min-h-[44px]"
                    />
                  </div>
                </div>
              )}

              {gameMode === "live" && !liveGameStarted && (
                <div className="flex flex-col gap-4 bg-secondary/30 p-3 sm:p-4 rounded-lg">
                  <div>
                    <label className="text-sm font-medium block mb-2">Game Time (minutes)</label>
                    <Input
                      type="number"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      placeholder="6"
                      min="1"
                      className="min-h-[44px]"
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {gameMode === "finished" && (
                <Button
                  onClick={() => addFinishedGameMutation.mutate()}
                  disabled={
                    addFinishedGameMutation.isPending || !homeTeam || !awayTeam || homeTeam === awayTeam || !startDateTime || !duration
                  }
                  className="w-full"
                  size="lg"
                >
                  {addFinishedGameMutation.isPending ? "Saving..." : "Save Game"}
                </Button>
              )}

              {gameMode === "live" && !liveGameStarted && (
                <Button
                  onClick={() => startLiveGameMutation.mutate()}
                  disabled={
                    startLiveGameMutation.isPending || !homeTeam || !awayTeam || homeTeam === awayTeam || !duration
                  }
                  className="w-full"
                  size="lg"
                >
                  {startLiveGameMutation.isPending ? "Starting..." : "Start Game"}
                </Button>
              )}

              {gameMode === "live" && liveGameStarted && (
                <Button
                  onClick={() => endLiveGameMutation.mutate()}
                  disabled={endLiveGameMutation.isPending}
                  className="w-full bg-red-600 hover:bg-red-700"
                  size="lg"
                >
                  {endLiveGameMutation.isPending ? "Ending..." : "End Game"}
                </Button>
              )}

              {/* Error Messages */}
              {addFinishedGameMutation.isError && (
                <div className="text-sm text-red-600 text-center">
                  Error: {addFinishedGameMutation.error instanceof Error ? addFinishedGameMutation.error.message : "Unknown error"}
                </div>
              )}
              {startLiveGameMutation.isError && (
                <div className="text-sm text-red-600 text-center">
                  Error: {startLiveGameMutation.error instanceof Error ? startLiveGameMutation.error.message : "Unknown error"}
                </div>
              )}
              {endLiveGameMutation.isError && (
                <div className="text-sm text-red-600 text-center">
                  Error: {endLiveGameMutation.error instanceof Error ? endLiveGameMutation.error.message : "Unknown error"}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Time Remaining Dialog */}
      <Dialog open={showTimePrompt} onOpenChange={setShowTimePrompt}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Goal - {selectedPlayerId ? getPlayerName(selectedPlayerId) : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium block mb-2">
              Time Remaining (M:SS)
            </label>
            <Input
              type="text"
              value={timeRemainingInput}
              onChange={(e) => setTimeRemainingInput(e.target.value)}
              placeholder="5:30"
              className="min-h-[44px]"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleTimeRemainingSubmit()
                }
              }}
            />
            <p className="text-xs text-muted-foreground mt-2">
              Enter the time remaining on the clock when the goal was scored (e.g., 5:30)
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTimePrompt(false)}>
              Cancel
            </Button>
            <Button onClick={handleTimeRemainingSubmit} disabled={addGoalMutation.isPending}>
              {addGoalMutation.isPending ? "Adding..." : "Add Goal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
