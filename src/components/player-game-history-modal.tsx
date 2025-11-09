"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface PlayerGameHistoryEntry {
  gameId: number
  dateTime: string
  teamSide: "HOME" | "AWAY"
  opponentTeamAverageElo: number
  playerEloAtGame: number
  goals: number
  deltaELO: number
  teamScore: number
  opponentScore: number
}

interface PlayerGameHistoryModalProps {
  playerId: number
  playerName: string
}

const fetchPlayerGameHistory = async (
  playerId: number
): Promise<PlayerGameHistoryEntry[]> => {
  const response = await fetch(`/api/players/${playerId}/history`)
  if (!response.ok) {
    throw new Error("Failed to fetch player game history")
  }
  const data = await response.json()
  return data.playerGameHistory
}

export function PlayerGameHistoryModal({
  playerId,
  playerName,
}: PlayerGameHistoryModalProps) {
  const [open, setOpen] = useState(true)

  const { data: gameHistory = [], isLoading, error } = useQuery({
    queryKey: ["playerGameHistory", playerId],
    queryFn: () => fetchPlayerGameHistory(playerId),
    enabled: open,
  })

  const formatDateTime = (dateTimeString: string) => {
    const date = new Date(dateTimeString)
    const dateStr = date.toLocaleDateString()
    const timeStr = date.toLocaleTimeString()
    return { dateStr, timeStr }
  }

  const formatResult = (
    teamScore: number,
    opponentScore: number,
    deltaELO: number
  ) => {
    let result = ""
    if (teamScore > opponentScore) {
      result = "W"
    } else if (teamScore < opponentScore) {
      result = "L"
    } else {
      result = "D"
    }
    return `${result} (${deltaELO > 0 ? "+" : ""}${deltaELO})`
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="!max-w-4xl max-h-[90vh] overflow-auto flex flex-col items-center">
        <DialogHeader className="w-full">
          <DialogTitle className="text-center">{playerName}&apos;s Game History</DialogTitle>
          <DialogDescription className="text-center">All games participated in</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <div className="text-muted-foreground">Loading game history...</div>
          </div>
        ) : error ? (
          <div className="flex justify-center items-center py-8">
            <div className="text-red-600">Error loading game history</div>
          </div>
        ) : gameHistory.length === 0 ? (
          <div className="flex justify-center items-center py-8">
            <div className="text-muted-foreground">No games played yet</div>
          </div>
        ) : (
          <div className="rounded-lg border bg-card overflow-auto w-fit mx-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">DateTime</TableHead>
                  <TableHead className="text-center">Your ELO</TableHead>
                  <TableHead className="text-center">Opponent Avg ELO</TableHead>
                  <TableHead className="text-center">Your Goals</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead className="text-center">Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gameHistory.map((game) => {
                  const { dateStr, timeStr } = formatDateTime(game.dateTime)
                  return (
                    <TableRow key={game.gameId}>
                      <TableCell className="whitespace-nowrap text-center">
                        <div>{dateStr}</div>
                        <div>{timeStr}</div>
                      </TableCell>
                      <TableCell className="text-center font-semibold">
                        {game.playerEloAtGame}
                      </TableCell>
                      <TableCell className="text-center">
                        {game.opponentTeamAverageElo}
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {game.goals}
                      </TableCell>
                      <TableCell className="text-center">
                        {game.teamScore} - {game.opponentScore}
                      </TableCell>
                      <TableCell className="text-center font-bold">
                        <span
                          className={
                            game.deltaELO > 0
                              ? "text-green-600"
                              : game.deltaELO < 0
                                ? "text-red-600"
                                : "text-muted-foreground"
                          }
                        >
                          {formatResult(game.teamScore, game.opponentScore, game.deltaELO)}
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
