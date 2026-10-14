import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { legacyPropostasLocation, propostasAccess } from "@/lib/propostasContratos";
import PropostasContratos from "@/pages/financeiro/PropostasContratos";

const state = vi.hoisted(() => ({ roles: { isAdmin: false, isCoordAdmin: false }, isLoading: false, isError: false }));
vi.mock("@/hooks/useUserRoles", () => ({ useUserRoles: () => ({ data: state.roles, isLoading: state.isLoading, isError: state.isError }) }));
vi.mock("@/components/leads/PropostasSite2027", () => ({ PropostasSite2027: () => <div data-testid="proposal-list" /> }));
afterEach(() => { cleanup(); state.isLoading = false; state.isError = false; });

describe("permissões de propostas de contratos", () => {
  it("coordenador consulta mas não executa ações sensíveis", () => {
    expect(propostasAccess({ isAdmin: false, isCoordAdmin: true })).toEqual({ canView: true, canManage: false });
  });
  it("admin consulta e executa ações sensíveis", () => {
    expect(propostasAccess({ isAdmin: true, isCoordAdmin: true })).toEqual({ canView: true, canManage: true });
  });
  it.each(["professor", "nutricionista", "fisioterapeuta"])("%s não acessa", () => {
    expect(propostasAccess({ isAdmin: false, isCoordAdmin: false }).canView).toBe(false);
  });
  it("não libera acesso antes da confirmação do papel", () => expect(propostasAccess()).toEqual({ canView: false, canManage: false }));
  it("rota não monta a consulta para equipe técnica", () => {
    state.roles = { isAdmin: false, isCoordAdmin: false };
    render(<MemoryRouter initialEntries={["/financeiro/propostas-contratos"]}><Routes>
      <Route path="/financeiro/propostas-contratos" element={<PropostasContratos />} />
      <Route path="/" element={<div data-testid="home" />} />
    </Routes></MemoryRouter>);
    expect(screen.getByTestId("home")).toBeInTheDocument();
    expect(screen.queryByTestId("proposal-list")).not.toBeInTheDocument();
  });
  it("coordenador monta a listagem existente", () => {
    state.roles = { isAdmin: false, isCoordAdmin: true };
    render(<MemoryRouter><PropostasContratos /></MemoryRouter>);
    expect(screen.getByTestId("proposal-list")).toBeInTheDocument();
  });
  it("erro de autorização não monta propostas", () => {
    state.isError = true;
    render(<MemoryRouter><PropostasContratos /></MemoryRouter>);
    expect(screen.queryByTestId("proposal-list")).not.toBeInTheDocument();
  });
});

describe("favoritos antigos de Leads", () => {
  it.each(["?tab=propostas", "?aba=propostas", "?tab=propostas-site"])("redireciona %s", (search) => {
    expect(legacyPropostasLocation(search)).toBe("/financeiro/propostas-contratos");
  });
  it("preserva parâmetros não relacionados à aba", () => {
    expect(legacyPropostasLocation("?tab=propostas&status=pago")).toBe("/financeiro/propostas-contratos?status=pago");
  });
  it("aceita favorito por âncora", () => expect(legacyPropostasLocation("", "#propostas")).toBe("/financeiro/propostas-contratos"));
  it("mantém edição e filtros de Leads na página original", () => expect(legacyPropostasLocation("?edit=registro&tab=leads")).toBeNull());
});