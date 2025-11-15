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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { History, ChevronDown, ChevronUp, Video, Trophy, ArrowUp, ArrowDown, Minus } from "lucide-react"

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
      return { width: 100, bgColor: "bg-green-100/60", textColor: "text-green-700", label: "Fresh" }
    } else if (gameInARow === 2) {
      return { width: 75, bgColor: "bg-yellow-100/60", textColor: "text-yellow-700", label: "2nd game" }
    } else if (gameInARow === 3) {
      return { width: 50, bgColor: "bg-orange-100/60", textColor: "text-orange-700", label: "3rd game" }
    } else if (gameInARow === 4) {
      return { width: 35, bgColor: "bg-red-100/60", textColor: "text-red-700", label: "4th game" }
    } else {
      return { width: 20, bgColor: "bg-red-200/70", textColor: "text-red-800", label: `${gameInARow}th game` }
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
      <DialogContent className="w-full max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-auto sm:max-w-2xl lg:max-w-4xl p-0">
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

interface GameCardProps {
  game: GameHistoryEntry
  isTeam1Winner: boolean
  isTeam2Winner: boolean
  formatTime: (dateTime: string) => string
  formatDuration: (timePlayed: number | null) => string
  getFatigueConfig: (gameInARow: number) => { width: number; bgColor: string; textColor: string; label: string }
  getEloIcon: (deltaELO: number) => React.ReactNode
  getEloColor: (deltaELO: number) => string
}

function GameCard({
  game,
  isTeam1Winner,
  isTeam2Winner,
  formatTime,
  formatDuration,
  getFatigueConfig,
  getEloIcon,
  getEloColor,
}: GameCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Find highest ELO players from each team
  const highestEloTeam1 = game.team1Players.reduce((prev, current) =>
    (prev.elo > current.elo) ? prev : current
  )
  const highestEloTeam2 = game.team2Players.reduce((prev, current) =>
    (prev.elo > current.elo) ? prev : current
  )

  return (
    <Card className="overflow-hidden p-0">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <button className="w-full text-left hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
            <div className="p-4 space-y-3">
              {/* Header: Time and Video Button */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="text-sm font-medium">{formatTime(game.dateTime)}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{formatDuration(game.timePlayed)}</div>
                </div>
                {game.videoLink && (
                  <a
                    href={game.videoLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center justify-center w-11 h-11 rounded-lg border border-border bg-background hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                    aria-label="Watch game video"
                  >
                    <Video className="w-5 h-5 text-blue-600" />
                  </a>
                )}
              </div>

              {/* Score Section */}
              <div className="text-center">
                <div className="text-xl tracking-wide mb-1.5">
                  Team {highestEloTeam1.name} vs Team {highestEloTeam2.name}
                </div>
                <div className="text-lg font-bold tracking-tight">
                  {game.team1Score} - {game.team2Score}
                </div>
                <div className="flex items-center justify-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span>Avg ELO: {game.team1AverageElo}</span>
                  <span>•</span>
                  <span>Avg ELO: {game.team2AverageElo}</span>
                </div>
              </div>

              {/* Expand Indicator */}
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-1">
                {isExpanded ? (
                  <>
                    <span>Hide details</span>
                    <ChevronUp className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    <span>View player details</span>
                    <ChevronDown className="w-4 h-4" />
                  </>
                )}
              </div>
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4 space-y-4">
            {/* Team 1 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide">Team {highestEloTeam1.name}</h3>
                {isTeam1Winner && (
                  <Badge variant="default" className="bg-green-600 text-white gap-1">
                    <Trophy className="w-3 h-3" />
                    Winner
                  </Badge>
                )}
              </div>
              <div className="space-y-2">
                {game.team1Players.map((player, idx) => (
                  <PlayerRow
                    key={idx}
                    player={player}
                    getFatigueConfig={getFatigueConfig}
                    getEloIcon={getEloIcon}
                    getEloColor={getEloColor}
                  />
                ))}
              </div>
            </div>

            {/* Team 2 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide">Team {highestEloTeam2.name}</h3>
                {isTeam2Winner && (
                  <Badge variant="default" className="bg-green-600 text-white gap-1">
                    <Trophy className="w-3 h-3" />
                    Winner
                  </Badge>
                )}
              </div>
              <div className="space-y-2">
                {game.team2Players.map((player, idx) => (
                  <PlayerRow
                    key={idx}
                    player={player}
                    getFatigueConfig={getFatigueConfig}
                    getEloIcon={getEloIcon}
                    getEloColor={getEloColor}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}

interface PlayerRowProps {
  player: Player
  getFatigueConfig: (gameInARow: number) => { width: number; bgColor: string; textColor: string; label: string }
  getEloIcon: (deltaELO: number) => React.ReactNode
  getEloColor: (deltaELO: number) => string
}

function PlayerRow({ player, getFatigueConfig, getEloIcon, getEloColor }: PlayerRowProps) {
  const fatigueConfig = getFatigueConfig(player.gameInARow)

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Player Name with Fatigue Battery Background */}
      <div className="relative">
        {/* Fatigue battery background */}
        <div
          className={`absolute inset-y-0 left-0 ${fatigueConfig.bgColor} rounded-lg transition-all duration-300`}
          style={{ width: `${fatigueConfig.width}%` }}
        />

        {/* Player info */}
        <div className="relative flex items-center justify-between px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="font-medium">{player.name}</span>
            {player.goals > 0 && (
              <span className="text-base">{"⚽".repeat(player.goals)}</span>
            )}
          </div>
          <div className={`flex items-center gap-1 font-semibold text-sm ${getEloColor(player.deltaELO)}`}>
            {player.deltaELO > 0 ? "+" : ""}{player.deltaELO}
            {getEloIcon(player.deltaELO)}
          </div>
        </div>
      </div>
    </div>
  )
}
