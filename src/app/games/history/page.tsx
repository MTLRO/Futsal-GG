"use client"

import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, ArrowUp, ArrowDown, Minus } from "lucide-react"
import { GameCard } from "@/components/game-card"

interface Player {
  playerId: number
  name: string
  lastName: string
  elo: number
  deltaELO: number
  goals: number
  fatigueX: number
  goalkeeper?: boolean
  goalTimestamps?: (number | null)[]
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
  videoTimestamp: number | null
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

export default function GameHistoryPage() {
  const router = useRouter()

  const { data: gameHistory = [], isLoading, error } = useQuery({
    queryKey: ["gameHistory"],
    queryFn: fetchGameHistory,
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

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 rounded-full hover:bg-slate-100 active:bg-slate-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <h1 className="text-lg font-bold text-slate-800">Game History</h1>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="text-slate-500">Loading game history...</div>
          </div>
        ) : error ? (
          <div className="flex justify-center items-center py-20">
            <div className="text-red-600">Error loading game history</div>
          </div>
        ) : gameHistory.length === 0 ? (
          <div className="flex justify-center items-center py-20">
            <div className="text-slate-500">No games played yet</div>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(gamesByDate).map(([date, games]) => (
              <div key={date}>
                {/* Date Header */}
                <div className="mb-3">
                  <h3 className="text-lg font-semibold text-slate-800">{date}</h3>
                </div>

                {/* Games for this date */}
                <div className="space-y-3">
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
      </div>
    </div>
  )
}
