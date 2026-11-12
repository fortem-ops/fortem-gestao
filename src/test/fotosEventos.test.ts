import { describe, expect, it } from "vitest";
import { acaoDaTecla, agruparQuaseIdenticas, arquivoAceito, dHash, dimensoesPrevia, hamming, ordenarFila, slugDe, colecaoDe, totais } from "@/lib/fotosEventos";

const f = (id: string, extra: Partial<{ enviado_por: string | null; alerta_moderacao: boolean; criado_em: string; hash: string }> = {}) =>
  ({ id, enviado_por: "L1", alerta_moderacao: false, criado_em: "2026-11-15T10:00:00Z", ...extra });

describe("Fotos de eventos — equipe", () => {
  it("aceita JPEG/PNG/HEIC até 15 MB, inclusive HEIC sem tipo", () => {
    expect(arquivoAceito({ type: "image/jpeg", name: "a.jpg", size: 15 * 1024 * 1024 })).toBe(true);
    expect(arquivoAceito({ type: "", name: "IMG_1.HEIC", size: 100 })).toBe(true);
    expect(arquivoAceito({ type: "image/jpeg", name: "a.jpg", size: 15 * 1024 * 1024 + 1 })).toBe(false);
    expect(arquivoAceito({ type: "image/gif", name: "a.gif", size: 100 })).toBe(false);
  });
  it("prévia com maior lado de 1200px sem ampliar", () => {
    expect(dimensoesPrevia(6000, 4000)).toEqual({ w: 1200, h: 800 });
    expect(dimensoesPrevia(3000, 4500)).toEqual({ w: 800, h: 1200 });
    expect(dimensoesPrevia(800, 600)).toEqual({ w: 800, h: 600 });
  });
  it("coleção sempre começa com fortem-", () => {
    expect(colecaoDe(slugDe("Festa 10 Anos"))).toBe("fortem-evento-festa-10-anos");
  });
  it("fila com alertas primeiro, depois as mais antigas", () => {
    const fila = ordenarFila([f("b", { criado_em: "2026-11-15T09:00:00Z" }), f("c", { alerta_moderacao: true, criado_em: "2026-11-15T11:00:00Z" }), f("a", { criado_em: "2026-11-15T08:00:00Z" })]);
    expect(fila.map((x) => x.id)).toEqual(["c", "a", "b"]);
  });
  it("agrupa quase idênticas só do mesmo remetente", () => {
    const h1 = "0".repeat(64), h2 = "0".repeat(60) + "1111", h3 = "1".repeat(64);
    const g = agruparQuaseIdenticas([f("1", { hash: h1 }), f("2", { hash: h2 }), f("3", { hash: h3 }), f("4", { hash: h1, enviado_por: "L2" })]);
    expect(g.map((x) => x.map((y) => y.id))).toEqual([["1", "2"], ["3"], ["4"]]);
  });
  it("dHash e distância", () => {
    const cinza = Array.from({ length: 72 }, (_, i) => 72 - i);
    expect(dHash(cinza)).toBe("1".repeat(64));
    expect(hamming("1010", "1001")).toBe(2);
  });
  it("atalhos A, R e setas", () => {
    expect(acaoDaTecla("a")).toBe("aprovar"); expect(acaoDaTecla("R")).toBe("rejeitar");
    expect(acaoDaTecla("ArrowLeft")).toBe("anterior"); expect(acaoDaTecla("ArrowRight")).toBe("proxima"); expect(acaoDaTecla("x")).toBeNull();
  });
  it("totais por status e origem; incompletas à parte", () => {
    const t = totais([
      { origem: "fotografo", status_moderacao: "aprovada", status_indexacao: "indexada", upload_concluido: true },
      { origem: "fotografo", status_moderacao: "aprovada", status_indexacao: "erro", upload_concluido: true },
      { origem: "convidado", status_moderacao: "pendente", status_indexacao: "pendente", upload_concluido: true },
      { origem: "fotografo", status_moderacao: "aprovada", status_indexacao: "pendente", upload_concluido: false },
    ]);
    expect(t).toMatchObject({ total: 3, fotografo: 2, convidado: 1, pendentes: 1, aprovadas: 2, indexadas: 1, erro: 1, a_indexar: 0, incompletas: 1 });
  });
});
