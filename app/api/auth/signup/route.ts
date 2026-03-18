import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { hashPassword, createAuthSession, setAuthCookie, User } from '@/lib/auth';
import { VotingSession } from '@/lib/types';
import { BILLBOARD_BANDS } from '@/lib/bands';

export async function POST(request: NextRequest) {
  try {
    const { email, password, displayName, secretCode } = await request.json();

    // Validate required fields
    if (!email || !password || !displayName || !secretCode) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Validate secret code
    const expectedSecret = process.env.SIGNUP_SECRET;
    if (!expectedSecret) {
      return NextResponse.json(
        { error: 'Sign-up is not configured' },
        { status: 500 }
      );
    }
    if (secretCode !== expectedSecret) {
      return NextResponse.json(
        { error: 'Invalid secret code. Ask the organizer for the code.' },
        { status: 403 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Validate display name
    const trimmedName = displayName.trim();
    if (trimmedName.length < 2) {
      return NextResponse.json(
        { error: 'Display name must be at least 2 characters' },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    const users = db.collection<User>('users');

    // Ensure unique indexes
    await users.createIndex({ email: 1 }, { unique: true });
    await users.createIndex({ displayName: 1 }, { unique: true });

    const normalizedEmail = email.toLowerCase().trim();

    // Check for existing email
    const existingEmail = await users.findOne({ email: normalizedEmail });
    if (existingEmail) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    // Check for existing display name
    const existingName = await users.findOne({
      displayName: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    });
    if (existingName) {
      return NextResponse.json(
        { error: 'This display name is already taken' },
        { status: 409 }
      );
    }

    // Create user
    const passwordHash = await hashPassword(password);
    const now = new Date();
    const user: User = {
      email: normalizedEmail,
      passwordHash,
      displayName: trimmedName,
      isAdmin: false,
      createdAt: now,
      updatedAt: now,
    };

    const result = await users.insertOne(user as any);
    user._id = result.insertedId;

    // Create voting session for the new user
    const sessions = db.collection<VotingSession>('sessions');
    const newSession: VotingSession = {
      sessionName: trimmedName,
      currentRound: 'round1',
      isAdmin: false,
      round1Bands: [...BILLBOARD_BANDS],
      round2MissingBands: [],
      round3Votes: [],
      allBands: [],
      knockedOutBands: [],
      finalRankings: [],
      createdAt: now,
      updatedAt: now,
      completed: false,
    };
    await sessions.insertOne(newSession as any);

    // Create auth session and set cookie
    const token = await createAuthSession(user);
    const response = NextResponse.json({
      success: true,
      user: {
        email: user.email,
        displayName: user.displayName,
        isAdmin: user.isAdmin,
      },
    });
    setAuthCookie(response, token);

    return response;
  } catch (error: any) {
    // Handle MongoDB duplicate key errors
    if (error?.code === 11000) {
      const field = error.message?.includes('email') ? 'email' : 'display name';
      return NextResponse.json(
        { error: `This ${field} is already taken` },
        { status: 409 }
      );
    }
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    );
  }
}
