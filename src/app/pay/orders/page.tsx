'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';

interface UserInfo {
  id?: number;
  username: string;
  balance: number;
}

interface MyOrder {
  id: string;
  amount: number;
  status: string;
  paymentType: string;
  createdAt: string;
}

type OrderStatusFilter = 'ALL' | 'PENDING' | 'PAID' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED' | 'FAILED';

const STATUS_TEXT_MAP: Record<string, string> = {
  PENDING: '待支付',
  PAID: '已支付',
  RECHARGING: '充值中',
  COMPLETED: '已完成',
  EXPIRED: '已超时',
  CANCELLED: '已取消',
  FAILED: '失败',
  REFUNDING: '退款中',
  REFUNDED: '已退款',
  REFUND_FAILED: '退款失败',
};

const FILTER_OPTIONS: { key: OrderStatusFilter; label: string }[] = [
  { key: 'ALL', label: '全部' },
  { key: 'PENDING', label: '待支付' },
  { key: 'COMPLETED', label: '已完成' },
  { key: 'CANCELLED', label: '已取消' },
  { key: 'EXPIRED', label: '已超时' },
];

function detectDeviceIsMobile(): boolean {
  if (typeof window === 'undefined') return false;

  const ua = navigator.userAgent || '';
  const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Windows Phone|Mobile/i.test(ua);
  const smallPhysicalScreen = Math.min(window.screen.width, window.screen.height) <= 768;
  const touchCapable = navigator.maxTouchPoints > 1;

  return mobileUA || (touchCapable && smallPhysicalScreen);
}

