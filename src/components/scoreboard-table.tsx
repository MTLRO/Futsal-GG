"use client"

import { useRef, useEffect } from "react"
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
  searchQuery?: string
}

export function ScoreboardTable({ data, searchQuery = "" }: ScoreboardTableProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const highlightedRowRef = useRef<HTMLTableRowElement>(null)

  // Filter for min 12 games and sort by ELO descending - show ALL qualified players
  const qualifiedPlayers = [...data]
    .filter((entry) => entry.gamesPlayed >= 12)
    .sort((a, b) => b.elo - a.elo)

  // Find the index of the searched player
  const searchLower = searchQuery.trim().toLowerCase()
  const searchedPlayerIndex = searchLower
    ? qualifiedPlayers.findIndex(
        (entry) =>
          entry.name.toLowerCase().includes(searchLower) ||
          entry.lastName.toLowerCase().includes(searchLower)
      )
    : -1

  // Scroll to highlighted player when search changes
  useEffect(() => {
    if (searchedPlayerIndex !== -1 && highlightedRowRef.current && scrollContainerRef.current) {
      setTimeout(() => {
        highlightedRowRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        })
      }, 100)
    }
  }, [searchQuery, searchedPlayerIndex])

  const getRowClasses = (index: number, isHighlighted: boolean) => {
    let bgClass = ""

    // Top 3 styling with dark mode support
    if (index === 0) {
      bgClass = "bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-900/50 dark:hover:bg-yellow-800/60 dark:text-yellow-100"
    } else if (index === 1) {
      bgClass = "bg-slate-200 hover:bg-slate-300 dark:bg-slate-600/50 dark:hover:bg-slate-500/60 dark:text-slate-100"
    } else if (index === 2) {
      bgClass = "bg-orange-100 hover:bg-orange-200 dark:bg-orange-900/50 dark:hover:bg-orange-800/60 dark:text-orange-100"
    }

    // Highlight searched player
    if (isHighlighted) {
      bgClass += " ring-2 ring-primary ring-inset"
    }

    return bgClass
  }

  return (
    <div className="rounded-lg border bg-card mx-auto w-fit flex flex-col" style={{ maxHeight: "calc(100vh - 280px)", minHeight: "400px" }}>
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto"
      >
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10">
            <TableRow>
              <TableHead className="text-center py-2">Rank</TableHead>
              <TableHead className="text-center py-2">Name</TableHead>
              <TableHead className="text-center py-2">GP</TableHead>
              <TableHead className="text-center py-2">G</TableHead>
              <TableHead className="text-center py-2">Rating</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {qualifiedPlayers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No players with 12+ games yet
                </TableCell>
              </TableRow>
            ) : (
              qualifiedPlayers.map((entry, index) => {
                const isHighlighted = searchedPlayerIndex !== -1 && index === searchedPlayerIndex

                return (
                  <TableRow
                    key={entry.playerId}
                    ref={isHighlighted ? highlightedRowRef : null}
                    className={getRowClasses(index, isHighlighted)}
                  >
                    <TableCell className="font-bold text-lg text-center py-2">
                      {index + 1}
                    </TableCell>
                    <TableCell className="text-center py-2">
                      <Link
                        href={`/player/${encodeURIComponent(entry.name)}/elo`}
                        className="font-medium hover:underline"
                      >
                        {entry.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-center py-2">{entry.gamesPlayed}</TableCell>
                    <TableCell className="text-center font-semibold text-blue-600 dark:text-blue-400 py-2">
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
                              <div className="font-semibold">
                                Player: {entry.playerElo} ({entry.playerGames} games)
                              </div>
                              <div className="font-semibold">
                                GK: {entry.gkElo} ({entry.gkGames} games)
                              </div>
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
    </div>
  )
}
