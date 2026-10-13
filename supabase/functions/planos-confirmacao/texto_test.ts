import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { montarEmail, decidirEnvio, mascararWhatsapp } from "./texto.ts";

const base = { nome: "Maria Souza", email: "m@x.com", whatsapp: "5551987651234", plano: "Power", frequencia: "3x", servicos: null, pagamento_tipo: "pix", parcelas: 1, total_centavos: 123456 };

Deno.test("e-mail sem CPF, sem cartão, WhatsApp mascarado e total certo", () => {
  const e = montarEmail({ ...base, cpf_ultimos3: "041" } as any);
  assertEquals(e.assunto, "FORTEM — pagamento confirmado");
  assertEquals(e.texto.includes("041"), false);
  assertEquals(e.texto.includes("(51) 9****-1234"), true);
  assertEquals(e.texto.includes("Total: R$ 1.234,56"), true);
  assertEquals(e.texto.includes("Pix à vista"), true);
  assertEquals(e.texto.includes("Olá, Maria."), true);
  assertEquals(e.texto.includes("!"), false);
});

Deno.test("cartão mostra parcelas; serviços só se houver", () => {
  const e = montarEmail({ ...base, pagamento_tipo: "cartao", parcelas: 12, servicos: "Nutrição" });
  assertEquals(e.texto.includes("Cartão de crédito em 12x"), true);
  assertEquals(e.texto.includes("Serviços: Nutrição"), true);
  assertEquals(montarEmail(base).texto.includes("Serviços"), false);
});

Deno.test("regra de envio: chave desligada, teste de admin e lista de teste", () => {
  assertEquals(decidirEnvio(base, false, []), "desligado");
  assertEquals(decidirEnvio(base, true, []), "enviar");
  assertEquals(decidirEnvio({ ...base, teste_admin: true }, true, []), "teste_rascunho");
  assertEquals(decidirEnvio({ ...base, teste_admin: true }, true, ["M@x.com"]), "enviar");
  assertEquals(decidirEnvio({ ...base, email: null }, true, []), "sem_email");
});

Deno.test("WhatsApp curto não vaza número", () => {
  assertEquals(mascararWhatsapp("123"), "cadastrado");
});
