import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { VotingSession } from '@/lib/types';
import { BILLBOARD_BANDS } from '@/lib/bands';
import { getAuthFromRequest } from '@/lib/auth';

// Create new session or load existing
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { sessionName, action } = await request.json();

    if (!sessionName || sessionName.trim().length === 0) {
      return NextResponse.json(
        { error: 'Session name is required' },
        { status: 400 }
      );
    }

    // Verify user owns this session
    if (sessionName !== auth.displayName) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const db = await getDatabase();
    const sessions = db.collection<VotingSession>('sessions');

    if (action === 'load') {
      // Load existing session
      const session = await sessions.findOne({ sessionName });

      if (!session) {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ session });
    } else {
      // Create new session
      const existingSession = await sessions.findOne({ sessionName });

      if (existingSession) {
        return NextResponse.json(
          { error: 'Session name already exists. Please choose a different name or load your existing session.' },
          { status: 409 }
        );
      }

      const newSession: VotingSession = {
        sessionName,
        currentRound: 'round1',
        isAdmin: false,
        round1Bands: [...BILLBOARD_BANDS],
        round2MissingBands: [],
        round3Votes: [],
        allBands: [],
        knockedOutBands: [],
        finalRankings: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        completed: false,
      };

      const result = await sessions.insertOne(newSession as any);
      newSession._id = result.insertedId.toString();

      return NextResponse.json({ session: newSession });
    }
  } catch (error) {
    console.error('Session API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Save session progress
export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const sessionData: VotingSession = await request.json();

    if (!sessionData.sessionName) {
      return NextResponse.json(
        { error: 'Session name is required' },
        { status: 400 }
      );
    }

    // Verify user owns this session
    if (sessionData.sessionName !== auth.displayName) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const db = await getDatabase();
    const sessions = db.collection<VotingSession>('sessions');

    const updateData = {
      ...sessionData,
      updatedAt: new Date(),
    };

    // Remove _id from update data if it exists
    delete updateData._id;

    await sessions.updateOne(
      { sessionName: sessionData.sessionName },
      { $set: updateData },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Session save error:', error);
    return NextResponse.json(
      { error: 'Failed to save session' },
      { status: 500 }
    );
  }
}
