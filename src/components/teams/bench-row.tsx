"use client"

import { memo } from "react"
import { useDroppable } from "@dnd-kit/core"
import { Player, getPlayerById } from "@/lib/team-utils"
import { DraggableBenchChip } from "./player-card"

interface BenchRowProps {
  title: string
  playerIds: number[]
  allPlayers: Player[]
  teamLetter: string
  isUnassigned?: boolean
  pendingPlayerId?: number | null
  onBenchTap?: (playerId: number, teamLetter: string) => void
}

export const BenchRow = memo(function BenchRow({
  title,
  playerIds,
  allPlayers,
  teamLetter,
  isUnassigned = false,
  pendingPlayerId = null,
  onBenchTap,
}: BenchRowProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `bench-${teamLetter}`,
    disabled: !isUnassigned,
  })

  return (
    <div
      ref={isUnassigned ? setNodeRef : undefined}
      className={`px-2 py-1.5 rounded-lg transition-colors ${isOver ? "bg-blue-50" : ""}`}
    >
      <div className="text-gray-500 text-[10px] font-semibold uppercase tracking-wide mb-1.5">
        {title}
      </div>

      {playerIds.length === 0 ? (
        <div
          className={`flex items-center justify-center rounded-lg py-3 text-xs text-gray-400
            ${isUnassigned ? "border-2 border-dashed border-gray-200 min-h-[44px]" : ""}`}
        >
          {isUnassigned ? "All players assigned" : "—"}
        </div>
      ) : (
        <div
          className={`flex flex-wrap gap-1.5 ${
            isUnassigned ? "p-2 border-2 border-dashed border-gray-200 rounded-lg" : ""
          } ${isOver && isUnassigned ? "border-blue-300" : ""}`}
        >
          {playerIds.map((playerId) => {
            const player = getPlayerById(playerId, allPlayers)
            if (!player) return null
            return (
              <DraggableBenchChip
                key={playerId}
                playerId={playerId}
                player={player}
                dragId={`bench-${teamLetter}-${playerId}`}
                isPendingSource={pendingPlayerId === playerId}
                onPress={() => onBenchTap?.(playerId, teamLetter)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
})

BenchRow.displayName = "BenchRow"
