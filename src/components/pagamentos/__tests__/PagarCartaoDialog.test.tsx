import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders, screen, waitFor, fireEvent } from "@/test/utils";

const rpc = vi.fn();
const invoke = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...a: unknown[]) => rpc(...a),
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
  },
}));

const rolesMock = vi.fn();
vi.mock("@/hooks/useUserRoles", () => ({
  useUserRoles: () => rolesMock(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

import { PagarCartaoDialog } from "../PagarCartaoDialog";

const CARTAO_APTO = {
  id: "c1", brand: "master", last4: "7452",
  expiration_month: 10, expiration_year: 2029,
  is_default: true, apto: true, motivo_inapto: null,
};
const CARTAO_VENCIDO = {
  id: "c2", brand: "visa", last4: "1111",
  expiration_month: 1, expiration_year: 2020,
  is_default: false, apto: false, motivo_inapto: "vencido",
};

function montar(props: Partial<React.ComponentProps<typeof PagarCartaoDialog>> = {}) {
  return renderWithProviders(
    <PagarCartaoDialog
      open
      onOpenChange={() => {}}
      vendaId="11111111-1111-1111-1111-111111111111"
      alunoId="22222222-2222-2222-2222-222222222222"
      valor={100}
      {...props}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  rolesMock.mockReturnValue({ data: { isAdmin: true, isCoordAdmin: true }, isLoading: false });
  rpc.mockResolvedValue({ data: [CARTAO_APTO, CARTAO_VENCIDO], error: null });
  invoke.mockResolvedValue({ data: { success: true, tid: "TID1", last4: "7452", brand: "master" }, error: null });
  if (!globalThis.crypto.randomUUID) {
    Object.defineProperty(globalThis.crypto, "randomUUID", { value: () => "uuid-x", configurable: true });
  }
});

describe("PagarCartaoDialog — cobrança de um clique", () => {
  it("pré-seleciona o cartão padrão apto e mostra o botão com valor e cartão", async () => {
    montar();
    const botao = await screen.findByRole("button", { name: /Cobrar R\$\s?100,00 no Mastercard ••••7452/ });
    expect(botao).toBeEnabled();
    expect(screen.getByRole("radio", { name: /Mastercard ••••7452/ })).toHaveAttribute("aria-checked", "true");
  });

  it("mostra o cartão vencido desabilitado com o motivo", async () => {
    montar();
    const vencido = await screen.findByRole("radio", { name: /Visa ••••1111/ });
    expect(vencido).toBeDisabled();
    expect(screen.getByText("vencido")).toBeInTheDocument();
  });

  it("coordenador (não admin) vê o formulário atual", async () => {
    rolesMock.mockReturnValue({ data: { isAdmin: false, isCoordAdmin: true }, isLoading: false });
    montar();
    expect(await screen.findByText("Número do cartão")).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sem cartão apto abre o formulário atual", async () => {
    rpc.mockResolvedValue({ data: [CARTAO_VENCIDO], error: null });
    montar();
    expect(await screen.findByText("Número do cartão")).toBeInTheDocument();
  });

  it("duplo clique dispara UMA única chamada", async () => {
    let resolver: (v: unknown) => void = () => {};
    invoke.mockReturnValue(new Promise((r) => { resolver = r; }));
    montar();
    const botao = await screen.findByRole("button", { name: /Cobrar R\$/ });
    fireEvent.click(botao);
    fireEvent.click(botao);
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    fireEvent.click(botao);
    expect(invoke).toHaveBeenCalledTimes(1);
    resolver({ data: { success: true, tid: "T" }, error: null });
  });

  it("recusa definitiva gera nova chave; resultado incerto trava o botão e mantém a chave", async () => {
    invoke.mockResolvedValue({ data: { success: false, motivo: "Cartão sem limite" }, error: null });
    montar();
    const botao = await screen.findByRole("button", { name: /Cobrar R\$/ });
    fireEvent.click(botao);
    await screen.findByText("Cartão sem limite");
    const chave1 = (invoke.mock.calls[0][1] as { body: { idempotency_key: string } }).body.idempotency_key;

    invoke.mockResolvedValue({ data: { success: false, incerto: true, error: "Resultado incerto — confira na Rede antes de tentar de novo." }, error: null });
    fireEvent.click(screen.getByRole("button", { name: /Cobrar R\$/ }));
    await screen.findByText(/Resultado incerto/);
    const chave2 = (invoke.mock.calls[1][1] as { body: { idempotency_key: string } }).body.idempotency_key;
    expect(chave2).not.toBe(chave1);

    await waitFor(() => expect(screen.getByRole("button", { name: /Cobrar R\$/ })).toBeDisabled());
  });

  it("sucesso invalida as consultas de pagamentos e fecha o diálogo", async () => {
    const onOpenChange = vi.fn();
    const { queryClient } = montar({ onOpenChange });
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    fireEvent.click(await screen.findByRole("button", { name: /Cobrar R\$/ }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(spy).toHaveBeenCalled();
  });
});
