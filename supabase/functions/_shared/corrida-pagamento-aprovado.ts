// Sequência de pós-pagamento aprovado do checkout /corrida.
// Extraída de corrida-cobrar-pedido para ser reaproveitada pelo caminho Pix.
// Comportamento idêntico ao original: consumo da vaga NB (quando aplicável),
// ativação do contrato e disparo do e-mail de confirmação (fire and forget).

export async function processarPagamentoAprovadoCorrida(
  supabase: any,
  params: { vendaId: string; contratoId?: string | null; alunoId?: string | null; modulo?: string },
): Promise<void> {
  const { vendaId } = params;
  const contratoId = params.contratoId ?? null;
  const modulo = params.modulo ?? "corrida-pagamento-aprovado";

  const { data: venda } = await supabase
    .from("vendas")
    .select("id, aluno_id, plano_id, observacoes")
    .eq("id", vendaId)
    .maybeSingle();

  const alunoId = params.alunoId ?? venda?.aluno_id ?? null;

  // ---------- vaga da promoção NB 42k (só consome com pagamento aprovado) ----------
  try {
    let temCortesia = false;
    try {
      const obs = JSON.parse(String(venda?.observacoes ?? "{}"));
      temCortesia = Boolean(obs?.cortesia_nb);
      if (!temCortesia) {
        const linhas = obs?.pedidoResumo?.linhas ?? [];
        temCortesia = Array.isArray(linhas) &&
          linhas.some((l: any) =>
            /NB 42k/i.test(String(l?.label ?? "")) && /50% OFF|Cortesia/i.test(String(l?.label ?? ""))
          );
      }
    } catch { /* observacoes não-JSON */ }

    if (temCortesia) {
      const { data: vaga, error: vagaErr } = await supabase.rpc("fn_corrida_consumir_vaga_nb");
      const row = Array.isArray(vaga) ? vaga[0] : vaga;
      if (vagaErr || !row?.consumida) {
        await supabase.from("system_logs").insert({
          modulo,
          acao: "vaga_nb_esgotada_apos_pagamento",
          mensagem:
            `Pagamento aprovado com a promoção NB 42k, mas não havia vaga disponível para consumir (venda ${vendaId}).`,
          payload: {
            venda_id: vendaId,
            aluno_id: alunoId,
            vagas_utilizadas: row?.vagas_utilizadas ?? null,
            vagas_totais: row?.vagas_totais ?? null,
            erro: vagaErr?.message ?? null,
          },
        });
      }
    }
  } catch (e) {
    console.error(`[${modulo}] consumo de vaga NB falhou:`, String(e));
  }

  // ---------- ativação do contrato ----------
  if (contratoId) {
    await supabase.from("contratos").update({ status: "ativo" }).eq("id", contratoId);
  }

  // ---------- link público de pagamento: só encerra com pagamento aprovado ----------
  try {
    await supabase
      .from("corrida_links_pagamento")
      .update({ usado_em: new Date().toISOString() })
      .eq("venda_id", vendaId)
      .is("usado_em", null);
  } catch (e) {
    console.error(`[${modulo}] falha ao marcar link de pagamento como usado:`, String(e));
  }


  // ---------- e-mail de confirmação — fire and forget ----------
  try {
    supabase.functions
      .invoke("corrida-enviar-confirmacao-email", {
        body: { venda_id: vendaId, contrato_id: contratoId },
      })
      .then((r: any) => {
        if (r?.error) {
          console.error(`[${modulo}] email confirmacao erro:`, String(r.error?.message ?? r.error));
        }
      })
      .catch((e: any) => console.error(`[${modulo}] email confirmacao erro:`, String(e)));
  } catch (e) {
    console.error(`[${modulo}] email confirmacao erro:`, String(e));
  }
}
