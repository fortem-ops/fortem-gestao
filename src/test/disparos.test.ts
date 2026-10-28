import { describe, it, expect } from "vitest";
import {
  normalizarTelefone, telefoneValidoWhatsapp, statusDosChips, confirmadosPorTelefone, motivoExclusao, resumoPublico,
  type CadastroPublico,
} from "@/lib/disparos";

const op = { canal: "whatsapp" as const, excluirConfirmados: true, excluirSemContato: true };
const c = (p: Partial<CadastroPublico>): CadastroPublico => ({ id: "x", status: "ativo", is_equipe: false, email: null, telefone: null, ...p });

describe("normalização de telefone", () => {
  it("igual à regra do WhatsApp", () => {
    expect(normalizarTelefone("(51) 99999-8888")).toBe("5551999998888");
    expect(normalizarTelefone("+55 51 99999-8888")).toBe("5551999998888");
    expect(normalizarTelefone("123")).toBe("123");
    expect(normalizarTelefone(null)).toBeNull();
    expect(telefoneValidoWhatsapp("123")).toBe(false);
    expect(telefoneValidoWhatsapp("51 3333-4444")).toBe(true);
  });
});

describe("público", () => {
  it("ex-alunos = inativo + cancelado", () => {
    expect(statusDosChips(["ex_alunos"]).sort()).toEqual(["cancelado", "inativo"]);
  });
  it("cruza confirmados só por telefone", () => {
    const conf = confirmadosPorTelefone(["51 99999-8888"]);
    expect(motivoExclusao(c({ telefone: "5551999998888" }), [], conf, op)).toBe("confirmou");
    expect(motivoExclusao(c({ telefone: "51 98888-7777", email: "a@a.com" }), [], conf, op)).toBeNull();
  });
  it("exclui equipe, opt-out e sem contato", () => {
    expect(motivoExclusao(c({ is_equipe: true, telefone: "51999998888" }), [], new Set(), op)).toBe("equipe");
    const oo = [{ canal: "whatsapp" as const, telefone_norm: "5551999998888", email_norm: null, aluno_id: null }];
    expect(motivoExclusao(c({ telefone: "51999998888" }), oo, new Set(), op)).toBe("optout");
    expect(motivoExclusao(c({ telefone: "51999998888" }), oo, new Set(), { ...op, canal: "email", excluirSemContato: false })).toBeNull();
    expect(motivoExclusao(c({ email: "a@a.com" }), [], new Set(), op)).toBe("sem_contato");
  });
  it("contagens", () => {
    const r = resumoPublico([
      c({ id: "1", telefone: "51999990001", email: "a@a.com" }),
      c({ id: "2", status: "cancelado", telefone: "51999990002" }),
      c({ id: "3", is_equipe: true, telefone: "51999990003" }),
      c({ id: "4", email: "b@b.com" }),
      c({ id: "5", status: "lead", telefone: "51999990005" }),
    ], ["ativos", "ex_alunos"], [], confirmadosPorTelefone(["51999990002"]), op);
    expect(r).toMatchObject({ total: 4, com_email: 2, com_whats: 3, elegiveis: 1, equipe: 1, confirmou: 1, sem_contato: 1, optout: 0 });
  });
});

import { primeiroNome, montarParametros, dedupePorTelefone, telefoneValidoWhatsapp as telOk } from "@/lib/disparos";
describe("etapa 3", () => {
  it("primeiro nome", () => { expect(primeiroNome("  Maria  Clara Souza")).toBe("Maria"); expect(primeiroNome(null)).toBe(""); });
  it("monta {{1}} = primeiro nome e fixos em ordem", () => {
    expect(montarParametros([{ pos: 2, fonte: "fixo", valor: "X" }, { pos: 1, fonte: "campo", valor: "primeiro_nome" }], { nome: "João Pedro" })).toEqual(["João", "X"]);
  });
  it("telefone de teste", () => { expect(telOk("51 99999-0000")).toBe(true); expect(telOk("9999")).toBe(false); });
  it("dedupe por telefone", () => {
    const r = dedupePorTelefone([{ id: 1, telefone: "(51) 99999-0000" }, { id: 2, telefone: "5551999990000" }, { id: 3, telefone: "123" }]);
    expect(r.map((x) => x.id)).toEqual([1]);
  });
});

import { confirmacaoValida, mascararTelefone, resumoStatus } from "@/lib/disparos";
describe("etapa 4", () => {
  it("confirmação exige o total exato", () => {
    expect(confirmacaoValida("673", 673)).toBe(true);
    expect(confirmacaoValida(" 673 ", 673)).toBe(true);
    expect(confirmacaoValida("676", 673)).toBe(false);
    expect(confirmacaoValida("673.0", 673)).toBe(false);
    expect(confirmacaoValida("0", 0)).toBe(false);
    expect(confirmacaoValida("", null)).toBe(false);
  });
  it("mascara telefone", () => {
    expect(mascararTelefone("5551999998888")).toBe("+55 (51) 9****-8888");
    expect(mascararTelefone(null)).toBe("—");
  });
  it("resume status", () => {
    expect(resumoStatus([{ status: "enviado" }, { status: "falhou" }, { status: "ignorado" }, { status: "pendente" }, { status: "enviando" }]))
      .toEqual({ enviado: 1, falhou: 1, ignorado: 1, pendente: 2, total: 5 });
  });
});
