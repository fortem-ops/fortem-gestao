/**
 * Parser determinístico do laudo Kinology (lógica pura, sem IO).
 * Extraído de parse-kinology-pdf/index.ts para permitir testes unitários.
 */

export const EXERCICIO_ENUM = [
  "rotacao_interna",
  "rotacao_externa",
  "flexao_ombro",
  "extensao_ombro",
  "abducao_ombro",
  "aducao_ombro",
  "flexao_cotovelo",
  "extensao_cotovelo",
  "pronacao_antebraco",
  "supinacao_antebraco",
  "flexao_punho",
  "extensao_punho",
  "dorsiflexao",
  "flexao_plantar",
  "inversao",
  "flexao_joelho",
  "extensao_joelho",
  "flexao_quadril",
  "extensao_quadril",
  "abducao_quadril",
  "aducao_quadril",
] as const;

export type ExercicioEnum = typeof EXERCICIO_ENUM[number];

export interface ParsedExercise {
  nome: ExercicioEnum;
  data?: string;
  direito_kg: number;
  esquerdo_kg: number;
}

// Mapa label PT-BR (como aparece no PDF Kinology) → enum interno.
export const NOME_LABEL_TO_ENUM: Record<string, ExercicioEnum> = {
  "rotação interna": "rotacao_interna",
  "rotação externa": "rotacao_externa",
  "flexão de ombro": "flexao_ombro",
  "extensão de ombro": "extensao_ombro",
  "abdução de ombro": "abducao_ombro",
  "adução de ombro": "aducao_ombro",
  "flexão de cotovelo": "flexao_cotovelo",
  "extensão de cotovelo": "extensao_cotovelo",
  "pronação do antebraço": "pronacao_antebraco",
  "supinação do antebraço": "supinacao_antebraco",
  "flexão de punho": "flexao_punho",
  "extensão de punho": "extensao_punho",
  "dorsiflexão": "dorsiflexao",
  "flexão plantar": "flexao_plantar",
  "inversão": "inversao",
  "flexão de joelho": "flexao_joelho",
  "extensão de joelho": "extensao_joelho",
  "flexão de quadril": "flexao_quadril",
  "extensão de quadril": "extensao_quadril",
  "abdução de quadril": "abducao_quadril",
  "adução de quadril": "aducao_quadril",
};

const NOME_LABELS = Object.keys(NOME_LABEL_TO_ENUM);

// Regex que casa uma linha da tabela "Assimetria e Indicativos de Risco":
//   <NOME> <dd/mm/aaaa> <D> kg <E> kg <asym>%
// Testado nos laudos Kinology reais dos exemplos do projeto (Frederico Muller e Lucas Busato).
export const LINE_RE = new RegExp(
  String.raw`(` +
    NOME_LABELS.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") +
    String.raw`)\s+` +
    String.raw`(\d{2}\/\d{2}\/\d{4})\s+` +
    String.raw`([\d.,]+)\s*kg\s+([\d.,]+)\s*kg\s+[\d.,]+\s*%`,
  "gi",
);

export function toNumber(s: string): number {
  return parseFloat(s.replace(",", "."));
}

export interface HistoricoEntrada {
  data: string; // dd/mm/aaaa
  exercicios: ParsedExercise[];
}

// Tokens da seção "Evolução de Assimetria": ou um RÓTULO de exercício (título
// da mini-tabela) ou uma LINHA de dados `<dd/mm/aa|aaaa> <D> kg <E> kg <a>%`.
// O layout é em 2 colunas e a extração de texto intercala as linhas das duas
// tabelas lado a lado (A1, B1, A2, B2...), com os rótulos vindo em par antes
// do bloco de linhas. O pareamento abaixo reconstrói isso por bloco.
export const EVOL_TOKEN_RE = new RegExp(
  `(${NOME_LABELS.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})` +
    String.raw`|(\d{2}\/\d{2}\/(?:\d{4}|\d{2}))\s+([\d.,]+)\s*kg\s+([\d.,]+)\s*kg\s+[\d.,]+\s*%`,
  "gi",
);

