"use client"

import { useState, useEffect, useRef, TouchEvent } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from "lucide-react"
import {
  DndContext,
  useDraggable,
  useDroppable,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  pointerWithin,
} from "@dnd-kit/core"

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

interface PlayerLink {
  player1Id: number
  player2Id: number
  wins: number
  losses: number
  draws: number
  totalGames: number
  synergy: number // 0-1 value
}

type TeamLetter = "A" | "B" | "C"

// Position indices for the 2-2 formation + GK
// GK at back, 2 defenders, 2 forwards
const FORMATION_POSITIONS = {
  GK: 0,    // Goalkeeper
  DL: 1,    // Defender Left
  DR: 2,    // Defender Right
  FL: 3,    // Forward Left
  FR: 4,    // Forward Right
}

function getPlayerById(playerId: number, allPlayers: Player[]): Player | undefined {
  return allPlayers.find((p) => p.id === playerId)
}

function getPlayerName(playerId: number, allPlayers: Player[]): string {
  const player = getPlayerById(playerId, allPlayers)
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

// Chemistry constants (from EloParameters)
const CHEMISTRY_MIN_COEFFICIENT = 0.65
const CHEMISTRY_MAX_COEFFICIENT = 1.45
const CHEMISTRY_NEUTRAL = 0.45
const GAMES_FOR_FULL_CONFIDENCE = 10

function getChemistryCoefficient(
  playerId: number,
  teammateIds: number[],
  links: PlayerLink[]
): number {
  if (teammateIds.length === 0) return 1.0

  let totalChemistry = 0
  let teammateCount = 0

  for (const teammateId of teammateIds) {
    const synergy = getSynergy(playerId, teammateId, links)
    const link = links.find((l) => {
      const [minId, maxId] = playerId < teammateId ? [playerId, teammateId] : [teammateId, playerId]
      return l.player1Id === minId && l.player2Id === maxId
    })

    const totalGames = link ? link.totalGames : 0

    let chemistry: number
    if (totalGames === 0) {
      chemistry = CHEMISTRY_NEUTRAL
    } else {
      const winRate = synergy ?? 0.5
      const confidence = Math.min(1, totalGames / GAMES_FOR_FULL_CONFIDENCE)
      chemistry = confidence * winRate + (1 - confidence) * CHEMISTRY_NEUTRAL
    }

    totalChemistry += chemistry
    teammateCount++
  }

  const avgChemistry = teammateCount > 0 ? totalChemistry / teammateCount : 0.5
  const coefficientRange = CHEMISTRY_MAX_COEFFICIENT - CHEMISTRY_MIN_COEFFICIENT
  const chemistryCoefficient = CHEMISTRY_MIN_COEFFICIENT + coefficientRange * avgChemistry

  return chemistryCoefficient
}

function calculateChemistryAdjustedElo(
  playerIds: number[],
  allPlayers: Player[],
  links: PlayerLink[]
): { avgElo: number; staticAvgElo: number; chemistryDelta: number } {
  if (playerIds.length === 0) return { avgElo: 0, staticAvgElo: 0, chemistryDelta: 0 }

  const staticAvgElo = calculateAverageElo(playerIds, allPlayers)

  const totalChemistryAdjustedElo = playerIds.reduce((sum, playerId) => {
    const player = allPlayers.find((p) => p.id === playerId)
    const staticElo = player?.elo || 1500

    // Get teammate IDs (all team members except this player)
    const teammateIds = playerIds.filter((id) => id !== playerId)

    // Calculate chemistry coefficient
    const chemistryCoefficient = getChemistryCoefficient(playerId, teammateIds, links)

    // Apply chemistry coefficient to ELO
    const chemistryAdjustedElo = staticElo * chemistryCoefficient

    return sum + chemistryAdjustedElo
  }, 0)

  const avgChemistryAdjustedElo = Math.round(totalChemistryAdjustedElo / playerIds.length)
  const chemistryDelta = avgChemistryAdjustedElo - staticAvgElo

  return {
    avgElo: avgChemistryAdjustedElo,
    staticAvgElo,
    chemistryDelta,
  }
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

// Get synergy between two players (0-1)
function getSynergy(p1Id: number, p2Id: number, links: PlayerLink[]): number | null {
  const [minId, maxId] = p1Id < p2Id ? [p1Id, p2Id] : [p2Id, p1Id]
  const link = links.find((l) => l.player1Id === minId && l.player2Id === maxId)
  return link ? link.synergy : null
}

// Convert synergy (0-1) to color (red -> yellow -> green)
function synergyToColor(synergy: number | null, opacity: number = 1): string {
  if (synergy === null) return `rgba(150, 150, 150, ${opacity * 0.5})` // Gray for no data

  // Clamp synergy to 0-1
  const s = Math.max(0, Math.min(1, synergy))

  // Red (0) -> Yellow (0.5) -> Green (1)
  let r: number, g: number, b: number
  if (s < 0.5) {
    // Red to Yellow: (220,50,50) -> (220,200,50)
    r = 220
    g = Math.round(50 + s * 2 * 150)
    b = 50
  } else {
    // Yellow to Green: (220,200,50) -> (50,180,50)
    r = Math.round(220 - (s - 0.5) * 2 * 170)
    g = Math.round(200 - (s - 0.5) * 2 * 20)
    b = 50
  }

  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}

// Get link statistics text
function getLinkStats(p1Id: number, p2Id: number, links: PlayerLink[]): string {
  const [minId, maxId] = p1Id < p2Id ? [p1Id, p2Id] : [p2Id, p1Id]
  const link = links.find((l) => l.player1Id === minId && l.player2Id === maxId)
  if (!link || link.totalGames === 0) return "No games"
  return `${link.wins}W ${link.draws}D ${link.losses}L`
}

// Player Card Component
function PlayerCard({
  playerId,
  player,
  isGK = false,
  isHighlighted = false,
  onPress,
  className = "",
}: {
  playerId: number | null
  player: Player | undefined
  isGK?: boolean
  isHighlighted?: boolean
  onPress?: () => void
  className?: string
}) {
  if (!playerId || !player) {
    return (
      <div
        className={`w-[89px] h-[92px] sm:w-[110px] sm:h-[110px] rounded-lg border-2 border-dashed border-gray-400 bg-gray-100 flex items-center justify-center ${className}`}
      >
        <span className="text-gray-400 text-xs">{isGK ? "GK" : "+"}</span>
      </div>
    )
  }

  return (
    <div
      onClick={onPress}
      className={`w-[89px] h-[92px] sm:w-[110px] sm:h-[110px] rounded-lg overflow-hidden cursor-pointer transition-all border-2 ${
        isHighlighted ? "border-black ring-2 ring-black scale-110 z-10" : "border-gray-300"
      } ${isGK ? "bg-gray-200" : "bg-white"} ${className}`}
      style={{
        boxShadow: isHighlighted ? "0 0 15px rgba(0,0,0,0.3)" : "0 2px 4px rgba(0,0,0,0.1)",
      }}
    >
      <div className="h-full flex flex-col items-center justify-center p-1">
        <div className="text-black font-bold text-xs sm:text-sm text-center leading-tight truncate w-full px-1">
          {player.name}
        </div>
        <div className="text-gray-600 text-[10px] sm:text-xs mt-1">{player.elo}</div>
        {isGK && <div className="text-gray-500 text-[8px] sm:text-[10px] mt-0.5">GK</div>}
      </div>
    </div>
  )
}

// Draggable Player Card
function DraggablePlayerCard({
  playerId,
  player,
  isGK = false,
  isHighlighted = false,
  onPress,
  dragId,
}: {
  playerId: number
  player: Player
  isGK?: boolean
  isHighlighted?: boolean
  onPress?: () => void
  dragId: string
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId,
    data: { playerId, isGK },
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`touch-none ${isDragging ? "opacity-50" : ""}`}
    >
      <PlayerCard
        playerId={playerId}
        player={player}
        isGK={isGK}
        isHighlighted={isHighlighted}
        onPress={onPress}
      />
    </div>
  )
}

// Droppable Position Slot
function DroppableSlot({
  slotId,
  playerId,
  player,
  isGK = false,
  isHighlighted = false,
  onPress,
  allPlayers,
}: {
  slotId: string
  playerId: number | null
  player: Player | undefined
  isGK?: boolean
  isHighlighted?: boolean
  onPress?: () => void
  allPlayers: Player[]
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: slotId,
    data: { isGK },
  })

  return (
    <div
      ref={setNodeRef}
      className={`transition-transform ${isOver ? "scale-110" : ""}`}
    >
      {playerId && player ? (
        <DraggablePlayerCard
          playerId={playerId}
          player={player}
          isGK={isGK}
          isHighlighted={isHighlighted}
          onPress={onPress}
          dragId={slotId}
        />
      ) : (
        <PlayerCard
          playerId={null}
          player={undefined}
          isGK={isGK}
          isHighlighted={isHighlighted}
          onPress={onPress}
        />
      )}
    </div>
  )
}

