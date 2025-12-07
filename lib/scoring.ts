/**
 * Modified Borda Count scoring system with top-heavy weighting
 *
 * Positions 1-10: Each rank = 5 points apart (1st=500, 10th=455)
 * Positions 11-30: Each rank = 2 points apart
 * Positions 31-50+: Each rank = 1 point apart
 */
export function calculateScore(position: number): number {
  if (position <= 10) {
    // Top 10: 5 points per position
    return 500 - ((position - 1) * 5);
  } else if (position <= 30) {
    // Positions 11-30: 2 points per position
    const baseScore = 455; // Score at position 10
    return baseScore - ((position - 10) * 2);
  } else {
    // Positions 31+: 1 point per position
    const baseScore = 415; // Score at position 30
    return baseScore - ((position - 30) * 1);
  }
}

export interface RankedBand {
  id: string;
  name: string;
  position: number;
  score: number;
}

export function scoreRankings(bandIds: string[], bandNames: Map<string, string>): RankedBand[] {
  return bandIds.map((id, index) => ({
    id,
    name: bandNames.get(id) || '',
    position: index + 1,
    score: calculateScore(index + 1),
  }));
}

export function aggregateScores(allRankings: RankedBand[][]): RankedBand[] {
  const scoreMap = new Map<string, { name: string; totalScore: number }>();

  // Aggregate scores from all rankings
  allRankings.forEach(ranking => {
    ranking.forEach(band => {
      const current = scoreMap.get(band.id);
      if (current) {
        current.totalScore += band.score;
      } else {
        scoreMap.set(band.id, {
          name: band.name,
          totalScore: band.score,
        });
      }
    });
  });

  // Convert to array and sort by total score
  const results = Array.from(scoreMap.entries()).map(([id, data]) => ({
    id,
    name: data.name,
    position: 0, // Will be set after sorting
    score: data.totalScore,
  }));

  results.sort((a, b) => b.score - a.score);

  // Set final positions
  results.forEach((band, index) => {
    band.position = index + 1;
  });

  return results;
}
