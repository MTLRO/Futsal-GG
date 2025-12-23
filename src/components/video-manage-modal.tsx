"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useAdmin } from "@/contexts/admin-context"
import { useMutation, useQueryClient } from "@tanstack/react-query"

interface Player {
  playerId: number
  name: string
  lastName: string
  goals: number
  goalTimestamps?: (number | null)[]
}

interface VideoManageModalProps {
  isOpen: boolean
  onClose: () => void
  videoLink: string | null
  videoTimestamp: number | null
  gameId: number
  team1Players: Player[]
  team2Players: Player[]
}

// Helper functions to convert between seconds and mm:ss format
function secondsToMMSS(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return ""
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function mmssToSeconds(mmss: string): number | null {
  if (!mmss || mmss.trim() === "") return null
  const parts = mmss.split(':')
  if (parts.length !== 2) return null
  const mins = parseInt(parts[0], 10)
  const secs = parseInt(parts[1], 10)
  if (isNaN(mins) || isNaN(secs)) return null
  return mins * 60 + secs
}

// Extract timestamp from YouTube URL
function extractTimestampFromYouTubeURL(url: string): number | null {
  if (!url) return null
  try {
    const urlObj = new URL(url)
    const tParam = urlObj.searchParams.get('t')
    if (tParam) {
      const seconds = parseInt(tParam, 10)
      return isNaN(seconds) ? null : seconds
    }
  } catch {
    // Invalid URL
  }
  return null
}

export function VideoManageModal({
  isOpen,
  onClose,
  videoLink,
  videoTimestamp,
  gameId,
  team1Players,
  team2Players,
}: VideoManageModalProps) {
  const { isAuthenticated } = useAdmin()
  const queryClient = useQueryClient()

  // Password verification state (non-admin)
  const [password, setPassword] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [isVerifying, setIsVerifying] = useState(false)

  // Admin edit state
  const [editVideoLink, setEditVideoLink] = useState(videoLink || "")
  const [editVideoTimestamp, setEditVideoTimestamp] = useState(secondsToMMSS(videoTimestamp))
  const [playerGoalTimestamps, setPlayerGoalTimestamps] = useState<Map<number, string[]>>(new Map())
  const [saveError, setSaveError] = useState("")

  // Initialize player goal timestamps
  useEffect(() => {
    if (isAuthenticated && isOpen) {
      const timestampMap = new Map<number, string[]>()

      // Add team 1 players
      team1Players.forEach(player => {
        if (player.goals > 0) {
          const timestamps = player.goalTimestamps || Array(player.goals).fill(null)
          timestampMap.set(
            player.playerId,
            timestamps.map(t => secondsToMMSS(t))
          )
        }
      })

      // Add team 2 players
      team2Players.forEach(player => {
        if (player.goals > 0) {
          const timestamps = player.goalTimestamps || Array(player.goals).fill(null)
          timestampMap.set(
            player.playerId,
            timestamps.map(t => secondsToMMSS(t))
          )
        }
      })

      setPlayerGoalTimestamps(timestampMap)
    }
  }, [isAuthenticated, isOpen, team1Players, team2Players])

  // Reset video link and timestamp when modal opens
  useEffect(() => {
    if (isOpen) {
      setEditVideoLink(videoLink || "")

      // If videoTimestamp exists, use it; otherwise try to extract from URL
      if (videoTimestamp !== null) {
        setEditVideoTimestamp(secondsToMMSS(videoTimestamp))
      } else if (videoLink) {
        const extractedTimestamp = extractTimestampFromYouTubeURL(videoLink)
        setEditVideoTimestamp(secondsToMMSS(extractedTimestamp))
      } else {
        setEditVideoTimestamp("")
      }
    }
  }, [isOpen, videoLink, videoTimestamp])

  const updateVideoMutation = useMutation({
    mutationFn: async (data: { videoLink: string; videoTimestamp: number | null }) => {
      const response = await fetch(`/api/games/${gameId}/video`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!response.ok) throw new Error("Failed to update video")
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gameHistory"] })
    },
  })

  const updateGoalTimestampsMutation = useMutation({
    mutationFn: async (data: { playerId: number; goalTimestamps: (number | null)[] }) => {
      const response = await fetch(`/api/games/${gameId}/goals`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!response.ok) throw new Error("Failed to update goal timestamps")
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gameHistory"] })
    },
  })

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError("")
    setIsVerifying(true)

    try {
      const response = await fetch("/api/auth/verify-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })

      if (response.ok) {
        setPassword("")
        if (videoLink) {
          window.open(videoLink, "_blank", "noopener,noreferrer")
        }
        onClose()
      } else {
        setPasswordError("Invalid password")
      }
    } catch {
      setPasswordError("Failed to verify password")
    } finally {
      setIsVerifying(false)
    }
  }

  const handleAdminSave = async () => {
    setSaveError("")

    try {
      // Update video link and timestamp
      const videoTimestampSeconds = mmssToSeconds(editVideoTimestamp)
      await updateVideoMutation.mutateAsync({
        videoLink: editVideoLink || "",
        videoTimestamp: videoTimestampSeconds,
      })

      // Update goal timestamps for all players
      const allPlayers = [...team1Players, ...team2Players]
      for (const player of allPlayers) {
        if (player.goals > 0) {
          const timestamps = playerGoalTimestamps.get(player.playerId) || []
          const timestampsInSeconds = timestamps.map(t => mmssToSeconds(t))
          await updateGoalTimestampsMutation.mutateAsync({
            playerId: player.playerId,
            goalTimestamps: timestampsInSeconds,
          })
        }
      }

      onClose()
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save")
    }
  }

  const handleWatchVideo = () => {
    if (videoLink) {
      window.open(videoLink, "_blank", "noopener,noreferrer")
    }
  }

  const handleGoalTimestampChange = (playerId: number, goalIndex: number, value: string) => {
    setPlayerGoalTimestamps(prev => {
      const newMap = new Map(prev)
      const timestamps = [...(newMap.get(playerId) || [])]
      timestamps[goalIndex] = value
      newMap.set(playerId, timestamps)
      return newMap
    })
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setPassword("")
      setPasswordError("")
      setSaveError("")
      onClose()
    }
  }

  const renderPlayerGoalInputs = (players: Player[], teamName: string) => {
    const playersWithGoals = players.filter(p => p.goals > 0)
    if (playersWithGoals.length === 0) return null

    return (
      <div className="space-y-3">
        <h4 className="font-semibold text-sm">Team {teamName} Goals</h4>
        {playersWithGoals.map(player => {
          const timestamps = playerGoalTimestamps.get(player.playerId) || []
          return (
            <div key={player.playerId} className="space-y-2">
              <div className="text-sm font-medium">
                {player.name} {player.lastName} ({player.goals} goal{player.goals > 1 ? 's' : ''})
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: player.goals }).map((_, idx) => (
                  <Input
                    key={idx}
                    type="text"
                    placeholder="mm:ss"
                    value={timestamps[idx] || ""}
                    onChange={(e) => handleGoalTimestampChange(player.playerId, idx, e.target.value)}
                    className="font-mono"
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // If not authenticated, show password prompt
  if (!isAuthenticated) {
    if (!videoLink) {
      return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>No Video</DialogTitle>
              <DialogDescription>
                This game does not have a video link.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )
    }

    return (
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Video Access</DialogTitle>
            <DialogDescription>
              Enter the video password to watch this game
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <Input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
              {passwordError && <div className="text-sm text-red-600 mt-2">{passwordError}</div>}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isVerifying}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isVerifying || !password}>
                {isVerifying ? "Verifying..." : "Watch Video"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    )
  }

  // Admin view - editable fields
  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Game Video</DialogTitle>
          <DialogDescription>
            Edit video link, timestamp, and goal timestamps
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {/* Video URL */}
          <div className="space-y-2">
            <div className="text-sm font-medium">YouTube URL</div>
            <Input
              id="video-url"
              type="text"
              placeholder="https://youtube.com/watch?v=..."
              value={editVideoLink}
              onChange={(e) => {
                const newUrl = e.target.value
                setEditVideoLink(newUrl)

                // Auto-fill timestamp from URL if not already set
                if (newUrl && !editVideoTimestamp) {
                  const extractedTimestamp = extractTimestampFromYouTubeURL(newUrl)
                  if (extractedTimestamp !== null) {
                    setEditVideoTimestamp(secondsToMMSS(extractedTimestamp))
                  }
                }
              }}
            />
          </div>

          {/* Video Start Timestamp */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Video Start Timestamp (mm:ss)</div>
            <Input
              id="video-timestamp"
              type="text"
              placeholder="00:00"
              value={editVideoTimestamp}
              onChange={(e) => setEditVideoTimestamp(e.target.value)}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              The timestamp in the video where this game starts
            </p>
          </div>

          {/* Goal Timestamps */}
          {renderPlayerGoalInputs(team1Players, team1Players[0]?.name || "1")}
          {renderPlayerGoalInputs(team2Players, team2Players[0]?.name || "2")}

          {saveError && (
            <div className="text-sm text-red-600">{saveError}</div>
          )}
        </div>
        <DialogFooter>
          {videoLink && (
            <Button
              type="button"
              variant="outline"
              onClick={handleWatchVideo}
            >
              Watch Video
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAdminSave}
            disabled={updateVideoMutation.isPending || updateGoalTimestampsMutation.isPending}
          >
            {updateVideoMutation.isPending || updateGoalTimestampsMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
