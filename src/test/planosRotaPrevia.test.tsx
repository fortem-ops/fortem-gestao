import { describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

let resolverSessao: (v: any) => void = () => {};
const rpc = vi.fn(async () => ({ data: { previa: true, disponivel: false, planos: [] }, error: null }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...a: any[]) => (rpc as any)(...a),
    auth: {
      getSession: () => new Promise((ok) => { resolverSessao = ok; }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  },
}));
vi.mock("@/site/ComercioPublico", () => ({ ComercioPublico: ({ children }: any) => children }));
import PlanosRota from "@/pages/PlanosRota";

describe("prévia de admin espera a sessão", () => {
  it("não pede o catálogo da prévia como visitante antes de a sessão chegar", async () => {
    render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={["/planos?previa=1"]}><PlanosRota /></MemoryRouter></QueryClientProvider>);
    await new Promise((r) => setTimeout(r, 50));
    expect(rpc).not.toHaveBeenCalled();
    resolverSessao({ data: { session: { user: { id: "adm" } } } });
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("fn_planos_publico_2027", { p_previa: true }));
  });
});
