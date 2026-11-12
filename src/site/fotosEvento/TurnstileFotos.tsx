import { useEffect, useRef } from "react";

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

/** Verificação de segurança (mesma chave do /planos). O token vale uma vez: troque `key` para gerar outro. */
export default function TurnstileFotos({ siteKey, onToken }: { siteKey: string; onToken: (t: string | null) => void }) {
  const caixa = useRef<HTMLDivElement>(null);
  const cb = useRef(onToken); cb.current = onToken;
  useEffect(() => {
    let id: string | null = null; let vivo = true;
    carregar().then(() => {
      const api = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
      if (!vivo || !caixa.current || !api) return;
      id = api.render(caixa.current, {
        sitekey: siteKey, language: "pt-br", theme: "dark",
        callback: (t: string) => cb.current(t), "expired-callback": () => cb.current(null), "error-callback": () => cb.current(null),
      });
    }).catch(() => cb.current(null));
    return () => { vivo = false; if (id) (window as unknown as { turnstile?: TurnstileApi }).turnstile?.remove(id); };
  }, [siteKey]);
  return <div ref={caixa} className="min-h-[65px]" />;
}
