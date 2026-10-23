import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Contrato } from "@/types/financeiro";
import { FORMA_PAGAMENTO_LABELS, formatBRL } from "@/types/financeiro";

// ---- mocks ----------------------------------------------------------------
const rpcSpy = vi.fn(async (...args: any[]) => {
  const fn = args[0] as string;
  if (fn === "fn_calcular_rescisao") {
    return { data: { tipo: "start_sem_multa", descricao: "ok" }, error: null };
  }
  return { data: null, error: null };
});
const updateSpy = vi.fn();

vi.mock("@/integrations/supabase/client", () => {
  const chain: any = {};
  for (const m of ["select", "eq", "in", "is", "neq", "order", "limit", "range", "insert", "delete", "filter"]) {
    chain[m] = vi.fn(() => chain);
  }
  chain.update = vi.fn(() => { updateSpy(); return chain; });
  chain.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
  chain.single = vi.fn(async () => ({ data: null, error: null }));
  return {
    supabase: {
      rpc: (fn: string, args?: any) => rpcSpy(fn, args),
      from: vi.fn(() => chain),
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: "u1", email: "equipe@fortem.com" } } })),
        getSession: vi.fn(async () => ({ data: { session: { user: { id: "u1" } } } })),
        refreshSession: vi.fn(async () => ({})),
      },
    },
  };
});

const createNotificacaoSpy = vi.fn(async (..._args: any[]) => "notif-id");
vi.mock("@/lib/notificar", () => ({
  createNotificacao: (input: any) => createNotificacaoSpy(input),
  expandRecipients: vi.fn(async () => ["admin-1"]),
}));

import { DialogRescisao } from "@/components/financeiro/DialogRescisao";
import {
  textoAvisoRescisaoConsultoria,
  TEXTO_RESCISAO_CONSULTORIA,
} from "@/lib/rescisaoConsultoria";

// ---- fixtures ---------------------------------------------------------------
const base: Contrato = {
  id: "c1",
  aluno_id: "a1",
  plano_id: "p1",
  plano_tipo: "consultoria_2027",
  frequencia_semanal: 0,
  creditos_total: 0,
  vigencia_tipo: "quadrimestral" as any,
  data_inicio: "2026-11-01",
  forma_pagamento: "cartao_parcelado",
  valor_base: 676,
  valor_cobrado: 676,
  taxa_recorrencia: 0,
  parcelas: 4,
  status: "ativo",
  notificacao_30d_enviada: false,
  created_at: "2026-10-01",
  updated_at: "2026-10-01",
  alunos: { id: "a1", nome: "Nicolas Teste" },
};

function abrir(contrato: Contrato) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <DialogRescisao contrato={contrato} open onOpenChange={() => {}} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  rpcSpy.mockClear();
  updateSpy.mockClear();
  createNotificacaoSpy.mockClear();
});

// ---- testes -----------------------------------------------------------------
describe("E4f — texto do aviso", () => {
  it("contém aluno, plano, vigência, valor, forma, motivo e quem pediu", () => {
    const { titulo, descricao } = textoAvisoRescisaoConsultoria({
      alunoId: "a1",
      alunoNome: "Nicolas Teste",
      vigenciaLabel: "4 meses",
      valorLabel: formatBRL(676),
      formaPagamentoLabel: FORMA_PAGAMENTO_LABELS.cartao_parcelado,
      motivo: "mudança de cidade",
      quemPediu: "equipe@fortem.com",
    });
    expect(titulo).toContain("Nicolas Teste");
    expect(descricao).toContain("Aluno: Nicolas Teste");
    expect(descricao).toContain("Plano: Consultoria Online");
    expect(descricao).toContain("Vigência: 4 meses");
    expect(descricao).toContain(`Valor: ${formatBRL(676)}`);
    expect(descricao).toContain(`Forma de pagamento: ${FORMA_PAGAMENTO_LABELS.cartao_parcelado}`);
    expect(descricao).toContain("Motivo: mudança de cidade");
    expect(descricao).toContain("Quem pediu: equipe@fortem.com");
  });

  it("motivo vazio vira 'Não informado'", () => {
    const { descricao } = textoAvisoRescisaoConsultoria({
      alunoId: "a1", alunoNome: "A", vigenciaLabel: "Mensal", valorLabel: "R$ 1",
      formaPagamentoLabel: "Pix", motivo: "  ", quemPediu: "x",
    });
    expect(descricao).toContain("Motivo: Não informado");
  });
});

describe("E4f — DialogRescisao com Consultoria", () => {
  it("não chama fn_calcular_rescisao, não mostra multa e avisa o admin", async () => {
    abrir(base);

    // texto de tratamento manual visível, sem valor de multa
    expect(screen.getByText(new RegExp(TEXTO_RESCISAO_CONSULTORIA))).toBeTruthy();
    expect(screen.queryByText(/Multa/)).toBeNull();
    expect(screen.queryByText("Confirmar cancelamento")).toBeNull();

    // fn_calcular_rescisao NUNCA é chamada para Consultoria
    await waitFor(() => {
      expect(rpcSpy.mock.calls.some(([fn]) => fn === "fn_calcular_rescisao")).toBe(false);
    });

    // motivo opcional entra no aviso
    fireEvent.change(screen.getByPlaceholderText(/mudança de cidade/i), {
      target: { value: "mudança de cidade" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Avisar o administrador/i }));

    await waitFor(() => expect(createNotificacaoSpy).toHaveBeenCalledTimes(1));
    const payload = createNotificacaoSpy.mock.calls[0]![0] as any;
    expect(payload.titulo).toContain("Nicolas Teste");
    expect(payload.descricao).toContain("Aluno: Nicolas Teste");
    expect(payload.descricao).toContain("Plano: Consultoria Online");
    expect(payload.descricao).toContain("Vigência: 4 meses");
    expect(payload.descricao).toContain(`Valor: ${formatBRL(676)}`);
    expect(payload.descricao).toContain(`Forma de pagamento: ${FORMA_PAGAMENTO_LABELS.cartao_parcelado}`);
    expect(payload.descricao).toContain("Motivo: mudança de cidade");
    expect(payload.descricao).toContain("Quem pediu: equipe@fortem.com");
    expect(payload.categoria).toBe("aluno");
    expect(payload.prioridade).toBe("alta");
    expect(payload.tipo).toBe("solicitacao");
    expect(payload.aluno_id).toBe("a1");
    expect(payload.destinatarios).toEqual([{ type: "all_admins" }, { type: "all_coordenadores" }]);

    // nenhum cancelamento executado (sem update em contratos)
    expect(updateSpy).not.toHaveBeenCalled();
  });
});

describe("E4f — Start/Power/Pro inalterados", () => {
  it.each(["start_2027", "power_2027", "pro_2027"] as const)(
    "%s continua chamando fn_calcular_rescisao e mostrando Confirmar cancelamento",
    async (plano_tipo) => {
      abrir({ ...base, plano_tipo, vigencia_tipo: "mensal" as any });
      await waitFor(() => {
        expect(rpcSpy.mock.calls.some(([fn]) => fn === "fn_calcular_rescisao")).toBe(true);
      });
      expect(await screen.findByText("Confirmar cancelamento")).toBeTruthy();
      expect(screen.queryByText(new RegExp(TEXTO_RESCISAO_CONSULTORIA))).toBeNull();
      expect(createNotificacaoSpy).not.toHaveBeenCalled();
    },
  );
});
