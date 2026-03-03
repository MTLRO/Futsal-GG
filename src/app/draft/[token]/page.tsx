"use client"

import { useEffect, useState, useCallback, use } from "react"
import { CheckCircle, Clock, Trophy, Users } from "lucide-react"
import { Button } from "@/components/ui/button"

import { PICK_ORDER } from "@/lib/draft-utils"

const CAPTAIN_COLORS = [
  { bg: "bg-blue-500", light: "bg-blue-100", text: "text-blue-700", border: "border-blue-300", label: "Team Blue" },
  { bg: "bg-red-500", light: "bg-red-100", text: "text-red-700", border: "border-red-300", label: "Team Red" },
  { bg: "bg-green-500", light: "bg-green-100", text: "text-green-700", border: "border-green-300", label: "Team Green" },
]

interface DraftPlayer {
  id: number
  name: string
  lastName: string
  elo: number
}

interface DraftState {
  captainIndex: number | null
  players: DraftPlayer[]
  picks: number[]
  currentPickIndex: number
  currentCaptain: number | null
  status: "ACTIVE" | "COMPLETED"
  captain1Token: string
  captain2Token: string
  captain3Token: string
}

export default function DraftPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [state, setState] = useState<DraftState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [justPicked, setJustPicked] = useState<number | null>(null)

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`/api/draft/${token}`)
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Draft not found")
        return
      }
      const data: DraftState = await res.json()
      setState(data)
    } catch {
      setError("Failed to load draft")
    }
  }, [token])

  useEffect(() => {
    fetchState()
  }, [fetchState])

  // Poll every 2.5s when it's not our turn (or session is active)
  useEffect(() => {
    if (!state || state.status === "COMPLETED") return
    if (state.currentCaptain === state.captainIndex) return // It's our turn, no need to poll

    const interval = setInterval(fetchState, 2500)
    return () => clearInterval(interval)
  }, [state, fetchState])

  const handlePick = async (playerId: number) => {
    if (!state || picking) return
    setPicking(true)
    try {
      const res = await fetch(`/api/draft/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Failed to pick")
        return
      }
      setJustPicked(playerId)
      setTimeout(() => setJustPicked(null), 1000)
      await fetchState()
    } catch {
      setError("Failed to pick player")
    } finally {
      setPicking(false)
    }
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-4xl mb-4">❌</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Draft Not Found</h1>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (!state) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <Clock className="w-5 h-5 animate-spin" />
          <span>Loading draft...</span>
        </div>
      </div>
    )
  }

  const { captainIndex, players, picks, currentPickIndex, currentCaptain, status } = state
  const isMyTurn = captainIndex !== null && currentCaptain === captainIndex && status === "ACTIVE"
  const isObserver = captainIndex === null
  const pickedSet = new Set(picks)

  // Build teams from picks
  const teams: number[][] = [[], [], []]
  for (let i = 0; i < picks.length; i++) {
    teams[PICK_ORDER[i]].push(picks[i])
  }

  const getPlayerById = (id: number) => players.find((p) => p.id === id)

  const captainLabel = captainIndex !== null
    ? CAPTAIN_COLORS[captainIndex].label
    : "Observer"

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Snake Draft</h1>
            {!isObserver && captainIndex !== null && (
              <p className={`text-xs font-semibold ${CAPTAIN_COLORS[captainIndex].text}`}>
                You are {captainLabel}
              </p>
            )}
          </div>
          <div className="text-right">
            {status === "COMPLETED" ? (
              <span className="inline-flex items-center gap-1 text-green-600 text-sm font-semibold">
                <CheckCircle className="w-4 h-4" /> Complete
              </span>
            ) : (
              <span className="text-sm text-gray-500">Pick {currentPickIndex + 1} / 15</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Turn banner */}
        {status === "ACTIVE" && (
          <div
            className={`px-4 py-2 text-center text-sm font-semibold ${
              isMyTurn
                ? `${captainIndex !== null ? CAPTAIN_COLORS[captainIndex].bg : "bg-gray-500"} text-white`
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {isMyTurn
              ? "Your turn — tap a player to pick"
              : `Waiting for ${currentCaptain !== null ? CAPTAIN_COLORS[currentCaptain].label : ""} to pick...`}
          </div>
        )}

        {status === "COMPLETED" && (
          <div className="bg-green-50 border-b border-green-200 px-4 py-3 text-center">
            <Trophy className="w-5 h-5 text-green-600 inline mr-2" />
            <span className="text-green-700 font-semibold text-sm">
              Draft complete! Teams have been saved.
            </span>
          </div>
        )}

        {/* Player list */}
        <div className="px-4 py-3 space-y-2">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Players (ELO ranked)
          </h2>
          {players.map((player, rank) => {
            const isPicked = pickedSet.has(player.id)
            const pickNumber = picks.indexOf(player.id)
            const pickedByCaptain = pickNumber >= 0 ? PICK_ORDER[pickNumber] : null
            const isJustPicked = justPicked === player.id
            const canPick = isMyTurn && !isPicked && !picking

            return (
              <button
                key={player.id}
                onClick={() => canPick && handlePick(player.id)}
                disabled={!canPick}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left ${
                  isJustPicked
                    ? "scale-95 opacity-70"
                    : isPicked
                    ? `${pickedByCaptain !== null ? CAPTAIN_COLORS[pickedByCaptain].light : "bg-gray-100"} ${
                        pickedByCaptain !== null ? CAPTAIN_COLORS[pickedByCaptain].border : "border-gray-200"
                      } opacity-70`
                    : canPick
                    ? "bg-white border-gray-200 hover:border-blue-400 hover:bg-blue-50 active:scale-95 cursor-pointer shadow-sm"
                    : "bg-white border-gray-200 cursor-default"
                }`}
              >
                {/* Rank badge */}
                <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center shrink-0">
                  {rank + 1}
                </span>

                {/* Player info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold text-sm truncate ${isPicked ? "line-through opacity-60" : "text-gray-900"}`}>
                      {player.name} {player.lastName}
                    </span>
                    {canPick && (
                      <span className="text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded font-semibold shrink-0">
                        PICK
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">{player.elo} ELO</span>
                </div>

                {/* Pick indicator */}
                {isPicked && pickedByCaptain !== null && (
                  <div className={`shrink-0 flex items-center gap-1 ${CAPTAIN_COLORS[pickedByCaptain].text}`}>
                    <div className={`w-2.5 h-2.5 rounded-full ${CAPTAIN_COLORS[pickedByCaptain].bg}`} />
                    <span className="text-xs font-semibold">#{pickNumber + 1}</span>
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Teams summary */}
        <div className="px-4 py-3 border-t border-gray-200 bg-white">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1">
            <Users className="w-3.5 h-3.5" /> Current Teams
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {teams.map((team, ci) => (
              <div
                key={ci}
                className={`rounded-lg border p-2 ${CAPTAIN_COLORS[ci].light} ${CAPTAIN_COLORS[ci].border}`}
              >
                <div className={`text-xs font-bold ${CAPTAIN_COLORS[ci].text} mb-1.5`}>
                  {CAPTAIN_COLORS[ci].label}
                </div>
                {team.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No picks yet</p>
                ) : (
                  <ul className="space-y-0.5">
                    {team.map((pid, i) => {
                      const p = getPlayerById(pid)
                      return (
                        <li key={pid} className="text-xs text-gray-700 truncate">
                          <span className="text-gray-400 mr-1">#{i + 1}</span>
                          {p ? `${p.name} ${p.lastName.charAt(0)}.` : "—"}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Pick history */}
        {picks.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-200">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Pick History
            </h2>
            <div className="space-y-1">
              {picks.map((pid, i) => {
                const cap = PICK_ORDER[i]
                const player = getPlayerById(pid)
                return (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400 text-xs w-5 text-right">#{i + 1}</span>
                    <div className={`w-2 h-2 rounded-full ${CAPTAIN_COLORS[cap].bg}`} />
                    <span className={`text-xs font-semibold w-16 ${CAPTAIN_COLORS[cap].text}`}>
                      {CAPTAIN_COLORS[cap].label.replace("Team ", "")}
                    </span>
                    <span className="text-gray-700 text-xs">
                      {player ? `${player.name} ${player.lastName}` : "—"}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Waiting spinner */}
      {status === "ACTIVE" && !isMyTurn && (
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-center gap-2 text-sm text-gray-500">
          <Clock className="w-4 h-4 animate-pulse" />
          <span>
            Waiting for {currentCaptain !== null ? CAPTAIN_COLORS[currentCaptain].label : "next captain"}...
          </span>
        </div>
      )}

      {/* Complete CTA */}
      {status === "COMPLETED" && (
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3">
          <Button
            className="w-full"
            onClick={() => window.close()}
          >
            Close Draft
          </Button>
        </div>
      )}
    </div>
  )
}
