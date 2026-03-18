import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getDatabase } from './mongodb';

// --- Types ---

export interface User {
  _id?: ObjectId;
  email: string;
  passwordHash: string;
  displayName: string;
  isAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthSession {
  _id?: ObjectId;
  token: string;
  userId: ObjectId;
  email: string;
  displayName: string;
  isAdmin: boolean;
  createdAt: Date;
  expiresAt: Date;
}

// --- Password helpers ---

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// --- Auth session management ---

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function createAuthSession(user: User): Promise<string> {
  const db = await getDatabase();
  const sessions = db.collection<AuthSession>('auth_sessions');

  // Ensure indexes exist (idempotent)
  await sessions.createIndex({ token: 1 }, { unique: true });
  await sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  const token = crypto.randomUUID();
  const now = new Date();

  await sessions.insertOne({
    token,
    userId: user._id!,
    email: user.email,
    displayName: user.displayName,
    isAdmin: user.isAdmin,
    createdAt: now,
    expiresAt: new Date(now.getTime() + SESSION_DURATION_MS),
  });

  return token;
}

export async function getAuthSession(token: string): Promise<AuthSession | null> {
  const db = await getDatabase();
  const sessions = db.collection<AuthSession>('auth_sessions');

  const session = await sessions.findOne({ token });
  if (!session) return null;

  // Double-check expiration (TTL index may lag)
  if (session.expiresAt < new Date()) {
    await sessions.deleteOne({ token });
    return null;
  }

  return session;
}

export async function deleteAuthSession(token: string): Promise<void> {
  const db = await getDatabase();
  const sessions = db.collection<AuthSession>('auth_sessions');
  await sessions.deleteOne({ token });
}

// --- Request/Response helpers ---

export async function getAuthFromRequest(request: NextRequest): Promise<AuthSession | null> {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  return getAuthSession(token);
}

export function setAuthCookie(response: NextResponse, token: string): void {
  response.cookies.set('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: SESSION_DURATION_MS / 1000, // seconds
    path: '/',
  });
}

export function clearAuthCookie(response: NextResponse): void {
  response.cookies.set('auth_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  });
}
