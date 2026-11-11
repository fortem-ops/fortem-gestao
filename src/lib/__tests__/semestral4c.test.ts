import { describe, it, expect } from "vitest";
import { acaoExpiracaoSemestral, podeDesistirSemestral, vendaContaParaCpf } from "@/lib/semestral";

describe("Plano Semestral 4C — desistir da venda", () => {
  it("admin/coordenador desiste de venda sem pagamento ou recusada", () => {
    expect(podeDesistirSemestral(true, null)).toBe(true);
    expect(podeDesistirSemestral(true, { estado: "recusado", mensagem: "", podeTentarDeNovo: true })).toBe(true);
  });
  it("professor não desiste; pagamento aprovado ou em processamento bloqueia", () => {
    expect(podeDesistirSemestral(false, null)).toBe(false);
    expect(podeDesistirSemestral(true, { estado: "processando", mensagem: "", podeTentarDeNovo: false })).toBe(false);
    expect(podeDesistirSemestral(true, { estado: "aprovado", mensagem: "", podeTentarDeNovo: false })).toBe(false);
  });
});

describe("Plano Semestral 4C — expiração em 7 dias", () => {
  it("até 7 dias mantém; depois expira", () => {
    expect(acaoExpiracaoSemestral("2026-11-11", "2026-11-18", false)).toBe("manter");
    expect(acaoExpiracaoSemestral("2026-11-11", "2026-11-19", false)).toBe("expirar");
  });
  it("pagamento em andamento não expira, só avisa a equipe", () => {
    expect(acaoExpiracaoSemestral("2026-11-11", "2026-11-19", true)).toBe("avisar");
  });
});

describe("Plano Semestral 4C — uma contratação por CPF", () => {
  it("desistida/expirada nunca paga não conta", () => {
    expect(vendaContaParaCpf({ status_pagamento: "cancelado", primeira_paga: false })).toBe(false);
    expect(vendaContaParaCpf({ status_pagamento: "pendente", primeira_paga: false })).toBe(false);
  });
  it("paga e ativada conta, mesmo cancelada ou estornada depois", () => {
    expect(vendaContaParaCpf({ status_pagamento: "cancelado", primeira_paga: true })).toBe(true);
    expect(vendaContaParaCpf({ status_pagamento: "estornado", primeira_paga: false })).toBe(true);
    expect(vendaContaParaCpf({ status_pagamento: "pago", primeira_paga: true })).toBe(true);
  });
});
