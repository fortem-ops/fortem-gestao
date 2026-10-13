import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { chaveIdempotencia, lerDadosCartao, mapearConsulta, mapearTransacao, mascararTid, referencia, sanitizarRaw } from "./cartao.ts";
import { estadoToken } from "../_shared/planos-cartao-token.ts";
import { cartaoRealElegivel, chavesLimite } from "./pagamento.ts";
import { acompanharCartaoReal, iniciarCartaoReal, type Deps, type TentativaCartao } from "./fluxo-cartao.ts";

const NUM = "4235647728025682", CVV = "123", NOME = "NICOLAS TESTE";
const dados = { numero: NUM, nome: NOME, mes: "12", ano: "2030", cvv: CVV };

Deno.test("puras: referência, chave, máscara, mapeamentos", () => {
  assertEquals(referencia("11111111-2222-3333-4444-555555555555"), "11111111222233334444");
  assertEquals(chaveIdempotencia("p", "a", "t"), "planos:p:a:t");
  assertEquals(mascararTid("12345678"), "****5678");
  assertEquals(mapearTransacao({ erroRede: true, httpStatus: 0, returnCode: null }), "desconhecido");
  assertEquals(mapearTransacao({ erroRede: false, httpStatus: 502, returnCode: "00" }), "desconhecido");
  assertEquals(mapearTransacao({ erroRede: false, httpStatus: 200, returnCode: "00" }), "aprovado");
  assertEquals(mapearTransacao({ erroRede: false, httpStatus: 400, returnCode: "51" }), "recusado");
  assertEquals(mapearConsulta(404, null), "nao_encontrado");
  assertEquals(mapearConsulta(200, { authorization: { status: "Approved" } }), "aprovado");
  assertEquals(estadoToken({ tokenizationStatus: "Active", token: { code: "x" } }), "ativo");
  assertEquals(estadoToken({ tokenizationStatus: "Active", brand: { tokenStatus: "Failed" }, token: { code: "x" } }), "recusado");
  assertEquals(estadoToken({ tokenizationStatus: "Pending" }), "pendente");
  assertEquals(lerDadosCartao({ ...dados, numero: "4235647728025683" }), null);
});

Deno.test("sanitizarRaw não guarda número, CVV nem nome", () => {
  const s = JSON.stringify(sanitizarRaw({ returnCode: "00", tid: "T1", cardNumber: NUM, securityCode: CVV, cardholderName: NOME, cardBin: "423564" }));
  assertEquals(s.includes(NUM) || s.includes(NOME) || s.includes("423564") || /\d{13,19}/.test(s), false);
});

