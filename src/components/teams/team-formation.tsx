"use client"

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

interface TeamFormationProps {
  teamLetter: TeamLetter
  team: number[]
  allPlayers: Player[]
  links: PlayerLink[]
  highlightedPlayer: number | null
  setHighlightedPlayer: (id: number | null) => void
}

export function TeamFormation({
  teamLetter,
  team,
  allPlayers,
  links,
  highlightedPlayer,
  setHighlightedPlayer,
}: TeamFormationProps) {
  const teamName = getHighestEloPlayerName(team, allPlayers) || teamLetter

  // Ensure team has 5 slots
  const teamSlots = [...team]
  while (teamSlots.length < 5) {
    teamSlots.push(0)
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
          {/* Field background */}
          <div className="absolute inset-0 rounded-xl bg-white border-2 border-black">
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <rect x="2" y="2" width="96" height="96" fill="none" stroke="black" strokeWidth="0.5" />
              <path d="M 30 2 A 20 20 0 0 0 70 2" fill="none" stroke="black" strokeWidth="0.5" />
              <path d="M 20 98 A 30 30 0 0 1 80 98" fill="none" stroke="black" strokeWidth="0.5" />
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
              />
              <DroppableSlot
                slotId={`${teamLetter}-FR`}
                playerId={teamSlots[4] || null}
                player={getPlayerById(teamSlots[4], allPlayers)}
                isHighlighted={highlightedPlayer === teamSlots[4]}
                onPress={() => setHighlightedPlayer(highlightedPlayer === teamSlots[4] ? null : teamSlots[4])}
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
              />
              <DroppableSlot
                slotId={`${teamLetter}-DR`}
                playerId={teamSlots[2] || null}
                player={getPlayerById(teamSlots[2], allPlayers)}
                isHighlighted={highlightedPlayer === teamSlots[2]}
                onPress={() => setHighlightedPlayer(highlightedPlayer === teamSlots[2] ? null : teamSlots[2])}
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
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
