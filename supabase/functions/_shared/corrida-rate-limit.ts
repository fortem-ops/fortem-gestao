// Rate limit compartilhado das rotas públicas da campanha /corrida.
// Mesma abordagem já usada em corrida-lookup-cpf (janelas fixas por IP).

export function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Retorna true quando a requisição está DENTRO do limite permitido.
 * janelaSegundos: tamanho da janela (default 60s). limite: máximo por janela.
 */
export async function checkRateLimit(
  admin: any,
  req: Request,
  endpoint: string,
  limite: number,
  janelaSegundos = 60,
): Promise<{ ok: boolean; ip: string }> {
  const ip = getClientIp(req);
  const janela_min = Math.floor(Date.now() / 1000 / janelaSegundos);

  try {
    const { data: rl } = await admin
      .from("rate_limit_corrida_publico")
      .select("contagem")
      .eq("ip_address", ip)
      .eq("endpoint", endpoint)
      .eq("janela_min", janela_min)
      .maybeSingle();

    const contagem = (rl?.contagem ?? 0) + 1;
    await admin
      .from("rate_limit_corrida_publico")
      .upsert(
        { ip_address: ip, endpoint, janela_min, contagem },
        { onConflict: "ip_address,endpoint,janela_min" },
      );

    return { ok: contagem <= limite, ip };
  } catch (_e) {
    // falha no controle não deve derrubar a rota
    return { ok: true, ip };
  }
}
