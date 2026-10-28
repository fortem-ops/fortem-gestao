import { describe, it, expect } from "vitest";
import { selecaoVazia, aoMudarBusca, aoMudarRecorte, marcarIds, limparIds, buscaParaSalvar, filtroParaSalvar } from "@/lib/disparosSelecao";

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
  it("recorte mantém ids e desliga todos", () => {
    const s = aoMudarRecorte({ ...base(), todos: true, removidos: new Set(["x"]) });
    expect([...s.ids]).toEqual(["a", "b"]);
    expect(s.nomes.get("a")).toBe("Ana");
    expect(s.todos).toBe(false);
    expect(s.removidos.size).toBe(0);
  });
  it("recorte sem todos não zera ids", () => {
    expect([...aoMudarRecorte(base()).ids]).toEqual(["a", "b"]);
  });
  const f = { chips: ["ativos"], busca: "ana", exclConfirmados: false, exclSemContato: true, clienteDesdeDe: "2020-01-01", clienteDesdeAte: "2021-01-01" };
  const todosChips = ["ativos", "ex_alunos", "leads", "prospects", "avulsos"];
  it("filtroParaSalvar modo ids: todos os chips, busca vazia, datas nulas, exclusões preservadas", () => {
    expect(filtroParaSalvar(false, f, todosChips)).toEqual({ chips: todosChips, busca: "", exclConfirmados: false, exclSemContato: true, clienteDesdeDe: null, clienteDesdeAte: null });
  });
  it("filtroParaSalvar modo todos: filtro intacto", () => {
    expect(filtroParaSalvar(true, f, todosChips)).toEqual(f);
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
