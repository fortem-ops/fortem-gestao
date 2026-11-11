import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

type TurnstileApi = { render: (el: HTMLElement, o: Record<string, unknown>) => string; remove: (id: string) => void };
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

/** Verificação de segurança do link de pagamento: o servidor confere na Cloudflare e marca o link. */
export function TurnstileLink({ token, siteKey, onOk }: { token: string; siteKey: string; onOk: () => void }) {
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let id: string | null = null; let vivo = true;
    carregar().then(() => {
      const api = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
      if (!vivo || !caixa.current || !api) return;
      id = api.render(caixa.current, {
        sitekey: siteKey, language: "pt-br", theme: "dark",
        callback: async (t: string) => {
          const { data } = await supabase.functions.invoke("validar-link-pagamento", { body: { token, acao: "turnstile", turnstile_token: t } });
          if (vivo && data?.ok) onOk();
        },
      });
    }).catch(() => {});
    return () => { vivo = false; if (id) (window as unknown as { turnstile?: TurnstileApi }).turnstile?.remove(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, siteKey]);
  return <div ref={caixa} className="min-h-[65px] flex justify-center" />;
}
