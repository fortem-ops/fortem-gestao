import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window { turnstile?: { render: (el: HTMLElement, o: Record<string, unknown>) => string; remove: (id: string) => void } }
}
let script: Promise<void> | null = null;
function carregar() {
  script ??= new Promise((ok, falha) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true; s.onload = () => ok(); s.onerror = () => { script = null; falha(new Error("turnstile")); };
    document.head.appendChild(s);
  });
  return script;
}

/** Verificação de segurança do cadastro público. Só aparece com a chave ligada no servidor.
 *  O token vai ao servidor, que confere na Cloudflare e devolve um passe; o navegador nunca decide sozinho. */
export function TurnstilePlanos({ reinicio, onPasse }: { reinicio: number; onPasse: (passe: string | null, ativo: boolean) => void }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [cfg, setCfg] = useState<{ ativo: boolean; site_key: string | null } | null>(null);
  useEffect(() => {
    supabase.functions.invoke("planos-codigo", { body: { acao: "turnstile_config" } })
      .then(({ data }) => { const c = { ativo: data?.ativo === true, site_key: typeof data?.site_key === "string" ? data.site_key : null }; setCfg(c); if (!c.ativo) onPasse(null, false); })
      .catch(() => { setCfg({ ativo: false, site_key: null }); onPasse(null, false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!cfg?.ativo || !cfg.site_key || !caixa.current) return;
    let id: string | null = null; let vivo = true;
    onPasse(null, true);
    carregar().then(() => {
      if (!vivo || !caixa.current || !window.turnstile) return;
      id = window.turnstile.render(caixa.current, {
        sitekey: cfg.site_key, language: "pt-br", theme: "dark",
        callback: async (token: string) => {
          const { data } = await supabase.functions.invoke("planos-codigo", { body: { acao: "turnstile", token } });
          if (vivo) onPasse(data?.ok && typeof data.passe === "string" ? data.passe : null, true);
        },
        "expired-callback": () => vivo && onPasse(null, true),
      });
    }).catch(() => {});
    return () => { vivo = false; if (id) window.turnstile?.remove(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg, reinicio]);
  if (!cfg?.ativo) return null;
  return <div ref={caixa} className="min-h-[65px]" />;
}
