import { lazy, type ComponentType } from "react";

const RELOAD_FLAG = "fortem:chunk-reloaded";

/** Detecta falha de carregamento de chunk (build antigo removido após deploy). */
export function isChunkLoadError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError/i.test(
    msg,
  );
}

async function clearCachesAndSW() {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    /* ignore */
  }
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* ignore */
  }
}

/**
 * Envolve um import() dinâmico: se o chunk não existir mais (deploy novo),
 * limpa service worker/caches e recarrega a página UMA única vez.
 */
export function lazyWithReload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      const mod = await factory();
      sessionStorage.removeItem(RELOAD_FLAG);
      return mod;
    } catch (error) {
      if (isChunkLoadError(error) && sessionStorage.getItem(RELOAD_FLAG) !== "1") {
        sessionStorage.setItem(RELOAD_FLAG, "1");
        await clearCachesAndSW();
        window.location.reload();
        // Mantém o Suspense pendurado enquanto o reload acontece.
        return await new Promise<{ default: T }>(() => {});
      }
      throw error;
    }
  });
}
