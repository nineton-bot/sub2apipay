type PlainRecord = Record<string, unknown>;

const ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on', 'debug']);
const SENSITIVE_KEY_PATTERN = /(token|secret|password|private|authorization|signature|sign|api[_-]?key|key)/i;
const MAX_STRING_LENGTH = 400;

function isPlainObject(value: unknown): value is PlainRecord {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function truncateString(value: string): string {
  if (value.length <= MAX_STRING_LENGTH) return value;
  return `${value.slice(0, MAX_STRING_LENGTH)}...[truncated:${value.length}]`;
}

function maskSensitiveString(value: string): string {
  if (value.length <= 8) return '[redacted]';
  return `${value.slice(0, 4)}...[redacted]...${value.slice(-4)}`;
}

function sanitizeValue(value: unknown, parentKey?: string, depth = 0): unknown {
  if (depth > 5) return '[max-depth]';

  if (typeof value === 'string') {
    if (parentKey && SENSITIVE_KEY_PATTERN.test(parentKey)) {
      return maskSensitiveString(value);
    }
    return truncateString(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean' || value == null) {
    return value;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack ? truncateString(value.stack) : undefined,
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, parentKey, depth + 1));
  }

  if (isPlainObject(value)) {
    const next: PlainRecord = {};
    for (const [key, innerValue] of Object.entries(value)) {
      next[key] = sanitizeValue(innerValue, key, depth + 1);
    }
    return next;
  }

  return String(value);
}

export function isPaymentDebugEnabled(): boolean {
  const raw = (process.env.PAYMENT_DEBUG_LOG_ENABLED || '').trim().toLowerCase();
  return ENABLED_VALUES.has(raw);
}

export function paymentDebugLog(event: string, payload?: unknown): void {
  if (!isPaymentDebugEnabled()) return;
  if (payload === undefined) {
    console.info(`[payment-debug] ${event}`);
    return;
  }
  console.info(`[payment-debug] ${event}`, sanitizeValue(payload));
}

export function paymentDebugError(event: string, error: unknown, payload?: unknown): void {
  if (!isPaymentDebugEnabled()) return;
  console.error(`[payment-debug] ${event}`, {
    context: payload === undefined ? undefined : sanitizeValue(payload),
    error: sanitizeValue(error),
  });
}
