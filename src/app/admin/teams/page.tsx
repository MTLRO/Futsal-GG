"use client"

import { useState, useEffect, useRef, TouchEvent } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react"
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  pointerWithin,
} from "@dnd-kit/core"
import {
  Player,
  PlayerLink,
  TeamLetter,
  getPlayerById,
  getHighestEloPlayerName,
} from "@/lib/team-utils"
import { TeamFormation, BenchRow, PlayerCard } from "@/components/teams"

interface TeamsData {
  teamA: number[]
  teamB: number[]
  teamC: number[]
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

  const touchStartX = useRef<number>(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const teams: TeamLetter[] = ["A", "B", "C"]

  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: { distance: 8 },
  })
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 150, tolerance: 8 },
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
  })

  const { data: linksData } = useQuery<{ links: PlayerLink[] }>({
    queryKey: ["playerLinks"],
    queryFn: async () => {
      const res = await fetch("/api/player-links")
      if (!res.ok) throw new Error("Failed to fetch player links")
      return res.json()
    },
  })

  const links = linksData?.links || []

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
        setActiveTeam(teams[currentIndex + 1])
      } else if (diff < 0 && currentIndex > 0) {
        setActiveTeam(teams[currentIndex - 1])
      }
    }
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
    setHighlightedPlayer(null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const activeIdStr = active.id as string
    const overIdStr = over.id as string

    if (activeIdStr === overIdStr) return

    let sourcePlayerId: number
    let sourceTeam: TeamLetter | "unassigned"
    let sourcePosition: string | null = null

    if (activeIdStr.startsWith("bench-")) {
      const parts = activeIdStr.split("-")
      sourcePlayerId = parseInt(parts[2])
      sourceTeam = parts[1] === "unassigned" ? "unassigned" : (parts[1] as TeamLetter)
    } else {
      const parts = activeIdStr.split("-")
      sourceTeam = parts[0] as TeamLetter
      sourcePosition = parts[1]
      const posIndex = ["GK", "DL", "DR", "FL", "FR"].indexOf(sourcePosition)
      const team = getTeam(sourceTeam)
      sourcePlayerId = team[posIndex]
    }

    if (!sourcePlayerId) return

    if (overIdStr === "bench-unassigned") {
      if (sourcePosition) {
        const sourcePosIndex = ["GK", "DL", "DR", "FL", "FR"].indexOf(sourcePosition)
        setTeam(sourceTeam as TeamLetter, (prev) => {
          const newTeam = [...prev]
          newTeam[sourcePosIndex] = 0
          return newTeam
        })
        setUnassigned((prev) => [...prev, sourcePlayerId])
      }
      return
    }

    if (overIdStr.startsWith("bench-")) return

    const targetParts = overIdStr.split("-")
    const targetTeam = targetParts[0] as TeamLetter
    const targetPosition = targetParts[1]

    if (targetTeam !== activeTeam) return

    const targetPosIndex = ["GK", "DL", "DR", "FL", "FR"].indexOf(targetPosition)
    if (targetPosIndex === -1) return

    const targetTeamData = getTeam(targetTeam)
    const targetPlayerId = targetTeamData[targetPosIndex] || null

    if (targetPlayerId) {
      if (sourcePosition && sourceTeam === targetTeam) {
        const sourcePosIndex = ["GK", "DL", "DR", "FL", "FR"].indexOf(sourcePosition)
        setTeam(targetTeam, (prev) => {
          const newTeam = [...prev]
          newTeam[sourcePosIndex] = targetPlayerId
          newTeam[targetPosIndex] = sourcePlayerId
          return newTeam
        })
      } else if (sourcePosition && sourceTeam !== targetTeam) {
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
        setUnassigned((prev) => [...prev.filter((id) => id !== sourcePlayerId), targetPlayerId])
        setTeam(targetTeam, (prev) => {
          const newTeam = [...prev]
          newTeam[targetPosIndex] = sourcePlayerId
          return newTeam
        })
      } else {
        setTeam(sourceTeam as TeamLetter, (prev) => [...prev.filter((id) => id !== sourcePlayerId), targetPlayerId])
        setTeam(targetTeam, (prev) => {
          const newTeam = [...prev]
          newTeam[targetPosIndex] = sourcePlayerId
          return newTeam
        })
      }
    } else {
      if (sourcePosition) {
        const sourcePosIndex = ["GK", "DL", "DR", "FL", "FR"].indexOf(sourcePosition)
        if (sourceTeam === targetTeam) {
          setTeam(targetTeam, (prev) => {
            const newTeam = [...prev]
            newTeam[sourcePosIndex] = 0
            newTeam[targetPosIndex] = sourcePlayerId
            return newTeam
          })
        } else {
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

  const getOtherTeams = () => teams.filter((t) => t !== activeTeam)

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
            <button
              onClick={() => canGoLeft && setActiveTeam(teams[currentTeamIndex - 1])}
              className={`absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 ${
                canGoLeft ? "text-gray-700 hover:text-black" : "text-gray-300"
              }`}
              disabled={!canGoLeft}
            >
              <ChevronLeft className="w-8 h-8" />
            </button>

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
