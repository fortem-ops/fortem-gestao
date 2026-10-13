// Regras puras do cartão real do /planos. Sem rede, sem banco.

export type DadosCartao = { numero: string; nome: string; mes: string; ano: string; cvv: string };

export function luhn(n: string): boolean {
  if (!/^\d{13,19}$/.test(n)) return false;
  let s = 0, dobra = false;
  for (let i = n.length - 1; i >= 0; i--) {
    let d = n.charCodeAt(i) - 48;
    if (dobra) { d *= 2; if (d > 9) d -= 9; }
    s += d; dobra = !dobra;
  }
  return s % 10 === 0;
}

/** Valida o que veio do navegador. Retorna null se algo não confere (nunca ecoa os dados). */
export function lerDadosCartao(c: any, agora = new Date()): DadosCartao | null {
  const numero = String(c?.numero ?? "").replace(/\D/g, "");
  const nome = String(c?.nome ?? "").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z ]/g, "").replace(/\s+/g, " ").slice(0, 26);
  const mes = String(c?.mes ?? "").replace(/\D/g, "").padStart(2, "0");
  let ano = String(c?.ano ?? "").replace(/\D/g, "");
  if (ano.length === 2) ano = "20" + ano;
  const cvv = String(c?.cvv ?? "").replace(/\D/g, "");
  const m = Number(mes), a = Number(ano);
  if (!luhn(numero) || nome.length < 3 || m < 1 || m > 12 || !/^\d{4}$/.test(ano) || !/^\d{3,4}$/.test(cvv)) return null;
  const fimValidade = new Date(a, m, 1); // primeiro dia do mês seguinte
  if (fimValidade <= agora) return null;
  return { numero, nome, mes, ano, cvv };
}

/** `reference` da Rede: id da tentativa sem hífens (20 caracteres, único por tentativa). */
export const referencia = (tentativaId: string) => tentativaId.replace(/-/g, "").slice(0, 20);

export const chaveIdempotencia = (propostaId: string, aceiteId: string | null, tentativaId: string) =>
  `planos:${propostaId}:${aceiteId ?? ""}:${tentativaId}`;

export function mascararTid(tid: string | null | undefined): string | null {
  if (!tid) return null;
  return tid.length > 4 ? "*".repeat(tid.length - 4) + tid.slice(-4) : tid;
}

/** "MM/YYYY" do token → mês/ano; null se não der para ler. */
export function validadeToken(v: unknown): { mes: string; ano: string } | null {
  const m = /^(\d{1,2})\/(\d{4})$/.exec(String(v ?? "").trim());
  if (!m || Number(m[1]) < 1 || Number(m[1]) > 12) return null;
  return { mes: m[1].padStart(2, "0"), ano: m[2] };
}

export type ResultadoTransacao = "aprovado" | "recusado" | "desconhecido";
/** Timeout/erro de comunicação/5xx = desconhecido (nunca recobrar). returnCode 00 = aprovado. */
export function mapearTransacao(r: { erroRede: boolean; httpStatus: number; returnCode: string | null }): ResultadoTransacao {
  if (r.erroRede || r.httpStatus === 0 || r.httpStatus >= 500) return "desconhecido";
  if (r.returnCode === "00") return "aprovado";
  if (r.returnCode) return "recusado";
  return "desconhecido";
}

/** Consulta por referência (GET /transactions?reference=). */
export function mapearConsulta(httpStatus: number, parsed: any): ResultadoTransacao | "nao_encontrado" {
  if (httpStatus === 404) return "nao_encontrado";
  const st = String(parsed?.authorization?.status ?? "").toLowerCase();
  if (st === "approved") return "aprovado";
  if (st === "denied" || st === "canceled" || st === "cancelled") return "recusado";
  if (httpStatus >= 200 && httpStatus < 300 && !parsed?.authorization) return "nao_encontrado";
  return "desconhecido";
}

/** Só o que pode ser gravado da resposta da transação. */
export function sanitizarRaw(raw: any) {
  if (!raw || typeof raw !== "object") return null;
  return {
    returnCode: raw.returnCode ?? null,
    returnMessage: typeof raw.returnMessage === "string" ? raw.returnMessage.slice(0, 120) : null,
    tid: raw.tid ?? null, nsu: raw.nsu ?? null, authorizationCode: raw.authorizationCode ?? null,
  };
}

/** Prazos (ms). */
export const PRAZO_TOKEN_MS = 10 * 60_000;      // token sem ativar → expirado
export const PRAZO_COBRAR_MS = 30 * 60_000;     // token ativo, mas o cliente sumiu: não cobra depois disso
export const PRAZO_COBRANDO_MS = 2 * 60_000;    // "cobrando" travado → desconhecido (conciliar)
export const INTERVALO_CONSULTA_MS = 30_000;

/** Fase visível ao visitante (nunca o motivo interno). */
export function fasePublica(status: string, motivo: string | null): "validando" | "cobrando" | "confirmando" | null {
  if (status === "desconhecido") return "confirmando";
  if (status !== "processando") return null;
  return motivo === "cobrando" ? "cobrando" : "validando";
}
