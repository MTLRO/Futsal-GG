"use client"

import { PlayerLink, getSynergy, synergyToColor } from "@/lib/team-utils"

interface PlayerLinksProps {
  team: number[]
  highlightedPlayer: number | null
  links: PlayerLink[]
}

export function PlayerLinks({ team, highlightedPlayer, links }: PlayerLinksProps) {
  // Position coordinates for the formation (relative to container)
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