export function normalizeDate(d: string): string {
  const [dd, mm, yy] = d.split("/");
  return `${dd}/${mm}/${yy.length === 2 ? `20${yy}` : yy}`;
}

const toSortKey = (s: string) => {
  const [dd, mm, yyyy] = s.split("/");
  return `${yyyy}-${mm}-${dd}`;
};

interface EvolRow {
  data: string;
  d: number;
  e: number;
}

/** Resultado da leitura da seção de evolução. `incerto` = não validou; caller cai pra IA. */
export interface EvolucaoResult {
  historico: HistoricoEntrada[];
  incerto: boolean;
}

/**
 * Distribui as linhas de um bloco entre os rótulos daquele bloco.
 * Round-robin entre os rótulos ainda "abertos": um rótulo fecha quando recebe
 * a linha que bate com a medição atual dele (última linha da mini-tabela).
 */
export function distribuirBloco(
  labels: ExercicioEnum[],
  rows: EvolRow[],
  atuaisPorNome: Map<ExercicioEnum, ParsedExercise>,
): Map<ExercicioEnum, EvolRow[]> | null {
  const out = new Map<ExercicioEnum, EvolRow[]>();
  labels.forEach((l) => out.set(l, []));
  if (labels.length === 1) {
    out.set(labels[0], rows);
    return out;
  }
  const fechado = new Set<ExercicioEnum>();
  let cursor = 0;
  for (const row of rows) {
    // acha o próximo rótulo aberto
    let tentativas = 0;
    while (fechado.has(labels[cursor % labels.length]) && tentativas < labels.length) {
      cursor++;
      tentativas++;
    }
    if (tentativas >= labels.length) return null; // todos fechados e ainda sobram linhas
    const label = labels[cursor % labels.length];
    out.get(label)!.push(row);
    const atual = atuaisPorNome.get(label);
    if (atual && atual.direito_kg === row.d && atual.esquerdo_kg === row.e) {
      fechado.add(label);
    }
    cursor++;
  }
  return out;
}

