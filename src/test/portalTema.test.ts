// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  PORTAL_TEMA_STORAGE_KEY,
  lerPortalTema,
  salvarPortalTema,
} from "@/hooks/usePortalTema";

describe("Tema do portal do aluno", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("usa escuro por padrão quando nada foi salvo", () => {
    expect(lerPortalTema()).toBe("escuro");
  });

  it("cai em escuro quando há valor inválido salvo", () => {
    window.localStorage.setItem(PORTAL_TEMA_STORAGE_KEY, "azul");
    expect(lerPortalTema()).toBe("escuro");
  });

  it("grava e lê a opção claro", () => {
    salvarPortalTema("claro");
    expect(window.localStorage.getItem(PORTAL_TEMA_STORAGE_KEY)).toBe("claro");
    expect(lerPortalTema()).toBe("claro");
  });

  it("volta para escuro ao salvar escuro", () => {
    salvarPortalTema("claro");
    salvarPortalTema("escuro");
    expect(window.localStorage.getItem(PORTAL_TEMA_STORAGE_KEY)).toBe("escuro");
    expect(lerPortalTema()).toBe("escuro");
  });
});