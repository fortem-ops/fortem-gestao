import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";

import { PUSH_ADIADO_KEY, PUSH_SESSAO_KEY, SETE_DIAS, pushAdiado } from "@/hooks/portalPushIncentivo";

export function PortalPushIncentivo({ modo = "inicio" }: { modo?: "inicio" | "contexto" | "configuracoes" }) {
  const push = usePushNotifications();
  const [adiado, setAdiado] = useState(pushAdiado);
  const [contextoVisivel, setContextoVisivel] = useState(false);
  useEffect(() => {
    if (modo !== "contexto" || push.isChecking || push.isSubscribed || push.permission === "denied" || adiado) return;
    try {
      if (sessionStorage.getItem(PUSH_SESSAO_KEY)) return;
      sessionStorage.setItem(PUSH_SESSAO_KEY, "1");
    } catch { /* Armazenamento indisponível: manter somente esta instância. */ }
    setContextoVisivel(true);
  }, [modo, push.isChecking, push.isSubscribed, push.permission, adiado]);

  const adiar = () => {
    try { localStorage.setItem(PUSH_ADIADO_KEY, String(Date.now() + SETE_DIAS)); } catch { /* Ainda oculta nesta visita. */ }
    setAdiado(true);
  };
  if (push.isChecking || (modo !== "configuracoes" && (push.isSubscribed || adiado)) || (modo === "contexto" && !contextoVisivel)) return null;

  return (
    <section aria-label="Notificações neste aparelho" className="border border-border bg-card p-4 space-y-3 rounded-none">
      <div className="flex items-center gap-2">
        <Bell className="h-5 w-5 text-muted-foreground shrink-0" />
        <h2 className="font-bold text-foreground">{push.isSubscribed ? "Notificações ativas neste aparelho" : modo === "contexto" ? "Ative as notificações para acompanhar seus avisos." : "Ative as notificações"}</h2>
      </div>
      {modo !== "contexto" && !push.isSubscribed && <p className="text-sm text-muted-foreground">Receba avisos de vaga liberada, documentos, mensalidades e conquistas.</p>}
      {push.needsInstall ? (
        <ol className="list-decimal pl-5 space-y-2 text-sm text-foreground">
          <li>No Safari, toque em Compartilhar.</li>
          <li>Toque em “Adicionar à Tela de Início”.</li>
          <li>Abra o app pelo ícone e ative as notificações.</li>
        </ol>
      ) : push.permission === "denied" ? (
        <p className="text-sm text-muted-foreground">As notificações estão bloqueadas. Nas configurações do aparelho ou do navegador, permita notificações para este site. Depois, volte ao portal para ativar.</p>
      ) : !push.isSupported ? (
        <p className="text-sm text-muted-foreground">Este navegador não oferece notificações. Use um navegador compatível, como o Chrome no Android ou no computador.</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {push.isSupported && push.permission !== "denied" && <Button className="rounded-none min-h-11" disabled={push.isLoading} onClick={push.isSubscribed ? push.unsubscribe : push.subscribe}>{push.isLoading ? "Aguarde..." : push.isSubscribed ? "Desativar" : "Ativar"}</Button>}
        {modo !== "configuracoes" && <Button variant="outline" className="rounded-none min-h-11" onClick={adiar}>Agora não</Button>}
      </div>
    </section>
  );
}
