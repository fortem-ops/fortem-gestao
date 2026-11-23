import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { ambienteDe, appEquipeStandalone, destinoAposChecagem, marcasParaGravar, redirecionarAppEquipe } from "@/lib/appInstalavel";

const equipeApp = { standalone: true, marca: "equipe" };

describe("app da equipe no celular", () => {
  it("erro na checagem de papel nunca leva ao portal", () => {
    expect(destinoAposChecagem({ ok: false }, null, false)).toBe("erro");
    expect(destinoAposChecagem({ ok: false }, null, true)).toBe("erro");
  });

  it("equipe vai para /equipe; aluno no navegador vai ao portal", () => {
    expect(destinoAposChecagem({ ok: true, isStaff: true }, null, true)).toBe("/equipe");
    expect(destinoAposChecagem({ ok: true, isStaff: false }, null, false)).toBe("/portal");
    // No app da equipe, quem não é equipe vê "Esta área é da equipe", nunca o portal.
    expect(destinoAposChecagem({ ok: true, isStaff: false }, null, true)).toBe("area_equipe");
  });

  it("app da equipe instalado não abre o portal nem a raiz", () => {
    expect(redirecionarAppEquipe("/portal", equipeApp)).toBe("/login");
    expect(redirecionarAppEquipe("/portal/agenda", equipeApp)).toBe("/login");
    expect(redirecionarAppEquipe("/", equipeApp)).toBe("/login");
    expect(redirecionarAppEquipe("/equipe", equipeApp)).toBeNull();
  });

  it("navegador comum e app do aluno continuam no portal", () => {
    expect(redirecionarAppEquipe("/portal", { standalone: false, marca: "equipe" })).toBeNull();
    expect(redirecionarAppEquipe("/portal", { standalone: true, marca: null })).toBeNull();
  });

  it("manifests: equipe entra por equipe-app.html; aluno mantém id /portal", () => {
    const eq = JSON.parse(readFileSync("public/manifest-equipe.json", "utf8"));
    expect(eq.start_url).toBe("/equipe-app.html");
    expect(eq.id).toBe("/?app=equipe");
    for (const f of ["public/manifest.json", "public/manifest-aluno.json"]) {
      const al = JSON.parse(readFileSync(f, "utf8"));
      expect(al.id).toBe("/portal");
      expect(al.start_url).toBe("/portal");
    }
  });

  it("equipe-app.html traz o manifest e o título da equipe no HTML estático", () => {
    const html = readFileSync("public/equipe-app.html", "utf8");
    expect(html).toContain('href="/manifest-equipe.json"');
    expect(html).toContain('name="apple-mobile-web-app-title" content="FORTEM Equipe"');
  });

  it("iPhone sem navigator.standalone, com display-mode standalone e marca salva, é o app da equipe", () => {
    const amb = ambienteDe({ navStandalone: undefined, displayStandalone: true, ios: true, marcaSessao: null, marcaLocal: "equipe" });
    expect(appEquipeStandalone(amb)).toBe(true);
    expect(redirecionarAppEquipe("/portal/home", amb)).toBe("/login");
  });

  it("Android: marca só no localStorage não transforma o atalho do aluno em app da equipe", () => {
    const amb = ambienteDe({ navStandalone: undefined, displayStandalone: true, ios: false, marcaSessao: null, marcaLocal: "equipe" });
    expect(appEquipeStandalone(amb)).toBe(false);
    expect(redirecionarAppEquipe("/portal/home", amb)).toBeNull();
  });

  it("equipe confirmada grava a marca só em standalone; permanente só no iPhone", () => {
    expect(marcasParaGravar({ standalone: true, marca: null, ios: true })).toEqual({ sessao: true, local: true });
    expect(marcasParaGravar({ standalone: true, marca: null, ios: false })).toEqual({ sessao: true, local: false });
    expect(marcasParaGravar({ standalone: false, marca: null, ios: true })).toEqual({ sessao: false, local: false });
  });

  it("equipe-app.html grava a marca no iPhone também por display-mode", () => {
    const html = readFileSync("public/equipe-app.html", "utf8");
    expect(html).toContain('if (ios && standalone) localStorage.setItem("fortem_app", "equipe")');
  });
});
