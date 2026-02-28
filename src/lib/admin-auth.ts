import { NextRequest, NextResponse } from 'next/server';
import { getEnv } from '@/lib/config';
import crypto from 'crypto';

export function verifyAdminToken(request: NextRequest): boolean {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) return false;

  const env = getEnv();
  const expected = Buffer.from(env.ADMIN_TOKEN);
  const received = Buffer.from(token);

  if (expected.length !== received.length) return false;
  return crypto.timingSafeEqual(expected, received);
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: '未授权' }, { status: 401 });
}
