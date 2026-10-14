// Checkout /planos 2027: montagem do texto do contrato no servidor.
// Espelha src/lib/contratos2027.ts (teste compara as duas saídas) e o preenchimento de contratosDocumentos.ts.
// Nunca registra CPF em log.

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
export interface ServicoTabela { nome: string; valor: number | string }

export interface Contratante {
  nome: string; email: string; cpf: string; data_nascimento: string; cep: string;
  logradouro: string; numero: string; complemento?: string | null; bairro: string;
  cidade: string; uf: string; rg?: string | null;
}

export const ETAPAS = ["rascunho", "identificada", "contrato_aceito", "aguardando_pagamento", "paga", "falhou", "expirada"] as const;
export type Etapa = typeof ETAPAS[number];

/** Transições válidas do checkout (a Fase 2 só usa até contrato_aceito + expirada). */
const TRANSICOES: Record<Etapa, Etapa[]> = {
  rascunho: ["identificada", "expirada"],
  identificada: ["identificada", "contrato_aceito", "expirada"],
  contrato_aceito: ["identificada", "contrato_aceito", "aguardando_pagamento", "expirada"],
  aguardando_pagamento: ["paga", "falhou", "expirada"],
  paga: [],
  falhou: ["identificada", "aguardando_pagamento"],
  expirada: ["identificada", "contrato_aceito"],
};
export function podeTransitar(de: Etapa, para: Etapa): boolean {
  return TRANSICOES[de]?.includes(para) ?? false;
}

export const VALIDADE_MS = 24 * 60 * 60 * 1000;
export function expirada(ultimaAtividade: Date, agora = new Date()): boolean {
  return agora.getTime() - ultimaAtividade.getTime() > VALIDADE_MS;
}

export function formaTemplate(formaPlano: string): "cartao_recorrencia" | "cartao_parcelado" {
  return formaPlano === "recorrencia" ? "cartao_recorrencia" : "cartao_parcelado";
}

export async function hashTexto(texto: string): Promise<string> {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
}

export function cpfDigitosValidos(v: string): boolean {
  const d = (v ?? "").replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

/** Tira qualquer CPF (com ou sem pontuação) de textos de log/erro. */
export function semCpf(texto: string): string {
  return String(texto ?? "").replace(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g, "***");
}

const escapar = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

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

export function montarClausulaReposicao(item: CatalogoPlano2027): string {
  const pct = Number(item.reposicao_saldo_pct ?? 0);
  if (pct <= 0 || ehLivre(item)) return "";
  const pctTxt = pct === 50 ? "50% (cinquenta por cento)" : `${pct}%`;
  return (
    `<h2>DA REPOSIÇÃO DE CRÉDITOS</h2>\n` +
    `<p><strong>Cláusula 15ª-A</strong> – Ao final da vigência deste contrato, ${pctTxt} do saldo de créditos de treino não utilizados, arredondado para cima, será transferido ao novo plano contratado pelo ALUNO, para uso conforme a vigência deste novo plano, desde que o novo plano seja contratado em até 30 (trinta) dias corridos após o término da vigência deste contrato; encerrado esse prazo, o saldo não será transferido.</p>\n` +
    `<p>Parágrafo único – A reposição vale somente para créditos de treino, não se aplicando a créditos de nutrição, reabilitação ou avaliações.</p>\n\n`
  );
}

export function montarVariaveis2027(item: CatalogoPlano2027, servicos: ServicoTabela[]): Record<string, string> {
  const valor = Number(item.valor || 0);
  // Start 2027 não tem taxa de recorrência, mesmo que o catálogo traga valor.
  const taxa = item.familia === "start_2027" ? 0 : Number(item.taxa_recorrencia || 0);
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

const fmtCpf = (c: string) => { const d = c.replace(/\D/g, ""); return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`; };
const fmtCep = (c: string) => { const d = c.replace(/\D/g, ""); return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : d; };
const fmtData = (iso: string) => { const [a, m, d] = String(iso).slice(0, 10).split("-"); return a && m && d ? `${d}/${m}/${a}` : ""; };

/** Data de hoje em São Paulo (dd, MM, yyyy). */
export function hojeSP(agora = new Date()) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(agora).split("-");
  return { ANO: p[0], MES: p[1], DIA: p[2] };
}

/** Variáveis completas (contratante + plano), na mesma ordem do fluxo do admin. */
export function montarVariaveisContrato(params: {
  contratante: Contratante; templateNome: string; totalCentavos: number;
  item: CatalogoPlano2027; servicos: ServicoTabela[]; agora?: Date;
}): Record<string, string> {
  const c = params.contratante;
  const vars: Record<string, string> = {
    NOME: escapar(c.nome),
    DATA_NASCIMENTO: fmtData(c.data_nascimento),
    CPF: fmtCpf(c.cpf),
    RG: escapar(c.rg ?? ""),
    ENDERECO: escapar(`${c.logradouro}, ${c.numero}${c.complemento ? ` - ${c.complemento}` : ""}`),
    BAIRRO: escapar(c.bairro),
    CIDADE: escapar(c.cidade || "Porto Alegre"),
    UF: escapar(c.uf || "RS"),
    CEP: fmtCep(c.cep),
    EMAIL: escapar(c.email),
    NOME_CONTRATO: escapar(params.templateNome),
    VALOR_FINAL_CONTRATO: brl(params.totalCentavos / 100),
    ...hojeSP(params.agora),
  };
  Object.assign(vars, montarVariaveis2027(params.item, params.servicos));
  return vars;
}

const ACEITE = ["ASSINATURA", "ACEITE", "DATA_ACEITE", "FORMATO_ACEITE", "IP_ACEITE"];
export function preencherContrato(conteudo: string, vars: Record<string, string>): string {
  let out = conteudo;
  for (const [k, v] of Object.entries(vars)) if (!ACEITE.includes(k)) out = out.split(`%${k}%`).join(v ?? "");
  for (const k of ACEITE) out = out.split(`%${k}%`).join("");
  return out;
}

/** Variáveis para guardar: CPF só com os 3 últimos dígitos. */
export function variaveisParaGuardar(vars: Record<string, string>): Record<string, string> {
  const out = { ...vars };
  if (out.CPF) out.CPF = `***.***.**${out.CPF.replace(/\D/g, "").slice(-3).slice(0, 1)}-${out.CPF.replace(/\D/g, "").slice(-2)}`;
  return out;
}