// SVG Links between players
function PlayerLinks({
  team,
  highlightedPlayer,
  links,
}: {
  team: number[]
  highlightedPlayer: number | null
  links: PlayerLink[]
}) {
  // Position coordinates for the formation (relative to container)
  // These correspond to the CSS positions in the formation
  const positions = [
    { x: 50, y: 82 },   // GK - bottom center
    { x: 25, y: 52 },   // DL - defender left
    { x: 75, y: 52 },   // DR - defender right
    { x: 25, y: 22 },   // FL - forward left
    { x: 75, y: 22 },   // FR - forward right
  ]

  // Generate all pairs
  const pairs: Array<{ from: number; to: number; fromIdx: number; toIdx: number }> = []
  for (let i = 0; i < team.length; i++) {
    for (let j = i + 1; j < team.length; j++) {
      if (team[i] && team[j]) {
        pairs.push({ from: team[i], to: team[j], fromIdx: i, toIdx: j })
      }
    }
  }

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {pairs.map(({ from, to, fromIdx, toIdx }) => {
        const synergy = getSynergy(from, to, links)
        const isHighlighted = highlightedPlayer === from || highlightedPlayer === to
        const opacity = highlightedPlayer === null ? 0.15 : isHighlighted ? 0.9 : 0.05
        const strokeWidth = isHighlighted ? 1.5 : 0.8

        // Calculate midpoint for the label
        const midX = (positions[fromIdx].x + positions[toIdx].x) / 2
        const midY = (positions[fromIdx].y + positions[toIdx].y) / 2

        return (
          <g key={`${from}-${to}`}>
            <line
              x1={`${positions[fromIdx].x}%`}
              y1={`${positions[fromIdx].y}%`}
              x2={`${positions[toIdx].x}%`}
              y2={`${positions[toIdx].y}%`}
              stroke={synergyToColor(synergy, opacity)}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
            {/* Show synergy value when highlighted */}
            {isHighlighted && synergy !== null && (
              <>
                {/* Background for better readability */}
                <rect
                  x={`${midX - 4}%`}
                  y={`${midY - 3}%`}
                  width="8%"
                  height="6%"
                  fill="white"
                  rx="1"
                  opacity="0.9"
                />
                <text
                  x={`${midX}%`}
                  y={`${midY + 1.5}%`}
                  textAnchor="middle"
                  fontSize="4"
                  fontWeight="bold"
                  fill={synergyToColor(synergy, 1)}
                >
                  {synergy.toFixed(2)}
                </text>
              </>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// Team Formation Component
function TeamFormation({
  teamLetter,
  team,
  allPlayers,
  links,
  highlightedPlayer,
  setHighlightedPlayer,
}: {
  teamLetter: TeamLetter
  team: number[]
  allPlayers: Player[]
  links: PlayerLink[]
  highlightedPlayer: number | null
  setHighlightedPlayer: (id: number | null) => void
}) {
  const teamName = getHighestEloPlayerName(team, allPlayers) || teamLetter

  // Ensure team has 5 slots
  const teamSlots = [...team]
  while (teamSlots.length < 5) {
    teamSlots.push(0) // 0 = empty slot
  }

  // Calculate chemistry-adjusted ELO only if team has 5 valid players
  const validPlayerIds = teamSlots.filter((id) => id > 0)
  const hasFullTeam = validPlayerIds.length === 5
  const { avgElo, staticAvgElo, chemistryDelta } = hasFullTeam
    ? calculateChemistryAdjustedElo(validPlayerIds, allPlayers, links)
    : { avgElo: 0, staticAvgElo: calculateAverageElo(validPlayerIds, allPlayers), chemistryDelta: 0 }

  return (
    <div className="w-full h-full flex flex-col">
      {/* Team Header */}
      <div className="text-center py-2 sm:py-3">
        <h2 className="text-black text-lg sm:text-xl font-bold">Team {teamName}</h2>
        <div className="flex items-center justify-center gap-2">
          <p className="text-gray-500 text-xs sm:text-sm">
            Avg ELO: {hasFullTeam ? avgElo : staticAvgElo || "—"}
          </p>
          {hasFullTeam && chemistryDelta !== 0 && (
            <div className={`flex items-center gap-0.5 text-xs font-medium ${chemistryDelta > 0 ? "text-green-600" : "text-red-600"}`}>
              {chemistryDelta > 0 ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              <span>{Math.abs(chemistryDelta)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Formation Field */}
      <div className="flex-1 flex items-center justify-center mx-1 mb-2">
        <div className="relative w-full max-w-[400px] aspect-[9/10]">
          {/* Field background - white with black lines */}
          <div className="absolute inset-0 rounded-xl bg-white border-2 border-black">
          {/* Half futsal field SVG markings */}
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {/* Outer boundary */}
            <rect x="2" y="2" width="96" height="96" fill="none" stroke="black" strokeWidth="0.5" />

            {/* Center half-circle at top (curving into our half) */}
            <path
              d="M 30 2 A 20 20 0 0 0 70 2"
              fill="none"
              stroke="black"
              strokeWidth="0.5"
            />

            {/* Goal area semi-circle at bottom (like handball) */}
            <path
              d="M 20 98 A 30 30 0 0 1 80 98"
              fill="none"
              stroke="black"
              strokeWidth="0.5"
            />

            {/* Goal line indication at very bottom */}
            <line x1="35" y1="98" x2="65" y2="98" stroke="black" strokeWidth="1" />
          </svg>
        </div>

        {/* Player Links SVG */}
        <PlayerLinks
          team={teamSlots}
          highlightedPlayer={highlightedPlayer}
          links={links}
        />

        {/* Formation positions - 2-2 + GK */}
        <div className="absolute inset-0 flex flex-col justify-between py-4 sm:py-6">
          {/* Forwards Row */}
          <div className="flex justify-around px-4 sm:px-8">
            <DroppableSlot
              slotId={`${teamLetter}-FL`}
              playerId={teamSlots[3] || null}
              player={getPlayerById(teamSlots[3], allPlayers)}
              isHighlighted={highlightedPlayer === teamSlots[3]}
              onPress={() => setHighlightedPlayer(highlightedPlayer === teamSlots[3] ? null : teamSlots[3])}
              allPlayers={allPlayers}
            />
            <DroppableSlot
              slotId={`${teamLetter}-FR`}
              playerId={teamSlots[4] || null}
              player={getPlayerById(teamSlots[4], allPlayers)}
              isHighlighted={highlightedPlayer === teamSlots[4]}
              onPress={() => setHighlightedPlayer(highlightedPlayer === teamSlots[4] ? null : teamSlots[4])}
              allPlayers={allPlayers}
            />
          </div>

          {/* Defenders Row */}
          <div className="flex justify-around px-4 sm:px-8">
            <DroppableSlot
              slotId={`${teamLetter}-DL`}
              playerId={teamSlots[1] || null}
              player={getPlayerById(teamSlots[1], allPlayers)}
              isHighlighted={highlightedPlayer === teamSlots[1]}
              onPress={() => setHighlightedPlayer(highlightedPlayer === teamSlots[1] ? null : teamSlots[1])}
              allPlayers={allPlayers}
            />
            <DroppableSlot
              slotId={`${teamLetter}-DR`}
              playerId={teamSlots[2] || null}
              player={getPlayerById(teamSlots[2], allPlayers)}
              isHighlighted={highlightedPlayer === teamSlots[2]}
              onPress={() => setHighlightedPlayer(highlightedPlayer === teamSlots[2] ? null : teamSlots[2])}
              allPlayers={allPlayers}
            />
          </div>

          {/* Goalkeeper Row */}
          <div className="flex justify-center">
            <DroppableSlot
              slotId={`${teamLetter}-GK`}
              playerId={teamSlots[0] || null}
              player={getPlayerById(teamSlots[0], allPlayers)}
              isGK
              isHighlighted={highlightedPlayer === teamSlots[0]}
              onPress={() => setHighlightedPlayer(highlightedPlayer === teamSlots[0] ? null : teamSlots[0])}
              allPlayers={allPlayers}
            />
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}

// Bench Row Component
function BenchRow({
  title,
  playerIds,
  allPlayers,
  teamLetter,
  isUnassigned = false,
}: {
  title: string
  playerIds: number[]
  allPlayers: Player[]
  teamLetter: string
  isUnassigned?: boolean
}) {
  // Only make unassigned row droppable
  const { setNodeRef, isOver } = useDroppable({
    id: `bench-${teamLetter}`,
    disabled: !isUnassigned,
  })

  return (
    <div
      ref={isUnassigned ? setNodeRef : undefined}
      className={`px-2 py-1 rounded-lg transition-colors ${isOver ? "bg-gray-200" : ""}`}
    >
      <div className="text-gray-600 text-[10px] sm:text-xs mb-1 font-medium">{title}</div>
      <div className={`flex gap-2 overflow-x-auto pb-1 scrollbar-hide min-h-[80px] ${isUnassigned ? "border-2 border-dashed border-gray-300 rounded-lg p-2" : ""}`}>
        {playerIds.length > 0 ? (
          playerIds.map((playerId) => {
            const player = getPlayerById(playerId, allPlayers)
            return player ? (
              <DraggablePlayerCard
                key={playerId}
                playerId={playerId}
                player={player}
                dragId={`bench-${teamLetter}-${playerId}`}
              />
            ) : null
          })
        ) : (
          <div className="text-gray-400 text-xs py-4 flex items-center">{isUnassigned ? "Drop players here" : "No players"}</div>
        )}
      </div>
    </div>
  )
}

export default function ManageTeamsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [activeTeam, setActiveTeam] = useState<TeamLetter>("A")
  const [teamA, setTeamA] = useState<number[]>([])
  const [teamB, setTeamB] = useState<number[]>([])
  const [teamC, setTeamC] = useState<number[]>([])
  const [unassigned, setUnassigned] = useState<number[]>([])
  const [highlightedPlayer, setHighlightedPlayer] = useState<number | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

  // Swipe handling
  const touchStartX = useRef<number>(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const teams: TeamLetter[] = ["A", "B", "C"]

  // Configure sensors
  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: { distance: 8 },
  })
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 150, tolerance: 8 },
  })
  const sensors = useSensors(mouseSensor, touchSensor)

  // Fetch players
  const { data: allPlayers = [] } = useQuery<Player[]>({
    queryKey: ["players"],
    queryFn: async () => {
      const res = await fetch("/api/players")
      if (!res.ok) throw new Error("Failed to fetch players")
      const data = await res.json()
      return data.players || []
    },
  })

  // Fetch teams
  const { data: teamsData } = useQuery<TeamsData>({
    queryKey: ["teams"],
    queryFn: async () => {
      const res = await fetch("/api/teams")
      if (!res.ok) throw new Error("Failed to fetch teams")
      return res.json()
    },
  })

  // Fetch player links
  const { data: linksData } = useQuery<{ links: PlayerLink[] }>({
    queryKey: ["playerLinks"],
    queryFn: async () => {
      const res = await fetch("/api/player-links")
      if (!res.ok) throw new Error("Failed to fetch player links")
      return res.json()
    },
  })

  const links = linksData?.links || []

  // Initialize teams
  useEffect(() => {
    if (teamsData && allPlayers.length > 0) {
      const allAssigned = [...teamsData.teamA, ...teamsData.teamB, ...teamsData.teamC]
      const unassignedPlayers = allPlayers.filter((p) => !allAssigned.includes(p.id)).map((p) => p.id)
      setTeamA(teamsData.teamA)
      setTeamB(teamsData.teamB)
      setTeamC(teamsData.teamC)
      setUnassigned(unassignedPlayers)
    }
  }, [teamsData, allPlayers])

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamA, teamB, teamC }),
      })
      if (!res.ok) throw new Error("Failed to save teams")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] })
      router.back()
    },
  })

  // Get team data by letter
  const getTeam = (letter: TeamLetter): number[] => {
    switch (letter) {
      case "A": return teamA
      case "B": return teamB
      case "C": return teamC
    }
  }

  const setTeam = (letter: TeamLetter, value: number[] | ((prev: number[]) => number[])) => {
    switch (letter) {
      case "A": setTeamA(value); break
      case "B": setTeamB(value); break
      case "C": setTeamC(value); break
    }
  }

  // Handle swipe navigation
  const handleTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e: TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX
    const diff = touchStartX.current - touchEndX
    const threshold = 50

    if (Math.abs(diff) > threshold) {
      const currentIndex = teams.indexOf(activeTeam)
      if (diff > 0 && currentIndex < teams.length - 1) {
        // Swipe left - next team
        setActiveTeam(teams[currentIndex + 1])
      } else if (diff < 0 && currentIndex > 0) {
        // Swipe right - previous team
        setActiveTeam(teams[currentIndex - 1])
      }
    }
  }

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
    setHighlightedPlayer(null)
  }

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    // If no drop target, do nothing (player stays in place)
    if (!over) return

    const activeIdStr = active.id as string
    const overIdStr = over.id as string

    // Same source and target - no action
    if (activeIdStr === overIdStr) return

    // Extract source info first
    let sourcePlayerId: number
    let sourceTeam: TeamLetter | "unassigned"
    let sourcePosition: string | null = null

    if (activeIdStr.startsWith("bench-")) {
      // From bench: bench-{team}-{playerId}
      const parts = activeIdStr.split("-")
      sourcePlayerId = parseInt(parts[2])
      sourceTeam = parts[1] === "unassigned" ? "unassigned" : (parts[1] as TeamLetter)
    } else {
      // From formation: {team}-{position}
      const parts = activeIdStr.split("-")
      sourceTeam = parts[0] as TeamLetter
      sourcePosition = parts[1]
      const posIndex = ["GK", "DL", "DR", "FL", "FR"].indexOf(sourcePosition)
      const team = getTeam(sourceTeam)
      sourcePlayerId = team[posIndex]
    }

    if (!sourcePlayerId) return

    // Handle dropping to unassigned bench (only from formation)
    if (overIdStr === "bench-unassigned") {
      if (sourcePosition) {
        // From formation to unassigned - move player to bench
        const sourcePosIndex = ["GK", "DL", "DR", "FL", "FR"].indexOf(sourcePosition)
        setTeam(sourceTeam as TeamLetter, (prev) => {
          const newTeam = [...prev]
          newTeam[sourcePosIndex] = 0
          return newTeam
        })
        setUnassigned((prev) => [...prev, sourcePlayerId])
      }
      // If already from bench, don't do anything
      return
    }

    // Only allow drops to the CURRENT active team's formation slots
    if (overIdStr.startsWith("bench-")) {
      // Dropping to other team benches is not allowed
      return
    }

    // Parse target - must be {teamLetter}-{position}
    const targetParts = overIdStr.split("-")
    const targetTeam = targetParts[0] as TeamLetter
    const targetPosition = targetParts[1]

    // Only allow drops to the currently active team
    if (targetTeam !== activeTeam) {
      return
    }

    const targetPosIndex = ["GK", "DL", "DR", "FL", "FR"].indexOf(targetPosition)
    if (targetPosIndex === -1) return

    // Get the player currently in the target slot (if any)
    const targetTeamData = getTeam(targetTeam)
    const targetPlayerId = targetTeamData[targetPosIndex] || null

    // Perform the swap/move
    if (targetPlayerId) {
      // Swap with existing player
      if (sourcePosition && sourceTeam === targetTeam) {
        // Same team, swap positions
        const sourcePosIndex = ["GK", "DL", "DR", "FL", "FR"].indexOf(sourcePosition)
        setTeam(targetTeam, (prev) => {
          const newTeam = [...prev]
          newTeam[sourcePosIndex] = targetPlayerId
          newTeam[targetPosIndex] = sourcePlayerId
          return newTeam
        })
      } else if (sourcePosition && sourceTeam !== targetTeam) {
        // Different teams - swap players between teams
        const sourcePosIndex = ["GK", "DL", "DR", "FL", "FR"].indexOf(sourcePosition)
        setTeam(sourceTeam as TeamLetter, (prev) => {
          const newTeam = [...prev]
          newTeam[sourcePosIndex] = targetPlayerId
          return newTeam
        })
        setTeam(targetTeam, (prev) => {
          const newTeam = [...prev]
          newTeam[targetPosIndex] = sourcePlayerId
          return newTeam
        })
      } else if (sourceTeam === "unassigned") {
        // From unassigned to occupied slot - swap
        setUnassigned((prev) => [...prev.filter((id) => id !== sourcePlayerId), targetPlayerId])
        setTeam(targetTeam, (prev) => {
          const newTeam = [...prev]
          newTeam[targetPosIndex] = sourcePlayerId
          return newTeam
        })
      } else {
        // From another team's bench to occupied slot - swap
        setTeam(sourceTeam as TeamLetter, (prev) => [...prev.filter((id) => id !== sourcePlayerId), targetPlayerId])
        setTeam(targetTeam, (prev) => {
          const newTeam = [...prev]
          newTeam[targetPosIndex] = sourcePlayerId
          return newTeam
        })
      }
    } else {
      // Empty slot - just move
      // Remove from source
      if (sourcePosition) {
        const sourcePosIndex = ["GK", "DL", "DR", "FL", "FR"].indexOf(sourcePosition)
        if (sourceTeam === targetTeam) {
          // Same team - move within team
          setTeam(targetTeam, (prev) => {
            const newTeam = [...prev]
            newTeam[sourcePosIndex] = 0
            newTeam[targetPosIndex] = sourcePlayerId
            return newTeam
          })
        } else {
          // Different team - leave empty slot in source, fill target
          setTeam(sourceTeam as TeamLetter, (prev) => {
            const newTeam = [...prev]
            newTeam[sourcePosIndex] = 0
            return newTeam
          })
          setTeam(targetTeam, (prev) => {
            const newTeam = [...prev]
            while (newTeam.length <= targetPosIndex) newTeam.push(0)
            newTeam[targetPosIndex] = sourcePlayerId
            return newTeam
          })
        }
      } else if (sourceTeam === "unassigned") {
        setUnassigned((prev) => prev.filter((id) => id !== sourcePlayerId))
        setTeam(targetTeam, (prev) => {
          const newTeam = [...prev]
          while (newTeam.length <= targetPosIndex) newTeam.push(0)
          newTeam[targetPosIndex] = sourcePlayerId
          return newTeam
        })
      } else {
        // From another team's bench (not in formation)
        setTeam(sourceTeam as TeamLetter, (prev) => prev.filter((id) => id !== sourcePlayerId))
        setTeam(targetTeam, (prev) => {
          const newTeam = [...prev]
          while (newTeam.length <= targetPosIndex) newTeam.push(0)
          newTeam[targetPosIndex] = sourcePlayerId
          return newTeam
        })
      }
    }
  }

  // Get other teams for bench display
  const getOtherTeams = () => {
    return teams.filter((t) => t !== activeTeam)
  }

  // Get drag overlay content
  const getDraggedPlayer = () => {
    if (!activeId) return null
    let playerId: number | null = null

    if (activeId.startsWith("bench-")) {
      const parts = activeId.split("-")
      playerId = parseInt(parts[2])
    } else {
      const parts = activeId.split("-")
      const team = parts[0] as TeamLetter
      const position = parts[1]
      const posIndex = ["GK", "DL", "DR", "FL", "FR"].indexOf(position)
      const teamData = getTeam(team)
      playerId = teamData[posIndex]
    }

    return playerId ? getPlayerById(playerId, allPlayers) : null
  }

  const activeTeamData = getTeam(activeTeam)
  const currentTeamIndex = teams.indexOf(activeTeam)
  const canGoLeft = currentTeamIndex > 0
  const canGoRight = currentTeamIndex < teams.length - 1

  // Count valid players per team
  const countValidPlayers = (team: number[]) => team.filter((id) => id > 0).length

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 -ml-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <h1 className="text-lg font-bold text-gray-900">Manage Teams</h1>
          </div>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={
              saveMutation.isPending ||
              countValidPlayers(teamA) !== 5 ||
              countValidPlayers(teamB) !== 5 ||
              countValidPlayers(teamC) !== 5
            }
            size="sm"
          >
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        collisionDetection={pointerWithin}
      >
        {/* Main Content */}
        <div
          ref={containerRef}
          className="flex-1 flex flex-col overflow-hidden"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Team Navigation Dots */}
          <div className="flex justify-center gap-2 py-2">
            {teams.map((team) => (
              <button
                key={team}
                onClick={() => setActiveTeam(team)}
                className={`w-2 h-2 rounded-full transition-all ${
                  activeTeam === team ? "bg-black w-4" : "bg-gray-300"
                }`}
              />
            ))}
          </div>

          {/* Navigation Arrows + Formation */}
          <div className="flex-1 flex items-stretch relative">
            {/* Left Arrow */}
            <button
              onClick={() => canGoLeft && setActiveTeam(teams[currentTeamIndex - 1])}
              className={`absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 ${
                canGoLeft ? "text-gray-700 hover:text-black" : "text-gray-300"
              }`}
              disabled={!canGoLeft}
            >
              <ChevronLeft className="w-8 h-8" />
            </button>

            {/* Formation Area */}
            <div className="flex-1 px-2">
              <TeamFormation
                teamLetter={activeTeam}
                team={activeTeamData}
                allPlayers={allPlayers}
                links={links}
                highlightedPlayer={highlightedPlayer}
                setHighlightedPlayer={setHighlightedPlayer}
              />
            </div>

            {/* Right Arrow */}
            <button
              onClick={() => canGoRight && setActiveTeam(teams[currentTeamIndex + 1])}
              className={`absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 ${
                canGoRight ? "text-gray-700 hover:text-black" : "text-gray-300"
              }`}
              disabled={!canGoRight}
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          </div>

          {/* Bench Section */}
          <div className="bg-gray-100 border-t border-gray-200 px-2 py-2 space-y-1">
            {getOtherTeams().map((teamLetter) => {
              const team = getTeam(teamLetter)
              const teamName = getHighestEloPlayerName(team, allPlayers) || teamLetter
              return (
                <BenchRow
                  key={teamLetter}
                  title={`Team ${teamName}`}
                  playerIds={team.filter((id) => id > 0)}
                  allPlayers={allPlayers}
                  teamLetter={teamLetter}
                />
              )
            })}
            <BenchRow
              title="Unassigned"
              playerIds={unassigned}
              allPlayers={allPlayers}
              teamLetter="unassigned"
              isUnassigned
            />
          </div>

          {/* Validation Warning */}
          {(countValidPlayers(teamA) !== 5 ||
            countValidPlayers(teamB) !== 5 ||
            countValidPlayers(teamC) !== 5) && (
            <div className="bg-red-50 border-t border-red-200 px-4 py-2">
              <p className="text-red-600 text-xs text-center">
                Each team needs 5 players. A: {countValidPlayers(teamA)}, B: {countValidPlayers(teamB)}, C: {countValidPlayers(teamC)}
              </p>
            </div>
          )}
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeId && getDraggedPlayer() && (
            <PlayerCard
              playerId={getDraggedPlayer()!.id}
              player={getDraggedPlayer()!}
              className="shadow-2xl scale-110"
            />
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
