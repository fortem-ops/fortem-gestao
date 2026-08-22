import { describe, it, expect, vi } from "vitest";
import { cobrarComToken, motivoRecusaLegivel } from "../rede-recorrencia-core";

const BASE = {
  tokenizationId: "tok-123",
  amountCentavos: 19900,
  installments: 1,
  reference: "abcdef0123456789abcdef0123456789",
  cardNumber: "4111111111111111",
  cardholderName: "JOAO SILVA",
  expirationMonth: "07",
  expirationYear: "2030",
  accessToken: "at-xyz",
  baseUrl: "https://api.rede/v1",
  tokenServiceBaseUrl: "https://token.rede/cryptograms",
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status });
}

const CRYPTO_OK = {
  returnCode: "00",
  returnMessage: "OK",
  cryptogramInfo: { tokenCryptogram: "CRYPTO-ABC" },
};

describe("cobrarComToken", () => {
  it("aprova e devolve tid quando returnCode é 00", async () => {
    const calls: Array<{ url: string; body: any }> = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init?.body ?? "{}")) });
      if (url.startsWith("https://token.rede")) return jsonResponse(200, CRYPTO_OK);
      return jsonResponse(200, {
        returnCode: "00",
        returnMessage: "Transacao autorizada",
        tid: "TID-1",
        nsu: "NSU-1",
        authorizationCode: "AUTH-1",
      });
    });

    const r = await cobrarComToken({ ...BASE, fetchImpl: fetchImpl as any });

    expect(r.stage).toBe("transaction");
    expect(r.approved).toBe(true);
    expect(r.errorKind).toBeNull();
    expect(r.tid).toBe("TID-1");
    expect(r.nsu).toBe("NSU-1");
    expect(r.desativarCartao).toBe(false);

    // criptograma primeiro, com subscription
    expect(calls[0].url).toBe("https://token.rede/cryptograms/tok-123");
    expect(calls[0].body).toEqual({ subscription: true });

    // transação com o payload MIT esperado
    expect(calls[1].url).toBe("https://api.rede/v1/transactions");
    expect(calls[1].body).toMatchObject({
      capture: true,
      kind: "credit",
      amount: 19900,
      installments: 1,
      storageCard: "2",
      cardNumber: "4111111111111111",
      tokenCryptogram: "CRYPTO-ABC",
      subscription: true,
      reference: BASE.reference,
    });
  });

  it("marca desativarCartao quando returnCode é 54", async () => {
    const fetchImpl = vi.fn(async (url: string) =>
      url.startsWith("https://token.rede")
        ? jsonResponse(200, CRYPTO_OK)
        : jsonResponse(200, { returnCode: "54", returnMessage: "Cartao expirado" }),
    );

    const r = await cobrarComToken({ ...BASE, fetchImpl: fetchImpl as any });

    expect(r.approved).toBe(false);
    expect(r.returnCode).toBe("54");
    expect(r.desativarCartao).toBe(true);
    expect(r.errorKind).toBeNull();
  });

  it("recusa comum não desativa o cartão", async () => {
    const fetchImpl = vi.fn(async (url: string) =>
      url.startsWith("https://token.rede")
        ? jsonResponse(200, CRYPTO_OK)
        : jsonResponse(200, { returnCode: "51", returnMessage: "Saldo insuficiente" }),
    );

    const r = await cobrarComToken({ ...BASE, fetchImpl: fetchImpl as any });

    expect(r.approved).toBe(false);
    expect(r.desativarCartao).toBe(false);
    expect(r.returnMessage).toBe("Saldo insuficiente");
  });

  it("para na etapa de criptograma quando o Token Service falha", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(400, { returnCode: "99", returnMessage: "Tokenizacao invalida" }),
    );

    const r = await cobrarComToken({ ...BASE, fetchImpl: fetchImpl as any });

    expect(r.stage).toBe("cryptogram");
    expect(r.errorKind).toBe("criptograma");
    expect(r.approved).toBe(false);
    expect(r.httpStatus).toBe(400);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("falha de criptograma quando não vem tokenCryptogram mesmo com returnCode 00", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { returnCode: "00", cryptogramInfo: {} }));
    const r = await cobrarComToken({ ...BASE, fetchImpl: fetchImpl as any });
    expect(r.errorKind).toBe("criptograma");
  });

  it("erro de rede no criptograma vira errorKind network sem lançar", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("boom");
    });
    const r = await cobrarComToken({ ...BASE, fetchImpl: fetchImpl as any });
    expect(r.stage).toBe("cryptogram");
    expect(r.errorKind).toBe("network");
    expect(r.httpStatus).toBe(0);
  });

  it("erro de rede na transação vira errorKind network na etapa transaction", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.startsWith("https://token.rede")) return jsonResponse(200, CRYPTO_OK);
      throw new Error("timeout");
    });
    const r = await cobrarComToken({ ...BASE, fetchImpl: fetchImpl as any });
    expect(r.stage).toBe("transaction");
    expect(r.errorKind).toBe("network");
    expect(r.approved).toBe(false);
  });

  it("não trata resposta não-JSON como aprovada", async () => {
    const fetchImpl = vi.fn(async (url: string) =>
      url.startsWith("https://token.rede")
        ? jsonResponse(200, CRYPTO_OK)
        : new Response("<html>erro</html>", { status: 500 }),
    );
    const r = await cobrarComToken({ ...BASE, fetchImpl: fetchImpl as any });
    expect(r.approved).toBe(false);
  });
});

describe("motivoRecusaLegivel", () => {
  it("usa texto humano para códigos conhecidos", () => {
    expect(motivoRecusaLegivel("54", "Expired card")).toBe("Cartão vencido");
    expect(motivoRecusaLegivel("51", "Insufficient funds")).toBe("Cartão sem limite");
  });

  it("cai no returnMessage da Rede para códigos desconhecidos", () => {
    expect(motivoRecusaLegivel("99", "Erro generico")).toBe("Erro generico");
  });

  it("tem fallback quando não há mensagem", () => {
    expect(motivoRecusaLegivel(null, null)).toBe("Cobrança recusada pelo banco emissor");
    expect(motivoRecusaLegivel("99", "   ")).toBe("Cobrança recusada pelo banco emissor");
  });
});
