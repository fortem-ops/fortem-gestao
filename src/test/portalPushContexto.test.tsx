// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { PortalPushContexto } from "@/components/portal/PortalPushContexto";
const mocks = vi.hoisted(() => ({ limit: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), not: vi.fn() }));
vi.mock("@/contexts/StudentPortalContext", () => ({ useStudentPortal: () => ({ student: { id: "aluno" } }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
vi.mock("@/hooks/usePushNotifications", () => ({ usePushNotifications: () => ({ isSupported: true, isSubscribed: false, isChecking: false, permission: "default", subscribe: vi.fn() }) }));
let qc: QueryClient;
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const chain = { select: mocks.select, eq: mocks.eq, not: mocks.not, limit: mocks.limit };
  mocks.from.mockReturnValue(chain); mocks.select.mockReturnValue(chain); mocks.eq.mockReturnValue(chain); mocks.not.mockReturnValue(chain);
});
afterEach(() => { cleanup(); qc.clear(); });
function abrir(path: string) {
  return render(<QueryClientProvider client={qc}><MemoryRouter initialEntries={[path]}><PortalPushContexto /></MemoryRouter></QueryClientProvider>);
}
describe("momentos contextuais do portal", () => {
  it("sugere somente após entrar em uma nova fila, não ao abrir com filas existentes", async () => {
    qc.setQueryData(["portal-fila-espera", "aluno"], [{ id: "existente" }]);
    abrir("/portal/agenda");
    expect(screen.queryByRole("button", { name: "Ativar" })).not.toBeInTheDocument();
    act(() => { qc.setQueryData(["portal-fila-espera", "aluno"], [{ id: "existente" }, { id: "nova" }]); });
    await waitFor(() => expect(screen.getByRole("button", { name: "Ativar" })).toBeInTheDocument());
  });
  it("abrir documentos pendentes oferece ativação", async () => {
    mocks.limit.mockResolvedValue({ data: [{ id: "pendente" }], error: null });
    abrir("/portal/contratos");
    await waitFor(() => expect(screen.getByRole("button", { name: "Ativar" })).toBeInTheDocument());
  });
  it("documentos sem pendência não oferecem pedido contextual", async () => {
    mocks.limit.mockResolvedValueOnce({ data: [], error: null }).mockResolvedValueOnce({ data: [{ id: "assinado" }], error: null });
    abrir("/portal/contratos");
    await waitFor(() => expect(qc.getQueryState(["portal-push-contexto-documentos", "aluno"])?.status).toBe("success"));
    expect(screen.queryByRole("button", { name: "Ativar" })).not.toBeInTheDocument();
  });
});
