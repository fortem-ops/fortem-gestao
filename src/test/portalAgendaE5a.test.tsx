import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

let ctx: any;
vi.mock("@/contexts/StudentPortalContext", () => ({
  useStudentPortal: () => ctx,
  useStudentPortalOptional: () => ctx,
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ signOut: vi.fn(), user: { email: "a@b.c" } }) }));
vi.mock("@/hooks/usePushNotifications", () => ({
  usePushNotifications: () => ({ isSupported: false, isSubscribed: true, isLoading: false, permission: "granted", subscribe: vi.fn() }),
}));

import { PortalLayout } from "@/components/portal/PortalLayout";
import { AgendaGuard } from "@/components/portal/AgendaGuard";
import { agendaOculta, filtrarNavPortal } from "@/lib/portalAgenda";

const base = { student: { id: "x", nome: "Aluno Teste" }, loading: false, unlinked: false, refetch: () => {} };

function renderLayout() {
  render(
    <MemoryRouter initialEntries={["/portal/home"]}>
      <Routes><Route element={<PortalLayout />}><Route path="/portal/home" element={<div />} /></Route></Routes>
    </MemoryRouter>,
  );
  return screen.getAllByRole("link").filter((l) => l.getAttribute("href")?.startsWith("/portal/")).map((l) => l.textContent);
}

function renderAgenda() {
  render(
    <MemoryRouter initialEntries={["/portal/agenda"]}>
      <Routes>
        <Route path="/portal/agenda" element={<AgendaGuard><p>TELA AGENDA</p></AgendaGuard>} />
        <Route path="/portal/treinos" element={<p>TELA TREINOS</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("E5a — regra", () => {
  it("só esconde quando confirmado true", () => {
    expect(agendaOculta(true)).toBe(true);
    expect(agendaOculta(false)).toBe(false);
    expect(agendaOculta(null)).toBe(false);
    expect(agendaOculta(undefined)).toBe(false);
    expect(filtrarNavPortal([{ to: "/portal/agenda" }, { to: "/portal/home" }], true)).toHaveLength(1);
    expect(filtrarNavPortal([{ to: "/portal/agenda" }, { to: "/portal/home" }], null)).toHaveLength(2);
  });
});

describe("E5a — menu inferior", () => {
  beforeEach(() => { ctx = { ...base }; });
  it("só Consultoria: 4 itens sem Agenda", () => {
    ctx.somenteOnline = true;
    const itens = renderLayout();
    expect(itens).toEqual(["Início", "Treinos", "Clube", "Evolução"]);
  });
  it.each([
    ["presencial (Start/Power/Pro)", false, false],
    ["carregando", null, true],
    ["erro", null, false],
  ])("%s: 5 itens com Agenda", (_n, v, loading) => {
    ctx.somenteOnline = v;
    ctx.somenteOnlineLoading = loading;
    expect(renderLayout()).toEqual(["Início", "Treinos", "Agenda", "Clube", "Evolução"]);
  });
});

describe("E5a — /portal/agenda", () => {
  beforeEach(() => { ctx = { ...base }; });
  it("só Consultoria redireciona para Treinos", () => {
    ctx.somenteOnline = true;
    renderAgenda();
    expect(screen.getByText("TELA TREINOS")).toBeInTheDocument();
  });
  it("presencial abre a Agenda", () => {
    ctx.somenteOnline = false;
    renderAgenda();
    expect(screen.getByText("TELA AGENDA")).toBeInTheDocument();
  });
  it("erro abre a Agenda (comportamento atual)", () => {
    ctx.somenteOnline = null;
    renderAgenda();
    expect(screen.getByText("TELA AGENDA")).toBeInTheDocument();
  });
  it("carregando não redireciona nem mostra nada", () => {
    ctx.somenteOnline = null;
    ctx.somenteOnlineLoading = true;
    renderAgenda();
    expect(screen.queryByText("TELA TREINOS")).toBeNull();
    expect(screen.queryByText("TELA AGENDA")).toBeNull();
  });
});

import PortalAssessments from "@/pages/portal/PortalAssessments";
vi.mock("@/components/avaliacoes-premium/useAlunoAvaliacoesConsolidadas", () => ({
  useAlunoAvaliacoesConsolidadas: () => ({ data: { funcional: { latest: null } }, isLoading: false }),
}));
vi.mock("@/components/portal/referenciaResumoPortal", () => ({ useMobilidadeResumoReferencia: () => ({ data: undefined }) }));

describe("E5a — botão de agendar avaliação", () => {
  const abrir = () => render(<MemoryRouter><PortalAssessments /></MemoryRouter>);
  it("só Consultoria: escondido, sem aviso", () => {
    ctx = { ...base, student: { ...base.student, sexo: "M" }, somenteOnline: true };
    abrir();
    expect(screen.queryByText(/Agendar avaliação funcional/)).toBeNull();
    expect(screen.queryByText(/WhatsApp|Fale com a equipe/i)).toBeNull();
  });
  it.each([false, null])("presencial/erro (%s): visível como hoje", (v) => {
    ctx = { ...base, student: { ...base.student, sexo: "M" }, somenteOnline: v };
    abrir();
    expect(screen.getByText(/Agendar avaliação funcional/)).toBeInTheDocument();
  });
});
