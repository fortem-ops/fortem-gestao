import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { descricaoNotificacaoExibicao } from "@/lib/notificacaoTexto";
import { AlterarTipoCobrancaDialog } from "@/components/financeiro/AlterarTipoCobrancaDialog";

// Texto real gerado por fn_recorrencia_2027_inadimplente_aviso.
const real = (fam: string, freq: string) =>
  `${fam} ${freq} · recorrência no cartão (venda da equipe)\nMensalidade 2 · vencimento 01/12/2026 · R$ 189,00\nÚltimo motivo: -\nWhatsApp -\n\nAção: falar com o aluno.`;

describe("aviso de inadimplência (exibição)", () => {
  it("remove 'livre' só da Consultoria", () => {
    expect(descricaoNotificacaoExibicao(real("Consultoria Online", "livre"))).toBe(
      real("Consultoria Online", "").replace("Online  ·", "Online ·"),
    );
  });
  it("Start/Power/Pro idênticos, inclusive Livre", () => {
    for (const t of [real("Start", "2x"), real("Power", "livre"), real("Pro", "3x"), real("Pro", "livre")]) {
      expect(descricaoNotificacaoExibicao(t)).toBe(t);
    }
    expect(descricaoNotificacaoExibicao("")).toBe("");
    expect(descricaoNotificacaoExibicao(null)).toBe("");
  });
});

function abrir(plano_tipo: string) {
  const qc = new QueryClient();
  render(
    <QueryClientProvider client={qc}>
      <AlterarTipoCobrancaDialog
        open
        onOpenChange={() => {}}
        contrato={{ id: "c", plano_tipo, forma_pagamento: "cartao_parcelado", vigencia_tipo: "quadrimestral", valor_base: 676, data_inicio: "2026-11-01" }}
        cobrancas={[]}
      />
    </QueryClientProvider>,
  );
}

describe("Alterar tipo de cobrança", () => {
  it("bloqueado para Consultoria", () => {
    abrir("consultoria_2027");
    expect(screen.getByText("Não disponível para Consultoria Online")).toBeTruthy();
  });
  it("Power continua liberado", () => {
    abrir("power_2027");
    expect(screen.queryByText("Não disponível para Consultoria Online")).toBeNull();
  });
});
