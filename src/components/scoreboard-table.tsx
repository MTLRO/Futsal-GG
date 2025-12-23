"use client"

import Link from "next/link"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface ScoreboardEntry {
  playerId: number
  name: string
  lastName: string
  gamesPlayed: number
  goalsScored: number
  elo: number
  playerElo: number
  gkElo: number
  playerGames: number
  gkGames: number
  last5GamesDeltaELO: number
}

interface ScoreboardTableProps {
  data: ScoreboardEntry[]
}

export function ScoreboardTable({ data }: ScoreboardTableProps) {
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
                    <Link
                      href={`/player/${encodeURIComponent(entry.name)}/elo`}
                      className="font-medium hover:underline"
                    >
                      {entry.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-center py-2">{entry.gamesPlayed}</TableCell>
                  <TableCell className="text-center font-semibold text-blue-600 py-2">
                    {entry.goalsScored}
                  </TableCell>
                  <TableCell className="text-center font-semibold text-primary py-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help">{entry.elo}</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="text-xs space-y-1">
                            <div className="font-semibold">Player: {entry.playerElo} ({entry.playerGames} games)</div>
                            <div className="font-semibold">GK: {entry.gkElo} ({entry.gkGames} games)</div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
