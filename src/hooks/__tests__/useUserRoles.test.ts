import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Mock do AuthContext
const mockUser = { id: "user-admin-uuid", email: "admin@fortem.app" };
let mockUserValue: typeof mockUser | null = mockUser;

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: mockUserValue }),
}));

// Mock do Supabase — padrão: admin + coordAdmin = true, parceiro = null
const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: any[]) => mockRpc(...args),
    from: (...args: any[]) => mockFrom(...args),
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: any }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

function setupMocks({
  isAdmin = true,
  isCoordAdmin = true,
  isParceiro = false,
} = {}) {
  mockRpc.mockImplementation((fn: string) => {
    if (fn === "is_admin") return Promise.resolve({ data: isAdmin, error: null });
    if (fn === "is_coordinator_or_admin") return Promise.resolve({ data: isCoordAdmin, error: null });
    return Promise.resolve({ data: null, error: null });
  });

  const parceiroResult = isParceiro ? { id: "parceiro-uuid" } : null;
  mockFrom.mockReturnValue({
    select: () => ({
      eq: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: parceiroResult, error: null }),
        }),
      }),
    }),
  });
}

// ─── Testes ──────────────────────────────────────────────────────────────────

import { useUserRoles } from "../useUserRoles";

describe("useUserRoles", () => {
  beforeEach(() => {
    mockUserValue = mockUser;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retorna isAdmin=true quando RPC is_admin retorna true", async () => {
    setupMocks({ isAdmin: true, isCoordAdmin: true });
    const { result } = renderHook(() => useUserRoles(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.isAdmin).toBe(true);
  });

  it("retorna isAdmin=false quando RPC is_admin retorna false", async () => {
    setupMocks({ isAdmin: false, isCoordAdmin: false });
    const { result } = renderHook(() => useUserRoles(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.isAdmin).toBe(false);
  });

  it("retorna isCoordAdmin=true quando é coordenador", async () => {
    setupMocks({ isAdmin: false, isCoordAdmin: true });
    const { result } = renderHook(() => useUserRoles(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.isCoordAdmin).toBe(true);
    expect(result.current.data?.isAdmin).toBe(false);
  });

  it("retorna isCoordAdmin=false para usuário sem privilégios", async () => {
    setupMocks({ isAdmin: false, isCoordAdmin: false });
    const { result } = renderHook(() => useUserRoles(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.isCoordAdmin).toBe(false);
  });

  it("retorna isParceiro=true quando aluno é parceiro ativo", async () => {
    setupMocks({ isAdmin: false, isCoordAdmin: false, isParceiro: true });
    const { result } = renderHook(() => useUserRoles(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.isParceiro).toBe(true);
  });

  it("retorna isParceiro=false quando não é parceiro", async () => {
    setupMocks({ isAdmin: false, isCoordAdmin: false, isParceiro: false });
    const { result } = renderHook(() => useUserRoles(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.isParceiro).toBe(false);
  });

  it("não executa query quando não há usuário autenticado", async () => {
    mockUserValue = null;
    setupMocks();
    const { result } = renderHook(() => useUserRoles(), { wrapper: makeWrapper() });
    // Deve ficar em loading (enabled=false) sem chamar o Supabase
    await new Promise((r) => setTimeout(r, 100));
    expect(result.current.isLoading).toBe(true);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("admin também é coordAdmin (hierarquia correta)", async () => {
    setupMocks({ isAdmin: true, isCoordAdmin: true });
    const { result } = renderHook(() => useUserRoles(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.isAdmin).toBe(true);
    expect(result.current.data?.isCoordAdmin).toBe(true);
  });

  it("chama is_admin e is_coordinator_or_admin em paralelo", async () => {
    setupMocks();
    const { result } = renderHook(() => useUserRoles(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const calls = mockRpc.mock.calls.map((c) => c[0]);
    expect(calls).toContain("is_admin");
    expect(calls).toContain("is_coordinator_or_admin");
  });

  it("retorna isParceiro=false mesmo quando admin (não acumula parceiro)", async () => {
    setupMocks({ isAdmin: true, isCoordAdmin: true, isParceiro: false });
    const { result } = renderHook(() => useUserRoles(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.isParceiro).toBe(false);
  });
});
