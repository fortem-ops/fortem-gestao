// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { appDaRota, aplicarApp, forcarApp } from "@/lib/appInstalavel";

const ler = (f: string): { id: string; start_url: string; name: string } =>
  JSON.parse(readFileSync(`public/${f}`, "utf8"));

describe("atalhos de tela inicial", () => {
  afterEach(() => forcarApp(null));
  it("portal usa o app do aluno", () => {
    expect(appDaRota("/portal/home")).toBe("aluno");
    expect(appDaRota("/portal/login")).toBe("aluno");
    expect(appDaRota("/")).toBe("aluno");
  });
  it("login e início da equipe usam o app da equipe", () => {
    expect(appDaRota("/login")).toBe("equipe");
    expect(appDaRota("/equipe")).toBe("equipe");
  });
  it("tela da equipe forçada troca as tags", () => {
    forcarApp("equipe");
    aplicarApp("/alunos");
    expect(document.querySelector('link[rel="manifest"]')?.getAttribute("href")).toBe("/manifest-equipe.json");
    expect(document.querySelector('meta[name="apple-mobile-web-app-title"]')?.getAttribute("content")).toBe("FORTEM Equipe");
    forcarApp(null);
    aplicarApp("/portal/home");
    expect(document.querySelector('link[rel="manifest"]')?.getAttribute("href")).toBe("/manifest-aluno.json");
  });
  it("manifests com ids distintos; aluno mantém /portal", () => {
    const aluno = ler("manifest-aluno.json");
    const legado = ler("manifest.json");
    const equipe = ler("manifest-equipe.json");
    expect(aluno.id).toBe("/portal");
    expect(legado.id).toBe("/portal");
    expect(equipe.id).toBe("/?app=equipe");
    expect(equipe.start_url).toBe("/login");
    expect(aluno.start_url).toBe("/portal");
    expect(equipe.name).toBe("FORTEM Equipe");
  });
});
