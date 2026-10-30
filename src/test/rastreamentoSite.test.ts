import { beforeEach, describe, expect, it } from "vitest";
import { capturarCampanha, ehRotaPublica, lerCampanha, lerConsentimento, linkComSufixo, rastrearCompraPlano, salvarConsentimento, sufixoCampanha, VALIDADE_CAMPANHA_MS, VALIDADE_CONSENTIMENTO_MS } from "@/site/rastreamento";

beforeEach(() => localStorage.clear());

describe("rastreamento do site", () => {
  it("tags só nas rotas públicas", () => {
    for (const r of ["/", "/treinamento", "/experimental", "/planos", "/store", "/store/carrinho", "/corrida", "/10anos", "/privacidade"]) expect(ehRotaPublica(r)).toBe(true);
    for (const r of ["/equipe", "/login", "/portal", "/portal/home", "/notificar", "/assinar-experimental"]) expect(ehRotaPublica(r)).toBe(false);
  });
  it("consentimento vale 12 meses", () => {
    const t = Date.now();
    salvarConsentimento("recusado", t);
    expect(lerConsentimento(t + VALIDADE_CONSENTIMENTO_MS - 1000)).toBe("recusado");
    expect(lerConsentimento(t + VALIDADE_CONSENTIMENTO_MS + 1000)).toBeNull();
  });
  it("campanha 90 dias, sem sobrescrever com vazio", () => {
    const t = Date.now();
    capturarCampanha("?gclid=ABC&utm_source=google", t);
    capturarCampanha("?utm_source=", t);
    expect(lerCampanha(t)?.gclid).toBe("ABC");
    expect(lerCampanha(t + VALIDADE_CAMPANHA_MS + 1000)).toBeNull();
  });
  it("sufixo não leva o gclid", () => {
    expect(sufixoCampanha({ gclid: "ABC" })).toBe(" (ref: google-ads)");
    expect(sufixoCampanha({ utm_source: "Instagram" })).toBe(" (ref: instagram)");
    const l = linkComSufixo("https://wa.me/555135199451?text=Ol%C3%A1", " (ref: google-ads)");
    expect(new URL(l).searchParams.get("text")).toBe("Olá (ref: google-ads)");
    expect(l).not.toContain("ABC");
  });
  it("compra de plano conta uma vez por transação", () => {
    const eventos: unknown[] = [];
    (window as unknown as { gtag: unknown }).gtag = (...a: unknown[]) => eventos.push(a);
    expect(rastrearCompraPlano("t1", 57900)).toBe(true);
    expect(rastrearCompraPlano("t1", 57900)).toBe(false);
    expect(eventos).toEqual([["event", "conversion", { send_to: "AW-797888979/fUEDCNfL664dENOju_wC", value: 579, currency: "BRL", transaction_id: "t1" }]]);
  });
});
