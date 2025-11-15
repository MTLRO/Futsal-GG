"use client"

import { useState, useEffect } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Video, Loader2 } from "lucide-react"

interface GameOnDate {
  id: number
  startDateTime: string
  timePlayed: number | null
  videoLink: string | null
}

interface GameWithTimestamp extends GameOnDate {
  calculatedTimestamp: number
  manualTimestamp: string
}

export function AddVideoModal() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [youtubeUrl, setYoutubeUrl] = useState("")
  const [date, setDate] = useState("")
  const [videoStartOffset, setVideoStartOffset] = useState("0")
  const [games, setGames] = useState<GameWithTimestamp[]>([])
  const [isLoadingGames, setIsLoadingGames] = useState(false)
  const [gamesError, setGamesError] = useState("")

  // Extract timestamp from YouTube URL (e.g., ?t=123 or &t=123)
  const extractTimestampFromUrl = (url: string | null): number | null => {
    if (!url) return null

    try {
      const urlObj = new URL(url)
      const timestampParam = urlObj.searchParams.get('t')
      if (timestampParam) {
        const timestamp = parseInt(timestampParam)
        return isNaN(timestamp) ? null : timestamp
      }
    } catch {
      // Invalid URL, ignore
    }
    return null
  }

  // Fetch games when date changes
  useEffect(() => {
    const fetchGames = async () => {
      if (!date) {
        setGames([])
        return
      }

      setIsLoadingGames(true)
      setGamesError("")

      try {
        const res = await fetch(`/api/games/by-date?date=${date}`)
        if (!res.ok) {
          throw new Error("Failed to fetch games")
        }

        const data = await res.json()
        const gamesOnDate: GameOnDate[] = data.games

        if (gamesOnDate.length === 0) {
          setGames([])
          setGamesError("No games found on this date")
          return
        }

        // Calculate timestamps for each game
        const offset = parseInt(videoStartOffset) || 0
        const firstGameStartTime = new Date(gamesOnDate[0].startDateTime).getTime()

        const gamesWithTimestamps: GameWithTimestamp[] = gamesOnDate.map((game) => {
          const gameStartTime = new Date(game.startDateTime).getTime()
          const elapsedSeconds = Math.floor((gameStartTime - firstGameStartTime) / 1000)
          const calculatedTimestamp = offset + elapsedSeconds

          // Check if game already has a video link with timestamp
          const existingTimestamp = extractTimestampFromUrl(game.videoLink)

          return {
            ...game,
            calculatedTimestamp,
            // Use existing timestamp if available, otherwise use calculated
            manualTimestamp: String(existingTimestamp ?? Math.max(0, calculatedTimestamp)),
          }
        })

        setGames(gamesWithTimestamps)
      } catch (error) {
        console.error("Error fetching games:", error)
        setGamesError("Failed to load games for this date")
        setGames([])
      } finally {
        setIsLoadingGames(false)
      }
    }

    fetchGames()
  }, [date, videoStartOffset])

  const addVideoMutation = useMutation({
    mutationFn: async () => {
      if (!youtubeUrl || !date || games.length === 0) {
        throw new Error("YouTube URL, date, and games are required")
      }

      const gameUpdates = games.map((game) => ({
        gameId: game.id,
        timestamp: parseInt(game.manualTimestamp) || 0,
      }))

      const res = await fetch("/api/games/add-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          youtubeUrl,
          gameUpdates,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to add video")
      }

      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["games"] })
      setOpen(false)
      // Reset form
      setYoutubeUrl("")
      setDate("")
      setVideoStartOffset("0")
      setGames([])

      // Show success message with count
      alert(`Successfully added video to ${data.gamesUpdated} game(s)!`)
    },
  })

  const updateGameTimestamp = (gameId: number, timestamp: string) => {
    setGames((prev) =>
      prev.map((game) =>
        game.id === gameId ? { ...game, manualTimestamp: timestamp } : game
      )
    )
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  }

  const formatTimestamp = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    }
    return `${minutes}:${String(secs).padStart(2, "0")}`
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="gap-2 min-h-[48px] w-full">
          <Video className="h-5 w-5" />
          Add Video
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[95vw] max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Add Video to Games</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* YouTube URL */}
          <div className="flex flex-col gap-2">
            <label htmlFor="youtube-url" className="text-sm font-medium">
              YouTube URL
            </label>
            <Input
              id="youtube-url"
              type="url"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="min-h-[44px]"
            />
          </div>

          {/* Date */}
          <div className="flex flex-col gap-2">
            <label htmlFor="date" className="text-sm font-medium">
              Date
            </label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="min-h-[44px]"
            />
          </div>

          {/* Video Start Offset */}
          <div className="flex flex-col gap-2">
            <label htmlFor="video-start" className="text-sm font-medium">
              Video Start Time (seconds)
            </label>
            <Input
              id="video-start"
              type="number"
              value={videoStartOffset}
              onChange={(e) => setVideoStartOffset(e.target.value)}
              placeholder="0"
              className="min-h-[44px]"
            />
            <p className="text-xs text-muted-foreground">
              When in the video does the first game start? Can be negative if video started late.
            </p>
          </div>

          {/* Games List */}
          {isLoadingGames && (
            <div className="flex items-center justify-center py-8 gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm text-muted-foreground">Loading games...</span>
            </div>
          )}

          {gamesError && (
            <div className="text-sm text-amber-600 text-center bg-amber-50 border border-amber-200 rounded p-3">
              {gamesError}
            </div>
          )}

          {!isLoadingGames && games.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Games Found ({games.length})</h3>
                <p className="text-xs text-muted-foreground">Adjust timestamps as needed</p>
              </div>

              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                {games.map((game, index) => {
                  const hasExistingVideo = !!game.videoLink
                  const existingTimestamp = extractTimestampFromUrl(game.videoLink)

                  return (
                    <div
                      key={game.id}
                      className={`border rounded-lg p-3 space-y-2 ${
                        hasExistingVideo
                          ? "bg-green-50/50 border-green-200"
                          : "bg-secondary/30 border-secondary"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">Game {index + 1}</p>
                            {hasExistingVideo && (
                              <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded">
                                Has Video
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Start time: {formatTime(game.startDateTime)}
                          </p>
                          {hasExistingVideo && existingTimestamp !== null && (
                            <p className="text-xs text-green-700">
                              Current: {formatTimestamp(existingTimestamp)}
                            </p>
                          )}
                          {game.calculatedTimestamp !== parseInt(game.manualTimestamp) && (
                            <p className="text-xs text-blue-600">
                              Auto: {formatTimestamp(game.calculatedTimestamp)}
                            </p>
                          )}
                        </div>
                      <div className="flex flex-col gap-1 items-end">
                        <label className="text-xs font-medium">Timestamp (s)</label>
                        <Input
                          type="number"
                          value={game.manualTimestamp}
                          onChange={(e) => updateGameTimestamp(game.id, e.target.value)}
                          className="w-24 h-9 text-sm"
                          min="0"
                        />
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(parseInt(game.manualTimestamp) || 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <Button
            onClick={() => addVideoMutation.mutate()}
            disabled={addVideoMutation.isPending || !youtubeUrl || !date || games.length === 0}
            className="w-full"
            size="lg"
          >
            {addVideoMutation.isPending ? "Adding Video..." : "Add Video to Games"}
          </Button>

          {addVideoMutation.isError && (
            <div className="text-sm text-red-600 text-center bg-red-50 border border-red-200 rounded p-3">
              Error: {addVideoMutation.error instanceof Error ? addVideoMutation.error.message : "Unknown error"}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
