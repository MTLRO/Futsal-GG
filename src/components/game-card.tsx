"use client"

import { useState, useRef, useEffect } from "react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronDown, Video, Trophy, Plus, Minus } from "lucide-react"
import PanToolIcon from "@mui/icons-material/PanTool"
import { VideoManageModal } from "@/components/video-manage-modal"
import { useAdmin } from "@/contexts/admin-context"
import { useMutation, useQueryClient } from "@tanstack/react-query"

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

interface GameCardProps {
  game: GameHistoryEntry
  isTeam1Winner: boolean
  isTeam2Winner: boolean
  formatTime: (dateTime: string) => string
  formatDuration: (timePlayed: number | null) => string
  getFatigueConfig: (fatigueX: number) => { width: number; bgColor: string; textColor: string; label: string }
  getEloIcon: (deltaELO: number) => React.ReactNode
  getEloColor: (deltaELO: number) => string
}

interface PlayerRowProps {
  player: Player
  gameId: number
  isEditMode: boolean
  getFatigueConfig: (fatigueX: number) => { width: number; bgColor: string; textColor: string; label: string }
  getEloIcon: (deltaELO: number) => React.ReactNode
  getEloColor: (deltaELO: number) => string
  onPlayerUpdate: () => void
}

function PlayerRow({ player, gameId, isEditMode, getFatigueConfig, getEloIcon, getEloColor, onPlayerUpdate }: PlayerRowProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const fatigueConfig = getFatigueConfig(player.fatigueX)
  const fatiguePercentage = Math.min(100, (player.fatigueX / 30) * 100) // Scale: 30 minutes = 100%
  const queryClient = useQueryClient()

  const updatePlayerMutation = useMutation({
    mutationFn: async ({ goals, goalkeeper }: { goals?: number, goalkeeper?: boolean }) => {
      const response = await fetch(`/api/games/${gameId}/player`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: player.playerId, goals, goalkeeper }),
      })
      if (!response.ok) throw new Error("Failed to update player")
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gameHistory"] })
      onPlayerUpdate()
    },
  })

  const handleGoalChange = (delta: number) => {
    const newGoals = Math.max(0, player.goals + delta)
    updatePlayerMutation.mutate({ goals: newGoals })
  }

  const handleGoalkeeperToggle = () => {
    updatePlayerMutation.mutate({ goalkeeper: !player.goalkeeper })
  }

  return (
    <div
      className="rounded-lg border bg-card overflow-visible relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Player Name with Fatigue Battery Background */}
      <div className="relative overflow-hidden rounded-lg">
        {/* Fatigue battery background */}
        <div
          className={`absolute inset-y-0 left-0 ${fatigueConfig.bgColor} transition-all duration-300`}
          style={{ width: `${fatiguePercentage}%` }}
        />

        {/* Player info */}
        <div className="relative flex items-center justify-between px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="font-medium">{player.name}</span>
            {player.goalkeeper && (
              <PanToolIcon sx={{ fontSize: 16, color: '#2563eb' }} />
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

        {/* Admin Controls */}
        {isEditMode && (
          <div className="relative border-t bg-muted/30 px-3 py-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-7 w-7 p-0"
                onClick={() => handleGoalChange(-1)}
                disabled={player.goals === 0 || updatePlayerMutation.isPending}
              >
                <Minus className="w-3 h-3" />
              </Button>
              <span className="text-xs font-medium px-2">Goals: {player.goals}</span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 w-7 p-0"
                onClick={() => handleGoalChange(1)}
                disabled={updatePlayerMutation.isPending}
              >
                <Plus className="w-3 h-3" />
              </Button>
            </div>
            <Button
              size="sm"
              variant={player.goalkeeper ? "default" : "outline"}
              className="h-7 px-2 text-xs"
              onClick={handleGoalkeeperToggle}
              disabled={updatePlayerMutation.isPending}
            >
              <PanToolIcon sx={{ fontSize: 12, marginRight: '4px' }} />
              GK
            </Button>
          </div>
        )}
      </div>

      {/* Fatigue Tooltip on Hover */}
      {showTooltip && !isEditMode && (
        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-slate-900 text-white px-2.5 py-1.5 rounded text-xs whitespace-nowrap shadow-lg">
            Fatigue: {player.fatigueX} min
          </div>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
        </div>
      )}
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
  const { isAuthenticated } = useAdmin()
  const [isExpanded, setIsExpanded] = useState(false)
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const queryClient = useQueryClient()

  const handlePlayerUpdate = () => {
    // Refetch game history after player update
    queryClient.invalidateQueries({ queryKey: ["gameHistory"] })
  }

  // Helper to format timestamp as m:ss
  const formatGoalTime = (seconds: number | null): string => {
    if (seconds === null || seconds === undefined) return ""
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Get all goal scorers with timestamps
  const getGoalScorers = (players: Player[]) => {
    const scorers: { name: string; timestamp: number | null }[] = []
    players.forEach(player => {
      if (player.goals > 0) {
        // If goalTimestamps exists and has entries, use them
        if (player.goalTimestamps && player.goalTimestamps.length > 0) {
          player.goalTimestamps.forEach(timestamp => {
            scorers.push({ name: player.name, timestamp })
          })
        } else {
          // If no timestamps, create entries based on goals count
          for (let i = 0; i < player.goals; i++) {
            scorers.push({ name: player.name, timestamp: null })
          }
        }
      }
    })
    // Sort by timestamp
    return scorers.sort((a, b) => {
      if (a.timestamp === null) return 1
      if (b.timestamp === null) return -1
      return a.timestamp - b.timestamp
    })
  }

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
            {/* Header: Time and Video Button */}
            <div className="p-4 pb-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="text-sm font-medium">{formatTime(game.dateTime)}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{formatDuration(game.timePlayed)}</div>
                </div>
                <div
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsPasswordModalOpen(true)
                  }}
                  className="flex items-center justify-center w-11 h-11 rounded-lg border border-border bg-background hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      e.stopPropagation()
                      setIsPasswordModalOpen(true)
                    }
                  }}
                  aria-label={game.videoLink ? "Watch/Edit game video" : "Add game video"}
                >
                  <Video className={`w-5 h-5 ${game.videoLink ? 'text-blue-600' : 'text-muted-foreground'}`} />
                </div>
              </div>
            </div>
            <div className="p-4 pt-3 space-y-3">
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

                {/* Goal Scorers */}
                <div className="flex items-start justify-center gap-8 mt-3">
                  {/* Team 1 Scorers */}
                  <div className="flex-1 text-right">
                    {getGoalScorers(game.team1Players).map((scorer, idx) => (
                      <div key={idx} className="text-xs text-muted-foreground">
                        {scorer.name}{scorer.timestamp !== null && <> • {formatGoalTime(scorer.timestamp)}</>}
                      </div>
                    ))}
                  </div>
                  {/* Team 2 Scorers */}
                  <div className="flex-1 text-left">
                    {getGoalScorers(game.team2Players).map((scorer, idx) => (
                      <div key={idx} className="text-xs text-muted-foreground">
                        {scorer.name}{scorer.timestamp !== null && <> • {formatGoalTime(scorer.timestamp)}</>}
                      </div>
                    ))}
                  </div>
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
                      gameId={game.gameId}
                      isEditMode={isAuthenticated}
                      getFatigueConfig={getFatigueConfig}
                      getEloIcon={getEloIcon}
                      getEloColor={getEloColor}
                      onPlayerUpdate={handlePlayerUpdate}
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
                      gameId={game.gameId}
                      isEditMode={isAuthenticated}
                      getFatigueConfig={getFatigueConfig}
                      getEloIcon={getEloIcon}
                      getEloColor={getEloColor}
                      onPlayerUpdate={handlePlayerUpdate}
                    />
                  ))}
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>

      <VideoManageModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        videoLink={game.videoLink}
        videoTimestamp={game.videoTimestamp}
        gameId={game.gameId}
        team1Players={game.team1Players}
        team2Players={game.team2Players}
      />
    </Card>
  )
}
