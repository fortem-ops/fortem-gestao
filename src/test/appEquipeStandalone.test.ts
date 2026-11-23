import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { destinoAposChecagem, redirecionarAppEquipe } from "@/lib/appInstalavel";

const equipeApp = { standalone: true, marca: "equipe" };

describe("app da equipe no celular", () => {
  it("erro na checagem de papel nunca leva ao portal", () => {
    expect(destinoAposChecagem({ ok: false }, null, false)).toBe("erro");
    expect(destinoAposChecagem({ ok: false }, null, true)).toBe("erro");
  });

  it("equipe vai para /equipe; aluno no navegador vai ao portal", () => {
    expect(destinoAposChecagem({ ok: true, isStaff: true }, null, true)).toBe("/equipe");
    expect(destinoAposChecagem({ ok: true, isStaff: false }, null, false)).toBe("/portal");
    expect(destinoAposChecagem({ ok: true, isStaff: false }, null, true)).toBe("/login");
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
});
