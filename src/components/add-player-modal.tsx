"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { UserPlus } from "lucide-react"

interface AddPlayerModalProps {
  onPlayerAdded: () => void
}

export function AddPlayerModal({ onPlayerAdded }: AddPlayerModalProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    name: "",
    lastName: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      if (!formData.name.trim() || !formData.lastName.trim()) {
        setError("Please fill in all fields")
        return
      }

      const response = await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          lastName: formData.lastName.trim(),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to add player")
      }

      setFormData({ name: "", lastName: "" })
      setOpen(false)
      onPlayerAdded()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="gap-2 min-h-[48px] w-full">
          <UserPlus className="h-5 w-5" />
          Add Player
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Player</DialogTitle>
          <DialogDescription>
            Create a new player to the leaderboard. Players start with 1500 ELO.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="text-sm font-medium mb-1 block">
              First Name
            </label>
            <Input
              id="name"
              placeholder="John"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={loading}
            />
          </div>
          <div>
            <label htmlFor="lastName" className="text-sm font-medium mb-1 block">
              Last Name
            </label>
            <Input
              id="lastName"
              placeholder="Doe"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              disabled={loading}
            />
          </div>
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Adding..." : "Add Player"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
