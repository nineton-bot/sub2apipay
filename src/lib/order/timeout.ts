import { prisma } from '@/lib/db';

const INTERVAL_MS = 30_000; // 30 seconds
let timer: ReturnType<typeof setInterval> | null = null;

export async function expireOrders(): Promise<number> {
  const result = await prisma.order.updateMany({
    where: {
      status: 'PENDING',
      expiresAt: { lt: new Date() },
    },
    data: { status: 'EXPIRED' },
  });

  if (result.count > 0) {
    console.log(`Expired ${result.count} orders`);
  }

  return result.count;
}

export function startTimeoutScheduler(): void {
  if (timer) return;

  // Run immediately on startup
  expireOrders().catch(console.error);

  // Then run every 30 seconds
  timer = setInterval(() => {
    expireOrders().catch(console.error);
  }, INTERVAL_MS);

  console.log('Order timeout scheduler started');
}

export function stopTimeoutScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
    console.log('Order timeout scheduler stopped');
  }
}
