import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDatabase } from '@/lib/mongodb';

interface InviteCode {
  code: string;
  createdAt: Date;
  usedBy: string | null;
  usedAt: Date | null;
}

// Verify the request is from an authenticated admin
async function isAdminRequest(request: NextRequest): Promise<boolean> {
  // Check super-admin token
  const adminToken = request.cookies.get('admin_token')?.value;
  if (adminToken) {
    try {
      const decoded = Buffer.from(adminToken, 'base64').toString();
      const [username, timestamp] = decoded.split(':');
      const tokenAge = Date.now() - parseInt(timestamp);
      if (tokenAge < 24 * 60 * 60 * 1000 && username === process.env.ADMIN_USERNAME) {
        return true;
      }
    } catch { /* invalid token */ }
  }

  // Check DB-based admin via auth_token
  const { getAuthFromRequest } = await import('@/lib/auth');
  const auth = await getAuthFromRequest(request);
  return !!auth?.isAdmin;
}

function generateCode(): string {
  // 6-char alphanumeric code, uppercase for readability
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

// GET — list all invite codes
export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const db = await getDatabase();
  const codes = await db
    .collection<InviteCode>('invite_codes')
    .find()
    .sort({ createdAt: -1 })
    .toArray();

  return NextResponse.json({ codes });
}

// POST — generate new invite code(s)
export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const count = Math.min(Math.max(parseInt(body.count) || 1, 1), 20);

  const db = await getDatabase();
  const collection = db.collection<InviteCode>('invite_codes');

  await collection.createIndex({ code: 1 }, { unique: true });

  const newCodes: InviteCode[] = [];
  for (let i = 0; i < count; i++) {
    let code: string;
    // Ensure uniqueness
    do {
      code = generateCode();
    } while (await collection.findOne({ code }));

    const inviteCode: InviteCode = {
      code,
      createdAt: new Date(),
      usedBy: null,
      usedAt: null,
    };
    await collection.insertOne(inviteCode as any);
    newCodes.push(inviteCode);
  }

  return NextResponse.json({ codes: newCodes });
}

// DELETE — revoke an unused invite code
export async function DELETE(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { code } = await request.json();
  if (!code) {
    return NextResponse.json({ error: 'Code is required' }, { status: 400 });
  }

  const db = await getDatabase();
  const result = await db
    .collection<InviteCode>('invite_codes')
    .deleteOne({ code, usedBy: null });

  if (result.deletedCount === 0) {
    return NextResponse.json(
      { error: 'Code not found or already used' },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
