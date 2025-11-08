"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Plus, Minus } from "lucide-react"

interface Player {
  id: number
  name: string
  lastName: string
}

interface TeamsData {
  teamA: number[]
  teamB: number[]
  teamC: number[]
}

interface GamePlayer {
  playerId: number
  goals: number
}

export function AddGameModal() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [homeTeam, setHomeTeam] = useState<"A" | "B" | "C" | null>(null)
  const [awayTeam, setAwayTeam] = useState<"A" | "B" | "C" | null>(null)
  const [startDateTime, setStartDateTime] = useState("")
  const [duration, setDuration] = useState("6")
  const [homeTeamGoals, setHomeTeamGoals] = useState<Record<number, number>>({})
  const [awayTeamGoals, setAwayTeamGoals] = useState<Record<number, number>>({})

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
    enabled: open,
  })

  // Set current date/time when modal opens
  useEffect(() => {
    if (open && !startDateTime) {
      const now = new Date()
      // Format for datetime-local input: YYYY-MM-DDTHH:MM
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      const hours = String(now.getHours()).padStart(2, '0')
      const minutes = String(now.getMinutes()).padStart(2, '0')
      setStartDateTime(`${year}-${month}-${day}T${hours}:${minutes}`)
    }
  }, [open, startDateTime])

  // Initialize goals for all players
  useEffect(() => {
    if (!teamsData) return

    const initGoals: Record<number, number> = {}
    ;[...teamsData.teamA, ...teamsData.teamB, ...teamsData.teamC].forEach((id) => {
      initGoals[id] = 0
    })

    setHomeTeamGoals(initGoals)
    setAwayTeamGoals(initGoals)
  }, [teamsData])

  const addGameMutation = useMutation({
    mutationFn: async () => {
      if (!homeTeam || !awayTeam || !startDateTime || !duration) {
        throw new Error("Missing required fields")
      }

      const getTeamPlayers = (teamLetter: "A" | "B" | "C"): GamePlayer[] => {
        const teamPlayers =
          teamLetter === "A" ? teamsData!.teamA : teamLetter === "B" ? teamsData!.teamB : teamsData!.teamC
        return teamPlayers.map((playerId) => ({
          playerId,
          goals: homeTeam === teamLetter ? homeTeamGoals[playerId] || 0 : awayTeamGoals[playerId] || 0,
        }))
      }

      const res = await fetch("/api/games/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          homeTeamPlayers: getTeamPlayers(homeTeam),
          awayTeamPlayers: getTeamPlayers(awayTeam),
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
      setOpen(false)
      // Reset form
      setHomeTeam(null)
      setAwayTeam(null)
      setStartDateTime("")
      setDuration("")
      setHomeTeamGoals({})
      setAwayTeamGoals({})
    },
  })

  const getPlayerName = (playerId: number): string => {
    const player = allPlayers.find((p) => p.id === playerId)
    return player ? `${player.name} ${player.lastName}` : "Unknown"
  }

  const TeamColumn = ({
    teamLetter,
    side,
    isHome,
  }: {
    teamLetter: "A" | "B" | "C"
    side: "Home" | "Away"
    isHome: boolean
  }) => {
    if (!teamsData) return null

    const teamPlayers =
      teamLetter === "A" ? teamsData.teamA : teamLetter === "B" ? teamsData.teamB : teamsData.teamC
    const goalsMap = isHome ? homeTeamGoals : awayTeamGoals
    const setGoalsMap = isHome ? setHomeTeamGoals : setAwayTeamGoals

    const updateGoals = (playerId: number, delta: number) => {
      const current = goalsMap[playerId] || 0
      const newGoals = Math.max(0, current + delta)
      setGoalsMap((prev) => ({ ...prev, [playerId]: newGoals }))
    }

    return (
      <div className="flex flex-col gap-2">
        <h3 className="font-bold text-lg text-center">
          Team {teamLetter} ({side})
        </h3>
        <div className="border-2 border-dashed border-primary rounded-lg p-4 min-h-[400px] bg-secondary/50">
          <div className="space-y-3">
            {teamPlayers.map((playerId) => (
              <div key={playerId} className="flex items-center justify-between bg-white p-3 rounded border border-gray-200">
                <span className="flex-1 font-medium">{getPlayerName(playerId)}</span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateGoals(playerId, -1)}
                    className="h-8 w-8 p-0"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-8 text-center font-bold">{goalsMap[playerId] || 0}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateGoals(playerId, 1)}
                    className="h-8 w-8 p-0"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="gap-2 min-h-[48px]">
          Add Game
        </Button>
      </DialogTrigger>
      <DialogContent className="!max-w-none w-[95vw] max-w-[95vw] h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record a Game</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Team Selection */}
          <div className="space-y-3">
            <h3 className="font-bold">Select Teams</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium block mb-2">Home Team</label>
                <div className="flex gap-2">
                  {["A", "B", "C"].map((team) => (
                    <Button
                      key={team}
                      onClick={() => setHomeTeam(team as "A" | "B" | "C")}
                      variant={homeTeam === team ? "default" : "outline"}
                      className="flex-1"
                    >
                      Team {team}
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
                      className="flex-1"
                    >
                      Team {team}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            {homeTeam === awayTeam && homeTeam && (
              <div className="text-sm text-red-600">Home and Away teams must be different</div>
            )}
          </div>

          {/* Teams Grid */}
          {homeTeam && awayTeam && homeTeam !== awayTeam && (
            <div className="grid grid-cols-2 gap-6">
              <TeamColumn teamLetter={homeTeam} side="Home" isHome={true} />
              <TeamColumn teamLetter={awayTeam} side="Away" isHome={false} />
            </div>
          )}

          {/* Date and Duration */}
          <div className="grid grid-cols-2 gap-4 bg-secondary/30 p-4 rounded-lg">
            <div>
              <label className="text-sm font-medium block mb-2">Start Date & Time</label>
              <Input
                type="datetime-local"
                value={startDateTime}
                onChange={(e) => setStartDateTime(e.target.value)}
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
              />
            </div>
          </div>

          {/* Save Button */}
          <Button
            onClick={() => addGameMutation.mutate()}
            disabled={
              addGameMutation.isPending || !homeTeam || !awayTeam || homeTeam === awayTeam || !startDateTime || !duration
            }
            className="w-full"
            size="lg"
          >
            {addGameMutation.isPending ? "Saving..." : "Save Game"}
          </Button>

          {addGameMutation.isError && (
            <div className="text-sm text-red-600 text-center">
              Error: {addGameMutation.error instanceof Error ? addGameMutation.error.message : "Unknown error"}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
