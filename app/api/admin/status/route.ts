import { NextRequest, NextResponse } from 'next/server';
import { getAuthFromRequest, clearAuthCookie, deleteAuthSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Check env-var super admin token first
    const adminToken = request.cookies.get('admin_token')?.value;
    if (adminToken) {
      try {
        const decoded = Buffer.from(adminToken, 'base64').toString();
        const [username, timestamp] = decoded.split(':');
        const tokenAge = Date.now() - parseInt(timestamp);
        const isExpired = tokenAge > 24 * 60 * 60 * 1000;

        if (!isExpired && username === process.env.ADMIN_USERNAME) {
          return NextResponse.json({
            isAdmin: true,
            message: 'Valid admin session (super admin)'
          });
        }
      } catch {
        // Invalid token format, continue to check auth_token
      }
    }

    // Check DB-based admin via auth_token
    const auth = await getAuthFromRequest(request);
    if (auth?.isAdmin) {
      return NextResponse.json({
        isAdmin: true,
        message: 'Valid admin session'
      });
    }

    return NextResponse.json({
      isAdmin: false,
      message: 'No admin session found'
    });
  } catch (error) {
    console.error('Admin status check error:', error);
    return NextResponse.json(
      { error: 'Failed to check admin status' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const response = NextResponse.json({
      success: true,
      message: 'Admin session cleared'
    });

    // Clear the super admin token cookie
    response.cookies.set('admin_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
    });

    // Also clear auth_token if present
    const token = request.cookies.get('auth_token')?.value;
    if (token) {
      await deleteAuthSession(token);
    }
    clearAuthCookie(response);

    return response;
  } catch (error) {
    console.error('Admin logout error:', error);
    return NextResponse.json(
      { error: 'Failed to logout admin' },
      { status: 500 }
    );
  }
}
