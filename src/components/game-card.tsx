"use client"

import { useState } from "react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, Video, Trophy } from "lucide-react"

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
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-muted-foreground">{player.elo}</span>
            <div className={`flex items-center gap-1 font-semibold text-sm ${getEloColor(player.deltaELO)}`}>
              {player.deltaELO > 0 ? "+" : ""}{player.deltaELO}
              {getEloIcon(player.deltaELO)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function GameCard({
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

  // Determine top bar gradient based on winner
  const getTopBarGradient = () => {
    if (isTeam1Winner) {
      // Team 1 (left) won: green on left, red on right
      return "bg-gradient-to-r from-green-500/30 to-red-500/30"
    } else if (isTeam2Winner) {
      // Team 2 (right) won: red on left, green on right
      return "bg-gradient-to-r from-red-500/30 to-green-500/30"
    } else {
      // Draw: subtle gray
      return "bg-slate-300/30"
    }
  }

  return (
    <Card className="relative overflow-hidden p-0 transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-xl">
      {/* Glassy gradient top bar */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${getTopBarGradient()} backdrop-blur-sm`} />
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <button className="w-full text-left cursor-pointer hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
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
                <div className="flex items-center justify-center gap-2 text-xl tracking-wide mb-1.5">
                  <div className="flex-1 text-right">
                    Team {highestEloTeam1.name}
                  </div>
                  <div className="text-muted-foreground px-2">vs</div>
                  <div className="flex-1 text-left">
                    Team {highestEloTeam2.name}
                  </div>
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
                <span className="transition-opacity duration-200">
                  {isExpanded ? "Hide details" : "View player details"}
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? "rotate-180" : "rotate-0"}`} />
              </div>
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="transition-all duration-200">
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
                {[...game.team1Players]
                  .sort((a, b) => b.elo - a.elo)
                  .map((player, idx) => (
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
                {[...game.team2Players]
                  .sort((a, b) => b.elo - a.elo)
                  .map((player, idx) => (
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
