import { describe, expect, it } from "vitest";
import {
  descreverInteresse,
  linkWhatsAppPromo10,
  mascararCpfInput,
  montarMensagemWhatsAppPromo10,
  textoQuebraUpgrade,
} from "@/lib/promo10Texto";
import {
  ehEquipePorPapel,
  podeReenviar,
  primeiroNome,
  promo10Encerrada,
  temAlgumaOferta,
} from "../../supabase/functions/_shared/promo10-publico";

describe("Promoções 10 anos — Fase 2 (textos, máscara, prazo e regras puras)", () => {
  it("aplica máscara de CPF progressivamente", () => {
    expect(mascararCpfInput("12345678901")).toBe("123.456.789-01");
    expect(mascararCpfInput("123.456")).toBe("123.456");
  });

  it("extrai somente o primeiro nome", () => {
    expect(primeiroNome("NICOLAS SQUEFF JANOVIK")).toBe("Nicolas");
    expect(primeiroNome("  bruna meyer  ")).toBe("Bruna");
  });

  it("encerra somente após 31/12/2026 23:59 no fuso de Brasília", () => {
    // 2026-12-31 23:59 BRT = 2027-01-01 02:59 UTC
    expect(promo10Encerrada(new Date("2027-01-01T02:59:00Z"))).toBe(false);
    // 2027-01-01 00:00 BRT = 2027-01-01 03:00 UTC
    expect(promo10Encerrada(new Date("2027-01-01T03:00:00Z"))).toBe(true);
  });

  it("respeita espera de 60 segundos para reenvio", () => {
    const base = Date.parse("2026-11-24T12:00:00Z");
    expect(podeReenviar("2026-11-24T12:00:00Z", base + 20_000)).toEqual({ ok: false, aguardarSegundos: 40 });
    expect(podeReenviar("2026-11-24T12:00:00Z", base + 60_000)).toEqual({ ok: true, aguardarSegundos: 0 });
  });

  it("identifica equipe por papel e recusa oferta quando segmento é equipe", () => {
    expect(ehEquipePorPapel(["professor"])).toBe(true);
    expect(ehEquipePorPapel(["aluno"])).toBe(false);
    expect(temAlgumaOferta({ segmento: "equipe", principal: [{}], corrida: null })).toBe(false);
    expect(temAlgumaOferta({ segmento: "so_corrida", principal: [], corrida: null })).toBe(false);
    expect(temAlgumaOferta({ segmento: "ex_aluno", principal: [{}], corrida: null })).toBe(true);
  });

  it("monta quebra do upgrade e mensagem do WhatsApp com código P10-xxxx", () => {
    const linhas = textoQuebraUpgrade({
      proporcional: 56,
      ciclos_completos: 7,
      valor_completos: 560,
      ultimo_proporcional: 0,
      total: 616,
      dias_restantes_ciclo_atual: 21,
      dias_ciclo_atual: 30,
    });
    expect(linhas[0]).toContain("21 de 30 dias");
    expect(linhas[1]).toContain("7 ciclos completos");

    const interesses = [
      {
        codigo_pedido: "P10-0042",
        segmento: "ex_aluno",
        oferta: "pro_2027_2x_anual",
        valor_promocional: 4140,
        valor_sem_desconto: 4440,
        detalhes: { tipo: "ex_aluno", nome: "Pro Anual", frequencia: "2x", parcela_12x: 345 },
        status: "novo",
      },
      {
        codigo_pedido: "P10-0043",
        segmento: "ex_aluno",
        oferta: "corrida_6_mais_1",
        valor_promocional: 1080,
        valor_sem_desconto: 1260,
        detalhes: { tipo: "corrida_6_mais_1", nome_catalogo: "Corrida - Sem Plano", valor_equivalente_mes: 154.29 },
        status: "novo",
      },
    ];
    expect(descreverInteresse(interesses[0]).titulo).toContain("Pro Anual");
    const msg = montarMensagemWhatsAppPromo10("Bruna", interesses);
    expect(msg).toContain("Sou Bruna");
    expect(msg).toContain("P10-0042");
    expect(msg).toContain("P10-0043");
    expect(linkWhatsAppPromo10(msg)).toContain("https://wa.me/555135199451?text=");
  });
});