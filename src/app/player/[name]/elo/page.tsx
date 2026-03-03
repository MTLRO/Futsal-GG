"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Area,
  ComposedChart,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"
import {
  ArrowLeft,
  Trophy,
  Target,
  Users,
  Swords,
  Battery,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Player {
  name: string
  lastName: string
  elo: number
  deltaELO: number
  goals: number
  fatigueX: number
  goalkeeper?: boolean
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

interface ChartDataPoint {
  x: number
  y: number
  gameId: number
  date: string
  dateLabel?: string
  team1Score: number
  team2Score: number
  playerTeam: 1 | 2
  teammates: Player[]
  opponents: Player[]
  deltaELO: number
  goals: number
  goalkeeper: boolean
  color: string
  fatigueX: number
  playerElo: number
  teammatesAvgElo: number
  teamAvgElo: number
  opponentsAvgElo: number
}

interface CustomDotProps {
  cx?: number
  cy?: number
  payload: ChartDataPoint
}

const fetchGameHistory = async (): Promise<GameHistoryEntry[]> => {
  const response = await fetch("/api/games/history")
  if (!response.ok) {
    throw new Error("Failed to fetch game history")
  }
  const data = await response.json()
  return data.gameHistory
}

const formatDateEST = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'America/New_York'
  })
}

const formatDateTimeEST = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York'
  })
}

const getDateKeyEST = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    timeZone: 'America/New_York'
  })
}

