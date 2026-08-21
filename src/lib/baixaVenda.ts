import { supabase } from "@/integrations/supabase/client";
import type { FormaRecebimento } from "@/lib/formasRecebimento";

const db = supabase as any;

/**
 * Propaga a baixa de uma cobrança para a venda correspondente:
 * - status_pagamento -> "pago" SEMPRE (exceto vendas canceladas/estornadas);
 * - forma_pagamento -> forma recebida apenas quando ainda está vazia/"pendente".
 *
 * Alvo: primeiro pelo vínculo direto (vendas.cobranca_id); se não houver,
 * cai para o plano do contrato da cobrança.
 */
export async function propagarBaixaParaVenda(
  cobrancaId: string,
  forma?: FormaRecebimento,
): Promise<void> {
  const ids = await resolverVendaIds(cobrancaId);
  if (!ids.length) return;

  await db
    .from("vendas")
    .update({ status_pagamento: "pago" })
    .in("id", ids)
    .not("status_pagamento", "in", "(cancelado,estornado)");

  if (forma) {
    await db
      .from("vendas")
      .update({ forma_pagamento: forma.vendaForma })
      .in("id", ids)
      .or("forma_pagamento.is.null,forma_pagamento.eq.pendente");
  }
}

export async function propagarBaixaEmLote(
  cobrancaIds: string[],
  forma?: FormaRecebimento,
): Promise<void> {
  for (const id of cobrancaIds) {
    await propagarBaixaParaVenda(id, forma);
  }
}

async function resolverVendaIds(cobrancaId: string): Promise<string[]> {
  const { data: diretas } = await db
    .from("vendas")
    .select("id")
    .eq("cobranca_id", cobrancaId);
  if (diretas?.length) return diretas.map((v: any) => v.id);

  const { data: cobranca } = await db
    .from("cobrancas")
    .select("aluno_id, contrato_id")
    .eq("id", cobrancaId)
    .maybeSingle();
  if (!cobranca?.contrato_id) return [];

  const { data: contrato } = await db
    .from("contratos")
    .select("plano_id")
    .eq("id", cobranca.contrato_id)
    .maybeSingle();
  if (!contrato?.plano_id) return [];

  const { data: vendas } = await db
    .from("vendas")
    .select("id")
    .eq("aluno_id", cobranca.aluno_id)
    .eq("plano_id", contrato.plano_id);

  return (vendas ?? []).map((v: any) => v.id);
}
