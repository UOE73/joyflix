import { NextRequest, NextResponse } from 'next/server';

import { isSecureRequest } from '@/lib/auth';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });

  // 清除认证cookie
  response.cookies.set('auth', '', {
    path: '/',
    expires: new Date(0),
    sameSite: 'lax',
    httpOnly: true,
    secure: isSecureRequest(request),
  });

  return response;
}
