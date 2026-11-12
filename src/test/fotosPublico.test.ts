import { describe, expect, it } from "vitest";
import { adicionarFotos, dimensoesSelfie, mensagemErro, problemasBusca, problemasEnvio, textoBotaoEnvio, textoContador, textoEncontradas, totalPaginas } from "@/lib/fotosPublico";

const f = (name: string, type = "image/jpeg", size = 1000) => ({ name, type, size });

describe("página pública de fotos", () => {
  it("busca exige nome, WhatsApp e aceite; e-mail é opcional", () => {
    expect(problemasBusca({ nome: "Ana", whatsapp: "(51) 99999-0000", email: "", aceite: true })).toEqual([]);
    expect(problemasBusca({ nome: "Ana", whatsapp: "(51) 99999-0000", email: "", aceite: false })).toHaveLength(1);
    expect(problemasBusca({ nome: "", whatsapp: "123", email: "x", aceite: true })).toHaveLength(3);
  });
  it("envio limita a 30 fotos e exige aceite", () => {
    expect(problemasEnvio({ nome: "Ana", whatsapp: "51999990000", aceite: true, qtd: 30 })).toEqual([]);
    expect(problemasEnvio({ nome: "Ana", whatsapp: "51999990000", aceite: true, qtd: 31 })).toHaveLength(1);
    expect(problemasEnvio({ nome: "Ana", whatsapp: "51999990000", aceite: false, qtd: 3 })).toHaveLength(1);
  });
  it("adicionar fotos corta em 30 e recusa tipos ou tamanhos inválidos", () => {
    const atuais = Array.from({ length: 28 }, (_, i) => f(`a${i}.jpg`));
    const r = adicionarFotos(atuais, [f("b.jpg"), f("c.gif", "image/gif"), f("d.heic", ""), f("e.png", "image/png"), f("g.jpg", "image/jpeg", 16 * 1024 * 1024)]);
    expect(r.lista).toHaveLength(30);
    expect(r.recusadas).toBe(2);
    expect(r.excedentes).toBe(1);
  });
  it("textos de contagem", () => {
    expect(textoContador(3)).toBe("3 de 30");
    expect(textoBotaoEnvio(1)).toBe("ENVIAR 1 FOTO");
    expect(textoBotaoEnvio(3)).toBe("ENVIAR 3 FOTOS");
    expect(textoEncontradas(12)).toBe("ENCONTRAMOS 12 FOTOS SUAS");
  });
  it("mensagens de limite sem exclamação", () => {
    expect(mensagemErro("limite_buscas")).toContain("muitas buscas");
    expect(mensagemErro("limite_envios")).toContain("muitos envios");
    for (const c of ["limite_buscas", "x"]) expect(mensagemErro(c)).not.toContain("!");
  });
  it("paginação e tamanho da selfie", () => {
    expect(totalPaginas(0, 30)).toBe(1);
    expect(totalPaginas(61, 30)).toBe(3);
    expect(dimensoesSelfie(4000, 3000)).toEqual({ w: 1280, h: 960 });
    expect(dimensoesSelfie(800, 600)).toEqual({ w: 800, h: 600 });
  });
});
