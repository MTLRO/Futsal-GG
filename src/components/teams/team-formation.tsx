"use client"

import { useMemo } from "react"
import { TrendingUp, TrendingDown } from "lucide-react"
import {
  Player,
  PlayerLink,
  TeamLetter,
  getPlayerById,
  getHighestEloPlayerName,
  calculateAverageElo,
  calculateChemistryAdjustedElo,
} from "@/lib/team-utils"
import { DroppableSlot } from "./droppable-slot"
import { PlayerLinks } from "./player-links"

const POSITIONS = ["GK", "DL", "DR", "FL", "FR"] as const

interface TeamFormationProps {
  teamLetter: TeamLetter
  team: number[]
  allPlayers: Player[]
  links: PlayerLink[]
  highlightedPlayer: number | null
  hasPendingPlayer: boolean
  onSlotTap: (slotId: string, currentPlayerId: number | null) => void
  onPlayerTap: (playerId: number) => void
}

export function TeamFormation({
  teamLetter,
  team,
  allPlayers,
  links,
  highlightedPlayer,
  hasPendingPlayer,
  onSlotTap,
  onPlayerTap,
}: TeamFormationProps) {
  // Pad to 5 slots
  const teamSlots = useMemo(() => {
    const slots = [...team]
    while (slots.length < 5) slots.push(0)
    return slots
  }, [team])

  const teamName = useMemo(
    () => getHighestEloPlayerName(team, allPlayers) || teamLetter,
    [team, allPlayers, teamLetter]
  )

  const validPlayerIds = useMemo(
    () => teamSlots.filter((id) => id > 0),
    [teamSlots]
  )

  const hasFullTeam = validPlayerIds.length === 5

  const { avgElo, staticAvgElo, chemistryDelta } = useMemo(
    () =>
      hasFullTeam
        ? calculateChemistryAdjustedElo(validPlayerIds, allPlayers, links)
        : { avgElo: 0, staticAvgElo: calculateAverageElo(validPlayerIds, allPlayers), chemistryDelta: 0 },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hasFullTeam, validPlayerIds.join(","), allPlayers, links]
  )

  // Slot layout: [FL, FR], [DL, DR], [GK]
  const rows = [
    [{ idx: 3, pos: "FL" }, { idx: 4, pos: "FR" }],
    [{ idx: 1, pos: "DL" }, { idx: 2, pos: "DR" }],
    [{ idx: 0, pos: "GK" }],
  ]

  return (
    <div className="w-full h-full flex flex-col">
      {/* Team header */}
      <div className="text-center py-2">
        <h2 className="text-foreground text-base font-bold">Team {teamName}</h2>
        <div className="flex items-center justify-center gap-2">
          <p className="text-muted-foreground text-xs">
            {hasFullTeam ? avgElo : staticAvgElo || "—"} ELO
          </p>
          {hasFullTeam && chemistryDelta !== 0 && (
            <div
              className={`flex items-center gap-0.5 text-xs font-medium ${
                chemistryDelta > 0 ? "text-green-600" : "text-red-500"
              }`}
            >
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

      {/* Field */}
      <div className="flex-1 flex items-center justify-center mx-1 mb-2">
        <div className="relative w-full max-w-[360px] aspect-[9/10]">
          {/* Field background */}
          <div className="absolute inset-0 rounded-xl bg-emerald-600 dark:bg-emerald-800 border-2 border-emerald-500 dark:border-emerald-700">
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <rect x="2" y="2" width="96" height="96" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" />
              <path d="M 30 2 A 20 20 0 0 0 70 2" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" />
              <path d="M 20 98 A 30 30 0 0 1 80 98" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" />
              <line x1="35" y1="98" x2="65" y2="98" stroke="rgba(255,255,255,0.6)" strokeWidth="1" />
            </svg>
          </div>

          {/* Chemistry links */}
          <PlayerLinks
            team={teamSlots}
            highlightedPlayer={hasPendingPlayer ? null : highlightedPlayer}
            links={links}
          />

          {/* Slots */}
          <div className="absolute inset-0 flex flex-col justify-between py-4 sm:py-5">
            {rows.map((row, rowIdx) => (
              <div
                key={rowIdx}
                className={`flex ${row.length === 1 ? "justify-center" : "justify-around px-4 sm:px-6"}`}
              >
                {row.map(({ idx, pos }) => {
                  const slotId = `${teamLetter}-${pos}`
                  const playerId = teamSlots[idx] || null
                  const player = getPlayerById(teamSlots[idx], allPlayers)
                  const isGK = pos === "GK"
                  return (
                    <DroppableSlot
                      key={slotId}
                      slotId={slotId}
                      playerId={playerId}
                      player={player}
                      isGK={isGK}
                      isHighlighted={!hasPendingPlayer && highlightedPlayer === teamSlots[idx]}
                      isPendingTarget={hasPendingPlayer}
                      onPress={() => {
                        if (hasPendingPlayer) {
                          onSlotTap(slotId, playerId)
                        } else if (playerId) {
                          onPlayerTap(playerId)
                        }
                      }}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