export function parseEvolucao(text: string, atuais: ParsedExercise[]): EvolucaoResult {
  if (atuais.length === 0) return { historico: [], incerto: false };
  const atuaisPorNome = new Map(atuais.map((a) => [a.nome, a]));

  // "Evolução de Assimetria" também aparece no índice da página 1 (seguido de
  // "Disponível"). Usamos a PRIMEIRA ocorrência real — a seção pode ocupar
  // várias páginas, cada uma repetindo o título.
  const ocorrencias = [...text.matchAll(/Evolu[çc][ãa]o de Assimetria/gi)].filter(
    (m) => !/Dispon[íi]vel/i.test(text.slice(m.index!, m.index! + 120)),
  );
  if (ocorrencias.length === 0) return { historico: [], incerto: false };
  const trecho = text.slice(ocorrencias[0].index!);

  // Varre em blocos: rótulos consecutivos → linhas consecutivas → próximo bloco.
  const porExercicio = new Map<ExercicioEnum, EvolRow[]>();
  let pendentes: ExercicioEnum[] = [];
  let linhas: EvolRow[] = [];
  let falhou = false;

  const flush = () => {
    if (pendentes.length === 0 || linhas.length === 0) {
      pendentes = [];
      linhas = [];
      return;
    }
    const dist = distribuirBloco(pendentes, linhas, atuaisPorNome);
    if (!dist) {
      falhou = true;
    } else {
      for (const [nome, rows] of dist) {
        porExercicio.set(nome, (porExercicio.get(nome) ?? []).concat(rows));
      }
    }
    pendentes = [];
    linhas = [];
  };

  for (const m of trecho.matchAll(EVOL_TOKEN_RE)) {
    if (m[1]) {
      const enumName = NOME_LABEL_TO_ENUM[m[1].toLowerCase()];
      if (!enumName) continue;
      if (linhas.length > 0) flush();
      pendentes.push(enumName);
    } else if (m[2]) {
      const d = toNumber(m[3]);
      const e = toNumber(m[4]);
      if (!isFinite(d) || !isFinite(e)) continue;
      linhas.push({ data: normalizeDate(m[2]), d, e });
    }
  }
  flush();

  if (falhou) return { historico: [], incerto: true };
  if (porExercicio.size === 0) return { historico: [], incerto: false };

  // Validação: a última linha de cada exercício precisa bater com a medição
  // atual (tabela "Assimetria e Indicativos de Risco") e as datas precisam
  // estar em ordem crescente. Se algo não fechar, o histórico é descartado.
  for (const [nome, rows] of porExercicio) {
    const atual = atuaisPorNome.get(nome);
    if (!atual || rows.length === 0) return { historico: [], incerto: true };
    const ultima = rows[rows.length - 1];
    if (ultima.d !== atual.direito_kg || ultima.e !== atual.esquerdo_kg) {
      return { historico: [], incerto: true };
    }
    for (let i = 1; i < rows.length; i++) {
      if (toSortKey(rows[i - 1].data) >= toSortKey(rows[i].data)) {
        return { historico: [], incerto: true };
      }
    }
  }

  // Agrupa por data (cada data pode ter um subconjunto diferente de exercícios).
  const grupos = new Map<string, ParsedExercise[]>();
  for (const [nome, rows] of porExercicio) {
    for (const r of rows) {
      if (!grupos.has(r.data)) grupos.set(r.data, []);
      grupos.get(r.data)!.push({
        nome,
        data: r.data,
        direito_kg: r.d,
        esquerdo_kg: r.e,
      });
    }
  }

  const historico: HistoricoEntrada[] = [...grupos.entries()].map(([data, exercicios]) => ({
    data,
    exercicios,
  }));

  return {
    historico: historico.sort((a, b) => (toSortKey(a.data) < toSortKey(b.data) ? 1 : -1)),
    incerto: false,
  };
}


/**
 * Parser determinístico do laudo Kinology. Não usa IA.
 * Retorna o mesmo shape que o fluxo de IA — { paciente, dataEmissao, exercicios[] }.
 * Se não reconhecer o padrão, devolve `exercicios: []` e o caller decide o fallback.
 */
export function tryParseKinologyDeterministic(text: string): {
  paciente: string | null;
  dataEmissao: string | null;
  exercicios: ParsedExercise[];
  historico: HistoricoEntrada[];
  historicoIncerto: boolean;
} {
  const seen = new Map<ExercicioEnum, ParsedExercise>();
  // A seção de evolução também casa com LINE_RE? Não: LINE_RE exige o rótulo do
  // exercício na mesma linha da data, o que só ocorre nas tabelas de assimetria.
  for (const m of text.matchAll(LINE_RE)) {
    const label = m[1].toLowerCase();
    const enumName = NOME_LABEL_TO_ENUM[label];
    if (!enumName) continue;
    const d = toNumber(m[3]);
    const e = toNumber(m[4]);
    if (!isFinite(d) || !isFinite(e)) continue;
    // Última ocorrência vence (o laudo lista membros superiores e inferiores em sequência,
    // e cada exercício aparece uma única vez na seção-fonte).
    seen.set(enumName, {
      nome: enumName,
      data: m[2],
      direito_kg: d,
      esquerdo_kg: e,
    });
  }

  const pacienteMatch = text.match(/Paciente:\s*([^\n\r]+?)\s{2,}/);
  const emissaoMatch = text.match(/Emiss[ãa]o:\s*(\d{2}\/\d{2}\/\d{4})/);
  const exercicios = [...seen.values()];
  const evol = parseEvolucao(text, exercicios);

  return {
    paciente: pacienteMatch ? pacienteMatch[1].trim() : null,
    dataEmissao: emissaoMatch ? emissaoMatch[1] : null,
    exercicios,
    historico: evol.historico,
    historicoIncerto: evol.incerto,
  };
}
