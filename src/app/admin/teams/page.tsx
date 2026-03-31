"use client"

import { useState, useEffect, useRef, useCallback, TouchEvent } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ChevronLeft, ChevronRight, Copy, Check, Shuffle, Users, X } from "lucide-react"
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  pointerWithin,
} from "@dnd-kit/core"
import {
  Player,
  PlayerLink,
  TeamLetter,
  getPlayerById,
  getHighestEloPlayerName,
} from "@/lib/team-utils"
import { TeamFormation, BenchRow, PlayerCard } from "@/components/teams"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

// ─── Daily selection helpers ──────────────────────────────────────────────────

const STORAGE_KEY = "futsalgg_daily_players"
const getTodayDate = () => new Date().toISOString().split("T")[0]

function loadDailySelection(): number[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const { date, playerIds } = JSON.parse(raw) as { date: string; playerIds: number[] }
    if (date !== getTodayDate()) return null
    return playerIds
  } catch {
    return null
  }
}

function saveDailySelection(playerIds: number[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: getTodayDate(), playerIds }))
}

function clearDailySelection() {
  localStorage.removeItem(STORAGE_KEY)
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface TeamsData {
  teamA: number[]
  teamB: number[]
  teamC: number[]
}

interface DraftLinks {
  captain1Token: string
  captain2Token: string
  captain3Token: string
}

interface LeaderboardEntry {
  id: number
  gamesPlayed: number
}

// ─── Select Players Modal ─────────────────────────────────────────────────────

function SelectPlayersModal({
  open,
  onClose,
  players,
  initialSelected,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  players: Player[]
  initialSelected: number[]
  onConfirm: (selectedIds: number[]) => void
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [gamesMap, setGamesMap] = useState<Map<number, number>>(new Map())

  useEffect(() => {
    if (!open) return
    setSelected(new Set(initialSelected))
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((data: LeaderboardEntry[]) =>
        setGamesMap(new Map(data.map((e) => [e.id, e.gamesPlayed])))
      )
      .catch(() => {})
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const sortedPlayers = [...players].sort((a, b) => {
    const gA = gamesMap.get(a.id) ?? 0
    const gB = gamesMap.get(b.id) ?? 0
    return gB - gA || b.elo - a.elo
  })

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-gray-100">
          <DialogTitle>Select Players</DialogTitle>
          <p className="text-sm text-gray-500 mt-1">
            Who is playing today?{" "}
            <span className={`font-semibold ${selected.size >= 6 ? "text-green-600" : "text-gray-700"}`}>
              {selected.size} selected
            </span>
            {selected.size < 6 && (
              <span className="text-gray-400"> · need at least 6 to enable Draft</span>
            )}
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
          {sortedPlayers.map((player) => {
            const isSelected = selected.has(player.id)
            const games = gamesMap.get(player.id) ?? 0
            return (
              <button
                key={player.id}
                onClick={() => toggle(player.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left
                  transition-all active:scale-95 ${
                  isSelected
                    ? "bg-black text-white border-black"
                    : "bg-white border-gray-200 hover:border-gray-400 cursor-pointer"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                    isSelected ? "border-white bg-white" : "border-gray-300"
                  }`}
                >
                  {isSelected && <div className="w-2.5 h-2.5 rounded-sm bg-black" />}
                </div>
                <span className="flex-1 font-semibold text-sm">
                  {player.name} {player.lastName}
                </span>
                <span className={`text-xs ${isSelected ? "text-gray-300" : "text-gray-400"}`}>
                  {games}g
                </span>
              </button>
            )
          })}
        </div>

        <DialogFooter className="px-5 py-4 border-t border-gray-100">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onConfirm(Array.from(selected))} disabled={selected.size === 0}>
            Confirm ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Draft Links Modal ────────────────────────────────────────────────────────

function DraftLinksModal({
  open,
  onClose,
  links,
}: {
  open: boolean
  onClose: () => void
  links: DraftLinks | null
}) {
  const [copied, setCopied] = useState<number | null>(null)

  const getUrl = (token: string) => `${window.location.origin}/draft/${token}`

  const copyToClipboard = async (token: string, index: number) => {
    try {
      await navigator.clipboard.writeText(getUrl(token))
      setCopied(index)
      setTimeout(() => setCopied(null), 2000)
    } catch { /* */ }
  }

  if (!links) return null

  const captainLinks = [
    { label: "Captain 1 (1st pick)", token: links.captain1Token, color: "text-blue-700 bg-blue-50 border-blue-200" },
    { label: "Captain 2 (2nd pick)", token: links.captain2Token, color: "text-red-700 bg-red-50 border-red-200" },
    { label: "Captain 3 (3rd pick)", token: links.captain3Token, color: "text-green-700 bg-green-50 border-green-200" },
  ]

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-gray-100">
          <DialogTitle>Draft Links Created</DialogTitle>
          <p className="text-sm text-gray-500 mt-1">
            Share each link with the corresponding captain. Snake order:{" "}
            <strong>1 → 2 → 3 → 3 → 2 → 1 → ...</strong>
          </p>
        </DialogHeader>
        <div className="px-5 py-4 space-y-3">
          {captainLinks.map((c, i) => (
            <div key={i} className={`rounded-lg border p-3 ${c.color}`}>
              <p className="text-xs font-semibold mb-2">{c.label}</p>
              <button
                onClick={() => copyToClipboard(c.token, i)}
                className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded hover:bg-black/10 transition-colors"
              >
                {copied === i ? (
                  <><Check className="w-3.5 h-3.5" /> Copied!</>
                ) : (
                  <><Copy className="w-3.5 h-3.5" /> Copy link</>
                )}
              </button>
            </div>
          ))}
        </div>
        <DialogFooter className="px-5 pb-5">
          <Button className="w-full" onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const POSITIONS_ORDER = ["GK", "DL", "DR", "FL", "FR"] as const

export default function ManageTeamsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [activeTeam, setActiveTeam] = useState<TeamLetter>("A")
  const [teamA, setTeamA] = useState<number[]>([])
  const [teamB, setTeamB] = useState<number[]>([])
  const [teamC, setTeamC] = useState<number[]>([])
  const [unassigned, setUnassigned] = useState<number[]>([])
  const [highlightedPlayer, setHighlightedPlayer] = useState<number | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

  // Tap-to-assign state
  const [pendingPlayerId, setPendingPlayerId] = useState<number | null>(null)
  const [pendingFromTeam, setPendingFromTeam] = useState<TeamLetter | "unassigned" | null>(null)

  // Daily player selection
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<number[]>([])
  const [selectModalOpen, setSelectModalOpen] = useState(false)

  // Draft
  const [draftLinksModalOpen, setDraftLinksModalOpen] = useState(false)
  const [draftLinks, setDraftLinks] = useState<DraftLinks | null>(null)
  const [isCreatingDraft, setIsCreatingDraft] = useState(false)

  const touchStartX = useRef<number>(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const teams: TeamLetter[] = ["A", "B", "C"]

  const mouseSensor = useSensor(MouseSensor, { activationConstraint: { distance: 8 } })
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  const sensors = useSensors(mouseSensor, touchSensor)

  const { data: allPlayers = [] } = useQuery<Player[]>({
    queryKey: ["players"],
    queryFn: async () => {
      const res = await fetch("/api/players")
      if (!res.ok) throw new Error("Failed to fetch players")
      return res.json().then((d) => d.players || [])
    },
  })

  const { data: teamsData } = useQuery<TeamsData>({
    queryKey: ["teams"],
    queryFn: async () => {
      const res = await fetch("/api/teams")
      if (!res.ok) throw new Error("Failed to fetch teams")
      return res.json()
    },
  })

  const { data: linksData } = useQuery<{ links: PlayerLink[] }>({
    queryKey: ["playerLinks"],
    queryFn: async () => {
      const res = await fetch("/api/player-links")
      if (!res.ok) throw new Error("Failed to fetch player links")
      return res.json()
    },
  })

  const links = linksData?.links || []

  // ── Daily reset ───────────────────────────────────────────────────────────
  useEffect(() => {
    const stored = loadDailySelection()
    if (stored === null) {
      clearDailySelection()
      fetch("/api/teams", { method: "DELETE" })
        .then(() => queryClient.invalidateQueries({ queryKey: ["teams"] }))
        .catch(() => {})
      setSelectedPlayerIds([])
    } else {
      setSelectedPlayerIds(stored)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync teams from DB ────────────────────────────────────────────────────
  useEffect(() => {
    if (!teamsData) return
    const allAssigned = [...teamsData.teamA, ...teamsData.teamB, ...teamsData.teamC]
    const playerPool = selectedPlayerIds.length > 0
      ? selectedPlayerIds
      : allPlayers.map((p) => p.id)
    setTeamA(teamsData.teamA)
    setTeamB(teamsData.teamB)
    setTeamC(teamsData.teamC)
    setUnassigned(playerPool.filter((id) => !allAssigned.includes(id)))
  }, [teamsData, allPlayers, selectedPlayerIds])

  // ── Save ──────────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamA, teamB, teamC }),
      })
      if (!res.ok) throw new Error("Failed to save teams")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] })
      router.back()
    },
  })

  // ── Team helpers ──────────────────────────────────────────────────────────
  const getTeam = useCallback((letter: TeamLetter): number[] => {
    if (letter === "A") return teamA
    if (letter === "B") return teamB
    return teamC
  }, [teamA, teamB, teamC])

  const setTeam = useCallback((
    letter: TeamLetter,
    value: number[] | ((prev: number[]) => number[])
  ) => {
    if (letter === "A") setTeamA(value)
    else if (letter === "B") setTeamB(value)
    else setTeamC(value)
  }, [])

  // ── Tap-to-assign ─────────────────────────────────────────────────────────
  const handleBenchTap = useCallback((playerId: number, fromTeam: string) => {
    setPendingPlayerId((prev) => (prev === playerId ? null : playerId))
    setPendingFromTeam(fromTeam as TeamLetter | "unassigned")
    setHighlightedPlayer(null)
  }, [])

  const handleSlotTap = useCallback((slotId: string, currentPlayerId: number | null) => {
    if (pendingPlayerId === null || pendingFromTeam === null) return

    const parts = slotId.split("-")
    const targetTeam = parts[0] as TeamLetter
    const targetPosition = parts[1]
    const targetPosIndex = POSITIONS_ORDER.indexOf(targetPosition as typeof POSITIONS_ORDER[number])
    if (targetPosIndex === -1) return

    // Remove pending player from source
    if (pendingFromTeam === "unassigned") {
      setUnassigned((prev) => prev.filter((id) => id !== pendingPlayerId))
    } else {
      setTeam(pendingFromTeam, (prev) => prev.map((id) => (id === pendingPlayerId ? 0 : id)))
    }

    // If slot was occupied, send that player to unassigned
    if (currentPlayerId && currentPlayerId !== pendingPlayerId) {
      setUnassigned((prev) => [...prev, currentPlayerId])
    }

    // Place pending player in the slot
    setTeam(targetTeam, (prev) => {
      const t = [...prev]
      while (t.length <= targetPosIndex) t.push(0)
      t[targetPosIndex] = pendingPlayerId
      return t
    })

    setPendingPlayerId(null)
    setPendingFromTeam(null)
  }, [pendingPlayerId, pendingFromTeam, setTeam])

  const handlePlayerTap = useCallback((playerId: number) => {
    setHighlightedPlayer((prev) => (prev === playerId ? null : playerId))
  }, [])

  const cancelPending = useCallback(() => {
    setPendingPlayerId(null)
    setPendingFromTeam(null)
  }, [])

  // ── Select players ────────────────────────────────────────────────────────
  const handleSelectConfirm = useCallback((ids: number[]) => {
    setSelectedPlayerIds(ids)
    saveDailySelection(ids)
    setSelectModalOpen(false)
  }, [])

  // ── Draft ─────────────────────────────────────────────────────────────────
  const handleDraft = useCallback(async () => {
    if (selectedPlayerIds.length < 6 || isCreatingDraft) return
    setIsCreatingDraft(true)
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerIds: selectedPlayerIds }),
      })
      if (!res.ok) {
        alert((await res.json()).error || "Failed to create draft")
        return
      }
      const data = await res.json()
      setDraftLinks(data)
      setDraftLinksModalOpen(true)
    } catch {
      alert("Failed to create draft")
    } finally {
      setIsCreatingDraft(false)
    }
  }, [selectedPlayerIds, isCreatingDraft])

  // ── Swipe ─────────────────────────────────────────────────────────────────
  const handleTouchStart = useCallback((e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }, [])

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    // Don't swipe if pending player is active (avoid accidental team change)
    if (pendingPlayerId !== null) return
    const diff = touchStartX.current - e.changedTouches[0].clientX
    const currentIndex = teams.indexOf(activeTeam)
    if (diff > 50 && currentIndex < teams.length - 1) setActiveTeam(teams[currentIndex + 1])
    else if (diff < -50 && currentIndex > 0) setActiveTeam(teams[currentIndex - 1])
  }, [pendingPlayerId, activeTeam, teams])

  // ── Drag ──────────────────────────────────────────────────────────────────
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
    setHighlightedPlayer(null)
    // Cancel any pending tap-to-assign when dragging starts
    setPendingPlayerId(null)
    setPendingFromTeam(null)
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    if (!over) return

    const activeIdStr = active.id as string
    const overIdStr = over.id as string
    if (activeIdStr === overIdStr) return

    let sourcePlayerId: number
    let sourceTeam: TeamLetter | "unassigned"
    let sourcePosition: string | null = null

    if (activeIdStr.startsWith("bench-")) {
      const parts = activeIdStr.split("-")
      sourcePlayerId = parseInt(parts[2])
      sourceTeam = parts[1] === "unassigned" ? "unassigned" : (parts[1] as TeamLetter)
    } else {
      const parts = activeIdStr.split("-")
      sourceTeam = parts[0] as TeamLetter
      sourcePosition = parts[1]
      const posIndex = POSITIONS_ORDER.indexOf(sourcePosition as typeof POSITIONS_ORDER[number])
      sourcePlayerId = getTeam(sourceTeam)[posIndex]
    }

    if (!sourcePlayerId) return

    if (overIdStr === "bench-unassigned") {
      if (sourcePosition) {
        const si = POSITIONS_ORDER.indexOf(sourcePosition as typeof POSITIONS_ORDER[number])
        setTeam(sourceTeam as TeamLetter, (prev) => {
          const t = [...prev]; t[si] = 0; return t
        })
        setUnassigned((prev) => [...prev, sourcePlayerId])
      }
      return
    }

    if (overIdStr.startsWith("bench-")) return

    const targetParts = overIdStr.split("-")
    const targetTeam = targetParts[0] as TeamLetter
    const targetPosition = targetParts[1]
    if (targetTeam !== activeTeam) return

    const targetPosIndex = POSITIONS_ORDER.indexOf(targetPosition as typeof POSITIONS_ORDER[number])
    if (targetPosIndex === -1) return

    const targetPlayerId = getTeam(targetTeam)[targetPosIndex] || null

    if (targetPlayerId) {
      if (sourcePosition && sourceTeam === targetTeam) {
        const si = POSITIONS_ORDER.indexOf(sourcePosition as typeof POSITIONS_ORDER[number])
        setTeam(targetTeam, (prev) => {
          const t = [...prev]; t[si] = targetPlayerId; t[targetPosIndex] = sourcePlayerId; return t
        })
      } else if (sourcePosition && sourceTeam !== targetTeam) {
        const si = POSITIONS_ORDER.indexOf(sourcePosition as typeof POSITIONS_ORDER[number])
        setTeam(sourceTeam as TeamLetter, (prev) => { const t = [...prev]; t[si] = targetPlayerId; return t })
        setTeam(targetTeam, (prev) => { const t = [...prev]; t[targetPosIndex] = sourcePlayerId; return t })
      } else if (sourceTeam === "unassigned") {
        setUnassigned((prev) => [...prev.filter((id) => id !== sourcePlayerId), targetPlayerId])
        setTeam(targetTeam, (prev) => { const t = [...prev]; t[targetPosIndex] = sourcePlayerId; return t })
      } else {
        setTeam(sourceTeam as TeamLetter, (prev) => prev.filter((id) => id !== sourcePlayerId))
        setTeam(targetTeam, (prev) => { const t = [...prev]; t[targetPosIndex] = sourcePlayerId; return t })
      }
    } else {
      if (sourcePosition) {
        const si = POSITIONS_ORDER.indexOf(sourcePosition as typeof POSITIONS_ORDER[number])
        if (sourceTeam === targetTeam) {
          setTeam(targetTeam, (prev) => {
            const t = [...prev]; t[si] = 0; t[targetPosIndex] = sourcePlayerId; return t
          })
        } else {
          setTeam(sourceTeam as TeamLetter, (prev) => { const t = [...prev]; t[si] = 0; return t })
          setTeam(targetTeam, (prev) => {
            const t = [...prev]
            while (t.length <= targetPosIndex) t.push(0)
            t[targetPosIndex] = sourcePlayerId; return t
          })
        }
      } else if (sourceTeam === "unassigned") {
        setUnassigned((prev) => prev.filter((id) => id !== sourcePlayerId))
        setTeam(targetTeam, (prev) => {
          const t = [...prev]
          while (t.length <= targetPosIndex) t.push(0)
          t[targetPosIndex] = sourcePlayerId; return t
        })
      } else {
        setTeam(sourceTeam as TeamLetter, (prev) => prev.filter((id) => id !== sourcePlayerId))
        setTeam(targetTeam, (prev) => {
          const t = [...prev]
          while (t.length <= targetPosIndex) t.push(0)
          t[targetPosIndex] = sourcePlayerId; return t
        })
      }
    }
  }, [activeTeam, getTeam, setTeam])

  // ── Derived ───────────────────────────────────────────────────────────────
  const getOtherTeams = () => teams.filter((t) => t !== activeTeam)
  const countValidPlayers = (team: number[]) => team.filter((id) => id > 0).length
  const activeTeamData = getTeam(activeTeam)
  const currentTeamIndex = teams.indexOf(activeTeam)
  const canGoLeft = currentTeamIndex > 0
  const canGoRight = currentTeamIndex < teams.length - 1
  const draftReady = selectedPlayerIds.length >= 6

  const pendingPlayer = pendingPlayerId ? getPlayerById(pendingPlayerId, allPlayers) : null

  const getDraggedPlayer = () => {
    if (!activeId) return null
    if (activeId.startsWith("bench-")) {
      return getPlayerById(parseInt(activeId.split("-")[2]), allPlayers)
    }
    const parts = activeId.split("-")
    const posIndex = POSITIONS_ORDER.indexOf(parts[1] as typeof POSITIONS_ORDER[number])
    const pid = getTeam(parts[0] as TeamLetter)[posIndex]
    return pid ? getPlayerById(pid, allPlayers) : null
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => router.back()}
              className="p-2 -ml-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors shrink-0"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <h1 className="text-lg font-bold text-gray-900 truncate">Manage Teams</h1>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectModalOpen(true)}
              className="flex items-center gap-1"
            >
              <Users className="w-3.5 h-3.5" />
              {selectedPlayerIds.length > 0 ? `Players (${selectedPlayerIds.length})` : "Players"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDraft}
              disabled={!draftReady || isCreatingDraft}
              className="flex items-center gap-1"
              title={!draftReady ? "Select at least 6 players to enable Draft" : ""}
            >
              <Shuffle className="w-3.5 h-3.5" />
              {isCreatingDraft ? "..." : "Draft"}
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={
                saveMutation.isPending ||
                countValidPlayers(teamA) !== 5 ||
                countValidPlayers(teamB) !== 5 ||
                countValidPlayers(teamC) !== 5
              }
              size="sm"
            >
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        collisionDetection={pointerWithin}
      >
        <div
          ref={containerRef}
          className="flex-1 flex flex-col overflow-hidden"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Team dots */}
          <div className="flex justify-center gap-2 py-2">
            {teams.map((team) => (
              <button
                key={team}
                onClick={() => setActiveTeam(team)}
                className={`h-2 rounded-full transition-all ${
                  activeTeam === team ? "bg-black w-4" : "bg-gray-300 w-2"
                }`}
              />
            ))}
          </div>

          {/* Formation + arrows */}
          <div className="flex-1 flex items-stretch relative">
            <button
              onClick={() => canGoLeft && setActiveTeam(teams[currentTeamIndex - 1])}
              className={`absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 transition-colors ${
                canGoLeft ? "text-gray-600 hover:text-black" : "text-gray-200"
              }`}
              disabled={!canGoLeft}
            >
              <ChevronLeft className="w-8 h-8" />
            </button>

            <div className="flex-1 px-2">
              <TeamFormation
                teamLetter={activeTeam}
                team={activeTeamData}
                allPlayers={allPlayers}
                links={links}
                highlightedPlayer={highlightedPlayer}
                hasPendingPlayer={pendingPlayerId !== null}
                onSlotTap={handleSlotTap}
                onPlayerTap={handlePlayerTap}
              />
            </div>

            <button
              onClick={() => canGoRight && setActiveTeam(teams[currentTeamIndex + 1])}
              className={`absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 transition-colors ${
                canGoRight ? "text-gray-600 hover:text-black" : "text-gray-200"
              }`}
              disabled={!canGoRight}
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          </div>

          {/* Bench */}
          <div className="bg-gray-50 border-t border-gray-200 px-3 py-2 space-y-1.5">
            {getOtherTeams().map((teamLetter) => {
              const team = getTeam(teamLetter)
              const teamName = getHighestEloPlayerName(team, allPlayers) || teamLetter
              return (
                <BenchRow
                  key={teamLetter}
                  title={`Team ${teamName}`}
                  playerIds={team.filter((id) => id > 0)}
                  allPlayers={allPlayers}
                  teamLetter={teamLetter}
                  pendingPlayerId={pendingPlayerId}
                  onBenchTap={handleBenchTap}
                />
              )
            })}
            <BenchRow
              title={
                selectedPlayerIds.length > 0
                  ? `Unassigned (${unassigned.length})`
                  : "Unassigned"
              }
              playerIds={unassigned}
              allPlayers={allPlayers}
              teamLetter="unassigned"
              isUnassigned
              pendingPlayerId={pendingPlayerId}
              onBenchTap={handleBenchTap}
            />
          </div>

          {/* Validation warning */}
          {(countValidPlayers(teamA) !== 5 ||
            countValidPlayers(teamB) !== 5 ||
            countValidPlayers(teamC) !== 5) && (
            <div className="bg-red-50 border-t border-red-200 px-4 py-2">
              <p className="text-red-600 text-xs text-center">
                Each team needs 5 players — A: {countValidPlayers(teamA)}, B:{" "}
                {countValidPlayers(teamB)}, C: {countValidPlayers(teamC)}
              </p>
            </div>
          )}
        </div>

        <DragOverlay>
          {activeId && getDraggedPlayer() && (
            <PlayerCard
              playerId={getDraggedPlayer()!.id}
              player={getDraggedPlayer()!}
              className="shadow-2xl scale-110"
            />
          )}
        </DragOverlay>
      </DndContext>

      {/* Pending-player banner */}
      {pendingPlayer && (
        <div className="fixed bottom-0 inset-x-0 z-30 bg-blue-600 text-white px-4 py-3 flex items-center justify-between shadow-lg">
          <p className="text-sm font-semibold">
            Tap a slot to place{" "}
            <span className="font-bold">
              {pendingPlayer.name} {pendingPlayer.lastName.charAt(0)}.
            </span>
          </p>
          <button
            onClick={cancelPending}
            className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Modals */}
      <SelectPlayersModal
        open={selectModalOpen}
        onClose={() => setSelectModalOpen(false)}
        players={allPlayers}
        initialSelected={selectedPlayerIds}
        onConfirm={handleSelectConfirm}
      />
      <DraftLinksModal
        open={draftLinksModalOpen}
        onClose={() => setDraftLinksModalOpen(false)}
        links={draftLinks}
      />
    </div>
  )
}
