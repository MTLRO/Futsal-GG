"use client"

import { useDraggable } from "@dnd-kit/core"
import { Player } from "@/lib/team-utils"

interface PlayerCardProps {
  playerId: number | null
  player: Player | undefined
  isGK?: boolean
  isHighlighted?: boolean
  onPress?: () => void
  className?: string
}

export function PlayerCard({
  playerId,
  player,
  isGK = false,
  isHighlighted = false,
  onPress,
  className = "",
}: PlayerCardProps) {
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

interface DraggablePlayerCardProps {
  playerId: number
  player: Player
  isGK?: boolean
  isHighlighted?: boolean
  onPress?: () => void
  dragId: string
}

export function DraggablePlayerCard({
  playerId,
  player,
  isGK = false,
  isHighlighted = false,
  onPress,
  dragId,
}: DraggablePlayerCardProps) {
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
