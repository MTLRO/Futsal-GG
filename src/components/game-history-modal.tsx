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
import { Badge } from "@/components/ui/badge"
import { History, ArrowUp, ArrowDown, Minus } from "lucide-react"
import { GameCard } from "./game-card"

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
  videoLink: string | null
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

  const formatTime = (dateTimeString: string) => {
    const date = new Date(dateTimeString)
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  const formatDuration = (timePlayed: number | null) => {
    if (!timePlayed) return "Duration not recorded"
    const minutes = Math.floor(timePlayed / 60)
    return `${minutes} min`
  }

  const getDateKey = (dateTimeString: string) => {
    const date = new Date(dateTimeString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // Group games by date
  const gamesByDate = gameHistory.reduce((groups: Record<string, GameHistoryEntry[]>, game) => {
    const dateKey = getDateKey(game.dateTime)
    if (!groups[dateKey]) {
      groups[dateKey] = []
    }
    groups[dateKey].push(game)
    return groups
  }, {})

  const getFatigueConfig = (gameInARow: number) => {
    if (gameInARow === 1) {
      return { width: 100, bgColor: "bg-green-100/30", textColor: "text-green-700", label: "Fresh" }
    } else if (gameInARow === 2) {
      return { width: 75, bgColor: "bg-yellow-100/30", textColor: "text-yellow-700", label: "2nd game" }
    } else if (gameInARow === 3) {
      return { width: 50, bgColor: "bg-orange-100/30", textColor: "text-orange-700", label: "3rd game" }
    } else if (gameInARow === 4) {
      return { width: 35, bgColor: "bg-red-100/30", textColor: "text-red-700", label: "4th game" }
    } else {
      return { width: 20, bgColor: "bg-red-200/30", textColor: "text-red-800", label: `${gameInARow}th game` }
    }
  }

  const getEloIcon = (deltaELO: number) => {
    if (deltaELO > 0) return <ArrowUp className="w-3 h-3" />
    if (deltaELO < 0) return <ArrowDown className="w-3 h-3" />
    return <Minus className="w-3 h-3" />
  }

  const getEloColor = (deltaELO: number) => {
    if (deltaELO > 0) return "text-green-600"
    if (deltaELO < 0) return "text-red-600"
    return "text-muted-foreground"
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <History className="mr-2 h-4 w-4" />
          Game History
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-auto sm:max-w-2xl lg:max-w-4xl p-0 [&>button]:fixed [&>button]:z-50">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="text-center">Game History</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center items-center py-8 px-6">
            <div className="text-muted-foreground">Loading game history...</div>
          </div>
        ) : error ? (
          <div className="flex justify-center items-center py-8 px-6">
            <div className="text-red-600">Error loading game history</div>
          </div>
        ) : gameHistory.length === 0 ? (
          <div className="flex justify-center items-center py-8 px-6">
            <div className="text-muted-foreground">No games played yet</div>
          </div>
        ) : (
          <div className="space-y-0">
            {Object.entries(gamesByDate).map(([date, games], index) => (
              <div key={date}>
                {/* Date Header */}
                <div className={`sticky top-0 z-10 bg-background/95 backdrop-blur-sm pb-3 px-6 ${index === 0 ? 'pt-4' : 'pt-6'}`}>
                  <h3 className="text-lg font-semibold text-foreground">{date}</h3>
                </div>

                {/* Games for this date */}
                <div className="space-y-3 px-6 pb-6">
                  {games.map((game) => {
                    const isTeam1Winner = game.team1Score > game.team2Score
                    const isTeam2Winner = game.team2Score > game.team1Score

                    return (
                      <GameCard
                        key={game.gameId}
                        game={game}
                        isTeam1Winner={isTeam1Winner}
                        isTeam2Winner={isTeam2Winner}
                        formatTime={formatTime}
                        formatDuration={formatDuration}
                        getFatigueConfig={getFatigueConfig}
                        getEloIcon={getEloIcon}
                        getEloColor={getEloColor}
                      />
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