function OrdersContent() {
  const searchParams = useSearchParams();
  const userId = Number(searchParams.get('user_id'));
  const token = (searchParams.get('token') || '').trim();
  const theme = searchParams.get('theme') === 'dark' ? 'dark' : 'light';
  const uiMode = searchParams.get('ui_mode') || 'standalone';
  const isDark = theme === 'dark';

  const [isIframeContext, setIsIframeContext] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [orders, setOrders] = useState<MyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState<OrderStatusFilter>('ALL');
  const [resolvedUserId, setResolvedUserId] = useState<number | null>(null);

  const isEmbedded = uiMode === 'embedded' && isIframeContext;
  const hasToken = token.length > 0;
  const effectiveUserId = resolvedUserId || userId;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsIframeContext(window.self !== window.top);
    setIsMobile(detectDeviceIsMobile());
  }, []);

  const buildMobilePayOrdersTabUrl = () => {
    const params = new URLSearchParams();
    if (userId && !Number.isNaN(userId)) params.set('user_id', String(userId));
    if (token) params.set('token', token);
    params.set('theme', theme);
    params.set('ui_mode', uiMode);
    params.set('tab', 'orders');
    return `/pay?${params.toString()}`;
  };

  useEffect(() => {
    if (!isMobile || isEmbedded || typeof window === 'undefined') return;
    window.location.replace(buildMobilePayOrdersTabUrl());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, isEmbedded, userId, token, theme, uiMode]);

  const loadOrders = async () => {
    setLoading(true);
    setError('');

    try {
      if (!userId || Number.isNaN(userId) || userId <= 0) {
        setError('无效的用户 ID');
        setOrders([]);
        return;
      }

      if (!hasToken) {
        const res = await fetch(`/api/users/${userId}`);
        if (res.ok) {
          const data = await res.json();
          setUserInfo({
            id: userId,
            username:
              (typeof data.displayName === 'string' && data.displayName.trim()) ||
              (typeof data.username === 'string' && data.username.trim()) ||
              (typeof data.email === 'string' && data.email.trim()) ||
              `用户 #${userId}`,
            balance: typeof data.balance === 'number' ? data.balance : 0,
          });
        }
        setOrders([]);
        setError('当前链接未携带登录 token，无法查询“我的订单”。');
        return;
      }

      const meRes = await fetch(`/api/orders/my?token=${encodeURIComponent(token)}`);
      if (!meRes.ok) {
        if (meRes.status === 401) {
          setError('登录态已失效，请从 Sub2API 重新进入支付页。');
        } else {
          setError('订单加载失败，请稍后重试。');
        }
        setOrders([]);
        return;
      }

      const meData = await meRes.json();
      const meUser = meData.user || {};
      const meId = Number(meUser.id);
      if (Number.isInteger(meId) && meId > 0) {
        setResolvedUserId(meId);
      }

      setUserInfo({
        id: Number.isInteger(meId) && meId > 0 ? meId : userId,
        username:
          (typeof meUser.displayName === 'string' && meUser.displayName.trim()) ||
          (typeof meUser.username === 'string' && meUser.username.trim()) ||
          `用户 #${userId}`,
        balance: typeof meUser.balance === 'number' ? meUser.balance : 0,
      });

      if (Array.isArray(meData.orders)) {
        setOrders(meData.orders);
      } else {
        setOrders([]);
      }
    } catch {
      setOrders([]);
      setError('网络错误，请稍后重试。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isMobile && !isEmbedded) return;
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, token, isMobile, isEmbedded]);

  const filteredOrders = useMemo(() => {
    if (activeFilter === 'ALL') return orders;
    return orders.filter((item) => item.status === activeFilter);
  }, [orders, activeFilter]);

  const summary = useMemo(() => {
    const total = orders.length;
    const pending = orders.filter((item) => item.status === 'PENDING').length;
    const completed = orders.filter((item) => item.status === 'COMPLETED' || item.status === 'PAID').length;
    const failed = orders.filter((item) => ['FAILED', 'CANCELLED', 'EXPIRED'].includes(item.status)).length;
    return { total, pending, completed, failed };
  }, [orders]);

  const formatStatus = (status: string) => STATUS_TEXT_MAP[status] || status;

  const formatCreatedAt = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  };

  const getStatusBadgeClass = (status: string) => {
    if (['COMPLETED', 'PAID'].includes(status)) {
      return isDark ? 'bg-emerald-500/20 text-emerald-200' : 'bg-emerald-100 text-emerald-700';
    }
    if (status === 'PENDING') {
      return isDark ? 'bg-blue-500/20 text-blue-200' : 'bg-blue-100 text-blue-700';
    }
    if (['CANCELLED', 'EXPIRED', 'FAILED'].includes(status)) {
      return isDark ? 'bg-slate-600 text-slate-200' : 'bg-slate-100 text-slate-700';
    }
    return isDark ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-700';
  };

  const buildScopedUrl = (path: string) => {
    const params = new URLSearchParams();
    if (effectiveUserId) params.set('user_id', String(effectiveUserId));
    if (token) params.set('token', token);
    params.set('theme', theme);
    params.set('ui_mode', uiMode);
    return `${path}?${params.toString()}`;
  };

  const payUrl = buildScopedUrl('/pay');

  if (isMobile) {
    return (
      <div className={`flex min-h-screen items-center justify-center p-4 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
        正在切换到移动端订单 Tab...
      </div>
    );
  }

  if (!effectiveUserId || Number.isNaN(effectiveUserId) || effectiveUserId <= 0) {
    return (
      <div className={`flex min-h-screen items-center justify-center p-4 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
        <div className="text-center text-red-500">
          <p className="text-lg font-medium">无效的用户 ID</p>
          <p className="mt-2 text-sm text-gray-500">请从 Sub2API 平台正确访问订单页面</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={[
        'relative min-h-screen w-full overflow-hidden p-3 sm:p-4',
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900',
      ].join(' ')}
    >
      <div
        className={[
          'pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full blur-3xl',
          isDark ? 'bg-indigo-500/25' : 'bg-sky-300/35',
        ].join(' ')}
      />
      <div
        className={[
          'pointer-events-none absolute -right-24 bottom-0 h-64 w-64 rounded-full blur-3xl',
          isDark ? 'bg-cyan-400/20' : 'bg-indigo-200/45',
        ].join(' ')}
      />

      <div
        className={[
          'relative mx-auto w-full max-w-6xl rounded-3xl border p-4 sm:p-6',
          isDark
            ? 'border-slate-700/70 bg-slate-900/85 shadow-2xl shadow-black/35'
            : 'border-slate-200/90 bg-white/95 shadow-2xl shadow-slate-300/45',
          isEmbedded ? '' : 'mt-6',
        ].join(' ')}
      >
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div
              className={[
                'mb-2 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium',
                isDark ? 'bg-indigo-500/20 text-indigo-200' : 'bg-indigo-50 text-indigo-700',
              ].join(' ')}
            >
              Sub2API Secure Pay
            </div>
            <h1 className={['text-2xl font-semibold tracking-tight', isDark ? 'text-slate-100' : 'text-slate-900'].join(' ')}>
              我的订单
            </h1>
            <p className={['mt-1 text-sm', isDark ? 'text-slate-400' : 'text-slate-500'].join(' ')}>
              {userInfo?.username || `用户 #${effectiveUserId}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadOrders}
              className={[
                'rounded-lg border px-3 py-2 text-xs font-medium',
                isDark ? 'border-slate-600 text-slate-200 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100',
              ].join(' ')}
            >
              刷新
            </button>
            <a
              href={payUrl}
              className={[
                'rounded-lg border px-3 py-2 text-xs font-medium',
                isDark ? 'border-slate-600 text-slate-200 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100',
              ].join(' ')}
            >
              返回充值
            </a>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className={['rounded-xl border p-3', isDark ? 'border-slate-700 bg-slate-800/70' : 'border-slate-200 bg-slate-50'].join(' ')}>
            <div className={['text-xs', isDark ? 'text-slate-400' : 'text-slate-500'].join(' ')}>总订单</div>
            <div className="mt-1 text-xl font-semibold">{summary.total}</div>
          </div>
          <div className={['rounded-xl border p-3', isDark ? 'border-slate-700 bg-slate-800/70' : 'border-slate-200 bg-slate-50'].join(' ')}>
            <div className={['text-xs', isDark ? 'text-slate-400' : 'text-slate-500'].join(' ')}>待支付</div>
            <div className="mt-1 text-xl font-semibold">{summary.pending}</div>
          </div>
          <div className={['rounded-xl border p-3', isDark ? 'border-slate-700 bg-slate-800/70' : 'border-slate-200 bg-slate-50'].join(' ')}>
            <div className={['text-xs', isDark ? 'text-slate-400' : 'text-slate-500'].join(' ')}>已完成</div>
            <div className="mt-1 text-xl font-semibold">{summary.completed}</div>
          </div>
          <div className={['rounded-xl border p-3', isDark ? 'border-slate-700 bg-slate-800/70' : 'border-slate-200 bg-slate-50'].join(' ')}>
            <div className={['text-xs', isDark ? 'text-slate-400' : 'text-slate-500'].join(' ')}>异常/关闭</div>
            <div className="mt-1 text-xl font-semibold">{summary.failed}</div>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveFilter(item.key)}
              className={[
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                activeFilter === item.key
                  ? (isDark ? 'border-slate-500 bg-slate-700 text-slate-100' : 'border-slate-400 bg-slate-900 text-white')
                  : (isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-600 hover:bg-slate-100'),
              ].join(' ')}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className={['rounded-2xl border p-3 sm:p-4', isDark ? 'border-slate-700 bg-slate-800/60' : 'border-slate-200 bg-slate-50/80'].join(' ')}>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className={['h-6 w-6 animate-spin rounded-full border-2 border-t-transparent', isDark ? 'border-slate-400' : 'border-slate-500'].join(' ')} />
            </div>
          ) : error ? (
            <div className={['rounded-xl border border-dashed px-4 py-10 text-center text-sm', isDark ? 'border-amber-500/40 text-amber-200' : 'border-amber-300 text-amber-700'].join(' ')}>
              {error}
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className={['rounded-xl border border-dashed px-4 py-10 text-center text-sm', isDark ? 'border-slate-600 text-slate-400' : 'border-slate-300 text-slate-500'].join(' ')}>
              暂无符合条件的订单记录
            </div>
          ) : (
            <>
              <div className={['hidden rounded-xl px-4 py-2 text-xs font-medium md:grid md:grid-cols-[1.2fr_0.6fr_0.8fr_0.8fr_1fr]', isDark ? 'text-slate-300' : 'text-slate-600'].join(' ')}>
                <span>订单号</span>
                <span>金额</span>
                <span>支付方式</span>
                <span>状态</span>
                <span>创建时间</span>
              </div>

              <div className="space-y-2 md:space-y-0">
                {filteredOrders.map((order) => (
                  <div key={order.id} className={['border-t px-4 py-3 first:border-t-0 md:grid md:grid-cols-[1.2fr_0.6fr_0.8fr_0.8fr_1fr] md:items-center', isDark ? 'border-slate-700 text-slate-200' : 'border-slate-200 text-slate-700'].join(' ')}>
                    <div className="font-medium">#{order.id.slice(0, 12)}</div>
                    <div className="font-semibold">¥{order.amount.toFixed(2)}</div>
                    <div>{order.paymentType}</div>
                    <div>
                      <span className={['rounded-full px-2 py-0.5 text-xs', getStatusBadgeClass(order.status)].join(' ')}>
                        {formatStatus(order.status)}
                      </span>
                    </div>
                    <div className={isDark ? 'text-slate-300' : 'text-slate-600'}>{formatCreatedAt(order.createdAt)}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-gray-500">加载中...</div>
        </div>
      }
    >
      <OrdersContent />
    </Suspense>
  );
}
