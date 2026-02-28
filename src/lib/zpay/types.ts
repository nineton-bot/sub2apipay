export interface ZPayCreateParams {
  pid: string;
  type: 'alipay' | 'wxpay';
  out_trade_no: string;
  notify_url: string;
  name: string;
  money: string;
  clientip: string;
  return_url: string;
  sign?: string;
  sign_type?: string;
}

export interface ZPayCreateResponse {
  code: number;
  msg?: string;
  trade_no: string;
  O_id?: string;
  payurl?: string;
  qrcode?: string;
  img?: string;
}

export interface ZPayNotifyParams {
  pid: string;
  name: string;
  money: string;
  out_trade_no: string;
  trade_no: string;
  param?: string;
  trade_status: string;
  type: string;
  sign: string;
  sign_type: string;
}

export interface ZPayQueryResponse {
  code: number;
  msg?: string;
  trade_no: string;
  out_trade_no: string;
  type: string;
  pid: string;
  addtime: string;
  endtime: string;
  name: string;
  money: string;
  status: number;
  param?: string;
  buyer?: string;
}

export interface ZPayRefundResponse {
  code: number;
  msg: string;
}
