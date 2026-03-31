// Snake draft pick order for 3 captains (captains are auto-assigned to their teams)
// Generates picks in snake order: 0,1,2,2,1,0,0,1,2,2,1,0,...
export function generatePickOrder(totalPicks: number): number[] {
  const order: number[] = [];
  for (let i = 0; i < totalPicks; i++) {
    const round = Math.floor(i / 3);
    const posInRound = i % 3;
    // Snake: even rounds go 0,1,2; odd rounds go 2,1,0
    const captain = round % 2 === 0 ? posInRound : 2 - posInRound;
    order.push(captain);
  }
  return order;
}

// Calculate total picks needed (total players - 3 captains)
export function getTotalPicks(playerCount: number): number {
  return playerCount - 3;
}

// Legacy constants for backwards compatibility
export const PICK_ORDER = [0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0];
export const TOTAL_PICKS = 12;