function cenario(opts: { token: ("pendente" | "ativo" | "recusado")[]; transacao?: { http: number; rc: string | null; erro?: boolean } }) {
  const gravado: string[] = []; const chamadas: string[] = [];
  let t: TentativaCartao = { id: "11111111-2222-3333-4444-555555555555", proposta_id: "p1", status: "processando", motivo: "token_pendente", valor_centavos: 120000, parcelas: 12, simulado: false, tokenizacao_id: null, consultado_em: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  let tok = { tokenization_id: "tok1", status: "pending", token_code: null as string | null, token_expiration: "12/2030", cardholder_name: null as string | null };
  let i = 0;
  const log = (x: unknown) => gravado.push(JSON.stringify(x));
  const deps: Deps = {
    softDescriptor: "FORTEM", esperar: async () => {}, tentativasConsultaToken: 3,
    rede: {
      tokenizar: async () => { chamadas.push("tokenizar"); return { ok: true, tokenizationId: "tok1" }; },
      consultarToken: async () => {
        chamadas.push("consultar"); const e = opts.token[Math.min(i++, opts.token.length - 1)];
        return { httpStatus: 200, erroRede: false, parsed: { tokenizationStatus: e === "pendente" ? "Pending" : "Active", brand: { name: "Visa", tokenStatus: e === "recusado" ? "Failed" : "Active" }, last4: "5682", token: e === "ativo" ? { code: "TKN" } : undefined } };
      },
      cobrar: async (x) => { chamadas.push("cobrar:" + x.nome + ":" + x.parcelas); const tr = opts.transacao ?? { http: 200, rc: "00" }; return { etapa: "transacao", httpStatus: tr.http, erroRede: !!tr.erro, parsed: tr.erro ? null : { returnCode: tr.rc, tid: "TID123456", nsu: "N1", cardNumber: NUM } }; },
      consultarPorReferencia: async () => { chamadas.push("referencia"); return { httpStatus: 404, parsed: null, erroRede: false }; },
    },
    db: {
      tentativa: async () => ({ ...t }),
      registrarToken: async (_t, id, nome) => { tok = { ...tok, cardholder_name: nome }; t = { ...t, tokenizacao_id: "r1" }; return true; },
      token: async () => ({ ...tok }),
      aplicarConsulta: async (_id, c) => { tok = { ...tok, status: estadoToken(c) === "ativo" ? "active" : estadoToken(c) === "recusado" ? "failed" : "pending", token_code: estadoToken(c) === "ativo" ? "TKN" : null }; },
      marcar: async (_id, c) => { log(c); t = { ...t, ...c } as TentativaCartao; },
      travarCobranca: async () => { if (t.motivo === "cobrando") return false; t = { ...t, motivo: "cobrando" }; return true; },
      resultado: async (_id, status, motivo) => { log({ status, motivo }); t = { ...t, status, motivo }; },
      liquidar: async (_id, a) => { log(a); t = { ...t, status: "aprovado", motivo: null }; },
    },
  };
  return { deps, get t() { return t; }, gravado, chamadas };
}

Deno.test("token ativa → cobra na mesma requisição, com nome só em memória", async () => {
  const c = cenario({ token: ["pendente", "ativo"] });
  await iniciarCartaoReal(c.deps, c.t, dados);
  assertEquals(c.t.status, "aprovado");
  assertEquals(c.chamadas.filter((x) => x.startsWith("cobrar")), ["cobrar:" + NOME + ":12"]);
  const tudo = c.gravado.join("|");
  assertEquals(tudo.includes(NOME) || tudo.includes(NUM) || tudo.includes(CVV + '"') || /\d{13,19}/.test(tudo), false);
});
Deno.test("token recusado → recusado, nunca cobra", async () => {
  const c = cenario({ token: ["recusado"] });
  await iniciarCartaoReal(c.deps, c.t, dados);
  assertEquals(c.t.status, "recusado");
  assertEquals(c.chamadas.some((x) => x.startsWith("cobrar")), false);
});
Deno.test("token pendente → segue processando; polling cobra 1x com o nome do token guardado", async () => {
  const c = cenario({ token: ["pendente", "pendente", "pendente", "ativo"] });
  await iniciarCartaoReal(c.deps, c.t, dados);
  assertEquals(c.t.status, "processando");
  await acompanharCartaoReal(c.deps, c.t);
  await acompanharCartaoReal(c.deps, c.t);
  assertEquals(c.chamadas.filter((x) => x.startsWith("cobrar")), ["cobrar:" + NOME + ":12"]);
  assertEquals(c.t.status, "aprovado");
});
Deno.test("token não ativa em 10 min → expirado", async () => {
  const c = cenario({ token: ["pendente"] });
  await iniciarCartaoReal(c.deps, c.t, dados);
  c.deps.agora = () => Date.now() + 11 * 60_000;
  await acompanharCartaoReal(c.deps, c.t);
  assertEquals(c.t.status, "expirado");
});
Deno.test("timeout na transação → desconhecido e nunca recobra; conciliação sem achar após prazo → recusado", async () => {
  const c = cenario({ token: ["ativo"], transacao: { http: 0, rc: null, erro: true } });
  await iniciarCartaoReal(c.deps, c.t, dados);
  assertEquals(c.t.status, "desconhecido");
  c.deps.agora = () => Date.now() + 3 * 60_000;
  await acompanharCartaoReal(c.deps, c.t);
  assertEquals(c.chamadas.filter((x) => x.startsWith("cobrar")).length, 1);
  assertEquals(c.chamadas.includes("referencia"), true);
  assertEquals(c.t.status, "recusado");
});
Deno.test("recusa da transação → recusado com código, sem dados do cartão", async () => {
  const c = cenario({ token: ["ativo"], transacao: { http: 400, rc: "51" } });
  await iniciarCartaoReal(c.deps, c.t, dados);
  assertEquals(c.t.status, "recusado");
  assertEquals(c.t.motivo, "transacao_51");
});

Deno.test("recusa guarda mensagem e retorno da bandeira, sem dados do cartão", async () => {
  const { motivoRecusa } = await import("./cartao.ts");
  const m = motivoRecusa({ returnCode: "107", returnMessage: "Unauthorized. Please try again. " + NUM, cardNumber: NUM, cardholderName: NOME,
    brand: { returnCode: "05", merchantAdviceCode: "03" } });
  assertEquals(m, "transacao_107 | Unauthorized. Please try again. | bandeira 05 mac 03");
  assertEquals(motivoRecusa({ returnCode: "51" }), "transacao_51");
  assertEquals(m.length <= 120, true);
});

Deno.test("código do cartão nunca loga dados do cartão", async () => {
  for (const f of ["index.ts", "cartao.ts", "cartao-rede.ts", "fluxo-cartao.ts", "deps-cartao.ts", "../_shared/planos-cartao-token.ts", "../rede-tokenizacao-webhook/planos-token.ts"]) {
    const src = await Deno.readTextFile(new URL(f, import.meta.url));
    for (const linha of src.split("\n").filter((l) => /console\.|system_logs/.test(l)))
      assertEquals(/numero|cvv|nome|cardNumber|securityCode|cardholder|cpf\b|dados\b|cartao\b/i.test(linha.replace(/"\[[^\]]*\]/g, "").replace("fn: nome", "").replace("semCpf(", "")), false, `${f}: ${linha.trim()}`);
    // Nome do titular só pode ser gravado junto do token (deps-cartao.ts → rede_tokenizacoes).
    if (!["deps-cartao.ts", "fluxo-cartao.ts"].includes(f)) assertEquals(/cardholder_name/.test(src), false, f);
  }
});

Deno.test("webhook: caminho de aluno byte a byte igual ao original", async () => {
  let s = await Deno.readTextFile(new URL("../rede-tokenizacao-webhook/index.ts", import.meta.url));
  s = s.replace('import { tratarTokenPlanos } from "./planos-token.ts";\n', "");
  s = s.slice(0, s.indexOf("  // Desvio: token do checkout /planos")) + s.slice(s.indexOf("  // 3/4/5/6."));
  const h = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))).map((b) => b.toString(16).padStart(2, "0")).join("");
  assertEquals(h, "104ca39e2d18c2f981fd00f33e332312e8d4dca3cca2656e6926d5f067cebde6");
  const desvio = (await Deno.readTextFile(new URL("../rede-tokenizacao-webhook/index.ts", import.meta.url))).match(/if \(regPlanos\?\.proposta_id && !regPlanos\.aluno_id\)/);
  assertEquals(!!desvio, true);
});

Deno.test("elegibilidade: plano 12x com consultas juntas sim; consultas à parte, Start/recorrência e Pix não", () => {
  assertEquals(cartaoRealElegivel({ forma_plano: "cartao_parcelado", parcelas_plano: 12, servicos_centavos: 0 }), true);
  assertEquals(cartaoRealElegivel({ forma_plano: "cartao_parcelado", parcelas_plano: 12, servicos_centavos: 50000, forma_servicos: null }), true);
  assertEquals(cartaoRealElegivel({ forma_plano: "cartao_parcelado", parcelas_plano: 12, servicos_centavos: 50000, forma_servicos: "cartao_parcelado", parcelas_servicos: 6 }), false);
  assertEquals(cartaoRealElegivel({ forma_plano: "cartao_parcelado", parcelas_plano: 12, servicos_centavos: 50000, forma_servicos: "pix_vista" }), false);
  assertEquals(cartaoRealElegivel({ forma_plano: "recorrencia", parcelas_plano: 1 }), false);
  assertEquals(cartaoRealElegivel({ forma_plano: "pix_vista" }), false);
  assertEquals(cartaoRealElegivel({ forma_plano: null, forma_servicos: "cartao_parcelado", parcelas_servicos: 6 }), true);
  assertEquals(cartaoRealElegivel({ forma_plano: null, forma_servicos: "cartao_parcelado", parcelas_servicos: 7 }), false);
});
Deno.test("limites: tokenizar 10/h por IP; status_cartao na cota de consulta", () => {
  assertEquals(chavesLimite("tokenizar_cartao", "1.2.3.4", "p").find((x) => x.chave.startsWith("ckcard"))?.limite, 10);
  assertEquals(chavesLimite("status_cartao", "1.2.3.4", "p").some((x) => x.chave.startsWith("ckf:")), false);
});
Deno.test("nada gravado na tentativa contém nome, número ou CVV", async () => {
  const c = cenario({ token: ["pendente", "ativo"] });
  await iniciarCartaoReal(c.deps, c.t, dados);
  const t = JSON.stringify(c.t) + c.gravado.join("|");
  assertEquals(t.includes(NOME) || t.includes(NUM) || /\b\d{13,19}\b/.test(t), false);
});