// Get Monday of current week in EST
const getMondayOfWeekEST = (): Date => {
  const now = new Date()
  // Convert to EST
  const estString = now.toLocaleString('en-US', { timeZone: 'America/New_York' })
  const estDate = new Date(estString)
  const day = estDate.getDay()
  const diff = estDate.getDate() - day + (day === 0 ? -6 : 1) // Adjust for Sunday
  const monday = new Date(estDate)
  monday.setDate(diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}

export default function PlayerEloProgressionPage() {
  const params = useParams()
  const router = useRouter()
  const playerName = decodeURIComponent(params.name as string)

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const chartScrollRef = useRef<HTMLDivElement>(null)

  const { data: allGames = [], isLoading, error } = useQuery({
    queryKey: ["gameHistory"],
    queryFn: fetchGameHistory,
  })

  const playerGames = allGames
    .filter((game) => {
      const inTeam1 = game.team1Players.some((p) => p.name === playerName)
      const inTeam2 = game.team2Players.some((p) => p.name === playerName)
      return inTeam1 || inTeam2
    })
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())

  const chartData: ChartDataPoint[] = playerGames.map((game, index) => {
    const isTeam1 = game.team1Players.some((p) => p.name === playerName)
    const playerTeam = isTeam1 ? 1 : 2
    const playerData = isTeam1
      ? game.team1Players.find((p) => p.name === playerName)
      : game.team2Players.find((p) => p.name === playerName)

    const teammates = isTeam1
      ? game.team1Players.filter((p) => p.name !== playerName)
      : game.team2Players.filter((p) => p.name !== playerName)

    const opponents = isTeam1 ? game.team2Players : game.team1Players

    const eloBeforeGame = playerData?.elo || 1500
    const deltaELO = playerData?.deltaELO || 0
    const eloAfterGame = eloBeforeGame + deltaELO

    let dateLabel: string | undefined
    if (index === 0) {
      dateLabel = formatDateEST(game.dateTime)
    } else {
      const prevDateKey = getDateKeyEST(playerGames[index - 1].dateTime)
      const currDateKey = getDateKeyEST(game.dateTime)
      if (prevDateKey !== currDateKey) {
        dateLabel = formatDateEST(game.dateTime)
      }
    }

    const playerTeamScore = playerTeam === 1 ? game.team1Score : game.team2Score
    const opponentTeamScore = playerTeam === 1 ? game.team2Score : game.team1Score
    let color = "#64748b"
    if (playerTeamScore > opponentTeamScore) color = "#22c55e"
    if (playerTeamScore < opponentTeamScore) color = "#ef4444"

    const fatigueX = playerData?.fatigueX || 0

    const teammatesAvgElo = teammates.length > 0
      ? Math.round(teammates.reduce((sum, p) => sum + p.elo, 0) / teammates.length)
      : 0

    const teamPlayers = isTeam1 ? game.team1Players : game.team2Players
    const teamAvgElo = teamPlayers.length > 0
      ? Math.round(teamPlayers.reduce((sum, p) => sum + p.elo, 0) / teamPlayers.length)
      : 0

    const opponentsAvgElo = opponents.length > 0
      ? Math.round(opponents.reduce((sum, p) => sum + p.elo, 0) / opponents.length)
      : 0

    return {
      x: index,
      y: eloAfterGame,
      gameId: game.gameId,
      date: game.dateTime,
      dateLabel,
      team1Score: game.team1Score,
      team2Score: game.team2Score,
      playerTeam,
      teammates,
      opponents,
      deltaELO,
      goals: playerData?.goals || 0,
      goalkeeper: playerData?.goalkeeper || false,
      color,
      fatigueX,
      playerElo: eloBeforeGame,
      teammatesAvgElo,
      teamAvgElo,
      opponentsAvgElo,
    }
  })

  const selectedPoint = selectedIndex !== null ? chartData[selectedIndex] : null

  // Calculate current ELO and weekly change
  const currentElo = chartData.length > 0 ? Math.round(chartData[chartData.length - 1].y) : 1500
  const mondayOfWeek = getMondayOfWeekEST()

  // Find ELO at start of week (last game before Monday, or first game if all games are this week)
  const weeklyDelta = (() => {
    if (chartData.length === 0) return 0

    // Find games this week
    const gamesThisWeek = chartData.filter(game => {
      const gameDate = new Date(game.date)
      const gameEST = new Date(gameDate.toLocaleString('en-US', { timeZone: 'America/New_York' }))
      return gameEST >= mondayOfWeek
    })

    if (gamesThisWeek.length === 0) return 0

    // Sum up all delta ELOs from this week's games
    return gamesThisWeek.reduce((sum, game) => sum + game.deltaELO, 0)
  })()

  // Set the latest game as selected when data loads
  useEffect(() => {
    if (chartData.length > 0 && selectedIndex === null) {
      setSelectedIndex(chartData.length - 1)
    }
  }, [chartData.length, selectedIndex])

  // Scroll chart to show selected game
  useEffect(() => {
    if (chartScrollRef.current && selectedIndex !== null && chartData.length > 20) {
      const scrollWidth = chartScrollRef.current.scrollWidth
      const containerWidth = chartScrollRef.current.clientWidth
      const scrollableWidth = scrollWidth - containerWidth
      const progress = selectedIndex / (chartData.length - 1)
      chartScrollRef.current.scrollLeft = scrollableWidth * progress
    }
  }, [selectedIndex, chartData.length])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedIndex === null) return
      if (e.key === 'ArrowLeft' && selectedIndex > 0) {
        setSelectedIndex(selectedIndex - 1)
      } else if (e.key === 'ArrowRight' && selectedIndex < chartData.length - 1) {
        setSelectedIndex(selectedIndex + 1)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedIndex, chartData.length])

  const goToPrevGame = useCallback(() => {
    if (selectedIndex !== null && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1)
    }
  }, [selectedIndex])

  const goToNextGame = useCallback(() => {
    if (selectedIndex !== null && selectedIndex < chartData.length - 1) {
      setSelectedIndex(selectedIndex + 1)
    }
  }, [selectedIndex, chartData.length])

  const getFatigueConfig = (fatigueX: number) => {
    if (fatigueX <= 10) return { bgColor: 'bg-green-500', textColor: 'text-green-700', label: 'Fresh' }
    if (fatigueX <= 20) return { bgColor: 'bg-yellow-500', textColor: 'text-yellow-700', label: 'Moderate' }
    return { bgColor: 'bg-red-500', textColor: 'text-red-700', label: 'Tired' }
  }

  const getFatigueStyle = (fatigueX: number) => {
    // Battery percentage: 100% at 0 min, 0% at 30+ min
    const fillPercent = Math.max(0, Math.min(100, 100 - (fatigueX / 30 * 100)))

    // Translucent color based on fatigue level
    let color: string
    if (fatigueX <= 4) {
      color = 'rgba(34, 197, 94, 0.15)' // green with 15% opacity
    } else if (fatigueX <= 8) {
      color = 'rgba(234, 179, 8, 0.15)' // yellow with 15% opacity
    } else if (fatigueX <= 12) {
      color = 'rgba(234, 179, 8, 0.2)' // yellow with 20% opacity
    } else if (fatigueX <= 18) {
      color = 'rgba(249, 115, 22, 0.2)' // orange with 20% opacity
    } else {
      color = 'rgba(239, 68, 68, 0.25)' // red with 25% opacity
    }

    return {
      background: `linear-gradient(to right, ${color} ${fillPercent}%, transparent ${fillPercent}%)`
    }
  }

  const getResultInfo = (point: ChartDataPoint) => {
    const playerTeamScore = point.playerTeam === 1 ? point.team1Score : point.team2Score
    const opponentTeamScore = point.playerTeam === 1 ? point.team2Score : point.team1Score
    const isWin = playerTeamScore > opponentTeamScore
    const isLoss = playerTeamScore < opponentTeamScore
    return { isWin, isLoss, isDraw: !isWin && !isLoss }
  }

  const getEloPredictionInfo = (point: ChartDataPoint) => {
    // Calculate expected score using ELO formula
    const eloDiff = point.opponentsAvgElo - point.teamAvgElo
    const expectedScore = 1 / (1 + Math.pow(10, eloDiff / 400))

    // Determine what the system expected
    let expectedResult: 'win' | 'loss' | 'tie'
    if (expectedScore >= 0.55) {
      expectedResult = 'win'
    } else if (expectedScore <= 0.45) {
      expectedResult = 'loss'
    } else {
      expectedResult = 'tie'
    }

    // Get actual result
    const { isWin, isLoss } = getResultInfo(point)
    const actualResult = isWin ? 'win' : isLoss ? 'loss' : 'tie'

    // Determine if prediction was correct
    const correct = expectedResult === actualResult
    const isUpset = (expectedResult === 'win' && actualResult === 'loss') ||
                    (expectedResult === 'loss' && actualResult === 'win')

    return {
      expectedResult,
      actualResult,
      correct,
      isUpset,
      expectedScore: (expectedScore * 100).toFixed(0) + '%'
    }
  }

  // Calculate ELO range for chart
  const eloValues = chartData.map(d => d.y)
  const minElo = Math.min(...eloValues)
  const maxElo = Math.max(...eloValues)
  const eloPadding = Math.max(50, (maxElo - minElo) * 0.15)
  const yMin = Math.floor((minElo - eloPadding) / 50) * 50
  const yMax = Math.ceil((maxElo + eloPadding + 50) / 50) * 50 // Extra space for emojis

  const renderGameDetails = (point: ChartDataPoint) => {
    const { isWin, isLoss } = getResultInfo(point)
    const fatigueConfig = getFatigueConfig(point.fatigueX)
    const fatiguePercentage = Math.min(100, (point.fatigueX / 30) * 100)
    const prediction = getEloPredictionInfo(point)

    return (
      <div className="space-y-3">
        {/* Header with navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={goToPrevGame}
            disabled={selectedIndex === 0}
            className={cn(
              "p-1.5 rounded-lg transition-all border",
              selectedIndex === 0
                ? "opacity-30 cursor-not-allowed border-border"
                : "hover:bg-accent border-border hover:border-accent-foreground/20 active:scale-95"
            )}
          >
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>

          <div className="text-center flex items-center gap-3">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              {formatDateTimeEST(point.date)}
            </span>
            <span className="text-xs text-muted-foreground">
              ({(selectedIndex ?? 0) + 1}/{chartData.length})
            </span>
          </div>

          <button
            onClick={goToNextGame}
            disabled={selectedIndex === chartData.length - 1}
            className={cn(
              "p-1.5 rounded-lg transition-all border",
              selectedIndex === chartData.length - 1
                ? "opacity-30 cursor-not-allowed border-border"
                : "hover:bg-accent border-border hover:border-accent-foreground/20 active:scale-95"
            )}
          >
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Score + Stats Row - All on one line */}
        <div className={cn(
          "rounded-xl p-3 flex items-center justify-between gap-4",
          isWin ? "bg-green-50 dark:bg-green-950/30" :
          isLoss ? "bg-red-50 dark:bg-red-950/30" :
          "bg-amber-50 dark:bg-amber-950/30"
        )}>
          {/* Result + Score */}
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-xs",
              isWin ? "bg-green-500 text-white" :
              isLoss ? "bg-red-500 text-white" :
              "bg-amber-500 text-white"
            )}>
              {isWin && <Trophy className="w-3 h-3" />}
              {isWin ? 'W' : isLoss ? 'L' : 'D'}
            </div>
            <div className="text-3xl font-black text-foreground">
              {point.playerTeam === 1 ? point.team1Score : point.team2Score}-{point.playerTeam === 1 ? point.team2Score : point.team1Score}
            </div>
          </div>

          {/* ELO + Delta + Goals */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-muted-foreground" />
              <span className="text-xl font-bold text-foreground">{Math.round(point.y)}</span>
              <span className={cn(
                "text-sm font-bold px-1.5 py-0.5 rounded",
                point.deltaELO > 0 ? "text-green-700 dark:text-green-200 bg-green-100 dark:bg-green-900/50" :
                point.deltaELO < 0 ? "text-red-700 dark:text-red-200 bg-red-100 dark:bg-red-900/50" :
                "text-muted-foreground bg-muted"
              )}>
                {point.deltaELO > 0 ? '+' : ''}{Math.round(point.deltaELO)}
              </span>
            </div>
            {point.goalkeeper ? (
              <span className="text-xl">🧤</span>
            ) : point.goals > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-lg">{"⚽".repeat(Math.min(point.goals, 5))}</span>
              </div>
            )}
          </div>
        </div>

        {/* Fatigue + ELO Averages Row */}
        <div className="grid grid-cols-4 gap-2">
          {/* Fatigue */}
          <div className="bg-muted/50 rounded-lg p-2 border border-border">
            <div className="flex items-center gap-1 mb-1">
              <Battery className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Fatigue</span>
            </div>
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full", fatigueConfig.bgColor)}
                style={{ width: `${fatiguePercentage}%` }}
              />
            </div>
            <div className={cn("text-xs font-bold mt-0.5", fatigueConfig.textColor)}>
              {point.fatigueX}m
            </div>
          </div>

          {/* Team Avg */}
          <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-2 border border-blue-200 dark:border-blue-800 text-center">
            <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">Team</div>
            <div className="text-lg font-black text-blue-700 dark:text-blue-300">{point.teamAvgElo}</div>
          </div>

          {/* Teammates Avg */}
          <div className="bg-muted/50 rounded-lg p-2 border border-border text-center">
            <div className="text-[10px] font-bold text-muted-foreground uppercase">Mates</div>
            <div className="text-lg font-black text-foreground">{point.teammatesAvgElo || '-'}</div>
          </div>

          {/* Opponents Avg */}
          <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-2 border border-red-200 dark:border-red-800 text-center">
            <div className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase">Opp</div>
            <div className="text-lg font-black text-red-700 dark:text-red-300">{point.opponentsAvgElo}</div>
          </div>
        </div>

        {/* Teams - Side by side on both mobile and PC */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-3 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-1.5 mb-2">
              <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-bold text-blue-700 dark:text-blue-300">Team</span>
            </div>
            <div className="space-y-1">
              {/* Player first with special styling */}
              <div
                className="flex items-center gap-2 border-2 border-blue-300 dark:border-blue-700 rounded px-2 py-1"
                style={getFatigueStyle(point.fatigueX)}
              >
                <span className="text-xs font-bold text-foreground truncate flex-1">{playerName}</span>
                <div className="flex items-center gap-1">
                  {point.goals > 0 && (
                    <span className="text-xs">⚽</span>
                  )}
                  <span className="text-[10px] font-bold text-blue-700 dark:text-blue-200 bg-blue-200 dark:bg-blue-900 px-1.5 rounded">{Math.round(point.playerElo)}</span>
                </div>
              </div>
              {/* Teammates */}
              {point.teammates.map((p, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 rounded px-2 py-1"
                  style={getFatigueStyle(p.fatigueX)}
                >
                  <span className="text-xs font-medium text-foreground truncate flex-1">{p.name}</span>
                  <div className="flex items-center gap-1">
                    {p.goals > 0 && (
                      <span className="text-xs">⚽</span>
                    )}
                    <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 rounded">{Math.round(p.elo)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-red-50 dark:bg-red-950/30 rounded-xl p-3 border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-1.5 mb-2">
              <Swords className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
              <span className="text-xs font-bold text-red-700 dark:text-red-300">Opponents</span>
            </div>
            <div className="space-y-1">
              {point.opponents.map((p, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 rounded px-2 py-1"
                  style={getFatigueStyle(p.fatigueX)}
                >
                  <span className="text-xs font-medium text-foreground truncate flex-1">{p.name}</span>
                  <div className="flex items-center gap-1">
                    {p.goals > 0 && (
                      <span className="text-xs">⚽</span>
                    )}
                    <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 rounded">{Math.round(p.elo)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ELO System Prediction Accuracy */}
        <div className={cn(
          "rounded-lg p-3 border",
          prediction.correct ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800" :
          prediction.isUpset ? "bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800" :
          "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
        )}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground uppercase">ELO Prediction</span>
              <span className={cn(
                "text-xs px-2 py-0.5 rounded-full font-bold",
                prediction.correct ? "bg-blue-500 text-white" :
                prediction.isUpset ? "bg-purple-500 text-white" :
                "bg-amber-500 text-white"
              )}>
                {prediction.correct ? '✓ Correct' : prediction.isUpset ? '⚡ Upset!' : '~ Close'}
              </span>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">
                Expected: <span className="font-bold capitalize">{prediction.expectedResult}</span> ({prediction.expectedScore})
              </div>
              <div className="text-xs text-muted-foreground">
                Actual: <span className="font-bold capitalize">{prediction.actualResult}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 bg-card border-b border-border px-4 py-2 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-1.5 -ml-1 rounded-full hover:bg-accent active:bg-accent/80 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold text-foreground truncate">
              {playerName}
            </h1>
            <p className="text-xs text-muted-foreground">{chartData.length} games</p>
          </div>
          {/* Current ELO and Weekly Delta */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xl font-bold text-foreground">{currentElo}</div>
              <div className={cn(
                "text-xs font-bold flex items-center justify-end gap-0.5",
                weeklyDelta > 0 ? "text-green-600 dark:text-green-500" :
                weeklyDelta < 0 ? "text-red-600 dark:text-red-500" : "text-muted-foreground"
              )}>
                {weeklyDelta > 0 ? <TrendingUp className="w-3 h-3" /> :
                 weeklyDelta < 0 ? <TrendingDown className="w-3 h-3" /> :
                 <Minus className="w-3 h-3" />}
                {weeklyDelta > 0 ? '+' : ''}{weeklyDelta} this week
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col w-full overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center flex-1">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        ) : error ? (
          <div className="flex justify-center items-center flex-1">
            <div className="text-red-600 dark:text-red-500">Error loading data</div>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex justify-center items-center flex-1">
            <div className="text-muted-foreground">No games played yet</div>
          </div>
        ) : (
          <>
            {/* Chart - Top Section */}
            <div className="flex-shrink-0 bg-card border-b border-border px-2 lg:px-6 py-2" style={{ height: '45vh' }}>
              <div
                ref={chartScrollRef}
                className="h-full overflow-x-auto"
                onWheel={(e) => {
                  if (chartScrollRef.current && Math.abs(e.deltaY) > 0) {
                    e.preventDefault()
                    chartScrollRef.current.scrollLeft += e.deltaY
                  }
                }}
              >
                <div style={{
                  width: chartData.length > 20 ? `${(chartData.length / 20) * 100}%` : '100%',
                  minWidth: '100%',
                  height: '100%'
                }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={chartData}
                      margin={{ top: 40, right: 15, bottom: 35, left: 10 }}
                    >
                      <defs>
                        <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#1e293b" stopOpacity={0.12} />
                          <stop offset="100%" stopColor="#1e293b" stopOpacity={0} />
                        </linearGradient>
                      </defs>

                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />

                      <XAxis
                        dataKey="x"
                        type="number"
                        domain={[0, chartData.length - 1]}
                        ticks={chartData.map((d) => d.x)}
                        tickFormatter={(x: number) => chartData[x]?.dateLabel || ""}
                        angle={-45}
                        textAnchor="end"
                        height={45}
                        tick={{ fontSize: 10, fill: "#64748b" }}
                        stroke="#cbd5e1"
                      />

                      <YAxis
                        domain={[yMin, yMax]}
                        tick={{ fontSize: 10, fill: "#64748b" }}
                        stroke="#cbd5e1"
                        width={45}
                      />

                      {selectedPoint && (
                        <ReferenceLine
                          x={selectedPoint.x}
                          stroke="#3b82f6"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                        />
                      )}

                      <Area type="monotone" dataKey="y" fill="url(#areaGradient)" stroke="none" />

                      <Line
                        type="monotone"
                        dataKey="y"
                        stroke="hsl(var(--foreground))"
                        strokeWidth={2}
                        dot={(props: CustomDotProps) => {
                          const { cx, cy, payload } = props
                          if (cx === undefined || cy === undefined) return null

                          const isSelected = selectedIndex === payload.x
                          const size = isSelected ? 10 : 6

                          const handleClick = () => {
                            setSelectedIndex(payload.x)
                          }

                          return (
                            <g style={{ cursor: "pointer" }} onClick={handleClick}>
                              {/* Large invisible hit area for clicking - full vertical strip */}
                              <rect
                                x={cx - 25}
                                y={0}
                                width={50}
                                height={5000}
                                fill="transparent"
                                onClick={handleClick}
                                style={{ cursor: "pointer" }}
                              />

                              {/* Goals emoji column above dot */}
                              {payload.goals > 0 && (
                                <text
                                  x={cx}
                                  y={cy - size - 8 - (payload.goalkeeper ? 14 : 0)}
                                  textAnchor="middle"
                                  fontSize={11}
                                  onClick={handleClick}
                                  style={{ cursor: "pointer" }}
                                >
                                  {Array.from({ length: Math.min(payload.goals, 5) }, (_, i) => (
                                    <tspan key={i} x={cx} dy={i === 0 ? 0 : -12}>⚽</tspan>
                                  )).reverse()}
                                </text>
                              )}

                              {/* GK glove emoji above dot */}
                              {payload.goalkeeper && (
                                <text
                                  x={cx}
                                  y={cy - size - 6}
                                  textAnchor="middle"
                                  fontSize={12}
                                  onClick={handleClick}
                                  style={{ cursor: "pointer" }}
                                >
                                  🧤
                                </text>
                              )}

                              {/* Visible dot */}
                              <circle
                                cx={cx}
                                cy={cy}
                                r={size}
                                fill={payload.color}
                                stroke="#fff"
                                strokeWidth={isSelected ? 3 : 2}
                                onClick={handleClick}
                                style={{
                                  cursor: "pointer",
                                  transition: "all 0.15s ease",
                                  filter: isSelected ? "drop-shadow(0 0 6px rgba(59, 130, 246, 0.5))" :
                                          "drop-shadow(0 1px 2px rgba(0,0,0,0.1))"
                                }}
                              />
                            </g>
                          )
                        }}
                        activeDot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Game Details - Bottom Section */}
            <div className="flex-1 bg-card overflow-y-auto">
              <div className="p-3 lg:p-4">
                {selectedPoint ? (
                  renderGameDetails(selectedPoint)
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Click on a point to see game details
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
