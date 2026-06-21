/**
 * Logger central. Em desenvolvimento, emite no console. Em produção, silencia
 * `debug`/`info` e mantém `warn`/`error`. Hook `onError` permite integrar com
 * Sentry/Logtail no futuro sem refatorar chamadas.
 */

type Level = "debug" | "info" | "warn" | "error";

const isDev = import.meta.env.DEV;

let errorSink: ((err: unknown, ctx?: Record<string, unknown>) => void) | null = null;

export function setErrorSink(fn: typeof errorSink) {
  errorSink = fn;
}

const SENSITIVE_KEYS = ["cpf", "rg", "senha", "password", "signature_data", "token", "secret", "ip_address", "email"];

function sanitizeCtx(ctx: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s))) {
      out[k] = "[REDACTED]";
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = sanitizeCtx(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function emit(level: Level, args: unknown[]) {
  if (!isDev && (level === "debug" || level === "info")) return;
  // eslint-disable-next-line no-console
  console[level](...args);
}

export const logger = {
  debug: (...args: unknown[]) => emit("debug", args),
  info: (...args: unknown[]) => emit("info", args),
  warn: (...args: unknown[]) => emit("warn", args),
  error: (err: unknown, ctx?: Record<string, unknown>) => {
    const safeCtx = ctx ? sanitizeCtx(ctx) : undefined;
    emit("error", safeCtx ? [err, safeCtx] : [err]);
    try { errorSink?.(err, safeCtx); } catch { /* noop */ }
  },
};
