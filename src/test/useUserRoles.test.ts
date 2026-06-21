import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// --- Mocks ---

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRoles";

const mockRpc = supabase.rpc as ReturnType<typeof vi.fn>;
const mockFrom = supabase.from as ReturnType<typeof vi.fn>;
const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

function wrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

function makeQc() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function mockParceiro(found: boolean) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: found ? { id: "parceiro-1" } : null,
      error: null,
    }),
  };
  mockFrom.mockReturnValue(chain);
}

describe("useUserRoles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna undefined e não executa query quando não há usuário logado", async () => {
    mockUseAuth.mockReturnValue({ user: null });

    const qc = makeQc();
    const { result } = renderHook(() => useUserRoles(), { wrapper: wrapper(qc) });

    expect(result.current.data).toBeUndefined();
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("admin=true, coordAdmin=true, parceiro=false", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "user-admin" } });

    mockRpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: true, error: null });

    mockParceiro(false);

    const qc = makeQc();
    const { result } = renderHook(() => useUserRoles(), { wrapper: wrapper(qc) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({
      isAdmin: true,
      isCoordAdmin: true,
      isParceiro: false,
    });
  });

  it("coordenador sem admin e sem parceiro", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "user-coord" } });

    mockRpc
      .mockResolvedValueOnce({ data: false, error: null })
      .mockResolvedValueOnce({ data: true, error: null });

    mockParceiro(false);

    const qc = makeQc();
    const { result } = renderHook(() => useUserRoles(), { wrapper: wrapper(qc) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({
      isAdmin: false,
      isCoordAdmin: true,
      isParceiro: false,
    });
  });

  it("professor com parceiro ativo", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "user-prof" } });

    mockRpc
      .mockResolvedValueOnce({ data: false, error: null })
      .mockResolvedValueOnce({ data: false, error: null });

    mockParceiro(true);

    const qc = makeQc();
    const { result } = renderHook(() => useUserRoles(), { wrapper: wrapper(qc) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({
      isAdmin: false,
      isCoordAdmin: false,
      isParceiro: true,
    });
  });

  it("usuário sem nenhuma role especial", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "user-comum" } });

    mockRpc
      .mockResolvedValueOnce({ data: false, error: null })
      .mockResolvedValueOnce({ data: false, error: null });

    mockParceiro(false);

    const qc = makeQc();
    const { result } = renderHook(() => useUserRoles(), { wrapper: wrapper(qc) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({
      isAdmin: false,
      isCoordAdmin: false,
      isParceiro: false,
    });
  });

  it("dispara is_admin e is_coordinator_or_admin em paralelo com o user correto", async () => {
    const uid = "user-test-uid";
    mockUseAuth.mockReturnValue({ user: { id: uid } });

    mockRpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: true, error: null });

    mockParceiro(false);

    const qc = makeQc();
    const { result } = renderHook(() => useUserRoles(), { wrapper: wrapper(qc) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRpc).toHaveBeenCalledWith("is_admin", { _user_id: uid });
    expect(mockRpc).toHaveBeenCalledWith("is_coordinator_or_admin", { _user_id: uid });
    expect(mockRpc).toHaveBeenCalledTimes(2);

    expect(mockFrom).toHaveBeenCalledWith("parceiros");
  });

  it("lança erro se o Supabase falhar", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "user-err" } });

    mockRpc
      .mockRejectedValueOnce(new Error("Supabase offline"))
      .mockResolvedValueOnce({ data: false, error: null });

    mockParceiro(false);

    const qc = makeQc();
    const { result } = renderHook(() => useUserRoles(), { wrapper: wrapper(qc) });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });
});
