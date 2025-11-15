"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Users } from "lucide-react"
import {
  DndContext,
  useDraggable,
  useDroppable,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  pointerWithin,
} from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"

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

function getHighestEloPlayerName(playerIds: number[], allPlayers: Player[]): string | null {
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

// Player Card Component (for display only)
function PlayerCard({ playerName, className = "" }: { playerName: string; className?: string }) {
  return (
    <div className={`bg-white p-3 rounded border border-gray-200 ${className}`}>
      {playerName}
    </div>
  )
}

// Draggable Player Component
function DraggablePlayer({ playerId, playerName }: { playerId: number; playerName: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `player-${playerId}`,
    data: { playerId },
  })

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: isDragging ? 50 : undefined,
  } : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="cursor-move"
    >
      <PlayerCard
        playerName={playerName}
        className={`hover:bg-gray-50 ${isDragging ? 'shadow-2xl' : ''}`}
      />
    </div>
  )
}

// Droppable Team Zone Component
function DroppableTeamZone({
  teamId,
  team,
  teamLetter,
  allPlayers,
}: {
  teamId: string
  team: number[]
  teamLetter: "A" | "B" | "C"
  allPlayers: Player[]
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: teamId,
    data: { teamLetter },
  })

  const avgElo = calculateAverageElo(team, allPlayers)
  const highestEloPlayerName = getHighestEloPlayerName(team, allPlayers)
  const teamDisplayName = highestEloPlayerName ? `Team ${highestEloPlayerName}` : `Team ${teamLetter}`

  return (
    <div ref={setNodeRef} className="flex flex-col gap-2">
      <div className="text-center">
        <h3 className="font-bold text-lg">{teamDisplayName}</h3>
        <p className="text-sm text-muted-foreground">
          Avg ELO: {avgElo > 0 ? avgElo : "—"} {team.length > 0 && `(${team.length} player${team.length !== 1 ? 's' : ''})`}
        </p>
      </div>
      <div
        className={`border-2 border-dashed rounded-lg p-4 min-h-[300px] transition-colors ${
          isOver ? "border-primary bg-primary/10" : "border-primary bg-secondary/50"
        }`}
      >
        <div className="space-y-2">
          {team.map((playerId) => (
            <DraggablePlayer
              key={playerId}
              playerId={playerId}
              playerName={getPlayerName(playerId, allPlayers)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// Droppable Unassigned Zone Component
function DroppableUnassignedZone({ unassigned, allPlayers }: { unassigned: number[]; allPlayers: Player[] }) {
  const { setNodeRef, isOver } = useDroppable({
    id: "unassigned",
  })

  return (
    <div ref={setNodeRef} className="space-y-2">
      <h3 className="font-bold text-lg">Unassigned Players</h3>
      <div
        className={`border-2 border-dashed rounded-lg p-4 min-h-[100px] transition-colors ${
          isOver ? "border-primary bg-primary/10" : "border-gray-300 bg-gray-50"
        }`}
      >
        <div className="flex flex-wrap gap-2">
          {unassigned.map((playerId) => (
            <DraggablePlayer
              key={playerId}
              playerId={playerId}
              playerName={getPlayerName(playerId, allPlayers)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export function ChangeTeamsModal() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [teamA, setTeamA] = useState<number[]>([])
  const [teamB, setTeamB] = useState<number[]>([])
  const [teamC, setTeamC] = useState<number[]>([])
  const [unassigned, setUnassigned] = useState<number[]>([])

  // Configure sensors for both mouse and touch with activation constraints
  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 8, // 8px movement required before drag starts
    },
  })

  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 200, // 200ms hold before drag starts (prevents conflicts with scrolling)
      tolerance: 8, // 8px movement tolerance
    },
  })

  const sensors = useSensors(mouseSensor, touchSensor)

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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over) return

    // Extract player ID from the draggable ID (format: "player-{id}")
    const playerId = Number((active.id as string).replace("player-", ""))
    const targetZone = over.id as string

    // Find which team the player is currently in
    let fromTeam: "A" | "B" | "C" | "unassigned" = "unassigned"
    if (teamA.includes(playerId)) fromTeam = "A"
    else if (teamB.includes(playerId)) fromTeam = "B"
    else if (teamC.includes(playerId)) fromTeam = "C"

    // Determine target team
    let toTeam: "A" | "B" | "C" | "unassigned" = "unassigned"
    if (targetZone === "team-a") toTeam = "A"
    else if (targetZone === "team-b") toTeam = "B"
    else if (targetZone === "team-c") toTeam = "C"

    // Don't move if dropping in the same zone
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="gap-2 min-h-[48px] w-full">
          <Users className="h-5 w-5" />
          Change Teams
        </Button>
      </DialogTrigger>
      <DialogContent className="!max-w-none w-[95vw] max-w-[95vw] h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Teams</DialogTitle>
        </DialogHeader>

        <DndContext sensors={sensors} onDragEnd={handleDragEnd} collisionDetection={pointerWithin}>
          <div className="space-y-6">
            {/* Teams Grid */}
            <div className="grid grid-cols-3 gap-4">
              <DroppableTeamZone teamId="team-a" team={teamA} teamLetter="A" allPlayers={allPlayers} />
              <DroppableTeamZone teamId="team-b" team={teamB} teamLetter="B" allPlayers={allPlayers} />
              <DroppableTeamZone teamId="team-c" team={teamC} teamLetter="C" allPlayers={allPlayers} />
            </div>

            {/* Unassigned Players */}
            <DroppableUnassignedZone unassigned={unassigned} allPlayers={allPlayers} />

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
        </DndContext>
      </DialogContent>
    </Dialog>
  )
}
