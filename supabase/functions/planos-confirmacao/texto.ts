import { convert } from "npm:html-to-text@9.0.5";
// O contrato vem exclusivamente do snapshot verificado no banco, nunca do template atual.
export type DadosEmail = {
  nome?: string | null; email?: string | null; whatsapp?: string | null; plano?: string | null; frequencia?: string | null;
  servicos?: string | null; pagamento_tipo?: string | null; parcelas?: number | null; total_centavos?: number | null;
  teste_admin?: boolean | null;
  teste_2027?: boolean | null; ensaio?: boolean;
  ativada_em?: string | null; pago_em?: string | null; pago_centavos?: number | null;
  data_inicio?: string | null; data_fim?: string | null;
  pagamento_referencia?: string | null; pagamento_nsu?: string | null;
  creditos?: { atividade: string; quantidade: number; ilimitado: boolean; validade?: string | null }[];
  contrato?: { html: string; hash: string; versao: number; regulamento_versao?: number | null; aceito_em: string } | null;
  recorrencia?: { familia?: string | null; mensal_centavos: number; dia: number; mensalidades?: number | null; final_cartao?: string | null } | null;
};

export function mascararWhatsapp(w: string | null | undefined): string {
  const d = String(w ?? "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length < 10) return "cadastrado";
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)}****-${d.slice(-4)}`;
}

const brl = (c: number | null | undefined) =>
  (Number(c ?? 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch] ?? ch));
const data = (s?: string | null) => s ? new Date(s.length === 10 ? `${s}T12:00:00Z` : s).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "Após a ativação";
const horario = (s?: string | null) => s ? new Date(s).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) + " (Brasília)" : "Não informado";

export function contratoTexto(html: string) {
  return convert(html, { wordwrap: false, selectors: [
    { selector: "a", options: { ignoreHref: true } },
    { selector: "img", format: "skip" }, { selector: "script", format: "skip" }, { selector: "style", format: "skip" },
  ] });
}

/** Bloco da assinatura (mesmo texto da tela de confirmação). Só o final do cartão, nunca o número. */
export function linhasRecorrencia(r: NonNullable<DadosEmail["recorrencia"]>): string[] {
  const cartao = r.final_cartao && /^\d{4}$/.test(r.final_cartao) ? ` no cartão final ${r.final_cartao}` : " no cartão cadastrado";
  return [
    `Assinatura ativa. 1ª mensalidade de R$ ${brl(r.mensal_centavos)} paga. Próximas cobranças automáticas todo dia ${r.dia}${cartao}.`,
    ...(r.dia >= 29 ? ["Em meses sem esse dia, a cobrança ocorre no último dia do mês."] : []),
    r.familia === "start_2027" ? "Plano Start: renova mensalmente, cancele quando quiser." : `${r.mensalidades ?? 12} mensalidades.`,
  ];
}

export function montarEmail(d: DadosEmail) {
  const primeiro = String(d.nome ?? "").trim().split(/\s+/)[0] || "você";
  const forma = d.recorrencia ? "Cartão de crédito recorrente" : d.pagamento_tipo === "pix" ? "Pix à vista" : `Cartão de crédito em ${d.parcelas ?? 1}x`;
  const linhas = [
    ...(d.ensaio ? ["ENSAIO SEGURO — não é uma nova compra nem comprova ativação.", ""] : []),
    `Olá, ${primeiro}.`, "",
    d.ensaio ? "Prévia do e-mail inicial da FORTEM, baseada em uma proposta de teste." : "Seu pagamento foi confirmado e seu plano foi ativado. Obrigado por escolher a FORTEM.", "",
    "Comprovante de pagamento",
    `Valor recebido: R$ ${brl(d.pago_centavos ?? d.total_centavos)}`,
    `Pagamento confirmado em: ${horario(d.pago_em)}`,
    ...(d.pagamento_referencia ? [`Referência do pagamento: ${d.pagamento_referencia}`] : []),
    ...(d.pagamento_nsu ? [`NSU: ${d.pagamento_nsu}`] : []), "",
    "Resumo",
    `Plano: ${[d.plano, d.frequencia].filter(Boolean).join(" ")}`,
    ...(d.servicos ? [`Serviços: ${d.servicos}`] : []),
    `Forma de pagamento: ${forma}`,
    ...(d.recorrencia ? linhasRecorrencia(d.recorrencia) : [`Total: R$ ${brl(d.total_centavos)}`]), "",
    `Início: ${data(d.data_inicio)}`,
    `Fim${d.recorrencia?.familia === "start_2027" ? " do ciclo pago" : " da vigência"}: ${data(d.data_fim)}`, "",
    "Créditos do programa",
    ...(d.creditos?.length ? d.creditos.map((c) => `${c.atividade}: ${c.ilimitado ? "ilimitados" : c.quantidade} · validade: ${data(c.validade)}`) : ["Créditos disponíveis após a ativação do programa."]), "",
    ...(d.contrato ? ["Dados do aceite", `Aceito em: ${horario(d.contrato.aceito_em)}`, `Versão do contrato: ${d.contrato.versao}`,
      ...(d.contrato.regulamento_versao != null ? [`Versão do regulamento: ${d.contrato.regulamento_versao}`] : []),
      `Hash SHA-256 do contrato aceito: ${d.contrato.hash}`, "", "Contrato aceito", contratoTexto(d.contrato.html), ""] : []),
    "Próximos passos",
    `Nossa equipe vai entrar em contato pelo WhatsApp ${mascararWhatsapp(d.whatsapp)} para organizar os agendamentos do programa.`, "",
    "Se tiver alguma dúvida, basta responder este e-mail.", "",
    "Equipe FORTEM",
  ];
  const texto = linhas.join("\n");
  const titulos = ["Comprovante de pagamento", "Resumo", "Créditos do programa", "Dados do aceite", "Contrato aceito", "Próximos passos"];
  const html = `<div style="background:#ffffff;color:#111111;font-family:Arial,sans-serif;font-size:15px;line-height:1.6;max-width:720px;margin:auto;padding:24px;overflow-wrap:anywhere">${
    linhas.map((l) => (l === "" ? "<br>" : titulos.includes(l) ? `<h2 style="font-size:18px;margin:20px 0 8px">${esc(l)}</h2>` : `<p style="margin:0;white-space:pre-wrap">${esc(l)}</p>`)).join("")
  }</div>`;
  return { assunto: d.ensaio ? "FORTEM — ensaio seguro de comprovante e contrato" : "FORTEM — pagamento confirmado e contrato", texto, html };
}

/** Decide se envia: chave ligada; teste de admin só para a lista de teste. */
export function decidirEnvio(d: DadosEmail, chaveAtiva: boolean, emailsTeste: string[]): "enviar" | "desligado" | "teste_rascunho" | "sem_email" {
  if (!d.email) return "sem_email";
  if (!chaveAtiva) return "desligado";
  if ((d.teste_admin || d.teste_2027) && !emailsTeste.map((e) => e.trim().toLowerCase()).includes(d.email.trim().toLowerCase())) return "teste_rascunho";
  return "enviar";
}
