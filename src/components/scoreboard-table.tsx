"use client"

import { useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PlayerGameHistoryModal } from "./player-game-history-modal"

interface ScoreboardEntry {
  playerId: number
  name: string
  lastName: string
  gamesPlayed: number
  goalsScored: number
  elo: number
  last5GamesDeltaELO: number
}

interface ScoreboardTableProps {
  data: ScoreboardEntry[]
}

export function ScoreboardTable({ data }: ScoreboardTableProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null)
  const [selectedPlayerName, setSelectedPlayerName] = useState<string>("")

  // Filter players with minimum 12 games, sort by ELO descending, and take top 15
  const sortedData = [...data]
    .filter((entry) => entry.gamesPlayed >= 12)
    .sort((a, b) => b.elo - a.elo)
    .slice(0, 15)

  return (
    <div className="rounded-lg border bg-card mx-auto w-fit">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-center py-2">Rank</TableHead>
            <TableHead className="text-center py-2">Name</TableHead>
            <TableHead className="text-center py-2">GP</TableHead>
            <TableHead className="text-center py-2">G</TableHead>
            <TableHead className="text-center py-2">Rating</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedData.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                No players yet
              </TableCell>
            </TableRow>
          ) : (
            sortedData.map((entry, index) => {
              let bgClass = ""
              if (index === 0) {
                bgClass = "bg-yellow-50 hover:bg-yellow-100" // Gold
              } else if (index === 1) {
                bgClass = "bg-slate-100 hover:bg-slate-200" // Silver
              } else if (index === 2) {
                bgClass = "bg-orange-50 hover:bg-orange-100" // Bronze
              }

              return (
                <TableRow key={entry.playerId} className={bgClass}>
                  <TableCell className="font-bold text-lg text-center py-2">{index + 1}</TableCell>
                  <TableCell className="text-center py-2">
                    <button
                      onClick={() => {
                        setSelectedPlayerId(entry.playerId)
                        setSelectedPlayerName(entry.name)
                      }}
                      className="font-medium hover:underline cursor-pointer"
                    >
                      {entry.name}
                    </button>
                  </TableCell>
                  <TableCell className="text-center py-2">{entry.gamesPlayed}</TableCell>
                  <TableCell className="text-center font-semibold text-blue-600 py-2">
                    {entry.goalsScored}
                  </TableCell>
                  <TableCell className="text-center font-semibold text-primary py-2">
                    {entry.elo}
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>

      {selectedPlayerId && (
        <PlayerGameHistoryModal
          key={selectedPlayerId}
          playerId={selectedPlayerId}
          playerName={selectedPlayerName}
          onClose={() => setSelectedPlayerId(null)}
        />
      )}
    </div>
  )
}
