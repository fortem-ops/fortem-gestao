// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

  it("repassa data-portal-tema em todas as marcações data-portal=\"true\" de Perfil e Reconhecimento facial", () => {
    for (const rel of ["src/pages/portal/PortalProfile.tsx", "src/pages/portal/PortalFacial.tsx"]) {
      const src = readFileSync(resolve(process.cwd(), rel), "utf8");
      const ocorrencias = src.match(/data-portal="true"[^\n>]*/g) ?? [];
      expect(ocorrencias.length).toBeGreaterThan(0);
      for (const trecho of ocorrencias) {
        expect(trecho).toContain("data-portal-tema={tema}");
      }
    }
  });

  it("destaca a aba ativa do menu inferior em vermelho e não em branco", () => {
    const layout = readFileSync(resolve(process.cwd(), "src/components/portal/PortalLayout.tsx"), "utf8");
    expect(layout).toContain('border-[#E73C3E] text-[#E73C3E]');
    expect(layout).not.toContain('border-[#E73C3E] text-white');
  });
});