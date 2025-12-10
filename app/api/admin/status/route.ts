import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const adminToken = request.cookies.get('admin_token')?.value;

    if (!adminToken) {
      return NextResponse.json({
        isAdmin: false,
        message: 'No admin session found'
      });
    }

    // Decode and validate token (simple validation for demo)
    try {
      const decoded = Buffer.from(adminToken, 'base64').toString();
      const [username, timestamp] = decoded.split(':');

      // Check if token is still valid (24 hours)
      const tokenAge = Date.now() - parseInt(timestamp);
      const isExpired = tokenAge > 24 * 60 * 60 * 1000;

      if (isExpired || username !== process.env.ADMIN_USERNAME) {
        return NextResponse.json({
          isAdmin: false,
          message: 'Admin session expired or invalid'
        });
      }

      return NextResponse.json({
        isAdmin: true,
        message: 'Valid admin session'
      });
    } catch (error) {
      return NextResponse.json({
        isAdmin: false,
        message: 'Invalid admin token'
      });
    }
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

    // Clear the admin token cookie
    response.cookies.set('admin_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0, // Expire immediately
    });

    return response;
  } catch (error) {
    console.error('Admin logout error:', error);
    return NextResponse.json(
      { error: 'Failed to logout admin' },
      { status: 500 }
    );
  }
}