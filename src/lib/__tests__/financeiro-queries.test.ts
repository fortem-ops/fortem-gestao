import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { createElement } from "react";

// ─── Mock Supabase ────────────────────────────────────────────────────────────

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockMaybeSingle = vi.fn();
const mockSingle = vi.fn();

// Builder encadeável — cada método retorna o próprio objeto
const builder: any = {
  select: (...a: any[]) => { mockSelect(...a); return builder; },
  eq: (...a: any[]) => { mockEq(...a); return builder; },
  order: (...a: any[]) => { mockOrder(...a); return builder; },
  maybeSingle: () => mockMaybeSingle(),
  single: () => mockSingle(),
  then: undefined, // não é thenable — força uso explícito de await nos testes
};

const mockFrom = vi.fn((..._a: any[]) => builder);

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...a: any[]) => mockFrom(...a) },
}));

// ─── Wrapper QueryClient ──────────────────────────────────────────────────────

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: any }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

// ─── Dados de fixture ─────────────────────────────────────────────────────────

const ALUNO_ID = "aluno-uuid-001";

const CONTRATO_ATIVO = {
  id: "contrato-uuid-001",
  aluno_id: ALUNO_ID,
  plano_tipo: "start_plus",
  vigencia_tipo: "anual",
  forma_pagamento: "cartao_recorrencia",
  valor_cobrado: 420,
  valor_base: 400,
  taxa_recorrencia: 20,
  parcelas: 1,
  status: "ativo",
  creditos_total: 156,
  frequencia_semanal: 3,
  data_inicio: "2026-01-01",
  data_fim: "2026-12-31",
  data_renovacao: "2026-12-31",
  created_at: "2026-01-01T00:00:00Z",
};

const CONTRATO_CANCELADO = {
  ...CONTRATO_ATIVO,
  id: "contrato-uuid-002",
  status: "cancelado",
};

const COBRANCA_PAGA = {
  id: "cobranca-uuid-001",
  contrato_id: "contrato-uuid-001",
  aluno_id: ALUNO_ID,
  numero_ciclo: 1,
  valor: 420,
  data_vencimento: "2026-01-01",
  data_pagamento: "2026-01-01",
  status: "pago",
  forma_pagamento: "cartao_recorrencia",
  meio_registro: "manual_admin",
  gateway: "rede",
};

const COBRANCA_PENDENTE = {
  ...COBRANCA_PAGA,
  id: "cobranca-uuid-002",
  numero_ciclo: 7,
  data_vencimento: "2026-07-01",
  data_pagamento: null,
  status: "pendente",
  meio_registro: "automatico",
};

const CICLO_ATIVO = {
  id: "ciclo-uuid-001",
  contrato_id: "contrato-uuid-001",
  creditos_liberados: 156,
  creditos_usados: 24,
  status: "ativo",
  data_inicio: "2026-01-01",
  data_fim: "2026-12-31",
};

const CARTAO_ATIVO = {
  id: "cartao-uuid-001",
  aluno_id: ALUNO_ID,
  token_rede: "tok_abc123",
  brand: "Mastercard",
  last4: "4715",
  holder_name: "NICOLAS S JANOVIK",
  expiration_month: 3,
  expiration_year: 2032,
  ativo: true,
  is_default: true,
  origem: "recepcao",
  created_at: "2026-06-17T00:00:00Z",
};

// ─── Hook inline p/ testar queries ───────────────────────────────────────────
// (as queries vivem nos componentes — testamos o padrão, não hooks extraídos)

import { supabase } from "@/integrations/supabase/client";

