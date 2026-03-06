import { NextRequest } from 'next/server';
import { handlePaymentNotify } from '@/lib/order/service';
import { AlipayProvider } from '@/lib/alipay/provider';
import { getEnv } from '@/lib/config';

const alipayProvider = new AlipayProvider();

export async function POST(request: NextRequest) {
  try {
    // 官方支付宝未配置时，直接返回成功（避免旧回调重试产生错误日志）
    const env = getEnv();
    if (!env.ALIPAY_APP_ID || !env.ALIPAY_PRIVATE_KEY) {
      return new Response('success', { headers: { 'Content-Type': 'text/plain' } });
    }

    const rawBody = await request.text();
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const notification = await alipayProvider.verifyNotification(rawBody, headers);
    const success = await handlePaymentNotify(notification, alipayProvider.name);
    return new Response(success ? 'success' : 'fail', {
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch (error) {
    console.error('Alipay notify error:', error);
    return new Response('fail', {
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}
