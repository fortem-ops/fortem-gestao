// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { chamar, type FotoPublica } from "@/site/fotosEvento/api";
import FestaGaleria from "@/site/components/FestaGaleria";
import Festa10Anos from "@/pages/Festa10Anos";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn(), functions: { invoke: vi.fn() } } }));
vi.mock("@/site/fotosEvento/api", () => ({ chamar: vi.fn() }));
vi.mock("@/lib/festaFotos", () => ({
  AJUSTE_PADRAO: {}, agruparFotosPorAno: () => ({}),
  carregarFestaFotosPublico: vi.fn().mockResolvedValue([]), carregarAjusteAutorPublico: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/lib/festaAudios", () => ({ carregarFestaAudios: vi.fn().mockResolvedValue({}), textoDuracao: () => "" }));
vi.mock("@/lib/festaInteracoes", () => ({ carregarInteracoes: vi.fn().mockResolvedValue({}) }));
vi.mock("@/components/Seo", () => ({ Seo: () => null }));
vi.mock("@/components/festa/FestaFotosAno", () => ({ default: () => null }));

const foto = (i: number): FotoPublica => ({ id: `foto-${i}`, largura: 1200, altura: 800, orientacao: "paisagem", url_previa: `/previa-${i}.jpg`, url_original: null, url_miniatura: `/miniatura-${i}.jpg` });
function montar(pagina = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}>{pagina ? <Festa10Anos /> : <FestaGaleria />}</QueryClientProvider>);
  return client;
}
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Festa retrospectiva: acesso público sem confirmação", () => {
  it("abrir /10anos não consulta confirmados nem inicia confirmação", async () => {
    vi.mocked(chamar).mockResolvedValue({ fotos: [], total: 0, pagina: 0, por_pagina: 24 });
    const client = montar(true);
    await waitFor(() => expect(chamar).toHaveBeenCalled());
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
    client.clear();
  });
});

describe("Galeria: paginação de fotos aprovadas pelo servidor", () => {
  it("pede 24 por página, só busca a seguinte sob demanda e respeita o total", async () => {
    vi.mocked(chamar)
      .mockResolvedValueOnce({ fotos: Array.from({ length: 24 }, (_, i) => foto(i)), total: 25, pagina: 0, por_pagina: 24 })
      .mockResolvedValueOnce({ fotos: [foto(24)], total: 25, pagina: 1, por_pagina: 24 });
    const client = montar();
    await screen.findByRole("button", { name: "Abrir foto 24" });
    expect(chamar).toHaveBeenCalledTimes(1);
    expect(chamar).toHaveBeenNthCalledWith(1, "fotos-evento-publico", { acao: "galeria", pagina: 0, por_pagina: 24 });
    fireEvent.click(screen.getByRole("button", { name: "Ver mais fotos" }));
    await screen.findByRole("button", { name: "Abrir foto 25" });
    expect(chamar).toHaveBeenNthCalledWith(2, "fotos-evento-publico", { acao: "galeria", pagina: 1, por_pagina: 24 });
    expect(client.getQueryData<{ pages: { fotos: FotoPublica[] }[] }>(["fotos-evento-publico", "galeria-aniversario", 24])?.pages.flatMap((p) => p.fotos)).toHaveLength(25);
    client.clear();
  });

  it("reabrir a galeria reutiliza URLs assinadas em cache, sem buscar novamente", async () => {
    vi.mocked(chamar).mockResolvedValue({ fotos: [foto(0)], total: 1, pagina: 0, por_pagina: 24 });
    const client = montar();
    await screen.findByRole("button", { name: "Abrir foto 1" });
    cleanup();
    render(<QueryClientProvider client={client}><FestaGaleria /></QueryClientProvider>);
    await screen.findByRole("button", { name: "Abrir foto 1" });
    expect(chamar).toHaveBeenCalledTimes(1);
    client.clear();
  });
});