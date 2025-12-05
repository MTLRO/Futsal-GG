"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ArrowUp, ArrowDown, Minus } from "lucide-react"
import { GameCard } from "./game-card"

interface Player {
  name: string
  lastName: string
  elo: number
  deltaELO: number
  goals: number
  fatigueX: number
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

interface PlayerGameHistoryModalProps {
  playerId: number
  playerName: string
  onClose: () => void
}

const fetchGameHistory = async (): Promise<GameHistoryEntry[]> => {
  const response = await fetch("/api/games/history")
  if (!response.ok) {
    throw new Error("Failed to fetch game history")
  }
  const data = await response.json()
  return data.gameHistory
}

export function PlayerGameHistoryModal({
  playerId,
  playerName,
  onClose,
}: PlayerGameHistoryModalProps) {
  const [open, setOpen] = useState(true)

  const { data: allGames = [], isLoading, error } = useQuery({
    queryKey: ["gameHistory"],
    queryFn: fetchGameHistory,
    enabled: open,
  })

  // Filter games where the player participated
  const gameHistory = allGames.filter((game) => {
    const inTeam1 = game.team1Players.some((p) => p.name === playerName)
    const inTeam2 = game.team2Players.some((p) => p.name === playerName)
    return inTeam1 || inTeam2
  })

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      onClose()
    }
  }

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

  const getFatigueConfig = (fatigueX: number) => {
    if (fatigueX === 0) {
      return { width: 100, bgColor: "bg-green-100/30", textColor: "text-green-700", label: "Fresh" }
    } else if (fatigueX <= 5) {
      return { width: 100, bgColor: "bg-green-100/30", textColor: "text-green-700", label: "Fresh" }
    } else if (fatigueX <= 10) {
      return { width: 75, bgColor: "bg-yellow-100/30", textColor: "text-yellow-700", label: "Moderate" }
    } else if (fatigueX <= 15) {
      return { width: 50, bgColor: "bg-orange-100/30", textColor: "text-orange-700", label: "Tired" }
    } else if (fatigueX <= 20) {
      return { width: 35, bgColor: "bg-red-100/30", textColor: "text-red-700", label: "Very Tired" }
    } else {
      return { width: 20, bgColor: "bg-red-200/30", textColor: "text-red-800", label: "Exhausted" }
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

  const gamesByDate = gameHistory.reduce((groups: Record<string, GameHistoryEntry[]>, game) => {
    const dateKey = getDateKey(game.dateTime)
    if (!groups[dateKey]) {
      groups[dateKey] = []
    }
    groups[dateKey].push(game)
    return groups
  }, {})

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-full max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-auto sm:max-w-2xl lg:max-w-4xl p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="text-center">{playerName}&apos;s Game History</DialogTitle>
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
