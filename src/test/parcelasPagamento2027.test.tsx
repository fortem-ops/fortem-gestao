import { describe, expect, it, vi, beforeAll } from "vitest";
import { fireEvent, render, screen, act } from "@testing-library/react";
import { descreverPagamento } from "@/components/planos/CheckoutSite2027";
import { CartaoPagamento2027 } from "@/components/planos/CartaoPagamento2027";
import { PagamentoReservado2027, type TelaPagamento } from "@/components/planos/PagamentoReservado2027";
import PlanosPublico2027 from "@/pages/PlanosPublico2027";
import { dividirCentavos } from "@/lib/checkoutSite2027";
import { type CatalogoPublico, type Familia2027, type Frequencia2027, type PlanoPublico } from "@/lib/planosPublico2027";

const TOTAL = 514_800; // Power 2x anual: R$ 5.148,00 em centavos
const sessao = { proposta_id: "00000000-0000-0000-0000-000000000001", chave_sessao: "a".repeat(64) };

const chamar = vi.hoisted(() => vi.fn(async (_acao: string, _corpo: unknown) => ({ tentativa: null })));
vi.mock("@/lib/checkoutSite2027", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/checkoutSite2027")>();
  return { ...real, checkout: (acao: string, corpo: unknown) => chamar(acao, corpo) };
});
vi.mock("@/components/Seo", () => ({ Seo: () => null }));

// Catálogo mínimo com todos os itens que a página consulta (valores batem com os testes de regras).
const MENSAL: Record<Familia2027, Record<Frequencia2027, number>> = {
  start_2027: { "1x": 399, "2x": 499, "3x": 599, livre: 699 },
  power_2027: { "1x": 329, "2x": 429, "3x": 529, livre: 629 },
  pro_2027: { "1x": 399, "2x": 499, "3x": 599, livre: 699 },
};
const base = { quantidade_creditos: null, ilimitado: false, fidelidade_meses: 12, licenca_dias: 10, avaliacoes_funcionais: 1,
  permite_fixar_horario: false, bota_compressao_mes: 0, nivel_clube: null, reposicao_saldo_pct: 0, nome: "" };
const planos: PlanoPublico[] = [];
for (const fam of Object.keys(MENSAL) as Familia2027[]) {
  for (const f of Object.keys(MENSAL[fam]) as Frequencia2027[]) {
    const v = MENSAL[fam][f];
    planos.push({ ...base, codigo: `${fam}_${f}_mensal`, familia: fam, frequencia: f, modalidade_cobranca: "recorrencia_mensal",
      valor: v, taxa_recorrencia: fam === "start_2027" ? 0 : 24.9 });
    if (fam !== "start_2027") planos.push({ ...base, codigo: `${fam}_${f}_anual`, familia: fam, frequencia: f,
      modalidade_cobranca: "anual", valor: v * 12, taxa_recorrencia: 0 });
  }
}
const catalogo: CatalogoPublico = { previa: false, disponivel: false, planos, servicos: [], corrida: [] };

const tela = (parcelasArr: number[]): TelaPagamento => ({
  revisao: { etapa: "aguardando_pagamento", familia: "power_2027", plano_codigo: "power_2027_2x_anual",
    forma_plano: "cartao_parcelado", parcelas_plano: 12, plano_centavos: TOTAL, servicos: [], servicos_centavos: 0,
    forma_servicos: null, parcelas_servicos: null, corrida_periodo_meses: null, corrida_total_centavos: null, total_centavos: TOTAL },
  aceite_id: "aceite-1",
  pagamento: { reservado: true, validade_pix_segundos: 1800, formas_permitidas: ["cartao_parcelado"],
    parcelas: parcelasArr, parcelas_servicos: [], cartao_simulado: true },
});

