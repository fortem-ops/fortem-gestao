// Classificação tolerante dos avisos de Pix Automático (recorrência / cobrança recorrente).
// Inter/Bacen já enviaram listas com nomes diferentes: rec|recs, cobr|cobrs|cobsr.

export type Origem = "rec" | "cobr" | "pix";
export type Evento = { origem: Origem; ev: any };

const asArray = (v: unknown): any[] => (Array.isArray(v) ? v : v && typeof v === "object" ? [v] : []);

export function extrairEventos(payload: any, pixNaoTratados: any[] = []): Evento[] {
  const out: Evento[] = [];
  for (const k of ["rec", "recs"]) for (const ev of asArray(payload?.[k])) out.push({ origem: "rec", ev });
  for (const k of ["cobr", "cobrs", "cobsr"]) for (const ev of asArray(payload?.[k])) out.push({ origem: "cobr", ev });
  for (const ev of pixNaoTratados) out.push({ origem: "pix", ev });
  if (out.length === 0 && payload?.tipo) {
    const t = String(payload.tipo).toUpperCase();
    out.push({ origem: t.startsWith("REC") ? "rec" : "cobr", ev: payload });
  }
  return out;
}

/** Status interno de pix_recorrencias, ou null se não reconhecido. */
export function statusRec(ev: any): string | null {
  const s = String(ev?.tipo ?? ev?.evento ?? ev?.status ?? "").toUpperCase().replace(/^REC_/, "");
  const mapa: Record<string, string> = {
    APROVADA: "AUTORIZADA", AUTORIZADA: "AUTORIZADA",
    REJEITADA: "REJEITADA", CANCELADA: "CANCELADA", EXPIRADA: "EXPIRADA", CRIADA: "CRIADA",
  };
  return mapa[s] ?? null;
}

/** Status interno de pix_cobrancas, ou null se não reconhecido. */
export function statusCobr(ev: any): string | null {
  const s = String(ev?.tipo ?? ev?.evento ?? ev?.status ?? "").toUpperCase().replace(/^COBR_/, "");
  const mapa: Record<string, string> = {
    LIQUIDADA: "LIQUIDADA", CONCLUIDA: "LIQUIDADA",
    AGENDADA: "AGENDADA", ATIVA: "AGENDADA", CRIADA: "AGENDADA",
    REJEITADA: "REJEITADA", CANCELADA: "CANCELADA", EXPIRADA: "EXPIRADA",
  };
  return mapa[s] ?? null;
}

/** Ordem de status de recorrência: não volta de um estado final para CRIADA. */
export function podeAtualizarRec(atual: string | null | undefined, novo: string): boolean {
  if (!atual || atual === novo) return atual !== novo;
  if (novo === "CRIADA") return false;
  if (["CANCELADA", "REJEITADA", "EXPIRADA"].includes(atual)) return false;
  return true;
}

export function mascararCpf(v: unknown): unknown {
  return JSON.parse(JSON.stringify(v ?? null).replace(/\b\d{8}(\d{3})\b/g, "********$1"));
}

const CHAVES_OMITIDAS = /^(pixcopiaecola|copiaecola|emv|qrcode|location|token|access_token|authorization|secret)$/i;
const CHAVES_NOME = /^(nome|nomedevedor|nomepagador|nomerecebedor|devedornome)$/i;

/** Versão do aviso bruto segura para log: CPF só com os 3 finais, nome só com a inicial, sem copia e cola nem token. */
export function mascararAvisoLog(v: unknown): unknown {
  const andar = (x: unknown, chave = ""): unknown => {
    if (CHAVES_OMITIDAS.test(chave)) return "[omitido]";
    if (typeof x === "string") {
      if (CHAVES_NOME.test(chave)) return x.trim() ? `${x.trim()[0]}***` : x;
      return x
        .replace(/\b\d{3}\.\d{3}\.\d{3}-(\d)(\d{2})\b/g, "***.***.**$1-$2")
        .replace(/\b\d{8}(\d{3})\b/g, "********$1");
    }
    if (typeof x === "number" && Number.isInteger(x) && String(x).length === 11) return `********${String(x).slice(-3)}`;
    if (Array.isArray(x)) return x.map((i) => andar(i));
    if (x && typeof x === "object") {
      return Object.fromEntries(Object.entries(x as Record<string, unknown>).map(([k, val]) => [k, andar(val, k)]));
    }
    return x;
  };
  return andar(v ?? null);
}
