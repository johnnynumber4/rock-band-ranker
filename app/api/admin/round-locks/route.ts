import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { getAuthFromRequest } from '@/lib/auth';
import { RoundLocks } from '@/lib/types';

const DEFAULT_LOCKS: Omit<RoundLocks, '_id'> = {
  round1: false,
  round2: false,
  round3: false,
  round4: false,
  results: false,
  updatedAt: new Date(),
};

async function isAdminRequest(request: NextRequest): Promise<boolean> {
  // Check env-var super admin token
  const adminToken = request.cookies.get('admin_token')?.value;
  if (adminToken) {
    try {
      const decoded = Buffer.from(adminToken, 'base64').toString();
      const [username, timestamp] = decoded.split(':');
      const tokenAge = Date.now() - parseInt(timestamp);
      if (tokenAge <= 24 * 60 * 60 * 1000 && username === process.env.ADMIN_USERNAME) {
        return true;
      }
    } catch {
      // fall through
    }
  }

  // Check DB-based admin
  const auth = await getAuthFromRequest(request);
  return !!auth?.isAdmin;
}

export async function GET() {
  try {
    const db = await getDatabase();
    const locks = await db.collection('round_locks').findOne({});
    return NextResponse.json(locks || DEFAULT_LOCKS);
  } catch (error) {
    console.error('Failed to fetch round locks:', error);
    return NextResponse.json({ error: 'Failed to fetch round locks' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const isAdmin = await isAdminRequest(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { round1, round2, round3, round4, results } = body;

    const db = await getDatabase();
    const update: Omit<RoundLocks, '_id'> = {
      round1: !!round1,
      round2: !!round2,
      round3: !!round3,
      round4: !!round4,
      results: !!results,
      updatedAt: new Date(),
    };

    await db.collection('round_locks').updateOne(
      {},
      { $set: update },
      { upsert: true }
    );

    return NextResponse.json(update);
  } catch (error) {
    console.error('Failed to update round locks:', error);
    return NextResponse.json({ error: 'Failed to update round locks' }, { status: 500 });
  }
}
