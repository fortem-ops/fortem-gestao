import { describe, it, expect } from "vitest";
import { separarReacoes, chaveTelefone, indicePrimeiraNaoLida, iniciais } from "@/lib/whatsappChat";

const m = (id: string, tipo: string, conteudo: string, extra: any = {}) => ({ id, tipo, conteudo, created_at: "", ...extra });

describe("whatsappChat", () => {
  it("tira reações da linha e guarda a última por mensagem", () => {
    const r = separarReacoes([m("1", "text", "oi", { wamid: "w1" }), m("2", "reaction", "👍", { reacao_a_wamid: "w1" }), m("3", "reaction", "❤️", { reacao_a_wamid: "w1" })]);
    expect(r.linha.map((x) => x.id)).toEqual(["1"]);
    expect(r.reacoes.w1).toEqual(["❤️"]);
  });
  it("reação removida some", () => {
    const r = separarReacoes([m("2", "reaction", "👍", { reacao_a_wamid: "w1" }), m("3", "reaction", "", { reacao_a_wamid: "w1" })]);
    expect(r.reacoes.w1).toBeUndefined();
  });
  it("casa telefone com e sem 55 e nono dígito", () => {
    expect(chaveTelefone("5551999887766")).toBe(chaveTelefone("(51) 9988-7766"));
    expect(chaveTelefone("123")).toBeNull();
  });
  it("primeira não lida", () => {
    const msgs = [{ direcao: "recebida" }, { direcao: "enviada" }, { direcao: "recebida" }, { direcao: "recebida" }];
    expect(indicePrimeiraNaoLida(msgs, 2)).toBe(2);
    expect(indicePrimeiraNaoLida(msgs, 0)).toBe(-1);
  });
  it("iniciais", () => expect(iniciais("Ana Paula Souza")).toBe("AS"));
});
