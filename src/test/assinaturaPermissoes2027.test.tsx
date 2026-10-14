import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/utils";
import { AssinaturaSite2027 } from "@/components/leads/AssinaturaSite2027";

const mocks = vi.hoisted(() => ({ admin: false }));
vi.mock("@/hooks/useUserRoles", () => ({ useUserRoles: () => ({ data: { isAdmin: mocks.admin, isCoordAdmin: true } }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: [
    { id: "mensalidade-teste", numero: 2, vencimento: "2026-11-14", valor_centavos: 100, status: "inadimplente", tentativas: 3, simulado: true },
  ], error: null }) }) }) }),
  rpc: vi.fn(), functions: { invoke: vi.fn() },
} }));
afterEach(cleanup);
describe("ações sensíveis na assinatura", () => {
  it("coordenador consulta mensalidades sem cancelar ou dar baixa", async () => {
    mocks.admin = false;
    renderWithProviders(<AssinaturaSite2027 propostaId="teste" familia="start_2027" cancelada={false} />);
    await screen.findByText(/14\/11\/2026/);
    expect(screen.queryByRole("button", { name: "Cancelar assinatura" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Recebido por Pix" })).not.toBeInTheDocument();
  });
  it("admin mantém cancelamento e baixa manual", async () => {
    mocks.admin = true;
    renderWithProviders(<AssinaturaSite2027 propostaId="teste" familia="start_2027" cancelada={false} />);
    expect(await screen.findByRole("button", { name: "Cancelar assinatura" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Recebido por Pix" })).toBeEnabled();
  });
});