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

  // Sort by ELO descending
  const sortedData = [...data].sort((a, b) => b.elo - a.elo)

  return (
    <div className="rounded-lg border bg-card mx-auto w-fit">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-center">Rank</TableHead>
            <TableHead className="text-center">Name</TableHead>
            <TableHead className="text-center">Games</TableHead>
            <TableHead className="text-center">Goals</TableHead>
            <TableHead className="text-center">ELO</TableHead>
            <TableHead className="text-center">Last 5 Δ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedData.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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
                  <TableCell className="font-bold text-lg text-center">{index + 1}</TableCell>
                  <TableCell className="text-center">
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
                  <TableCell className="text-center">{entry.gamesPlayed}</TableCell>
                  <TableCell className="text-center font-semibold text-blue-600">
                    {entry.goalsScored}
                  </TableCell>
                  <TableCell className="text-center font-semibold text-primary">
                    {entry.elo}
                  </TableCell>
                  <TableCell className="text-center">
                    <span
                      className={
                        entry.last5GamesDeltaELO > 0
                          ? "text-green-600 font-medium"
                          : entry.last5GamesDeltaELO < 0
                            ? "text-red-600 font-medium"
                            : "text-muted-foreground"
                      }
                    >
                      {entry.last5GamesDeltaELO > 0 ? "+" : ""}
                      {entry.last5GamesDeltaELO}
                    </span>
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
        />
      )}
    </div>
  )
}
