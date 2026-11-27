// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PortalPushIncentivo } from "@/components/portal/PortalPushIncentivo";
import { PUSH_ADIADO_KEY, PUSH_SESSAO_KEY, SETE_DIAS } from "@/hooks/portalPushIncentivo";
import { calcularAdesaoPush } from "@/hooks/portalPushAdesao";

const push = vi.hoisted(() => ({ isSupported: true, needsInstall: false, permission: "default" as NotificationPermission,
  isSubscribed: false, isChecking: false, isLoading: false, subscribe: vi.fn(), unsubscribe: vi.fn() }));
vi.mock("@/hooks/usePushNotifications", () => ({ usePushNotifications: () => push }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  Object.assign(push, { isSupported: true, needsInstall: false, permission: "default", isSubscribed: false, isChecking: false, isLoading: false });
  vi.clearAllMocks();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("incentivo ao push do portal", () => {
  it("oferece ativação somente sem inscrição e desaparece ao ativar", () => {
    const { rerender } = render(<PortalPushIncentivo />);
    fireEvent.click(screen.getByRole("button", { name: "Ativar" }));
    expect(push.subscribe).toHaveBeenCalledOnce();
    push.isSubscribed = true;
    rerender(<PortalPushIncentivo />);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });
  it("não oferece ativação antes de consultar a inscrição deste aparelho", () => {
    push.isChecking = true;
    render(<PortalPushIncentivo />);
    expect(screen.queryByRole("button", { name: "Ativar" })).not.toBeInTheDocument();
  });
  it("Agora não oculta por exatamente sete dias no aparelho, inclusive após reabrir", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-27T19:53:00Z"));
    const agora = Date.now();
    const { unmount } = render(<PortalPushIncentivo />);
    fireEvent.click(screen.getByRole("button", { name: "Agora não" }));
    expect(Number(localStorage.getItem(PUSH_ADIADO_KEY))).toBe(agora + SETE_DIAS);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    unmount(); vi.setSystemTime(agora + SETE_DIAS - 1);
    const oculto = render(<PortalPushIncentivo />);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    oculto.unmount(); vi.setSystemTime(agora + SETE_DIAS);
    render(<PortalPushIncentivo />);
    expect(screen.getByRole("button", { name: "Ativar" })).toBeInTheDocument();
  });
  it("iPhone sem instalação orienta três passos, sem pedir permissão", () => {
    push.needsInstall = true; push.isSupported = false;
    render(<PortalPushIncentivo />);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: "Ativar" })).not.toBeInTheDocument();
    expect(push.subscribe).not.toHaveBeenCalled();
  });
  it("permissão negada mostra orientação e nunca insiste com ativação", () => {
    push.permission = "denied";
    render(<PortalPushIncentivo />);
    expect(screen.getByText(/Nas configurações do aparelho/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ativar" })).not.toBeInTheDocument();
  });
  it("limita o pedido contextual a um por sessão entre fila e documentos", () => {
    const primeiro = render(<PortalPushIncentivo modo="contexto" />);
    expect(screen.getByRole("button", { name: "Ativar" })).toBeInTheDocument();
    expect(sessionStorage.getItem(PUSH_SESSAO_KEY)).toBe("1");
    primeiro.unmount(); render(<PortalPushIncentivo modo="contexto" />);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });
  it("não pede em contexto se negado, adiado ou já ativo", () => {
    push.permission = "denied";
    const { rerender } = render(<PortalPushIncentivo modo="contexto" />);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    push.permission = "default"; push.isSubscribed = true;
    rerender(<PortalPushIncentivo modo="contexto" />);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(sessionStorage.getItem(PUSH_SESSAO_KEY)).toBeNull();
  });
  it("configurações continuam acessíveis mesmo durante adiamento", () => {
    localStorage.setItem(PUSH_ADIADO_KEY, String(Date.now() + SETE_DIAS));
    render(<PortalPushIncentivo modo="configuracoes" />);
    expect(screen.getByRole("button", { name: "Ativar" })).toBeInTheDocument();
  });
});
describe("adesão administrativa", () => {
  it("conta alunos ativos distintos, não aparelhos ou alunos inativos", () => {
    expect(calcularAdesaoPush(["a", "b", "c", "d"], ["a", "a", "inativo"])).toEqual({ total: 4, quantidade: 1, percentual: 25 });
    expect(calcularAdesaoPush([], ["a"])).toEqual({ total: 0, quantidade: 0, percentual: 0 });
  });
});
