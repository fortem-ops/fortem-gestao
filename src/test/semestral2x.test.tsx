// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fireEvent, render, screen } from "@testing-library/react";
import { beneficiosSemestral, frequenciasSemestral } from "@/lib/semestral";
import { descreverInteresse, montarMensagemWhatsAppPromo10, type OfertaAgregadoraPromo10 } from "@/lib/promo10Texto";
import { rotuloOfertaEquipePromo10 } from "@/lib/promo10Admin";
import { Promo10Ofertas } from "@/site/promo10/Promo10Ofertas";

const WELLHUB_OFERTAS: OfertaAgregadoraPromo10[] = [
  {
    tipo: "semestral_agregadora",
    codigo: "start_semestral_wellhub_2x",
    nome: "Start Semestral",
    agregadora: "wellhub",
    frequencia: "2x",
    valor_mensal: 409,
    valor_promocional: 2454,
    valor_referencia_mes: 499,
    valor_sem_desconto: 2994,
    economia_mes: 90,
    economia_6_meses: 540,
  },
  {
    tipo: "semestral_agregadora",
    codigo: "pro_semestral_wellhub_2x",
    nome: "Pro Semestral",
    agregadora: "wellhub",
    frequencia: "2x",
    valor_mensal: 429,
    valor_promocional: 2574,
    valor_referencia_mes: 499,
    valor_sem_desconto: 2994,
    economia_mes: 70,
    economia_6_meses: 420,
  },
  {
    tipo: "semestral_agregadora",
    codigo: "start_semestral_wellhub_3x",
    nome: "Start Semestral",
    agregadora: "wellhub",
    frequencia: "3x",
    valor_mensal: 439,
    valor_promocional: 2634,
    valor_referencia_mes: 599,
    valor_sem_desconto: 3594,
    economia_mes: 160,
    economia_6_meses: 960,
  },
  {
    tipo: "semestral_agregadora",
    codigo: "pro_semestral_wellhub_3x",
    nome: "Pro Semestral",
    agregadora: "wellhub",
    frequencia: "3x",
    valor_mensal: 469,
    valor_promocional: 2814,
    valor_referencia_mes: 599,
    valor_sem_desconto: 3594,
    economia_mes: 130,
    economia_6_meses: 780,
  },
];

const TOTALPASS_OFERTAS: OfertaAgregadoraPromo10[] = [
  {
    tipo: "semestral_agregadora",
    codigo: "start_semestral_totalpass_2x",
    nome: "Start Semestral",
    agregadora: "totalpass",
    frequencia: "2x",
    valor_mensal: 399,
    valor_promocional: 2394,
    valor_referencia_mes: 499,
    valor_sem_desconto: 2994,
    economia_mes: 100,
    economia_6_meses: 600,
  },
  {
    tipo: "semestral_agregadora",
    codigo: "pro_semestral_totalpass_2x",
    nome: "Pro Semestral",
    agregadora: "totalpass",
    frequencia: "2x",
    valor_mensal: 419,
    valor_promocional: 2514,
    valor_referencia_mes: 499,
    valor_sem_desconto: 2994,
    economia_mes: 80,
    economia_6_meses: 480,
  },
];

