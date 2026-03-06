import { NextRequest } from 'next/server';
import { handlePaymentNotify } from '@/lib/order/service';
import { WxpayProvider } from '@/lib/wxpay';

const wxpayProvider = new WxpayProvider();

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const notification = await wxpayProvider.verifyNotification(rawBody, headers);
    if (!notification) {
      return Response.json({ code: 'SUCCESS', message: '成功' });
    }
    const success = await handlePaymentNotify(notification, wxpayProvider.name);
    return Response.json(
      success ? { code: 'SUCCESS', message: '成功' } : { code: 'FAIL', message: '处理失败' },
      { status: success ? 200 : 500 },
    );
  } catch (error) {
    console.error('Wxpay notify error:', error);
    return Response.json(
      { code: 'FAIL', message: '处理失败' },
      { status: 500 },
    );
  }
}
