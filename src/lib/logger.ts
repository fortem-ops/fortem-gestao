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
    emit("error", ctx ? [err, ctx] : [err]);
    try { errorSink?.(err, ctx); } catch { /* noop */ }
  },
};
