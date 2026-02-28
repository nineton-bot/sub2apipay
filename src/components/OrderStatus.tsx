'use client';

interface OrderStatusProps {
  status: string;
  onBack: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string; message: string }> = {
  COMPLETED: {
    label: '充值成功',
    color: 'text-green-600',
    icon: '✓',
    message: '余额已到账，感谢您的充值！',
  },
  PAID: {
    label: '充值中',
    color: 'text-blue-600',
    icon: '⟳',
    message: '支付成功，正在充值余额中...',
  },
  RECHARGING: {
    label: '充值中',
    color: 'text-blue-600',
    icon: '⟳',
    message: '正在充值余额中，请稍候...',
  },
  FAILED: {
    label: '充值失败',
    color: 'text-red-600',
    icon: '✗',
    message: '充值失败，请联系管理员处理。',
  },
  EXPIRED: {
    label: '订单超时',
    color: 'text-gray-500',
    icon: '⏰',
    message: '订单已超时，请重新创建订单。',
  },
  CANCELLED: {
    label: '已取消',
    color: 'text-gray-500',
    icon: '✗',
    message: '订单已取消。',
  },
};

export default function OrderStatus({ status, onBack }: OrderStatusProps) {
  const config = STATUS_CONFIG[status] || {
    label: status,
    color: 'text-gray-600',
    icon: '?',
    message: '未知状态',
  };

  return (
    <div className="flex flex-col items-center space-y-4 py-8">
      <div className={`text-6xl ${config.color}`}>{config.icon}</div>
      <h2 className={`text-xl font-bold ${config.color}`}>{config.label}</h2>
      <p className="text-center text-gray-500">{config.message}</p>
      <button
        onClick={onBack}
        className="mt-4 w-full rounded-lg bg-blue-600 py-3 font-medium text-white hover:bg-blue-700"
      >
        {status === 'COMPLETED' ? '完成' : '返回充值'}
      </button>
    </div>
  );
}
