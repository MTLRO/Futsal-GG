"use client"

import { useDroppable } from "@dnd-kit/core"
import { Player } from "@/lib/team-utils"
import { PlayerCard, DraggablePlayerCard } from "./player-card"

interface DroppableSlotProps {
  slotId: string
  playerId: number | null
  player: Player | undefined
  isGK?: boolean
  isHighlighted?: boolean
  onPress?: () => void
}

export function DroppableSlot({
  slotId,
  playerId,
  player,
  isGK = false,
  isHighlighted = false,
  onPress,
}: DroppableSlotProps) {
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
