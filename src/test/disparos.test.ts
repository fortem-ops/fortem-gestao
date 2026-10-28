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
