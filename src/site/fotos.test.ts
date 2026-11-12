import { describe, expect, it } from "vitest";
import { fotoEquipe, FOTOS_SITE } from "./fotos";
import { EQUIPE } from "./conteudo";
import { PAGINAS_SERVICO } from "./conteudoServicos";

describe("fotoEquipe", () => {
  it("devolve a foto cadastrada pelo nome", () => {
    expect(fotoEquipe("Nicolas Janovik")).toBe(FOTOS_SITE["equipe-nicolas"]);
    expect(fotoEquipe("Thaís dos Santos")).toBe(FOTOS_SITE["equipe-thais"]);
  });
  it("sem foto cadastrada devolve indefinido", () => {
    expect(fotoEquipe("Jonas Hubner")).toBeUndefined();
  });
  it("todos com foto na home também têm nas páginas de serviço", () => {
    const comFoto = EQUIPE.filter((p) => fotoEquipe(p.nome)).map((p) => p.nome);
    const nasPaginas = Object.values(PAGINAS_SERVICO).flatMap((pg) => pg.blocos)
      .flatMap((b) => (b.tipo === "pessoas" ? b.pessoas.map((p) => p.nome) : []));
    for (const n of nasPaginas) if (comFoto.includes(n)) expect(fotoEquipe(n)?.src).toBeTruthy();
    expect(nasPaginas.filter((n) => fotoEquipe(n)).length).toBe(4);
  });
});
