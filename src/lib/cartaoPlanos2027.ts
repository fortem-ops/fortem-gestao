// Regras da tela de cartão do /planos. Os dados do cartão só existem nos campos do formulário
// e são apagados ao enviar; nada vai para storage, console ou URL.

export type FaseCartao = "formulario" | "validando" | "cobrando" | "confirmando" | "aprovado" | "recusado" | "expirado" | "esgotado";
export type TentativaCartaoTela = { tipo: "pix" | "cartao"; status: string; fase?: string | null } | null;

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

export const mascararNumeroCartao = (v: string) => v.replace(/\D/g, "").slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ");
export function mascararValidade(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

export type CamposCartao = { numero: string; nome: string; validade: string; cvv: string };
/** Confere o formulário; devolve o corpo para o servidor ou a mensagem de erro. */
export function validarCartao(c: CamposCartao, agora = new Date()): { ok: true; cartao: { numero: string; nome: string; mes: string; ano: string; cvv: string } } | { ok: false; erro: string } {
  const numero = c.numero.replace(/\D/g, "");
  if (!luhn(numero)) return { ok: false, erro: "Confira o número do cartão" };
  const nome = c.nome.trim().replace(/\s+/g, " ");
  if (nome.length < 3) return { ok: false, erro: "Informe o nome impresso no cartão" };
  const m = /^(\d{2})\/(\d{2})$/.exec(c.validade);
  const mes = m ? Number(m[1]) : 0, ano = m ? 2000 + Number(m[2]) : 0;
  if (!m || mes < 1 || mes > 12 || new Date(ano, mes, 1) <= agora) return { ok: false, erro: "Confira a validade do cartão" };
  const cvv = c.cvv.replace(/\D/g, "");
  if (!/^\d{3,4}$/.test(cvv)) return { ok: false, erro: "Confira o código de segurança" };
  return { ok: true, cartao: { numero, nome, mes: m[1], ano: String(ano), cvv } };
}

/** Fase da tela a partir da tentativa devolvida pelo servidor. */
export function faseCartao(t: TentativaCartaoTela, esgotado: boolean): FaseCartao {
  if (!t || t.tipo !== "cartao") return esgotado ? "esgotado" : "formulario";
  if (t.status === "aprovado") return "aprovado";
  if (t.status === "desconhecido") return "confirmando";
  if (t.status === "processando") return t.fase === "cobrando" ? "cobrando" : "validando";
  if (esgotado) return "esgotado";
  if (t.status === "expirado") return "expirado";
  if (t.status === "recusado") return "recusado";
  return "formulario";
}

/** Durante a validação, cobrança ou confirmação não se volta nem se altera a proposta. */
export const faseTravada = (f: FaseCartao) => f === "validando" || f === "cobrando" || f === "confirmando";
export const INTERVALO_CARTAO_MS = 8000;
