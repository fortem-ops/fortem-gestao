// Texto do e-mail de confirmação de pagamento do /planos (rascunho aprovado no plano P4).
// Nunca inclui CPF nem dados de cartão.
export type DadosEmail = {
  nome?: string | null; email?: string | null; whatsapp?: string | null; plano?: string | null; frequencia?: string | null;
  servicos?: string | null; pagamento_tipo?: string | null; parcelas?: number | null; total_centavos?: number | null;
  teste_admin?: boolean | null;
};

export function mascararWhatsapp(w: string | null | undefined): string {
  const d = String(w ?? "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length < 10) return "cadastrado";
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)}****-${d.slice(-4)}`;
}

const brl = (c: number | null | undefined) =>
  (Number(c ?? 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]!));

export function montarEmail(d: DadosEmail) {
  const primeiro = String(d.nome ?? "").trim().split(/\s+/)[0] || "você";
  const forma = d.pagamento_tipo === "pix" ? "Pix à vista" : `Cartão de crédito em ${d.parcelas ?? 1}x`;
  const linhas = [
    `Olá, ${primeiro}.`, "",
    "Recebemos o seu pagamento. Obrigado por escolher a FORTEM.", "",
    "Resumo",
    `Plano: ${[d.plano, d.frequencia].filter(Boolean).join(" ")}`,
    ...(d.servicos ? [`Serviços: ${d.servicos}`] : []),
    `Forma de pagamento: ${forma}`,
    `Total: R$ ${brl(d.total_centavos)}`, "",
    "Próximos passos",
    `Nossa equipe vai entrar em contato pelo WhatsApp ${mascararWhatsapp(d.whatsapp)} para agendar a sua ativação e o início do programa.`, "",
    "Se tiver alguma dúvida, basta responder este e-mail.", "",
    "Equipe FORTEM",
  ];
  const texto = linhas.join("\n");
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#111">${
    linhas.map((l) => (l === "" ? "<br>" : ["Resumo", "Próximos passos"].includes(l) ? `<p style="margin:0"><strong>${l}</strong></p>` : `<p style="margin:0">${esc(l)}</p>`)).join("")
  }</div>`;
  return { assunto: "FORTEM — pagamento confirmado", texto, html };
}

/** Decide se envia: chave ligada; teste de admin só para a lista de teste. */
export function decidirEnvio(d: DadosEmail, chaveAtiva: boolean, emailsTeste: string[]): "enviar" | "desligado" | "teste_rascunho" | "sem_email" {
  if (!d.email) return "sem_email";
  if (!chaveAtiva) return "desligado";
  if (d.teste_admin && !emailsTeste.map((e) => e.toLowerCase()).includes(d.email.toLowerCase())) return "teste_rascunho";
  return "enviar";
}
