/**
 * Gravação de cartão salvo com substituição do cartão anterior.
 *
 * Motivação: os três pontos que gravavam em `cartoes_salvos`
 * (rede-tokenizacao-webhook, rede-salvar-cartao, rede-cobrar-cartao)
 * faziam INSERT cego. Recadastrar o mesmo plástico criava uma linha nova,
 * deixando contratos/planos apontando para o token antigo (que costuma ser
 * justamente o que falhou) e podendo produzir mais de um `is_default = true`
 * por aluno.
 *
 * Regra adotada (opção "substituir com repontamento"):
 *  - a chave de duplicata é apenas `aluno_id + last4` (a validade digitada
 *    pode variar entre cadastros do mesmo cartão);
 *  - o cartão novo é sempre inserido com `is_default = true`;
 *  - o cartão antigo é desativado (`ativo = false`, `is_default = false`);
 *  - `contratos.cartao_token_id` e `planos.cartao_token_id` que apontavam
 *    para o antigo passam a apontar para o novo;
 *  - qualquer outro cartão ativo do aluno perde o `is_default`.
 *
 * Nada disso cria constraint no banco — a garantia é de aplicação.
 */

export interface SalvarCartaoInput {
  alunoId: string;
  last4: string;
  tokenRede: string | null;
  brand: string | null;
  expirationMonth: number;
  expirationYear: number;
  holderName: string;
  origem: string;
}

export interface CartaoAtivoRow {
  id: string;
  last4: string | null;
}

export interface DecisaoSubstituicao {
  /** id do cartão que deve ser desativado e repontado (null = nenhum) */
  substituirId: string | null;
  /** ids de cartões ativos que só precisam perder o is_default */
  limparDefaultIds: string[];
}

/**
 * Função pura: decide, a partir dos cartões ativos do aluno, qual deve ser
 * substituído e quais apenas perdem o `is_default`.
 *
 * - Cartão ativo com o mesmo `last4` → substituição (o mais antigo primeiro,
 *   caso exista mais de um por passivo histórico; os demais entram em
 *   `limparDefaultIds` e também são desativados pelo chamador).
 * - Cartões ativos com `last4` diferente → apenas perdem o `is_default`.
 */
export function decidirSubstituicao(
  cartoesAtivos: CartaoAtivoRow[],
  last4: string,
  novoCartaoId?: string | null,
): DecisaoSubstituicao {
  const outros = (cartoesAtivos ?? []).filter(
    (c) => c && c.id && c.id !== novoCartaoId,
  );
  const mesmos = outros.filter((c) => (c.last4 ?? "") === last4);
  const substituirId = mesmos.length > 0 ? mesmos[0].id : null;
  const limparDefaultIds = outros
    .filter((c) => c.id !== substituirId)
    .map((c) => c.id);
  return { substituirId, limparDefaultIds };
}

export interface SalvarCartaoResultado {
  cartaoId: string | null;
  substituiuId: string | null;
  contratosRepontados: number;
  planosRepontados: number;
  erro: string | null;
}

/**
 * Insere o cartão novo e aplica a substituição/limpeza de is_default.
 * `supabase` deve ser um client com service_role.
 */
export async function salvarCartaoComSubstituicao(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  input: SalvarCartaoInput,
): Promise<SalvarCartaoResultado> {
  const last4 = String(input.last4 ?? "").trim();

  // (a) cartões ativos do aluno — base da decisão
  const { data: ativos } = await supabase
    .from("cartoes_salvos")
    .select("id, last4")
    .eq("aluno_id", input.alunoId)
    .eq("ativo", true);

  const decisao = decidirSubstituicao((ativos ?? []) as CartaoAtivoRow[], last4);

  // (b) insere o novo cartão como padrão
  const { data: novo, error: insErr } = await supabase
    .from("cartoes_salvos")
    .insert({
      aluno_id: input.alunoId,
      token_rede: input.tokenRede,
      brand: input.brand,
      last4,
      holder_name: input.holderName,
      expiration_month: input.expirationMonth,
      expiration_year: input.expirationYear,
      ativo: true,
      is_default: true,
      origem: input.origem,
    })
    .select("id")
    .maybeSingle();

  if (insErr || !novo?.id) {
    return {
      cartaoId: null,
      substituiuId: null,
      contratosRepontados: 0,
      planosRepontados: 0,
      erro: insErr?.message ?? "insert_sem_id",
    };
  }

  const novoId: string = novo.id;
  const agora = new Date().toISOString();

  // (d) nenhum outro cartão ativo pode continuar como padrão
  for (const id of decisao.limparDefaultIds) {
    await supabase
      .from("cartoes_salvos")
      .update({ is_default: false })
      .eq("id", id);
  }

  let contratosRepontados = 0;
  let planosRepontados = 0;

  // (c) substituição do cartão anterior de mesmo last4
  if (decisao.substituirId) {
    const antigoId = decisao.substituirId;

    await supabase
      .from("cartoes_salvos")
      .update({ ativo: false, is_default: false })
      .eq("id", antigoId);

    const { data: contratos } = await supabase
      .from("contratos")
      .update({ cartao_token_id: novoId, updated_at: agora })
      .eq("cartao_token_id", antigoId)
      .select("id");
    contratosRepontados = Array.isArray(contratos) ? contratos.length : 0;

    const { data: planos } = await supabase
      .from("planos")
      .update({ cartao_token_id: novoId })
      .eq("cartao_token_id", antigoId)
      .select("id");
    planosRepontados = Array.isArray(planos) ? planos.length : 0;

    try {
      await supabase.from("system_logs").insert({
        modulo: "cartao-substituicao",
        acao: "cartao_substituido",
        mensagem:
          `Cartão ${antigoId} substituído por ${novoId} (aluno ${input.alunoId}) — ` +
          `${contratosRepontados} contrato(s) e ${planosRepontados} plano(s) repontados`,
        payload: {
          aluno_id: input.alunoId,
          cartao_antigo_id: antigoId,
          cartao_novo_id: novoId,
          last4,
          origem: input.origem,
          contratos_repontados: contratosRepontados,
          planos_repontados: planosRepontados,
        },
      });
    } catch (e) {
      console.error("[cartao-substituicao] falha ao registrar system_logs:", String(e));
    }
  }

  return {
    cartaoId: novoId,
    substituiuId: decisao.substituirId,
    contratosRepontados,
    planosRepontados,
    erro: null,
  };
}
