import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserByToken } from '@/lib/sub2api/client';
import { deriveOrderState, isRechargeRetryable } from '@/lib/order/status';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')?.trim();
  if (!token) {
    return NextResponse.json({ error: 'token is required' }, { status: 400 });
  }

  try {
    const user = await getCurrentUserByToken(token);
    const orders = await prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        amount: true,
        status: true,
        paymentType: true,
        createdAt: true,
        paidAt: true,
        completedAt: true,
      },
    });

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.username || user.email || `User #${user.id}`,
        balance: user.balance,
      },
      orders: orders.map((item) => {
        const derived = deriveOrderState(item);
        return {
          id: item.id,
          amount: Number(item.amount),
          status: item.status,
          paymentType: item.paymentType,
          createdAt: item.createdAt,
          paymentSuccess: derived.paymentSuccess,
          rechargeSuccess: derived.rechargeSuccess,
          rechargeStatus: derived.rechargeStatus,
          rechargeRetryable: isRechargeRetryable(item),
        };
      }),
    });
  } catch (error) {
    console.error('Get my orders error:', error);
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
}
