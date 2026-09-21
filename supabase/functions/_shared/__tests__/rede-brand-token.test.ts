import { describe, it, expect } from "vitest";
import {
  bandeiraRecusouToken,
  extrairBrandTokenStatus,
  resolverStatusTokenizacao,
} from "../rede-brand-token.ts";

// raw_response REAL registrado na tentativa da aluna Mayara (Elo final 4521),
// copiado de rede_tokenizacoes.raw_response — tokenizationId 47bb8f2f-…
const RAW_MAYARA = {
  affiliation: 96337443,
  bin: "651653",
  brand: { name: "Elo", tokenStatus: "Unavailable" },
  last4: "4521",
  lastModifiedDate: "2026-09-21T15:24:22-03:00",
  returnCode: "00",
  returnMessage: "Success",
  tokenizationId: "47bb8f2f-b3d2-4e3b-a45c-8a1c3e5a0ca9",
  tokenizationStatus: "Active",
};

// raw_response REAL da aluna Carolina (Mastercard final 7939) — token excluído.
const RAW_CAROLINA = {
  affiliation: 96337443,
  bin: "523431",
  brand: { name: "Mastercard", tokenStatus: "Deleted" },
  last4: "7939",
  returnCode: "00",
  returnMessage: "Success",
  tokenizationId: "cc107177-e9cc-41ad-97e7-3a0c47c093c3",
  tokenizationStatus: "Active",
};

// raw_response REAL de uma tokenização bem-sucedida (Visa final 3507).
const RAW_OK = {
  affiliation: 96337443,
  bin: "499818",
  brand: { name: "Visa", tokenStatus: "Active" },
  last4: "3507",
  returnCode: "00",
  returnMessage: "Success",
  token: { code: "4667630426623104", expirationDate: "10/2029" },
  tokenizationId: "b10fe333-b80f-45c6-a732-ae8c52f0689a",
  tokenizationStatus: "Active",
};

describe("extrairBrandTokenStatus", () => {
  it("lê o status da bandeira", () => {
    expect(extrairBrandTokenStatus(RAW_MAYARA)).toBe("Unavailable");
    expect(extrairBrandTokenStatus(RAW_OK)).toBe("Active");
  });

  it("devolve string vazia quando não há resposta da bandeira", () => {
    expect(extrairBrandTokenStatus(null)).toBe("");
    expect(extrairBrandTokenStatus({})).toBe("");
    expect(extrairBrandTokenStatus({ brand: {} })).toBe("");
  });
});

describe("bandeiraRecusouToken", () => {
  it("Unavailable (caso real Mayara) é recusa", () => {
    expect(bandeiraRecusouToken(RAW_MAYARA)).toBe(true);
  });

  it("Deleted (caso real Carolina) é recusa", () => {
    expect(bandeiraRecusouToken(RAW_CAROLINA)).toBe(true);
  });

  it("Active não é recusa", () => {
    expect(bandeiraRecusouToken(RAW_OK)).toBe(false);
  });

  it("sem resposta da bandeira não é recusa (segue como timeout)", () => {
    expect(bandeiraRecusouToken(null)).toBe(false);
    expect(bandeiraRecusouToken(undefined)).toBe(false);
    expect(bandeiraRecusouToken({})).toBe(false);
    expect(bandeiraRecusouToken({ brand: { name: "Elo" } })).toBe(false);
  });

  it("status de processamento não é recusa", () => {
    for (const s of ["Pending", "Processing", "InProgress", "Requested", "Created", "Waiting"]) {
      expect(bandeiraRecusouToken({ brand: { tokenStatus: s } })).toBe(false);
    }
  });

  it("qualquer outro status definitivo conta como recusa", () => {
    expect(bandeiraRecusouToken({ brand: { tokenStatus: "Suspended" } })).toBe(true);
    expect(bandeiraRecusouToken({ brand: { tokenStatus: "Denied" } })).toBe(true);
  });
});

describe("resolverStatusTokenizacao", () => {
  it("pending + recusa da bandeira vira recusado_bandeira (dados reais da Mayara)", () => {
    expect(resolverStatusTokenizacao("pending", RAW_MAYARA)).toBe("recusado_bandeira");
    expect(resolverStatusTokenizacao("pending", RAW_CAROLINA)).toBe("recusado_bandeira");
  });

  it("pending sem resposta da bandeira continua pending", () => {
    expect(resolverStatusTokenizacao("pending", null)).toBe("pending");
    expect(resolverStatusTokenizacao("pending", { brand: { tokenStatus: "Processing" } })).toBe("pending");
  });

  it("não altera status já concluídos", () => {
    expect(resolverStatusTokenizacao("active", RAW_OK)).toBe("active");
    expect(resolverStatusTokenizacao("failed", RAW_MAYARA)).toBe("failed");
  });
});
