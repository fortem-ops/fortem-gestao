// Diagnóstico de conectividade entre o navegador do usuário e os endpoints do backend.
// Usado para diferenciar "credenciais inválidas" de "rede Wi-Fi bloqueando o backend".

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export const SUPABASE_HOST = (() => {
  try {
    return new URL(SUPABASE_URL).host;
  } catch {
    return SUPABASE_URL;
  }
})();

export type NetworkDiagnosis =
  | "ok"
  | "offline"
  | "backend_blocked"
  | "backend_slow"
  | "app_unreachable"
  | "unknown";

export interface DiagnosisResult {
  status: NetworkDiagnosis;
  detail: string;
  authReachable: boolean;
  restReachable: boolean;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 5000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(t);
  }
}

export async function diagnoseNetwork(): Promise<DiagnosisResult> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return {
      status: "offline",
      detail: "Sem conexão com a internet.",
      authReachable: false,
      restReachable: false,
    };
  }

  const headers = { apikey: SUPABASE_KEY } as Record<string, string>;

  let authReachable = false;
  let restReachable = false;
  let timedOut = false;

  await Promise.all([
    fetchWithTimeout(`${SUPABASE_URL}/auth/v1/health`, { method: "GET", headers }, 5000)
      .then((r) => {
        authReachable = r.ok || r.status < 500;
      })
      .catch((e) => {
        if (e?.name === "AbortError") timedOut = true;
      }),
    fetchWithTimeout(`${SUPABASE_URL}/rest/v1/`, { method: "GET", headers }, 5000)
      .then((r) => {
        restReachable = r.ok || r.status < 500;
      })
      .catch((e) => {
        if (e?.name === "AbortError") timedOut = true;
      }),
  ]);

  if (authReachable && restReachable) {
    return { status: "ok", detail: "Conexão com o servidor OK.", authReachable, restReachable };
  }

  if (timedOut && !authReachable && !restReachable) {
    return {
      status: "backend_slow",
      detail: "O servidor demorou demais para responder nesta rede.",
      authReachable,
      restReachable,
    };
  }

  return {
    status: "backend_blocked",
    detail: "Esta rede está bloqueando a comunicação com o servidor do app.",
    authReachable,
    restReachable,
  };
}

export function describeDiagnosis(d: DiagnosisResult): { title: string; description: string } {
  switch (d.status) {
    case "offline":
      return {
        title: "Sem internet",
        description: "Verifique sua conexão Wi-Fi ou dados móveis e tente novamente.",
      };
    case "backend_blocked":
      return {
        title: "Esta rede está bloqueando o servidor do app",
        description:
          `Sua internet pode estar rápida, mas a velocidade só mede a banda até o seu provedor — não garante acesso a todos os sites. Esta rede (firewall, proxy, DNS ou antivírus com inspeção HTTPS) está bloqueando o domínio ${SUPABASE_HOST}. Soluções: trocar o DNS para 1.1.1.1 ou 8.8.8.8, desativar VPN/antivírus com inspeção HTTPS, pedir ao TI/admin para liberar o domínio, ou usar 4G/5G temporariamente.`,
      };
    case "backend_slow":
      return {
        title: "Conexão muito lenta com o servidor",
        description: "O servidor não respondeu a tempo nesta rede. Tente novamente ou troque para outra rede.",
      };
    case "app_unreachable":
      return {
        title: "App indisponível",
        description: "Não conseguimos carregar recursos do app. Tente recarregar a página.",
      };
    case "ok":
      return { title: "Conexão OK", description: "A rede está funcionando normalmente." };
    default:
      return {
        title: "Falha de conexão",
        description: "Não foi possível contatar o servidor. Tente novamente em instantes.",
      };
  }
}
