import { describe, it, expect } from 'vitest';
import { generateSign, verifySign } from '@/lib/zpay/sign';

describe('ZPAY Sign', () => {
  const pkey = 'YifxyCWYTLW3hXD4Ae7xB9KqtVA2474k';

  it('should generate correct sign with sorted params', () => {
    const params = {
      pid: '2026022720004756',
      type: 'alipay',
      out_trade_no: '20160806151343349',
      notify_url: 'http://www.aaa.com/notify_url.php',
      name: 'test product',
      money: '1.00',
      return_url: 'http://www.aaa.com/return_url.php',
    };
    const sign = generateSign(params, pkey);
    expect(sign).toMatch(/^[a-f0-9]{32}$/); // md5 lowercase hex
  });

  it('should filter out empty values, sign and sign_type', () => {
    const params = {
      a: '1',
      b: '',
      sign: 'xxx',
      sign_type: 'MD5',
      c: '3',
    };
    const sign = generateSign(params, pkey);
    // Should only use a=1&c=3 + pkey
    const expected = generateSign({ a: '1', c: '3' }, pkey);
    expect(sign).toBe(expected);
  });

  it('should sort params by ASCII order', () => {
    const params1 = { z: '1', a: '2', m: '3' };
    const params2 = { a: '2', m: '3', z: '1' };
    expect(generateSign(params1, pkey)).toBe(generateSign(params2, pkey));
  });

  it('should verify valid signature', () => {
    const params = { a: '1', b: '2' };
    const sign = generateSign(params, pkey);
    expect(verifySign(params, pkey, sign)).toBe(true);
  });

  it('should reject invalid signature', () => {
    const params = { a: '1', b: '2' };
    expect(verifySign(params, pkey, 'invalidsignature1234567890123456')).toBe(false);
  });

  it('should reject signature with wrong length', () => {
    const params = { a: '1', b: '2' };
    expect(verifySign(params, pkey, 'short')).toBe(false);
  });
});
