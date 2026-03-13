# 支付宝直连支付接入指南

## 概述

本项目通过直接对接 **支付宝开放平台** 实现收款，不依赖任何三方聚合支付平台。支持以下产品：

| 产品         | API 方法                | 场景                 |
| ------------ | ----------------------- | -------------------- |
| 电脑网站支付 | `alipay.trade.page.pay` | PC 浏览器扫码        |
| 手机网站支付 | `alipay.trade.wap.pay`  | 移动端 H5 拉起支付宝 |

签名算法：**RSA2 (SHA256withRSA)**，密钥格式 **PKCS8**。

## 前置条件

1. 注册 [支付宝开放平台](https://open.alipay.com/) 企业/个人账号
2. 创建网页/移动应用，获取 **APPID**
3. 在应用中签约 **电脑网站支付** 和 **手机网站支付** 产品
4. 配置 **接口加签方式** → 选择 **公钥模式 (RSA2)**，生成密钥对

## 密钥说明

支付宝公钥模式涉及 **三把密钥**，务必区分：

| 密钥           | 来源                       | 用途             | 对应环境变量         |
| -------------- | -------------------------- | ---------------- | -------------------- |
| **应用私钥**   | 你自己生成                 | 对请求参数签名   | `ALIPAY_PRIVATE_KEY` |
| **支付宝公钥** | 上传应用公钥后，支付宝返回 | 验证回调通知签名 | `ALIPAY_PUBLIC_KEY`  |
| 应用公钥       | 你自己生成                 | 上传到支付宝后台 | (不配置到项目中)     |

> **常见错误**：把「应用公钥」填到 `ALIPAY_PUBLIC_KEY`。必须使用「支付宝公钥」，否则回调验签永远失败。

## 环境变量

```env
# ── 必需 ──
ALIPAY_APP_ID=2021000000000000          # 支付宝开放平台 APPID
ALIPAY_PRIVATE_KEY=MIIEvQIBADANB...     # 应用私钥（PKCS8 格式，Base64 / PEM 均可）
ALIPAY_PUBLIC_KEY=MIIBIjANBgkqh...      # 支付宝公钥（非应用公钥！）
ALIPAY_NOTIFY_URL=https://pay.example.com/api/alipay/notify  # 异步通知地址

# ── 可选 ──
ALIPAY_RETURN_URL=https://pay.example.com/pay/result  # 同步跳转地址（默认自动生成）

# ── 启用渠道 ──
PAYMENT_PROVIDERS=alipay        # 逗号分隔，可同时含 easypay,alipay,wxpay,stripe
ENABLED_PAYMENT_TYPES=alipay    # 前端展示哪些支付方式
```

### 密钥格式

`ALIPAY_PRIVATE_KEY` 和 `ALIPAY_PUBLIC_KEY` 支持两种写法：

```env
# 方式 1：裸 Base64（推荐，适合 Docker 环境）
ALIPAY_PRIVATE_KEY=MIIEvQIBADANBgkqh...一行到底...

# 方式 2：完整 PEM（换行用 \n）
ALIPAY_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIIEvQIBADA...\n-----END PRIVATE KEY-----
```

项目会自动补全 PEM header/footer 并按 64 字符折行（兼容 OpenSSL 3.x 严格模式）。

## 架构

```
用户浏览器
    │
    ├── PC：扫码页面 (/pay/{orderId}) → 生成支付宝跳转 URL → 扫码/登录付款
    │                                      ↓
    │                                alipay.trade.page.pay (GET 跳转)
    │
    └── Mobile：直接拉起 → alipay.trade.wap.pay (GET 跳转)

支付宝服务器
    │
    └── POST /api/alipay/notify  ← 异步通知（trade_status=TRADE_SUCCESS）
         │
         ├── 验签（RSA2 + 支付宝公钥）
         ├── 校验 app_id 一致
         ├── 确认订单金额匹配
         └── 调用 handlePaymentNotify() → 订单状态流转 → 充值/订阅履约
```

### PC 支付流程（短链中转）

PC 端不直接返回支付宝 URL，而是生成一个 **项目内部短链** `/pay/{orderId}`：

1. 用户扫描短链二维码
2. 服务端根据 User-Agent 判断设备类型
3. 如果在支付宝客户端内打开 → 直接跳转 `alipay.trade.wap.pay`
4. 如果在普通浏览器打开 → 跳转 `alipay.trade.page.pay`
5. 订单已支付/已过期 → 显示状态页

这种设计避免了支付宝 URL 过长无法生成二维码的问题。

## 文件结构

```
src/lib/alipay/
├── provider.ts   # AlipayProvider 实现 PaymentProvider 接口
├── client.ts     # pageExecute (跳转URL) + execute (服务端API调用)
├── sign.ts       # RSA2 签名生成 + 验签
├── codec.ts      # 编码处理（GBK/UTF-8 自动检测、回调参数解析）
└── types.ts      # TypeScript 类型定义

src/app/api/alipay/
└── notify/route.ts   # 异步通知接收端点

src/app/pay/
└── [orderId]/route.ts  # PC 扫码中转页（短链）
```

## 支持的 API 能力

| 能力     | API                                 | 说明             |
| -------- | ----------------------------------- | ---------------- |
| 创建支付 | `alipay.trade.page.pay` / `wap.pay` | GET 跳转方式     |
| 查询订单 | `alipay.trade.query`                | 主动查询交易状态 |
| 关闭订单 | `alipay.trade.close`                | 超时关单         |
| 退款     | `alipay.trade.refund`               | 全额退款         |
| 异步通知 | POST 回调                           | RSA2 验签        |

## 注意事项

- **异步通知编码**：支付宝可能使用 GBK 编码发送通知。`codec.ts` 自动检测 Content-Type 和 body 中的 charset 参数，按 `UTF-8 → GBK → GB18030` 优先级尝试解码。
- **签名空格问题**：支付宝通知中的 `sign` 参数可能包含空格（URL 解码 `+` 导致），`codec.ts` 会自动将空格还原为 `+`。
- **默认限额**：单笔 ¥1000，单日 ¥10000（可通过环境变量 `MAX_DAILY_AMOUNT_ALIPAY_DIRECT` 调整）。
- **验签调试**：非生产环境自动输出验签失败的详细信息；生产环境可设置 `DEBUG_ALIPAY_SIGN=1` 开启。
