/**
 * Contratos dos planos versionados (2027+).
 * Seleção do template por família do catálogo + forma de cobrança, e montagem
 * das variáveis a partir das colunas do planos_catalogo/servicos_catalogo.
 */

export interface CatalogoPlano2027 {
  familia: string | null;
  versao: number | null;
  nome_exibicao?: string | null;
  nome?: string | null;
  frequencia?: string | null;
  valor: number | string;
  taxa_recorrencia?: number | string | null;
  licenca_dias?: number | null;
  avaliacoes_funcionais_meses?: number[] | null;
  permite_fixar_horario?: boolean | null;
  bota_compressao_mes?: number | null;
  brindes?: string[] | null;
  nivel_clube?: string | null;
  reposicao_saldo_pct?: number | string | null;
  ilimitado?: boolean | null;
}

export interface ServicoTabela {
  nome: string;
  valor: number | string;
}

/** Item versionado usa o template próprio; legado (versao nula) segue o mapa antigo. */
export function ehPlanoVersionado(item?: { versao?: number | null; familia?: string | null } | null): boolean {
  return !!item && item.versao != null && !!item.familia;
}

/** Forma de pagamento do template: recorrência ou parcelado (12x / PIX à vista). */
export function formaTemplate(tipoCobranca: string): "cartao_recorrencia" | "cartao_parcelado" {
  return tipoCobranca === "recorrencia" ? "cartao_recorrencia" : "cartao_parcelado";
}

const brl = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const FREQ_LABEL: Record<string, string> = {
  "1x": "1 (uma) vez por semana",
  "2x": "2 (duas) vezes por semana",
  "3x": "3 (três) vezes por semana",
  livre: "Livre",
};

const BRINDE_LABEL: Record<string, string> = { camiseta: "camiseta", garrafinha: "garrafinha" };

function ehLivre(item: CatalogoPlano2027) {
  return (item.frequencia ?? "").toLowerCase() === "livre" || !!item.ilimitado;
}

export function montarBeneficios(item: CatalogoPlano2027): string {
  const lis: string[] = [];
  const av = item.avaliacoes_funcionais_meses ?? [];
  if (av.length === 1) lis.push(`1 (uma) avaliação funcional no ${av[0]}º mês`);
  else if (av.length > 1)
    lis.push(`${av.length} avaliações funcionais (${av.map((m) => `${m}º`).join(" e ")} mês)`);
  if (item.licenca_dias) lis.push(`${item.licenca_dias} dias de licença`);
  if (item.permite_fixar_horario) lis.push("fixação de horários");
  if (item.bota_compressao_mes)
    lis.push(
      `${item.bota_compressao_mes} sessões por mês de bota de compressão pneumática, agendáveis no portal, não acumuláveis`,
    );
  const br = (item.brindes ?? []).map((b) => BRINDE_LABEL[b] ?? b);
  if (br.length) lis.push(`brinde: ${br.join(" e ")}`);
  if (item.nivel_clube === "diamante") lis.push("condições especiais no Clube Fortem");
  if (!lis.length) return "";
  return `<ul>\n${lis.map((l) => `<li>${l}</li>`).join("\n")}\n</ul>`;
}

export function montarTabelaServicos(servicos: ServicoTabela[]): string {
  if (!servicos.length) return "";
  const linhas = [...servicos]
    .sort((a, b) => Number(b.valor) - Number(a.valor))
    .map((s) => `<li>${s.nome.replace(/\s*\(2027\)\s*$/, "")}: ${brl(Number(s.valor))}</li>`);
  return `<ul>\n${linhas.join("\n")}\n</ul>`;
}

/** Cláusula de reposição: só itens com reposicao_saldo_pct > 0 e fora do Livre. */
export function montarClausulaReposicao(item: CatalogoPlano2027): string {
  const pct = Number(item.reposicao_saldo_pct ?? 0);
  if (pct <= 0 || ehLivre(item)) return "";
  return (
    `<h2>DA REPOSIÇÃO DE CRÉDITOS</h2>\n` +
    `<p><strong>Cláusula 15ª-A</strong> – Ao final da vigência deste contrato, ${pct}% (cinquenta por cento) do saldo de créditos de treino não utilizados, arredondado para cima, será transferido ao novo plano contratado pelo ALUNO, para uso conforme a vigência deste novo plano.</p>\n` +
    `<p>Parágrafo único – A reposição vale somente para créditos de treino, não se aplicando a créditos de nutrição, reabilitação ou avaliações.</p>\n\n`
  ).replace(`${pct}% (cinquenta por cento)`, pct === 50 ? "50% (cinquenta por cento)" : `${pct}%`);
}

export function montarVariaveis2027(
  item: CatalogoPlano2027,
  servicos: ServicoTabela[],
): Record<string, string> {
  const valor = Number(item.valor || 0);
  const taxa = Number(item.taxa_recorrencia || 0);
  const freq = (item.frequencia ?? "").toLowerCase();
  const nome = item.nome_exibicao ?? item.nome ?? "";
  return {
    NOME_CONTRATO: freq ? `${nome} ${freq === "livre" ? "Livre" : freq}` : nome,
    FREQUENCIA: FREQ_LABEL[freq] ?? item.frequencia ?? "",
    VALOR_MENSAL: brl(valor + taxa),
    TAXA_RECORRENCIA: brl(taxa),
    LICENCA_DIAS: item.licenca_dias != null ? String(item.licenca_dias) : "",
    BENEFICIOS_PLANO: montarBeneficios(item),
    TABELA_SERVICOS: montarTabelaServicos(servicos),
    CLAUSULA_REPOSICAO: montarClausulaReposicao(item),
  };
}
