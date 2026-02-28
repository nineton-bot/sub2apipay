import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/sub2api/client';
import { getEnv } from '@/lib/config';

export async function GET(request: NextRequest) {
  const userId = Number(request.nextUrl.searchParams.get('user_id'));
  if (!userId || isNaN(userId) || userId <= 0) {
    return NextResponse.json({ error: '无效的用户 ID' }, { status: 400 });
  }

  try {
    const env = getEnv();
    const user = await getUser(userId);

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        status: user.status,
        balance: user.balance,
      },
      config: {
        enabledPaymentTypes: env.ENABLED_PAYMENT_TYPES,
        minAmount: env.MIN_RECHARGE_AMOUNT,
        maxAmount: env.MAX_RECHARGE_AMOUNT,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'USER_NOT_FOUND') {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }
    console.error('Get user error:', error);
    return NextResponse.json({ error: '获取用户信息失败' }, { status: 500 });
  }
}
