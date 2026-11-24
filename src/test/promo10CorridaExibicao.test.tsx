// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Promo10Ofertas } from "@/site/promo10/Promo10Ofertas";
import {
  descreverInteresse,
  montarMensagemWhatsAppPromo10,
  type InteressePromo10,
  type RespostaOfertasPromo10,
} from "@/lib/promo10Texto";

const CORRIDA = {
  tipo: "corrida_6_mais_1" as const,
  nome_catalogo: "Corrida - Power",
  meses_pagos: 6,
  meses_total: 7,
  valor_promocional: 1080,
  valor_equivalente_mes: 154.29,
  valor_sem_desconto: 1260,
  economia: 180,
};

function ofertaSoCorrida(): RespostaOfertasPromo10 {
  return { encerrada: false, segmento: "so_corrida", principal: [], corrida: CORRIDA };
}

const interesseCorrida: InteressePromo10 = {
  codigo_pedido: "P10-0043",
  segmento: "so_corrida",
  oferta: "corrida_6_mais_1",
  valor_promocional: 1080,
  valor_sem_desconto: 1260,
  detalhes: { tipo: "corrida_6_mais_1", nome_catalogo: "Corrida - Power", valor_equivalente_mes: 154.29 },
  status: "novo",
};

describe("Promoções 10 anos — Corrida é exibida só como 'Corrida'", () => {
  it("cartão da Corrida mostra 'Corrida · 7 meses de acesso', sem o nome do catálogo", () => {
    render(
      <Promo10Ofertas
        primeiroNome="Bruna"
        ofertas={ofertaSoCorrida()}
        enviando={null}
        erro={null}
        onInteresse={vi.fn()}
      />,
    );

    expect(screen.getByText("Corrida · 7 meses de acesso")).toBeInTheDocument();
    expect(screen.queryByText(/Corrida - /)).not.toBeInTheDocument();
  });

  it("resumo do interesse e mensagem do WhatsApp não trazem o nome do catálogo", () => {
    const { titulo, detalhe } = descreverInteresse(interesseCorrida);
    expect(titulo).toBe("Corrida (6 meses + 1 grátis)");
    expect(detalhe).toContain("7 meses");

    const msg = montarMensagemWhatsAppPromo10("Bruna", [interesseCorrida]);
    expect(msg).toContain("Corrida (6 meses + 1 grátis)");
    expect(msg).not.toContain("Corrida - ");
    expect(msg).toContain("P10-0043");
  });
});
