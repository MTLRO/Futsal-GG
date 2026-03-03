"use client"

import { memo } from "react"
import { useDraggable } from "@dnd-kit/core"
import { Player } from "@/lib/team-utils"

interface PlayerCardProps {
  playerId: number | null
  player: Player | undefined
  isGK?: boolean
  isHighlighted?: boolean
  isPendingSource?: boolean  // this player is selected, waiting to be placed
  isPendingTarget?: boolean  // a pending player is being held; this slot is a valid target
  onPress?: () => void
  className?: string
}

export const PlayerCard = memo(function PlayerCard({
  playerId,
  player,
  isGK = false,
  isHighlighted = false,
  isPendingSource = false,
  isPendingTarget = false,
  onPress,
  className = "",
}: PlayerCardProps) {
  if (!playerId || !player) {
    return (
      <div
        onClick={onPress}
        className={`w-[92px] h-[92px] sm:w-[108px] sm:h-[108px] rounded-xl border-2 border-dashed
          flex flex-col items-center justify-center gap-1 transition-all
          ${isPendingTarget
            ? "border-blue-400 bg-blue-50 cursor-pointer scale-105"
            : "border-gray-300 bg-gray-50"
          } ${className}`}
      >
        {isPendingTarget ? (
          <span className="text-blue-400 text-xl font-light leading-none">+</span>
        ) : (
          <span className="text-gray-300 text-xs">{isGK ? "GK" : "+"}</span>
        )}
        {isGK && isPendingTarget && (
          <span className="text-blue-400 text-[9px] font-semibold">GK</span>
        )}
      </div>
    )
  }

  return (
    <div
      onClick={onPress}
      className={`w-[92px] h-[92px] sm:w-[108px] sm:h-[108px] rounded-xl overflow-hidden
        cursor-pointer transition-all border-2 select-none
        ${isPendingSource
          ? "border-blue-500 ring-2 ring-blue-400 ring-offset-1 scale-105 z-10"
          : isHighlighted
          ? "border-black ring-2 ring-black scale-110 z-10"
          : isPendingTarget
          ? "border-blue-300 ring-1 ring-blue-200"
          : "border-gray-200"
        }
        ${isGK ? "bg-gray-100" : "bg-white"}
        ${className}`}
      style={{
        boxShadow: isPendingSource
          ? "0 0 14px rgba(59,130,246,0.4)"
          : isHighlighted
          ? "0 0 15px rgba(0,0,0,0.3)"
          : "0 1px 4px rgba(0,0,0,0.08)",
      }}
    >
      <div className="h-full flex flex-col items-center justify-center p-1.5 gap-0.5">
        <div className="text-gray-900 font-bold text-xs sm:text-sm text-center leading-tight w-full px-1 line-clamp-2">
          {player.name}
        </div>
        <div className="text-gray-400 text-[10px] sm:text-xs">{player.elo}</div>
        {isGK && <div className="text-gray-400 text-[9px] font-semibold tracking-wider">GK</div>}
        {isPendingTarget && (
          <div className="text-blue-400 text-[9px] font-semibold">SWAP</div>
        )}
      </div>
    </div>
  )
})

PlayerCard.displayName = "PlayerCard"

// ─── Bench chip (compact, used in bench rows) ─────────────────────────────────

interface BenchChipProps {
  player: Player
  isPendingSource?: boolean
  onPress?: () => void
}

export const BenchChip = memo(function BenchChip({
  player,
  isPendingSource = false,
  onPress,
}: BenchChipProps) {
  return (
    <div
      onClick={onPress}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-full border
        cursor-pointer select-none transition-all active:scale-95
        ${isPendingSource
          ? "bg-blue-500 border-blue-500 text-white shadow-md"
          : "bg-white border-gray-300 text-gray-800 active:bg-gray-100"
        }`}
    >
      <span className="text-xs font-semibold whitespace-nowrap">
        {player.name} {player.lastName.charAt(0)}.
      </span>
      <span className={`text-[10px] ${isPendingSource ? "text-blue-200" : "text-gray-400"}`}>
        {player.elo}
      </span>
    </div>
  )
})

BenchChip.displayName = "BenchChip"

// ─── Draggable variants ────────────────────────────────────────────────────────

interface DraggablePlayerCardProps {
  playerId: number
  player: Player
  isGK?: boolean
  isHighlighted?: boolean
  isPendingSource?: boolean
  isPendingTarget?: boolean
  onPress?: () => void
  dragId: string
}

export const DraggablePlayerCard = memo(function DraggablePlayerCard({
  playerId,
  player,
  isGK = false,
  isHighlighted = false,
  isPendingSource = false,
  isPendingTarget = false,
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
      className={`touch-none ${isDragging ? "opacity-40" : ""}`}
    >
      <PlayerCard
        playerId={playerId}
        player={player}
        isGK={isGK}
        isHighlighted={isHighlighted}
        isPendingSource={isPendingSource}
        isPendingTarget={isPendingTarget}
        onPress={onPress}
      />
    </div>
  )
})

DraggablePlayerCard.displayName = "DraggablePlayerCard"

interface DraggableBenchChipProps {
  playerId: number
  player: Player
  isPendingSource?: boolean
  onPress?: () => void
  dragId: string
}

export const DraggableBenchChip = memo(function DraggableBenchChip({
  playerId,
  player,
  isPendingSource = false,
  onPress,
  dragId,
}: DraggableBenchChipProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId,
    data: { playerId },
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`touch-none ${isDragging ? "opacity-40" : ""}`}
    >
      <BenchChip
        player={player}
        isPendingSource={isPendingSource}
        onPress={onPress}
      />
    </div>
  )
})

DraggableBenchChip.displayName = "DraggableBenchChip"