function montarPagamento(arr = dividirCentavos(TOTAL, 12)) {
  render(<PagamentoReservado2027 tela={tela(arr)} sessao={sessao} confirmacao={false}
    onConfirmar={() => {}} onVoltar={() => {}} onAlterar={() => {}} />);
}
async function preencherCartao() {
  fireEvent.change(screen.getByLabelText(/Número do cartão/), { target: { value: "4111111111111111" } });
  fireEvent.change(screen.getByLabelText(/Nome impresso/), { target: { value: "Fulano Teste" } });
  fireEvent.change(screen.getByLabelText(/Validade/), { target: { value: "1230" } });
  fireEvent.change(screen.getByLabelText(/CVV/), { target: { value: "123" } });
}

describe("parcelas escolhidas na etapa final de pagamento", () => {
  beforeAll(() => { window.scrollTo = () => {}; });

  it("passo 5 não pede mais o número de parcelas e o cartão diz 'em até 12x'", () => {
    render(<PlanosPublico2027 catalogo={catalogo} />);
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getAllByRole("button", { name: "Continuar" })[0]);
    expect(screen.queryByLabelText("Parcelas do plano")).toBeNull();
    expect(screen.queryByText("Número de parcelas")).toBeNull();
    expect(screen.getByText(/em até 12x no cartão · Total de R\$ 5\.148,00\./)).toBeInTheDocument();
  });

  it("revisão mostra 'Cartão de crédito em até 12x' e preserva Pix e recorrência", () => {
    expect(descreverPagamento({ forma_plano: "cartao_parcelado", parcelas_plano: 12, plano_centavos: TOTAL,
      servicos_centavos: 0, forma_servicos: null } as never)).toBe("Cartão de crédito em até 12x");
    expect(descreverPagamento({ forma_plano: "pix_vista", parcelas_plano: 1, plano_centavos: TOTAL,
      servicos_centavos: 0, forma_servicos: null } as never)).toMatch(/Pix à vista: R\$ 5\.148,00/);
    expect(descreverPagamento({ forma_plano: "recorrencia", parcelas_plano: 12, plano_centavos: 35390,
      servicos_centavos: 0, forma_servicos: null } as never)).toMatch(/Recorrência mensal no cartão: R\$ 353,90 por mês, 12 cobranças/);
  });

  it("tela final: seletor ativo 1–12 começando em 12x com valor por parcela", () => {
    montarPagamento();
    const sel = screen.getByLabelText(/Parcelamento/) as HTMLSelectElement;
    expect(sel.value).toBe("12");
    expect([...sel.options].map((o) => Number(o.value))).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    expect(screen.getAllByText(/12x de R\$ 429,00/).length).toBeGreaterThan(0);
  });

  it("trocar para 6x recalcula o valor na hora e envia a escolha ao servidor", async () => {
    chamar.mockClear();
    montarPagamento();
    fireEvent.change(screen.getByLabelText(/Parcelamento/), { target: { value: "6" } });
    expect(screen.getAllByText(/6x de R\$ 858,00/).length).toBeGreaterThan(0);
    await preencherCartao();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Simular cartão aprovado/ })); });
    const corpo = chamar.mock.calls.find((c) => c[0] === "pagar_cartao")![1] as Record<string, unknown>;
    expect(corpo.parcelas).toBe(6);
    expect(corpo.cartao).toBeUndefined();
  });

  it("sem escolha ativa (modo legado), a cobrança não envia parcelas", async () => {
    chamar.mockClear();
    render(<CartaoPagamento2027 sessao={sessao} simulacao parcelas={dividirCentavos(TOTAL, 12)} chamar={chamar as never}
      onTravado={() => {}} onAprovado={() => {}} />);
    const sel = screen.getByLabelText(/Parcelamento/) as HTMLSelectElement;
    expect(sel.options.length).toBe(1); // no modo antigo só existe a parcela reservada; não há como escolher
    await preencherCartao();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Simular cartão aprovado/ })); });
    const corpo = chamar.mock.calls.find((c) => c[0] === "pagar_cartao")![1] as Record<string, unknown>;
    expect("parcelas" in corpo).toBe(false);
  });
});
