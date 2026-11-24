import { describe, expect, it } from "vitest";
import {
  calcularResumoPromo10,
  deveAvisarInteressePromo10,
  linkWhatsAppAlunoPromo10,
  montarMensagemWhatsAppEquipePromo10,
  montarTituloAvisoPromo10,
  rotuloOfertaEquipePromo10,
  segmentoEfetivoPromo10,
} from "@/lib/promo10Admin";

describe("Promoções 10 anos — Fase 3 (tela da equipe e aviso interno)", () => {
  it("monta texto legível da oferta para upgrade, semestrais, ex-aluno e corrida com tabela", () => {
    expect(
      rotuloOfertaEquipePromo10({
        segmento: "upgrade",
        oferta: "upgrade_3x",
        detalhes: { tipo: "upgrade", frequencia_atual: "2x", frequencia_destino: "3x" },
      }),
    ).toBe("Upgrade 2x → 3x");

    expect(
      rotuloOfertaEquipePromo10({
        segmento: "upgrade",
        oferta: "upgrade_livre",
        detalhes: { tipo: "upgrade", frequencia_atual: "3x", frequencia_destino: "livre" },
      }),
    ).toBe("Upgrade 3x → Livre");

    expect(
      rotuloOfertaEquipePromo10({
        segmento: "wellhub",
        oferta: "pro_semestral_wellhub",
        detalhes: { tipo: "semestral_agregadora", nome: "Pro Semestral", agregadora: "wellhub" },
      }),
    ).toBe("Pro Semestral Wellhub");

    expect(
      rotuloOfertaEquipePromo10({
        segmento: "totalpass",
        oferta: "start_semestral_totalpass",
        detalhes: { tipo: "semestral_agregadora", nome: "Start Semestral", agregadora: "totalpass" },
      }),
    ).toBe("Start Semestral TotalPass");

    expect(
      rotuloOfertaEquipePromo10({
        segmento: "ex_aluno",
        oferta: "power_2x_anual",
        detalhes: { tipo: "ex_aluno", familia: "power_2027", frequencia: "2x" },
      }),
    ).toBe("Power 2x anual (ex-aluno)");

    expect(
      rotuloOfertaEquipePromo10({
        segmento: "upgrade",
        oferta: "corrida_6_mais_1",
        detalhes: { tipo: "corrida_6_mais_1", nome_catalogo: "Corrida - Start+" },
      }),
    ).toBe("Corrida 6+1 · tabela Start+");
  });

  it("calcula contagem e soma por status e por segmento (incluindo Corrida separada)", () => {
    const resumo = calcularResumoPromo10([
      { status: "novo", segmento: "upgrade", oferta: "upgrade_3x", detalhes: { tipo: "upgrade" }, valor_promocional: 616 },
      { status: "contatado", segmento: "wellhub", oferta: "pro_semestral", detalhes: { tipo: "semestral_agregadora" }, valor_promocional: 2800 },
      { status: "fechado", segmento: "upgrade", oferta: "corrida_6_mais_1", detalhes: { tipo: "corrida_6_mais_1" }, valor_promocional: 900 },
      { status: "desistiu", segmento: "ex_aluno", oferta: "power_2x", detalhes: { tipo: "ex_aluno" }, valor_promocional: 4200 },
    ]);

    expect(resumo.totalQuantidade).toBe(4);
    expect(resumo.totalValor).toBe(8516);
    expect(resumo.porStatus.novo).toEqual({ quantidade: 1, valor: 616 });
    expect(resumo.porStatus.contatado).toEqual({ quantidade: 1, valor: 2800 });
    expect(resumo.porStatus.fechado).toEqual({ quantidade: 1, valor: 900 });
    expect(resumo.porStatus.desistiu).toEqual({ quantidade: 1, valor: 4200 });
    expect(resumo.porSegmento.upgrade).toEqual({ quantidade: 1, valor: 616 });
    expect(resumo.porSegmento.wellhub).toEqual({ quantidade: 1, valor: 2800 });
    expect(resumo.porSegmento.corrida).toEqual({ quantidade: 1, valor: 900 });
    expect(resumo.porSegmento.ex_aluno).toEqual({ quantidade: 1, valor: 4200 });
    expect(segmentoEfetivoPromo10("upgrade", "corrida_6_mais_1")).toBe("corrida");
  });

  it("monta título do aviso interno no formato exato, só primeiro nome, sem CPF nem e-mail", () => {
    const titulo = montarTituloAvisoPromo10({
      codigoPedido: "P10-0007",
      nomeAluno: "Bruna Meyer da Silva",
      ofertaLegivel: "Upgrade 2x → 3x",
      valorPromocional: 616,
    });

    expect(titulo).toBe("Promoções 10 anos: novo interesse P10-0007 — Bruna — Upgrade 2x → 3x — R$\u00a0616,00");
    expect(titulo).not.toContain("Meyer");
    expect(titulo).not.toContain("@");
  });

  it("dispara aviso em interesse novo ou troca de oferta, mas não em reenvio igual", () => {
    expect(deveAvisarInteressePromo10("criado")).toBe(true);
    expect(deveAvisarInteressePromo10("substituido")).toBe(true);
    expect(deveAvisarInteressePromo10("atualizado")).toBe(false);
    expect(deveAvisarInteressePromo10(undefined)).toBe(false);
  });

  it("monta mensagem pronta do WhatsApp citando o pedido e formata o link", () => {
    const msg = montarMensagemWhatsAppEquipePromo10({
      nomeAluno: "Bruna Meyer",
      codigoPedido: "P10-0001",
      ofertaLegivel: "Upgrade 2x → 3x",
    });
    expect(msg).toContain("Bruna");
    expect(msg).toContain("P10-0001");
    expect(msg).toContain("Upgrade 2x → 3x");

    const url = linkWhatsAppAlunoPromo10("(51) 99999-8888", msg);
    expect(url).toMatch(/^https:\/\/wa\.me\/5551999998888\?text=/);
    expect(linkWhatsAppAlunoPromo10("", msg)).toBeNull();
  });
});