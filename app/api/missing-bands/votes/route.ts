import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { MissingBandVote, CollaborativeRanking } from '@/lib/types';
import { calculateScore } from '@/lib/scoring';

// GET - Get collaborative rankings for missing bands
export async function GET() {
  try {
    const db = await getDatabase();
    const votesCollection = db.collection('missing_band_votes');
    const missingBandsCollection = db.collection('missing_bands');

    // Get all votes
    const votes = await votesCollection.find({}).toArray();
    const missingBands = await missingBandsCollection.find({}).toArray();

    // Group votes by band and calculate collaborative ranking
    const votesByBand = new Map<string, MissingBandVote[]>();
    votes.forEach((vote: any) => {
      if (!votesByBand.has(vote.bandId)) {
        votesByBand.set(vote.bandId, []);
      }
      votesByBand.get(vote.bandId)!.push(vote as MissingBandVote);
    });

    // Calculate collaborative rankings
    const rankings: CollaborativeRanking[] = [];
    votesByBand.forEach((bandVotes, bandId) => {
      const band = missingBands.find(b => b.id === bandId);
      if (!band) return;

      // Calculate total score using position-based scoring
      const totalScore = bandVotes.reduce((sum, vote) => {
        return sum + calculateScore(vote.rank);
      }, 0);

      const averageRank = bandVotes.reduce((sum, vote) => sum + vote.rank, 0) / bandVotes.length;

      rankings.push({
        bandId,
        bandName: band.name,
        totalScore,
        voteCount: bandVotes.length,
        averageRank,
        finalPosition: 0 // Will be set after sorting
      });
    });

    // Sort by total score and assign final positions
    rankings.sort((a, b) => b.totalScore - a.totalScore);
    rankings.forEach((ranking, index) => {
      ranking.finalPosition = index + 1;
    });

    // Update final ranks in missing_bands collection
    for (const ranking of rankings) {
      await missingBandsCollection.updateOne(
        { id: ranking.bandId },
        { $set: { finalRank: ranking.finalPosition } }
      );
    }

    return NextResponse.json({ rankings });
  } catch (error) {
    console.error('Collaborative rankings fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch collaborative rankings' },
      { status: 500 }
    );
  }
}

// POST - Submit user's votes for missing bands (Round 3)
export async function POST(request: NextRequest) {
  try {
    const { sessionName, votes } = await request.json();

    if (!sessionName || !Array.isArray(votes)) {
      return NextResponse.json(
        { error: 'Missing session name or votes' },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    const votesCollection = db.collection('missing_band_votes');

    // Remove existing votes from this session
    await votesCollection.deleteMany({ sessionName });

    // Insert new votes
    const newVotes: MissingBandVote[] = votes.map((vote, index) => ({
      sessionName,
      bandId: vote.bandId,
      rank: index + 1, // Position in the ranked list
      createdAt: new Date()
    }));

    await votesCollection.insertMany(newVotes as any);

    return NextResponse.json({
      success: true,
      votesSubmitted: newVotes.length
    });
  } catch (error) {
    console.error('Vote submission error:', error);
    return NextResponse.json(
      { error: 'Failed to submit votes' },
      { status: 500 }
    );
  }
}