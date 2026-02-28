import { getEnv } from '@/lib/config';
import { generateSign } from './sign';
import type { ZPayCreateResponse, ZPayQueryResponse, ZPayRefundResponse } from './types';

export interface CreatePaymentOptions {
  outTradeNo: string;
  amount: string; // 金额字符串，如 "10.00"
  paymentType: 'alipay' | 'wxpay';
  clientIp: string;
  productName: string;
}

export async function createPayment(opts: CreatePaymentOptions): Promise<ZPayCreateResponse> {
  const env = getEnv();
  const params: Record<string, string> = {
    pid: env.ZPAY_PID,
    type: opts.paymentType,
    out_trade_no: opts.outTradeNo,
    notify_url: env.ZPAY_NOTIFY_URL,
    return_url: env.ZPAY_RETURN_URL,
    name: opts.productName,
    money: opts.amount,
    clientip: opts.clientIp,
  };

  const sign = generateSign(params, env.ZPAY_PKEY);
  params.sign = sign;
  params.sign_type = 'MD5';

  const formData = new URLSearchParams(params);
  const response = await fetch(`${env.ZPAY_API_BASE}/mapi.php`, {
    method: 'POST',
    body: formData,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  const data = await response.json() as ZPayCreateResponse;
  if (data.code !== 1) {
    throw new Error(`ZPAY create payment failed: ${data.msg || 'unknown error'}`);
  }
  return data;
}

export async function queryOrder(outTradeNo: string): Promise<ZPayQueryResponse> {
  const env = getEnv();
  const url = `${env.ZPAY_API_BASE}/api.php?act=order&pid=${env.ZPAY_PID}&key=${env.ZPAY_PKEY}&out_trade_no=${outTradeNo}`;
  const response = await fetch(url);
  const data = await response.json() as ZPayQueryResponse;
  if (data.code !== 1) {
    throw new Error(`ZPAY query order failed: ${data.msg || 'unknown error'}`);
  }
  return data;
}

export async function refund(tradeNo: string, outTradeNo: string, money: string): Promise<ZPayRefundResponse> {
  const env = getEnv();
  const params = new URLSearchParams({
    pid: env.ZPAY_PID,
    key: env.ZPAY_PKEY,
    trade_no: tradeNo,
    out_trade_no: outTradeNo,
    money,
  });
  const response = await fetch(`${env.ZPAY_API_BASE}/api.php?act=refund`, {
    method: 'POST',
    body: params,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  const data = await response.json() as ZPayRefundResponse;
  if (data.code !== 1) {
    throw new Error(`ZPAY refund failed: ${data.msg || 'unknown error'}`);
  }
  return data;
}
