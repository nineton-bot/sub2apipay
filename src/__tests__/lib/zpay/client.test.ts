import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock config
vi.mock('@/lib/config', () => ({
  getEnv: () => ({
    ZPAY_PID: 'test_pid',
    ZPAY_PKEY: 'test_pkey',
    ZPAY_API_BASE: 'https://test.zpay.com',
    ZPAY_NOTIFY_URL: 'https://test.com/api/zpay/notify',
    ZPAY_RETURN_URL: 'https://test.com/pay/result',
  }),
}));

import { createPayment, queryOrder, refund } from '@/lib/zpay/client';

describe('ZPAY Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('createPayment should post to mapi.php and return result', async () => {
    const mockResponse = {
      code: 1,
      trade_no: 'zpay_123',
      payurl: 'https://pay.example.com',
      qrcode: 'https://qr.example.com',
      img: 'https://img.example.com/qr.jpg',
    };

    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve(mockResponse),
    });

    const result = await createPayment({
      outTradeNo: 'test_order_1',
      amount: '10.00',
      paymentType: 'alipay',
      clientIp: '127.0.0.1',
      productName: 'Test Product',
    });

    expect(result.trade_no).toBe('zpay_123');
    expect(result.payurl).toBe('https://pay.example.com');
    expect(fetch).toHaveBeenCalledWith(
      'https://test.zpay.com/mapi.php',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('createPayment should throw on error response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ code: 0, msg: 'insufficient balance' }),
    });

    await expect(
      createPayment({
        outTradeNo: 'test_order_2',
        amount: '10.00',
        paymentType: 'alipay',
        clientIp: '127.0.0.1',
        productName: 'Test Product',
      }),
    ).rejects.toThrow('ZPAY create payment failed');
  });

  it('queryOrder should fetch order status', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        code: 1,
        trade_no: 'zpay_123',
        out_trade_no: 'test_order_1',
        status: 1,
        money: '10.00',
      }),
    });

    const result = await queryOrder('test_order_1');
    expect(result.status).toBe(1);
    expect(result.money).toBe('10.00');
  });

  it('refund should post refund request', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ code: 1, msg: '退款成功' }),
    });

    const result = await refund('zpay_123', 'test_order_1', '10.00');
    expect(result.code).toBe(1);
  });
});
