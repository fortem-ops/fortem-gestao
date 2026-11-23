import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const acesso = vi.hoisted(() => ({ impl: (_id: string): Promise<boolean> => Promise.resolve(false) }));

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1", email: "admin@fortem.app" }, isReady: true, signOut: async () => {} }),
}));
vi.mock("@/lib/authAccess", () => ({ userHasStaffAccess: (id: string) => acesso.impl(id) }));
vi.mock("@/components/auth/MfaGate", () => ({ MfaGate: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

import { ProtectedRoute } from "@/components/ProtectedRoute";

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/equipe"]}>
        <Routes>
          <Route path="/equipe" element={<ProtectedRoute requireStaff><p>Painel da equipe</p></ProtectedRoute>} />
          <Route path="/portal/*" element={<p>PORTAL DO ALUNO</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ProtectedRoute da equipe", () => {

  it("sem papel de equipe mostra 'Esta área é da equipe' e não abre o portal", async () => {
    acesso.impl = async () => false;
    montar();
    expect(await screen.findByText("Esta área é da equipe")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ir para o portal do aluno" })).toBeInTheDocument();
    expect(screen.queryByText("PORTAL DO ALUNO")).not.toBeInTheDocument();
  });

  it("erro na checagem mostra 'Tentar novamente', nunca o portal", async () => {
    acesso.impl = async () => { throw new Error("sem_sessao_confirmada"); };
    montar();
    expect(await screen.findByText("Tentar novamente", {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.queryByText("PORTAL DO ALUNO")).not.toBeInTheDocument();
  });

  it("equipe confirmada abre o painel", async () => {
    acesso.impl = async () => true;
    montar();
    expect(await screen.findByText("Painel da equipe")).toBeInTheDocument();
  });
});
