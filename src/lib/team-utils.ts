// Team management utility functions

export interface Player {
  id: number
  name: string
  lastName: string
  elo: number
}

export interface PlayerLink {
  player1Id: number
  player2Id: number
  wins: number
  losses: number
  draws: number
  totalGames: number
  synergy: number
}

export type TeamLetter = "A" | "B" | "C"

// Chemistry constants (from EloParameters)
const CHEMISTRY_MIN_COEFFICIENT = 0.65
const CHEMISTRY_MAX_COEFFICIENT = 1.45
const CHEMISTRY_NEUTRAL = 0.45
const GAMES_FOR_FULL_CONFIDENCE = 10

export function getPlayerById(playerId: number, allPlayers: Player[]): Player | undefined {
  return allPlayers.find((p) => p.id === playerId)
}

export function calculateAverageElo(playerIds: number[], allPlayers: Player[]): number {
  if (playerIds.length === 0) return 0
  const totalElo = playerIds.reduce((sum, playerId) => {
    const player = allPlayers.find((p) => p.id === playerId)
    return sum + (player?.elo || 1500)
  }, 0)
  return Math.round(totalElo / playerIds.length)
}

export function getSynergy(p1Id: number, p2Id: number, links: PlayerLink[]): number | null {
  const [minId, maxId] = p1Id < p2Id ? [p1Id, p2Id] : [p2Id, p1Id]
  const link = links.find((l) => l.player1Id === minId && l.player2Id === maxId)
  return link ? link.synergy : null
}

export function synergyToColor(synergy: number | null, opacity: number = 1): string {
  if (synergy === null) return `rgba(150, 150, 150, ${opacity * 0.5})`

  const s = Math.max(0, Math.min(1, synergy))

  let r: number, g: number, b: number
  if (s < 0.5) {
    r = 220
    g = Math.round(50 + s * 2 * 150)
    b = 50
  } else {
    r = Math.round(220 - (s - 0.5) * 2 * 170)
    g = Math.round(200 - (s - 0.5) * 2 * 20)
    b = 50
  }

  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}

export function getChemistryCoefficient(
  playerId: number,
  teammateIds: number[],
  links: PlayerLink[]
): number {
  if (teammateIds.length === 0) return 1.0

  let totalChemistry = 0
  let teammateCount = 0

  for (const teammateId of teammateIds) {
    const synergy = getSynergy(playerId, teammateId, links)
    const link = links.find((l) => {
      const [minId, maxId] = playerId < teammateId ? [playerId, teammateId] : [teammateId, playerId]
      return l.player1Id === minId && l.player2Id === maxId
    })

    const totalGames = link ? link.totalGames : 0

    let chemistry: number
    if (totalGames === 0) {
      chemistry = CHEMISTRY_NEUTRAL
    } else {
      const winRate = synergy ?? 0.5
      const confidence = Math.min(1, totalGames / GAMES_FOR_FULL_CONFIDENCE)
      chemistry = confidence * winRate + (1 - confidence) * CHEMISTRY_NEUTRAL
    }

    totalChemistry += chemistry
    teammateCount++
  }

  const avgChemistry = teammateCount > 0 ? totalChemistry / teammateCount : 0.5
  const coefficientRange = CHEMISTRY_MAX_COEFFICIENT - CHEMISTRY_MIN_COEFFICIENT
  const chemistryCoefficient = CHEMISTRY_MIN_COEFFICIENT + coefficientRange * avgChemistry

  return chemistryCoefficient
}

export function calculateChemistryAdjustedElo(
  playerIds: number[],
  allPlayers: Player[],
  links: PlayerLink[]
): { avgElo: number; staticAvgElo: number; chemistryDelta: number } {
  if (playerIds.length === 0) return { avgElo: 0, staticAvgElo: 0, chemistryDelta: 0 }

  const staticAvgElo = calculateAverageElo(playerIds, allPlayers)

  const totalChemistryAdjustedElo = playerIds.reduce((sum, playerId) => {
    const player = allPlayers.find((p) => p.id === playerId)
    const staticElo = player?.elo || 1500
    const teammateIds = playerIds.filter((id) => id !== playerId)
    const chemistryCoefficient = getChemistryCoefficient(playerId, teammateIds, links)
    const chemistryAdjustedElo = staticElo * chemistryCoefficient
    return sum + chemistryAdjustedElo
  }, 0)

  const avgChemistryAdjustedElo = Math.round(totalChemistryAdjustedElo / playerIds.length)
  const chemistryDelta = avgChemistryAdjustedElo - staticAvgElo

  return {
    avgElo: avgChemistryAdjustedElo,
    staticAvgElo,
    chemistryDelta,
  }
}

export function getHighestEloPlayerName(playerIds: number[], allPlayers: Player[]): string | null {
  if (playerIds.length === 0) return null
  let highestEloPlayer: Player | null = null
  let highestElo = -1
  for (const playerId of playerIds) {
    const player = allPlayers.find((p) => p.id === playerId)
    if (player && player.elo > highestElo) {
      highestElo = player.elo
      highestEloPlayer = player
    }
  }
  return highestEloPlayer ? highestEloPlayer.name : null
}
