"use client"

import { useDroppable } from "@dnd-kit/core"
import { Player, getPlayerById } from "@/lib/team-utils"
import { DraggablePlayerCard } from "./player-card"

interface BenchRowProps {
  title: string
  playerIds: number[]
  allPlayers: Player[]
  teamLetter: string
  isUnassigned?: boolean
}

export function BenchRow({
  title,
  playerIds,
  allPlayers,
  teamLetter,
  isUnassigned = false,
}: BenchRowProps) {
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
          <div className="text-gray-400 text-xs py-4 flex items-center">
            {isUnassigned ? "Drop players here" : "No players"}
          </div>
        )}
      </div>
    </div>
  )
}
