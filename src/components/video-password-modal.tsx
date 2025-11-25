"use client"

import { useState } from "react"
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

interface VideoPasswordModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  videoLink: string
}

export function VideoPasswordModal({ isOpen, onClose, onSuccess, videoLink }: VideoPasswordModalProps) {
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isVerifying, setIsVerifying] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsVerifying(true)

    try {
      const response = await fetch("/api/auth/verify-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })

      if (response.ok) {
        setPassword("")
        onSuccess()
        window.open(videoLink, "_blank", "noopener,noreferrer")
        onClose()
      } else {
        setError("Invalid password")
      }
    } catch {
      setError("Failed to verify password")
    } finally {
      setIsVerifying(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setPassword("")
      setError("")
      onClose()
    }
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
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            {error && <div className="text-sm text-red-600 mt-2">{error}</div>}
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
