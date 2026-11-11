// Link de pagamento da 1ª mensalidade do Plano Semestral: validade, WhatsApp e mensagem aprovada.

const brl = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Espelho de fn_semestral_link_validade: 72 h, nunca depois do 8º dia da venda (00:00 de Brasília). */
export function validadeLinkSemestral(agora: Date, vendaCriadaEm: Date): Date {
  const sp = new Date(vendaCriadaEm.getTime() - 3 * 3600_000); // Brasília (UTC-3)
  const limite = Date.UTC(sp.getUTCFullYear(), sp.getUTCMonth(), sp.getUTCDate() + 8, 3, 0, 0);
  return new Date(Math.min(agora.getTime() + 72 * 3600_000, limite));
}

/** Telefone do aluno só com dígitos e 55 na frente; null se não houver um número válido. */
export function telefoneWhatsApp(tel: string | null | undefined): string | null {
  let d = String(tel ?? "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return /^55\d{10,11}$/.test(d) ? d : null;
}

export function mensagemLinkSemestral(p: { primeiroNome: string; plano: string; valor: number; link: string }): string {
  return (
    `Olá, ${p.primeiroNome}! Aqui é da FORTEM 💪\n` +
    `Seu ${p.plano} está quase pronto. Para concluir, é só abrir o link abaixo, aceitar o contrato, cadastrar seu cartão e pagar a 1ª mensalidade de R$ ${brl(p.valor)}:\n` +
    `${p.link}\n` +
    `O link vale por 72 horas. Qualquer dúvida, é só responder aqui.`
  );
}

export function urlWhatsAppSemestral(telefone: string, mensagem: string): string {
  return `https://api.whatsapp.com/send/?phone=${telefone}&text=${encodeURIComponent(mensagem)}`;
}
