import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { VotingSession } from '@/lib/types';
import { aggregateScores, RankedBand } from '@/lib/scoring';

export async function GET() {
  try {
    const db = await getDatabase();
    const sessions = db.collection<VotingSession>('sessions');

    // Get all completed sessions
    const completedSessions = await sessions
      .find({ completed: true })
      .toArray();

    if (completedSessions.length === 0) {
      return NextResponse.json({
        message: 'No completed sessions yet',
        aggregatedResults: [],
        sessionCount: 0,
      });
    }

    // Aggregate all rankings
    const allRankings: RankedBand[][] = completedSessions.map(
      (session) => session.finalRankings
    );

    const aggregatedResults = aggregateScores(allRankings);

    return NextResponse.json({
      aggregatedResults,
      sessionCount: completedSessions.length,
      sessions: completedSessions.map((s) => ({
        sessionName: s.sessionName,
        completedAt: s.updatedAt,
      })),
    });
  } catch (error) {
    console.error('Aggregation error:', error);
    return NextResponse.json(
      { error: 'Failed to aggregate results' },
      { status: 500 }
    );
  }
}
