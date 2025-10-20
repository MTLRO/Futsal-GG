"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"

type Session = {
  id: number
  date: string
  status: string
  gameLengthMinutes: number
  team1PlayerIds: number[]
  team2PlayerIds: number[]
  team3PlayerIds: number[]
  games: any[]
}

export default function GameMasterPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isNewSessionOpen, setIsNewSessionOpen] = useState(false)
  const [newSessionDate, setNewSessionDate] = useState("")
  const [newSessionGameLength, setNewSessionGameLength] = useState("7")

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })

      if (response.ok) {
        setIsAuthenticated(true)
        setPassword("")
      } else {
        setError("Invalid password")
      }
    } catch (err) {
      setError("Failed to verify password")
    }
  }

  const { data: sessions = [], isLoading } = useQuery<Session[]>({
    queryKey: ["sessions"],
    queryFn: async () => {
      const res = await fetch("/api/sessions")
      if (!res.ok) throw new Error("Failed to fetch sessions")
      return res.json()
    },
    enabled: isAuthenticated,
  })

  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: newSessionDate,
          gameLengthMinutes: parseInt(newSessionGameLength),
          autoBalance: true,
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to create session")
      }
      return res.json()
    },
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] })
      setIsNewSessionOpen(false)
      setNewSessionDate("")
      setNewSessionGameLength("7")
      router.push(`/game-master/session/${session.id}`)
    },
  })

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Game Master Access</CardTitle>
            <CardDescription>Enter the game master password to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <Input
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full"
                />
              </div>
              {error && (
                <div className="text-sm text-red-600">{error}</div>
              )}
              <Button type="submit" className="w-full">
                Unlock
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Game Master</h1>
          <Dialog open={isNewSessionOpen} onOpenChange={setIsNewSessionOpen}>
            <DialogTrigger asChild>
              <Button>New Session</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Session</DialogTitle>
                <DialogDescription>
                  Teams will be automatically balanced based on player ELO
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <label className="text-sm font-medium">Date & Time</label>
                  <Input
                    type="datetime-local"
                    value={newSessionDate}
                    onChange={(e) => setNewSessionDate(e.target.value)}
                    className="w-full mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Game Length (minutes)</label>
                  <Input
                    type="number"
                    value={newSessionGameLength}
                    onChange={(e) => setNewSessionGameLength(e.target.value)}
                    min="1"
                    className="w-full mt-1"
                  />
                </div>
                <Button
                  onClick={() => createSessionMutation.mutate()}
                  disabled={!newSessionDate || createSessionMutation.isPending}
                  className="w-full"
                >
                  {createSessionMutation.isPending ? "Creating..." : "Create Session"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="text-center py-12">Loading sessions...</div>
        ) : sessions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No sessions yet. Create your first session to get started.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => (
              <Card
                key={session.id}
                className="cursor-pointer hover:bg-accent transition-colors"
                onClick={() => router.push(`/game-master/session/${session.id}`)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>
                        {new Date(session.date).toLocaleDateString()} at{" "}
                        {new Date(session.date).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </CardTitle>
                      <CardDescription>
                        {session.gameLengthMinutes} minute games
                      </CardDescription>
                    </div>
                    <Badge
                      variant={
                        session.status === "COMPLETED"
                          ? "default"
                          : session.status === "IN_PROGRESS"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {session.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    {session.games.length} games played
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
