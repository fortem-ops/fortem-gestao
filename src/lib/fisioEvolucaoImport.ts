/**
 * Leitura de documentos de histórico de Fisioterapia (Evolução).
 * Funções puras: separam o texto do documento em sessões numeradas.
 */

export interface SessaoImportada {
  n: number;
  data: string | null; // ISO YYYY-MM-DD
  texto: string;
}

export interface ResultadoDivisao {
  cabecalho: string;
  dataCabecalho: string | null;
  sessoes: SessaoImportada[];
}

/** Converte dd/mm/aaaa em ISO (YYYY-MM-DD). Retorna null se inválida. */
export function dataParaISO(v: string | null | undefined): string | null {
  if (!v) return null;
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(v);
  if (!m) return null;
  const dia = parseInt(m[1], 10);
  const mes = parseInt(m[2], 10);
  let ano = parseInt(m[3], 10);
  if (ano < 100) ano += 2000;
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return null;
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** Remove marcadores, asteriscos de negrito e espaços de uma linha. */
function limparLinha(linha: string): string {
  return linha
    .replace(/\u00a0/g, " ")
    .replace(/^[\s>*_•●▪◦·\-–—]+/, "")
    .replace(/[\s*_]+$/, "")
    .trim();
}

/**
 * Detecta um título de sessão: "2° fisio 23/02/2026", "5º fisio 04/03/2026",
 * "45° fisio 17/07/2026", "12ª sessão 10/03/2026", "fisio 2 - 23/02/2026".
 */
export function tituloDeSessao(linhaOriginal: string): { n: number; data: string | null } | null {
  const linha = limparLinha(linhaOriginal);
  if (!linha) return null;
  if (linha.length > 140) return null;

  // Formato "N° fisio/sessão [data]"
  let m = /^(\d{1,3})\s*[°ºoª]?\s*(?:fisio(?:terapia)?|sess[ãa]o|atendimento)\b(.*)$/i.exec(linha);
  if (!m) {
    // Formato "fisio N - data"
    m = /^(?:fisio(?:terapia)?|sess[ãa]o|atendimento)\s*(?:n[º°.]?\s*)?(\d{1,3})\b(.*)$/i.exec(linha);
  }
  if (!m) return null;

  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n) || n < 1 || n > 500) return null;
  const resto = m[2] ?? "";
  return { n, data: dataParaISO(resto) };
}

/** Data da avaliação inicial no cabeçalho ("AVALIAÇÃO: 20/02/2026"). */
export function dataDoCabecalho(cabecalho: string): string | null {
  const m = /avalia[çc][ãa]o\s*:?\s*([^\n]*)/i.exec(cabecalho);
  const iso = dataParaISO(m?.[1] ?? null);
  if (iso) return iso;
  return dataParaISO(cabecalho.split("\n").slice(0, 12).join(" "));
}

/** Remove cabeçalhos de página gerados pela extração ("## Page 3", "Página 3"). */
function ehRuido(linha: string): boolean {
  const l = limparLinha(linha).toLowerCase();
  if (!l) return false;
  return /^#{0,3}\s*(page|p[áa]gina)\s*\d+$/.test(l);
}

/** Divide o texto do documento em cabeçalho (avaliação inicial) + sessões numeradas. */
export function dividirSessoes(texto: string): ResultadoDivisao {
  const linhas = (texto ?? "").replace(/\r\n?/g, "\n").split("\n");
  const cabecalhoLinhas: string[] = [];
  const sessoes: { n: number; data: string | null; linhas: string[] }[] = [];

  for (const linha of linhas) {
    if (ehRuido(linha)) continue;
    const titulo = tituloDeSessao(linha);
    if (titulo) {
      sessoes.push({ n: titulo.n, data: titulo.data, linhas: [] });
      continue;
    }
    if (sessoes.length === 0) cabecalhoLinhas.push(linha);
    else sessoes[sessoes.length - 1].linhas.push(linha);
  }

  const cabecalho = cabecalhoLinhas.join("\n").replace(/\n{3,}/g, "\n\n").trim();

  return {
    cabecalho,
    dataCabecalho: dataDoCabecalho(cabecalho),
    sessoes: sessoes
      .map((s) => ({
        n: s.n,
        data: s.data,
        texto: s.linhas.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
      }))
      .filter((s) => s.texto.length > 0),
  };
}

/**
 * Monta a lista final para conferência: cabeçalho vira a Sessão 1 (quando houver
 * conteúdo) e as demais mantêm a numeração do documento.
 */
export function montarSessoesParaConferencia(texto: string): SessaoImportada[] {
  const { cabecalho, dataCabecalho, sessoes } = dividirSessoes(texto);
  const lista: SessaoImportada[] = [];
  const temSessaoUm = sessoes.some((s) => s.n === 1);
  if (cabecalho.length > 40 && !temSessaoUm) {
    lista.push({ n: 1, data: dataCabecalho, texto: cabecalho });
  }
  return [...lista, ...sessoes].sort((a, b) => a.n - b.n);
}
