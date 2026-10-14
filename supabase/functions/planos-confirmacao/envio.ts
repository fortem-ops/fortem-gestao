export type RegistroEmail = { envio_id: string; dados: unknown; idempotency_key: string };

/** Reserva persistente + chave estável no provedor: chamadas concorrentes e repetidas não duplicam o envio. */
export async function executarEnvio(deps: {
  reservar: () => Promise<RegistroEmail | null>;
  enviar: (registro: RegistroEmail) => Promise<{ ok: boolean; status?: number }>;
  resultado: (id: string, ok: boolean, erro: string | null) => Promise<void>;
}) {
  const registro = await deps.reservar();
  if (!registro) return { ok: true, resultado: "nao_reservado" };
  let resposta: { ok: boolean; status?: number };
  try { resposta = await deps.enviar(registro); }
  catch { resposta = { ok: false, status: 0 }; }
  const erro = resposta.ok ? null : `Resend HTTP ${resposta.status ?? 0}`;
  await deps.resultado(registro.envio_id, resposta.ok, erro);
  return { ok: resposta.ok, resultado: resposta.ok ? "enviado" : "falha_envio" };
}