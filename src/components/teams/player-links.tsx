"use client"

import { useMemo } from "react"
import { PlayerLink, getSynergy, synergyToColor } from "@/lib/team-utils"

interface PlayerLinksProps {
  team: number[]
  highlightedPlayer: number | null
  links: PlayerLink[]
}

// Position coordinates for the formation (relative to container)
const POSITIONS = [
  { x: 50, y: 82 }, // GK
  { x: 25, y: 52 }, // DL
  { x: 75, y: 52 }, // DR
  { x: 25, y: 22 }, // FL
  { x: 75, y: 22 }, // FR
]

export function PlayerLinks({ team, highlightedPlayer, links }: PlayerLinksProps) {
  const pairs = useMemo(() => {
    const result: Array<{ from: number; to: number; fromIdx: number; toIdx: number }> = []
    for (let i = 0; i < team.length; i++) {
      for (let j = i + 1; j < team.length; j++) {
        if (team[i] && team[j]) {
          result.push({ from: team[i], to: team[j], fromIdx: i, toIdx: j })
        }
      }
    }
    return result
  }, [team])

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
        const midX = (POSITIONS[fromIdx].x + POSITIONS[toIdx].x) / 2
        const midY = (POSITIONS[fromIdx].y + POSITIONS[toIdx].y) / 2

        return (
          <g key={`${from}-${to}`}>
            <line
              x1={`${POSITIONS[fromIdx].x}%`}
              y1={`${POSITIONS[fromIdx].y}%`}
              x2={`${POSITIONS[toIdx].x}%`}
              y2={`${POSITIONS[toIdx].y}%`}
              stroke={synergyToColor(synergy, opacity)}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
            {isHighlighted && synergy !== null && (
              <>
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
