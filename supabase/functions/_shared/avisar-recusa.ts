// Dispara o aviso interno de compra recusada sem bloquear a resposta ao aluno.
// Qualquer falha de envio é apenas registrada no log — nunca propagada.

export interface AvisoRecusaPayload {
  fluxo: "loja" | "corrida";
  etapa: "tokenizacao" | "cobranca";
  pedido_id?: string | null;
  venda_id?: string | null;
  aluno_id?: string | null;
  return_code?: string | null;
  return_message?: string | null;
  erro?: string | null;
}

export function dispararAvisoRecusa(supabase: any, payload: AvisoRecusaPayload) {
  const p = (async () => {
    try {
      await supabase.functions.invoke("notificar-compra-recusada", { body: payload });
    } catch (e) {
      console.error("[avisar-recusa] falha ao disparar aviso:", String(e));
    }
  })();

  try {
    // @ts-ignore — disponível no runtime das edge functions
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(p);
    }
  } catch { /* ignore */ }

  return p;
}
