"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Users } from "lucide-react"

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

function generateRandomTeams(players: Player[]): TeamsData {
  const shuffled = [...players].sort(() => Math.random() - 0.5)
  return {
    teamA: shuffled.slice(0, 5).map((p) => p.id),
    teamB: shuffled.slice(5, 10).map((p) => p.id),
    teamC: shuffled.slice(10, 15).map((p) => p.id),
  }
}

function getPlayerName(playerId: number, allPlayers: Player[]): string {
  const player = allPlayers.find((p) => p.id === playerId)
  return player ? player.name : "Unknown"
}

function calculateAverageElo(playerIds: number[], allPlayers: Player[]): number {
  if (playerIds.length === 0) return 0
  const totalElo = playerIds.reduce((sum, playerId) => {
    const player = allPlayers.find((p) => p.id === playerId)
    return sum + (player?.elo || 1500)
  }, 0)
  return Math.round(totalElo / playerIds.length)
}

export function ChangeTeamsModal() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [draggedPlayerId, setDraggedPlayerId] = useState<number | null>(null)
  const [teamA, setTeamA] = useState<number[]>([])
  const [teamB, setTeamB] = useState<number[]>([])
  const [teamC, setTeamC] = useState<number[]>([])
  const [unassigned, setUnassigned] = useState<number[]>([])

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

  // Initialize teams when data is fetched
  useEffect(() => {
    if (!open) return

    if (teamsData && (teamsData.teamA.length > 0 || teamsData.teamB.length > 0 || teamsData.teamC.length > 0)) {
      // Teams exist - load them
      const allAssigned = [
        ...teamsData.teamA,
        ...teamsData.teamB,
        ...teamsData.teamC,
      ]
      const unassignedPlayers = allPlayers
        .filter((p) => !allAssigned.includes(p.id))
        .map((p) => p.id)

      setTeamA(teamsData.teamA)
      setTeamB(teamsData.teamB)
      setTeamC(teamsData.teamC)
      setUnassigned(unassignedPlayers)
    } else if (allPlayers.length > 0) {
      // No teams exist or teams are empty - generate random ones
      const randomTeams = generateRandomTeams(allPlayers)
      const allAssigned = [
        ...randomTeams.teamA,
        ...randomTeams.teamB,
        ...randomTeams.teamC,
      ]
      const unassignedPlayers = allPlayers
        .filter((p) => !allAssigned.includes(p.id))
        .map((p) => p.id)

      setTeamA(randomTeams.teamA)
      setTeamB(randomTeams.teamB)
      setTeamC(randomTeams.teamC)
      setUnassigned(unassignedPlayers)
    }
  }, [teamsData, open, allPlayers])

  const changeTeamsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamA,
          teamB,
          teamC,
        }),
      })
      if (!res.ok) throw new Error("Failed to update teams")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] })
      setOpen(false)
    },
  })

  const handleDragStart = (playerId: number) => {
    setDraggedPlayerId(playerId)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const movePlayer = (
    fromTeam: "A" | "B" | "C" | "unassigned",
    toTeam: "A" | "B" | "C" | "unassigned",
    playerId: number
  ) => {
    if (fromTeam === toTeam) return

    // Remove from source
    if (fromTeam === "A") setTeamA((prev) => prev.filter((id) => id !== playerId))
    else if (fromTeam === "B") setTeamB((prev) => prev.filter((id) => id !== playerId))
    else if (fromTeam === "C") setTeamC((prev) => prev.filter((id) => id !== playerId))
    else setUnassigned((prev) => prev.filter((id) => id !== playerId))

    // Add to destination
    if (toTeam === "A") setTeamA((prev) => [...prev, playerId])
    else if (toTeam === "B") setTeamB((prev) => [...prev, playerId])
    else if (toTeam === "C") setTeamC((prev) => [...prev, playerId])
    else setUnassigned((prev) => [...prev, playerId])
  }

  const handleDropTeam = (e: React.DragEvent, toTeam: "A" | "B" | "C") => {
    e.preventDefault()
    if (!draggedPlayerId) return

    let fromTeam: "A" | "B" | "C" | "unassigned" = "unassigned"
    if (teamA.includes(draggedPlayerId)) fromTeam = "A"
    else if (teamB.includes(draggedPlayerId)) fromTeam = "B"
    else if (teamC.includes(draggedPlayerId)) fromTeam = "C"

    movePlayer(fromTeam, toTeam, draggedPlayerId)
    setDraggedPlayerId(null)
  }

  const handleDropUnassigned = (e: React.DragEvent) => {
    e.preventDefault()
    if (!draggedPlayerId) return

    let fromTeam: "A" | "B" | "C" | "unassigned" = "unassigned"
    if (teamA.includes(draggedPlayerId)) fromTeam = "A"
    else if (teamB.includes(draggedPlayerId)) fromTeam = "B"
    else if (teamC.includes(draggedPlayerId)) fromTeam = "C"

    movePlayer(fromTeam, "unassigned", draggedPlayerId)
    setDraggedPlayerId(null)
  }

  const TeamColumn = ({ team, teamLetter }: { team: number[]; teamLetter: "A" | "B" | "C" }) => {
    const avgElo = calculateAverageElo(team, allPlayers)

    return (
      <div className="flex flex-col gap-2">
        <div className="text-center">
          <h3 className="font-bold text-lg">Team {teamLetter}</h3>
          <p className="text-sm text-muted-foreground">
            Avg ELO: {avgElo > 0 ? avgElo : "—"} {team.length > 0 && `(${team.length} player${team.length !== 1 ? 's' : ''})`}
          </p>
        </div>
        <div
          onDragOver={handleDragOver}
          onDrop={(e) => handleDropTeam(e, teamLetter)}
          className="border-2 border-dashed border-primary rounded-lg p-4 min-h-[300px] bg-secondary/50"
        >
          <div className="space-y-2">
            {team.map((playerId) => (
              <div
                key={playerId}
                draggable
                onDragStart={() => handleDragStart(playerId)}
                className="bg-white p-3 rounded border border-gray-200 cursor-move hover:bg-gray-50"
              >
                {getPlayerName(playerId, allPlayers)}
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
          <Users className="h-5 w-5" />
          Change Teams
        </Button>
      </DialogTrigger>
      <DialogContent className="!max-w-none w-[95vw] max-w-[95vw] h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Teams</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Teams Grid */}
          <div className="grid grid-cols-3 gap-4">
            <TeamColumn team={teamA} teamLetter="A" />
            <TeamColumn team={teamB} teamLetter="B" />
            <TeamColumn team={teamC} teamLetter="C" />
          </div>

          {/* Unassigned Players */}
          <div className="space-y-2">
            <h3 className="font-bold text-lg">Unassigned Players</h3>
            <div
              onDragOver={handleDragOver}
              onDrop={handleDropUnassigned}
              className="border-2 border-dashed border-gray-300 rounded-lg p-4 min-h-[100px] bg-gray-50"
            >
              <div className="flex flex-wrap gap-2">
                {unassigned.map((playerId) => (
                  <div
                    key={playerId}
                    draggable
                    onDragStart={() => handleDragStart(playerId)}
                    className="bg-white px-3 py-1 rounded border border-gray-200 cursor-move hover:bg-gray-50"
                  >
                    {getPlayerName(playerId, allPlayers)}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Save Button */}
          <Button
            onClick={() => changeTeamsMutation.mutate()}
            disabled={changeTeamsMutation.isPending || teamA.length !== 5 || teamB.length !== 5 || teamC.length !== 5}
            className="w-full"
          >
            {changeTeamsMutation.isPending ? "Saving..." : "Save Teams"}
          </Button>

          {(teamA.length !== 5 || teamB.length !== 5 || teamC.length !== 5) && (
            <div className="text-sm text-red-600 text-center">
              Each team must have exactly 5 players. Team A: {teamA.length}, Team B: {teamB.length}, Team C: {teamC.length}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
