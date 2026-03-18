import { NextRequest, NextResponse } from 'next/server';
import { getAuthFromRequest, deleteAuthSession, clearAuthCookie } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthFromRequest(request);

    if (!session) {
      return NextResponse.json({
        authenticated: false,
      });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        email: session.email,
        displayName: session.displayName,
        isAdmin: session.isAdmin,
      },
    });
  } catch (error) {
    console.error('Auth status error:', error);
    return NextResponse.json({ authenticated: false });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value;

    if (token) {
      await deleteAuthSession(token);
    }

    const response = NextResponse.json({
      success: true,
      message: 'Logged out',
    });
    clearAuthCookie(response);

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    const response = NextResponse.json(
      { error: 'Logout failed' },
      { status: 500 }
    );
    clearAuthCookie(response);
    return response;
  }
}
