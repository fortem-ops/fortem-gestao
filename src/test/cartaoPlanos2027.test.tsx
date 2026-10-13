import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { faseCartao, faseTravada, luhn, mascararNumeroCartao, validarCartao } from "@/lib/cartaoPlanos2027";
import { CartaoPagamento2027 } from "@/components/planos/CartaoPagamento2027";

const sessao = { proposta_id: "00000000-0000-0000-0000-000000000001", chave_sessao: "x".repeat(43) };
const NUM = "4111 1111 1111 1111";
const tent = (status: string, fase: string | null = null, simulado = false) =>
  ({ id: "t1", tipo: "cartao", simulado, valor_centavos: 100, total_proposta_centavos: 100, parcelas: 12, status, fase });

describe("regras do cartão", () => {
  it("Luhn e máscara", () => {
    expect(luhn("4111111111111111")).toBe(true);
    expect(luhn("4111111111111112")).toBe(false);
    expect(mascararNumeroCartao("4111111111111111")).toBe(NUM);
  });
  it("validade vencida e CVV curto são recusados", () => {
    const base = { numero: NUM, nome: "FULANO TESTE", validade: "12/30", cvv: "123" };
    expect(validarCartao(base).ok).toBe(true);
    expect(validarCartao({ ...base, validade: "01/20" }).ok).toBe(false);
    expect(validarCartao({ ...base, cvv: "12" }).ok).toBe(false);
  });
  it("fases a partir do servidor", () => {
    expect(faseCartao(null, false)).toBe("formulario");
    expect(faseCartao(tent("processando", "validando") as any, false)).toBe("validando");
    expect(faseCartao(tent("processando", "cobrando") as any, false)).toBe("cobrando");
    expect(faseCartao(tent("desconhecido") as any, false)).toBe("confirmando");
    expect(faseCartao(tent("recusado") as any, false)).toBe("recusado");
    expect(faseCartao(tent("expirado") as any, false)).toBe("expirado");
    expect(faseCartao(tent("recusado") as any, true)).toBe("esgotado");
    expect(faseCartao(tent("desconhecido") as any, true)).toBe("confirmando");
    expect(faseCartao(tent("aprovado") as any, false)).toBe("aprovado");
    expect(["validando", "cobrando", "confirmando"].every((f) => faseTravada(f as any))).toBe(true);
    expect(faseTravada("recusado")).toBe(false);
  });
});

function montar(respostas: Record<string, any>, simulacao = false) {
  const chamar = vi.fn(async (acao: string, _c: Record<string, unknown>) => {
    const r = respostas[acao]; return typeof r === "function" ? r() : r;
  });
  const onTravado = vi.fn(); const onAprovado = vi.fn();
  render(<CartaoPagamento2027 sessao={sessao} simulacao={simulacao} parcelas={Array(12).fill(5000)} chamar={chamar as any} onTravado={onTravado} onAprovado={onAprovado} />);
  return { chamar, onTravado, onAprovado };
}
async function preencher() {
  fireEvent.change(screen.getByLabelText(/Número do cartão/), { target: { value: "4111111111111111" } });
  fireEvent.change(screen.getByLabelText(/Nome impresso/), { target: { value: "Fulano Teste" } });
  fireEvent.change(screen.getByLabelText(/Validade/), { target: { value: "1230" } });
  fireEvent.change(screen.getByLabelText(/CVV/), { target: { value: "123" } });
}

describe("tela do cartão", () => {
  it("envia uma vez, limpa os campos e mostra validação com polling de 8 s", async () => {
    vi.useFakeTimers();
    const log = vi.spyOn(console, "log"); const store = vi.spyOn(Storage.prototype, "setItem");
    let n = 0;
    const { chamar, onTravado } = montar({
      status_cartao: () => (n++ === 0 ? { tentativa: null } : { tentativa: tent("processando", "cobrando") }),
      tokenizar_cartao: { tentativa: tent("processando", "validando") },
    });
    await act(async () => {});
    await preencher();
    expect(screen.getByText(/Pagar com cartão · 12x de R\$ 50,00/)).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Pagar com cartão/ })); });
    const corpo = chamar.mock.calls.find((c) => c[0] === "tokenizar_cartao")![1] as any;
    expect(corpo.cartao).toEqual({ numero: "4111111111111111", nome: "Fulano Teste", mes: "12", ano: "2030", cvv: "123" });
    expect(screen.getByText("Validando seu cartão…")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Número do cartão/)).toBeNull();
    expect(document.body.innerHTML).not.toContain("4111");
    expect(onTravado).toHaveBeenLastCalledWith(true);
    await act(async () => { vi.advanceTimersByTime(8000); });
    expect(screen.getByText("Processando o pagamento…")).toBeInTheDocument();
    expect(log).not.toHaveBeenCalled(); expect(store).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
  it("recusado oferece outro cartão com campos vazios", async () => {
    montar({ status_cartao: { tentativa: tent("recusado") } });
    await act(async () => {});
    expect(screen.getByText("Não foi possível usar este cartão")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar outro cartão" }));
    expect((screen.getByLabelText(/Número do cartão/) as HTMLInputElement).value).toBe("");
  });
  it("expirado, desconhecido e esgotado", async () => {
    montar({ status_cartao: { tentativa: tent("expirado") } });
    await act(async () => {});
    expect(screen.getByText("Não conseguimos validar o cartão a tempo")).toBeInTheDocument();
  });
  it("desconhecido trava a tela e não recobra", async () => {
    const { chamar, onTravado } = montar({ status_cartao: { tentativa: tent("desconhecido") } });
    await act(async () => {});
    expect(screen.getByText("Confirmando com o banco…")).toBeInTheDocument();
    expect(onTravado).toHaveBeenLastCalledWith(true);
    expect(chamar.mock.calls.some((c) => c[0] === "tokenizar_cartao")).toBe(false);
  });
  it("3 tentativas esgotadas: Pix ou equipe", async () => {
    montar({ status_cartao: { tentativa: tent("recusado"), cartao_esgotado: true } });
    await act(async () => {});
    expect(screen.getByText("Pague por Pix ou fale com a equipe")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tentar outro cartão" })).toBeNull();
  });
  it("simulação: não envia dados do cartão e aprova", async () => {
    const { chamar, onAprovado } = montar({ status_cartao: { tentativa: null }, pagar_cartao: { tentativa: tent("aprovado", null, true) } }, true);
    await act(async () => {});
    expect(screen.getByText(/Modo simulação/)).toBeInTheDocument();
    await preencher();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Simular cartão aprovado" })); });
    const corpo = chamar.mock.calls.find((c) => c[0] === "pagar_cartao")![1] as any;
    expect(corpo.cartao).toBeUndefined();
    expect(corpo.simular).toBe("aprovado");
    expect(onAprovado).toHaveBeenCalledWith(true);
  });
  it("real: sem aviso de simulação", async () => {
    montar({ status_cartao: { tentativa: null } });
    await act(async () => {});
    expect(screen.queryByText(/Modo simulação/)).toBeNull();
  });
});
