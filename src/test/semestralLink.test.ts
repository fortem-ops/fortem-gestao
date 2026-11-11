import { describe, expect, it } from "vitest";
import { mensagemLinkSemestral, telefoneWhatsApp, urlWhatsAppSemestral, validadeLinkSemestral } from "@/lib/semestralLink";

describe("link de pagamento do Semestral", () => {
  it("validade é 72 h quando a venda é recente", () => {
    const agora = new Date("2026-11-11T20:00:00Z");
    expect(validadeLinkSemestral(agora, new Date("2026-11-11T19:00:00Z")).toISOString()).toBe("2026-11-14T20:00:00.000Z");
  });
  it("validade nunca passa do dia em que a venda expira (8º dia, 00:00 de Brasília)", () => {
    const agora = new Date("2026-11-17T20:00:00Z");
    expect(validadeLinkSemestral(agora, new Date("2026-11-11T19:00:00Z")).toISOString()).toBe("2026-11-19T03:00:00.000Z");
  });
  it("telefone vira 55+DDD+número; sem telefone não há WhatsApp", () => {
    expect(telefoneWhatsApp("(51) 99876-5432")).toBe("5551998765432");
    expect(telefoneWhatsApp("+55 51 99876-5432")).toBe("5551998765432");
    expect(telefoneWhatsApp("")).toBeNull();
    expect(telefoneWhatsApp("123")).toBeNull();
  });
  it("mensagem aprovada com nome, plano, valor e link", () => {
    const m = mensagemLinkSemestral({ primeiroNome: "Ana", plano: "Pro Semestral", valor: 469, link: "https://x/pagamento/abc" });
    expect(m).toBe(
      "Olá, Ana! Aqui é da FORTEM 💪\nSeu Pro Semestral está quase pronto. Para concluir, é só abrir o link abaixo, aceitar o contrato, cadastrar seu cartão e pagar a 1ª mensalidade de R$ 469,00:\nhttps://x/pagamento/abc\nO link vale por 72 horas. Qualquer dúvida, é só responder aqui.",
    );
  });
  it("link do WhatsApp usa api.whatsapp.com com o telefone do aluno e texto codificado", () => {
    expect(urlWhatsAppSemestral("5551998765432", "Olá & tchau")).toBe("https://api.whatsapp.com/send/?phone=5551998765432&text=Ol%C3%A1%20%26%20tchau");
  });
});
