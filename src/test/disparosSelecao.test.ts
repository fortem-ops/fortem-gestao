import { describe, it, expect } from "vitest";
import { selecaoVazia, aoMudarBusca, aoMudarRecorte, marcarIds, limparIds, buscaParaSalvar } from "@/lib/disparosSelecao";

const base = () => marcarIds(selecaoVazia(), [{ id: "a", nome: "Ana" }, { id: "b", nome: "Bia" }], true);

describe("seleção do Público", () => {
  it("busca não zera ids marcados", () => {
    const s = aoMudarBusca(base());
    expect([...s.ids]).toEqual(["a", "b"]);
  });
  it("ids acumulam entre buscas", () => {
    const s = marcarIds(aoMudarBusca(base()), [{ id: "c", nome: "Caio" }], true);
    expect(s.ids.size).toBe(3);
    expect(s.nomes.get("c")).toBe("Caio");
  });
  it("chips/recorte zeram a seleção", () => {
    const s = aoMudarRecorte({ ...base(), todos: true, removidos: new Set(["x"]) });
    expect(s.ids.size).toBe(0);
    expect(s.todos).toBe(false);
    expect(s.removidos.size).toBe(0);
  });
  it("todos + busca desliga todos e zera removidos, mas mantém ids", () => {
    const s = aoMudarBusca({ ...base(), todos: true, removidos: new Set(["x"]) });
    expect(s.todos).toBe(false);
    expect(s.removidos.size).toBe(0);
    expect(s.ids.size).toBe(2);
  });
  it("desmarcar remove id e nome; limpar zera ids", () => {
    const s = marcarIds(base(), [{ id: "a", nome: "Ana" }], false);
    expect([...s.ids]).toEqual(["b"]);
    expect(s.nomes.has("a")).toBe(false);
    expect(limparIds(s).ids.size).toBe(0);
  });
  it("modo ids salva busca vazia; modo todos salva a busca", () => {
    expect(buscaParaSalvar(false, "ana")).toBe("");
    expect(buscaParaSalvar(true, "ana")).toBe("ana");
  });
});