describe("Semestrais de agregadoras — opção 2x/semana", () => {
  it("beneficiosSemestral usa a frequência e créditos do item (8 no 2x, 12 no 3x) sem assumir 3x", () => {
    expect(
      beneficiosSemestral({ id: "1", codigo: "start_semestral_wellhub_2x", nome: "Start Semestral", valor: 409, frequencia: "2x", quantidade_creditos: 8 }),
    ).toEqual(["2x/semana", "8 créditos por ciclo"]);

    expect(
      beneficiosSemestral({ id: "2", codigo: "pro_semestral_totalpass_2x", nome: "Pro Semestral", valor: 419, frequencia: "2x", quantidade_creditos: 8, permite_fixar_horario: true, bota_compressao_mes: 4 }),
    ).toEqual(["2x/semana", "8 créditos por ciclo", "Horários fixos", "Bota de compressão 4/ciclo"]);

    expect(beneficiosSemestral({ id: "3", codigo: "sem_freq", nome: "Semestral", valor: 409 })).toEqual([]);
    expect(frequenciasSemestral([{ frequencia: "3x" }, { frequencia: "2x" }, { frequencia: "3x" }])).toEqual(["2x", "3x"]);
  });

  it("Promo10Ofertas alterna entre 2x e 3x, compara com o Start da mesma frequência e envia o código escolhido", () => {
    const onInteresse = vi.fn();
    render(
      <Promo10Ofertas
        primeiroNome="Bruna"
        ofertas={{ encerrada: false, segmento: "wellhub", principal: WELLHUB_OFERTAS, corrida: null }}
        enviando={null}
        erro={null}
        onInteresse={onInteresse}
      />,
    );

    // Padrão 3x: Start 3x hoje R$ 599,00/mês e 12 créditos
    expect(screen.getAllByText(/Start 3x hoje R\$\s*599,00\/mês/).length).toBe(2);
    expect(screen.getByText(/3x por semana \(12 créditos por mês\)/)).toBeTruthy();
    expect(screen.queryByText(/399,00/)).toBeNull(); // nunca mostra preço TotalPass

    // Troca para 2x: Start 2x hoje R$ 499,00/mês e 8 créditos
    fireEvent.click(screen.getByRole("button", { name: "2x/semana" }));
    expect(screen.getAllByText(/Start 2x hoje R\$\s*499,00\/mês/).length).toBe(2);
    expect(screen.getByText(/2x por semana \(8 créditos por mês\)/)).toBeTruthy();
    expect(screen.getByText(/Menos que o Start 2x e com mais vantagens/)).toBeTruthy();
    expect(screen.getByText(/R\$\s*409,00/)).toBeTruthy();
    expect(screen.getByText(/R\$\s*429,00/)).toBeTruthy();

    const botoes = screen.getAllByRole("button", { name: "Tenho interesse" });
    fireEvent.click(botoes[1]);
    expect(onInteresse).toHaveBeenCalledWith("principal", "pro_semestral_wellhub_2x");
  });

  it("TotalPass nunca exibe preços Wellhub", () => {
    render(
      <Promo10Ofertas
        primeiroNome="Carlos"
        ofertas={{ encerrada: false, segmento: "totalpass", principal: TOTALPASS_OFERTAS, corrida: null }}
        enviando={null}
        erro={null}
        onInteresse={vi.fn()}
      />,
    );

    expect(screen.getByText(/R\$\s*399,00/)).toBeTruthy();
    expect(screen.getByText(/R\$\s*419,00/)).toBeTruthy();
    expect(screen.queryByText(/469,00/)).toBeNull();
    expect(screen.queryByText(/429,00/)).toBeNull();
  });

  it("resumo, WhatsApp e tela Comercial mostram a frequência do Semestral", () => {
    const interesse = {
      codigo_pedido: "P10-0099",
      segmento: "wellhub",
      oferta: "pro_semestral_wellhub_2x",
      valor_promocional: 2574,
      valor_sem_desconto: 2994,
      detalhes: {
        tipo: "semestral_agregadora",
        nome: "Pro Semestral",
        agregadora: "wellhub",
        frequencia: "2x",
        valor_mensal: 429,
      },
      status: "novo",
    };

    expect(descreverInteresse(interesse).titulo).toBe("Pro Semestral (2x/sem)");
    expect(montarMensagemWhatsAppPromo10("Bruna", [interesse])).toContain("Pro Semestral (2x/sem)");
    expect(rotuloOfertaEquipePromo10(interesse)).toBe("Pro Semestral Wellhub 2x");
    expect(
      rotuloOfertaEquipePromo10({
        segmento: "totalpass",
        oferta: "start_semestral_totalpass_2x",
        detalhes: { tipo: "semestral_agregadora", nome: "Start Semestral", agregadora: "totalpass" },
      }),
    ).toBe("Start Semestral TotalPass 2x");
  });

  it("fn_promo10_ofertas compara com o Start da mesma frequência e filtra agregadora + ativo", () => {
    const sql = readFileSync("drizzle/migrations/0295_promo10_ofertas_semestral_2x_3x.sql", "utf8");
    expect(sql).not.toContain("'start_2027_3x_mensal'");
    expect(sql).toContain("'start_2027_' || v_item.frequencia::text || '_mensal'");
    expect(sql).toContain("WHERE agregadora_requerida = v_agr");
    expect(sql).toContain("AND COALESCE(ativo, false)");
    expect(sql).toContain("fn_semestral_elegivel");
  });
});