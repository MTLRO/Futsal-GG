"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { History } from "lucide-react"

interface Player {
  name: string
  lastName: string
  elo: number
  deltaELO: number
  goals: number
  gameInARow: number
}

interface GameHistoryEntry {
  gameId: number
  dateTime: string
  team1Players: Player[]
  team1AverageElo: number
  team2Players: Player[]
  team2AverageElo: number
  timePlayed: number | null
  team1Score: number
  team2Score: number
}

const fetchGameHistory = async (): Promise<GameHistoryEntry[]> => {
  const response = await fetch("/api/games/history")
  if (!response.ok) {
    throw new Error("Failed to fetch game history")
  }
  const data = await response.json()
  return data.gameHistory
}

export function GameHistoryModal() {
  const [open, setOpen] = useState(false)

  const { data: gameHistory = [], isLoading, error } = useQuery({
    queryKey: ["gameHistory"],
    queryFn: fetchGameHistory,
    enabled: open,
  })

  const formatDateTime = (dateTimeString: string) => {
    const date = new Date(dateTimeString)
    return date.toLocaleString()
  }

  const formatTime = (seconds: number | null) => {
    if (!seconds) return "-"
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}:${secs.toString().padStart(2, "0")}`
  }

  const renderGoals = (goals: number) => {
    if (goals === 0) return null
    return <span className="ml-1">{"⚽".repeat(goals)}</span>
  }

  const renderEnergyIcon = (gameInARow: number) => {
    // gameInARow: 1 = no fatigue (full battery), 2+ = fatigued
    if (gameInARow === 1) {
      return <span className="ml-1 text-green-600" title="Fresh">🔋</span>
    } else if (gameInARow === 2) {
      return <span className="ml-1 text-yellow-600" title="Slight fatigue">🪫</span>
    } else if (gameInARow === 3) {
      return <span className="ml-1 text-orange-600" title="Moderate fatigue">🪫</span>
    } else if (gameInARow === 4) {
      return <span className="ml-1 text-red-600" title="High fatigue">🪫</span>
    } else {
      return <span className="ml-1 text-red-700" title="Critical fatigue">🪫</span>
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <History className="mr-2 h-4 w-4" />
          Game History
        </Button>
      </DialogTrigger>
      <DialogContent className="!max-w-none w-[95vw] max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Game History</DialogTitle>
          <DialogDescription>Previous game results and statistics</DialogDescription>
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
          <div className="rounded-lg border bg-card overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>DateTime</TableHead>
                  <TableHead>Team 1 Players</TableHead>
                  <TableHead className="text-right">Team 1 Avg ELO</TableHead>
                  <TableHead>Team 2 Players</TableHead>
                  <TableHead className="text-right">Team 2 Avg ELO</TableHead>
                  <TableHead className="text-right">Time Played</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gameHistory.map((game) => (
                  <TableRow key={game.gameId}>
                    <TableCell className="whitespace-nowrap">
                      {formatDateTime(game.dateTime)}
                    </TableCell>
                    <TableCell className="max-w-[250px] break-words">
                      <div className="space-y-1">
                        {game.team1Players.map((p, idx) => (
                          <div key={idx} className="flex items-center">
                            <span>{p.name}</span>
                            {renderGoals(p.goals)}
                            {renderEnergyIcon(p.gameInARow)}
                            <span
                              className={`font-medium ml-1 ${
                                p.deltaELO > 0
                                  ? "text-green-600"
                                  : p.deltaELO < 0
                                    ? "text-red-600"
                                    : "text-muted-foreground"
                              }`}
                            >
                              ({p.deltaELO > 0 ? "+" : ""}
                              {p.deltaELO})
                            </span>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {game.team1AverageElo}
                    </TableCell>
                    <TableCell className="max-w-[250px] break-words">
                      <div className="space-y-1">
                        {game.team2Players.map((p, idx) => (
                          <div key={idx} className="flex items-center">
                            <span>{p.name}</span>
                            {renderGoals(p.goals)}
                            {renderEnergyIcon(p.gameInARow)}
                            <span
                              className={`font-medium ml-1 ${
                                p.deltaELO > 0
                                  ? "text-green-600"
                                  : p.deltaELO < 0
                                    ? "text-red-600"
                                    : "text-muted-foreground"
                              }`}
                            >
                              ({p.deltaELO > 0 ? "+" : ""}
                              {p.deltaELO})
                            </span>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {game.team2AverageElo}
                    </TableCell>
                    <TableCell className="text-right">{formatTime(game.timePlayed)}</TableCell>
                    <TableCell className="text-right font-bold">
                      {game.team1Score} - {game.team2Score}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
