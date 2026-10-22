import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn(), functions: { invoke: vi.fn() } } }));
import { NossaHistoria } from "@/pages/Festa10Anos";
import { festaHistoriaCapitulos as caps } from "@/config/festaHistoria";
const r = (c = caps) => render(<NossaHistoria capitulos={c} fotosDb={{}} interacoes={{}} onInteracao={() => {}} />);
describe("Nossa história", () => {
  it("renderiza os 12 capítulos", () => { r(); caps.forEach((c) => expect(document.getElementById(`cap-${c.ano}`)).toBeTruthy()); });
  it("capítulo oculto some da página e da navegação", () => {
    r(caps.map((c) => c.ano === "2019" ? { ...c, oculto: true } : c));
    expect(document.getElementById("cap-2019")).toBeNull();
    expect(screen.queryAllByRole("link", { name: /2019/ })).toHaveLength(0);
  });
  it("sem áudio não há botões de ouvir", () => {
    r(caps.map((c) => ({ ...c, audio: "" }))); expect(screen.queryByRole("button", { name: /ouvir/i })).toBeNull();
  });
  it("cada capítulo aponta para /audio/10anos/ANO.m4a", () => {
    caps.forEach((c) => expect(c.audio).toBe(`/audio/10anos/${c.ano}.m4a`));
  });
  it("com áudio aparecem ouvir tudo e ouvir capítulo", () => {
    r(caps.map((c) => c.ano === "2016" ? { ...c, audio: "/audio/festa/2016.mp3" } : c));
    expect(screen.getByRole("button", { name: /ouvir tudo/i })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /ouvir capítulo/i })).toHaveLength(1);
  });
  it("recolhível é um summary focável", () => {
    r(); const s = screen.getAllByText(/continuar lendo/i)[0].closest("summary")!;
    s.focus(); expect(document.activeElement).toBe(s);
    fireEvent.click(s); expect(s.parentElement!.hasAttribute("open")).toBe(true);
  });
});
