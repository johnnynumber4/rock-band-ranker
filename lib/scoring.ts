/**
 * Simple linear scoring: 1st = 50 pts, 2nd = 49, ... 50th = 1
 */
export function calculateScore(position: number): number {
  return Math.max(51 - position, 1);
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
