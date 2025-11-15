"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Video } from "lucide-react"

export function AddVideoModal() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [youtubeUrl, setYoutubeUrl] = useState("")
  const [date, setDate] = useState("")
  const [videoStartOffset, setVideoStartOffset] = useState("0")

  const addVideoMutation = useMutation({
    mutationFn: async () => {
      if (!youtubeUrl || !date) {
        throw new Error("YouTube URL and date are required")
      }

      const res = await fetch("/api/games/add-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          youtubeUrl,
          date,
          videoStartOffset: parseInt(videoStartOffset) || 0,
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

      // Show success message with count
      alert(`Successfully added video to ${data.gamesUpdated} game(s)!`)
    },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="gap-2 min-h-[48px] w-full">
          <Video className="h-5 w-5" />
          Add Video
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[95vw] max-w-[500px]">
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
            <p className="text-xs text-muted-foreground">
              Enter the full YouTube URL for the video
            </p>
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
            <p className="text-xs text-muted-foreground">
              Select the date when the games were played
            </p>
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
              When in the video does the first game start? Use negative numbers if the video started after the game (e.g., -30 if video started 30 seconds late)
            </p>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-900">
              <strong>How it works:</strong> This will add the YouTube URL to all games on the selected date.
              The first game gets the video at the offset you specify. Each subsequent game gets a timestamped
              link based on when it started (calculated from previous games' durations).
            </p>
          </div>

          {/* Submit Button */}
          <Button
            onClick={() => addVideoMutation.mutate()}
            disabled={addVideoMutation.isPending || !youtubeUrl || !date}
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