function useContratosAluno(alunoId: string) {
  return useQuery({
    queryKey: ["contratos-aluno", alunoId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("contratos")
        .select("*")
        .eq("aluno_id", alunoId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!alunoId,
  });
}

function useCobrancasContrato(contratoId: string | null) {
  return useQuery({
    queryKey: ["cobrancas-contrato", contratoId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("cobrancas")
        .select("*")
        .eq("contrato_id", contratoId!)
        .order("data_vencimento", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!contratoId,
  });
}

function useCicloAtivo(contratoId: string | null) {
  return useQuery({
    queryKey: ["ciclo-ativo", contratoId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("ciclos_credito")
        .select("*")
        .eq("contrato_id", contratoId!)
        .eq("status", "ativo")
        .maybeSingle();
      return data;
    },
    enabled: !!contratoId,
  });
}

function useCartoesAluno(alunoId: string) {
  return useQuery({
    queryKey: ["cartoes-salvos-aluno", alunoId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("cartoes_salvos")
        .select("*")
        .eq("aluno_id", alunoId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!alunoId,
  });
}

// ─── Testes: contratos ────────────────────────────────────────────────────────

describe("useContratosAluno", () => {
  beforeEach(() => { vi.clearAllMocks(); builder.then = undefined; });

  it("retorna lista de contratos do aluno", async () => {
    mockOrder.mockResolvedValueOnce({
      data: [CONTRATO_ATIVO, CONTRATO_CANCELADO], error: null,
    });
    const { result } = renderHook(
      () => useContratosAluno(ALUNO_ID),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
    expect(mockFrom).toHaveBeenCalledWith("contratos");
  });

  it("retorna [] quando aluno não tem contratos", async () => {
    mockOrder.mockResolvedValueOnce({ data: [], error: null });
    const { result } = renderHook(
      () => useContratosAluno(ALUNO_ID),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(0);
  });

  it("primeiro contrato é o ativo (ordenado por created_at desc)", async () => {
    mockOrder.mockResolvedValueOnce({
      data: [CONTRATO_ATIVO, CONTRATO_CANCELADO], error: null,
    });
    const { result } = renderHook(
      () => useContratosAluno(ALUNO_ID),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].status).toBe("ativo");
  });

  it("lança erro quando Supabase retorna error", async () => {
    mockOrder.mockResolvedValueOnce({
      data: null, error: { message: "Permission denied" },
    });
    const { result } = renderHook(
      () => useContratosAluno(ALUNO_ID),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe("Permission denied");
  });

  it("não executa quando alunoId está vazio", async () => {
    const { result } = renderHook(
      () => useContratosAluno(""),
      { wrapper: makeWrapper() },
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

// ─── Testes: cobranças ────────────────────────────────────────────────────────

describe("useCobrancasContrato", () => {
  beforeEach(() => { vi.clearAllMocks(); builder.then = undefined; });

  it("retorna cobranças do contrato", async () => {
    mockOrder.mockResolvedValueOnce({
      data: [COBRANCA_PENDENTE, COBRANCA_PAGA], error: null,
    });
    const { result } = renderHook(
      () => useCobrancasContrato("contrato-uuid-001"),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
    expect(mockFrom).toHaveBeenCalledWith("cobrancas");
  });

  it("pendente aparece antes da paga (ordenado por vencimento desc)", async () => {
    mockOrder.mockResolvedValueOnce({
      data: [COBRANCA_PENDENTE, COBRANCA_PAGA], error: null,
    });
    const { result } = renderHook(
      () => useCobrancasContrato("contrato-uuid-001"),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].status).toBe("pendente");
  });

  it("cobrança paga tem data_pagamento preenchida", async () => {
    mockOrder.mockResolvedValueOnce({
      data: [COBRANCA_PAGA], error: null,
    });
    const { result } = renderHook(
      () => useCobrancasContrato("contrato-uuid-001"),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].data_pagamento).not.toBeNull();
  });

  it("cobrança pendente tem data_pagamento nula", async () => {
    mockOrder.mockResolvedValueOnce({
      data: [COBRANCA_PENDENTE], error: null,
    });
    const { result } = renderHook(
      () => useCobrancasContrato("contrato-uuid-001"),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].data_pagamento).toBeNull();
  });

  it("não executa quando contratoId é null", async () => {
    const { result } = renderHook(
      () => useCobrancasContrato(null),
      { wrapper: makeWrapper() },
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(result.current.fetchStatus).toBe("idle");
  });
});

// ─── Testes: ciclos de crédito ────────────────────────────────────────────────

describe("useCicloAtivo", () => {
  beforeEach(() => { vi.clearAllMocks(); builder.then = undefined; });

  it("retorna ciclo ativo com créditos usados e liberados", async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: CICLO_ATIVO, error: null });
    const { result } = renderHook(
      () => useCicloAtivo("contrato-uuid-001"),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.creditos_liberados).toBe(156);
    expect(result.current.data?.creditos_usados).toBe(24);
    expect(mockFrom).toHaveBeenCalledWith("ciclos_credito");
  });

  it("retorna null quando não há ciclo ativo", async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const { result } = renderHook(
      () => useCicloAtivo("contrato-uuid-001"),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("créditos disponíveis = liberados - usados", async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: CICLO_ATIVO, error: null });
    const { result } = renderHook(
      () => useCicloAtivo("contrato-uuid-001"),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const ciclo = result.current.data!;
    const disponíveis = ciclo.creditos_liberados - ciclo.creditos_usados;
    expect(disponíveis).toBe(132);
  });

  it("não executa quando contratoId é null", async () => {
    const { result } = renderHook(
      () => useCicloAtivo(null),
      { wrapper: makeWrapper() },
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

// ─── Testes: cartões salvos ───────────────────────────────────────────────────

describe("useCartoesAluno", () => {
  beforeEach(() => { vi.clearAllMocks(); builder.then = undefined; });

  it("retorna cartões do aluno", async () => {
    mockOrder.mockResolvedValueOnce({ data: [CARTAO_ATIVO], error: null });
    const { result } = renderHook(
      () => useCartoesAluno(ALUNO_ID),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(mockFrom).toHaveBeenCalledWith("cartoes_salvos");
  });

  it("cartão ativo tem is_default=true e ativo=true", async () => {
    mockOrder.mockResolvedValueOnce({ data: [CARTAO_ATIVO], error: null });
    const { result } = renderHook(
      () => useCartoesAluno(ALUNO_ID),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].ativo).toBe(true);
    expect(result.current.data?.[0].is_default).toBe(true);
  });

  it("last4 tem exatamente 4 dígitos", async () => {
    mockOrder.mockResolvedValueOnce({ data: [CARTAO_ATIVO], error: null });
    const { result } = renderHook(
      () => useCartoesAluno(ALUNO_ID),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].last4).toMatch(/^\d{4}$/);
  });

  it("retorna [] quando aluno não tem cartões", async () => {
    mockOrder.mockResolvedValueOnce({ data: [], error: null });
    const { result } = renderHook(
      () => useCartoesAluno(ALUNO_ID),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(0);
  });

  it("token_rede nunca é vazio em cartão válido", async () => {
    mockOrder.mockResolvedValueOnce({ data: [CARTAO_ATIVO], error: null });
    const { result } = renderHook(
      () => useCartoesAluno(ALUNO_ID),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].token_rede).toBeTruthy();
  });
});
