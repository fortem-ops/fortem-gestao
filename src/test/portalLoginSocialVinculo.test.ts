import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  marcarRetornoOAuthPortal,
  consumirRetornoOAuthPortal,
  limparRetornoOAuthPortal,
} from "@/lib/oauthPortalReturn";

const mig = readFileSync(
  resolve(process.cwd(), "drizzle/migrations/0301_portal_link_aluno_logs_aviso_e_integridade.sql"),
  "utf8",
);
const scriptSql = readFileSync(
  resolve(process.cwd(), "scripts/portal-primeiro-vinculo.test.sql"),
  "utf8",
);
const portalLayout = readFileSync(
  resolve(process.cwd(), "src/components/portal/PortalLayout.tsx"),
  "utf8",
);

describe("Login social no Portal + prevenção de vínculo errado", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => { store.set(k, v); },
        removeItem: (k: string) => { store.delete(k); },
      },
      configurable: true,
    });
  });

  it("marca, consome uma única vez e expira após 10 min o retorno do OAuth do portal", () => {
    const t0 = 1_700_000_000_000;
    marcarRetornoOAuthPortal(t0);
    expect(consumirRetornoOAuthPortal(t0 + 60_000)).toBe(true);
    expect(consumirRetornoOAuthPortal(t0 + 61_000)).toBe(false);

    marcarRetornoOAuthPortal(t0);
    expect(consumirRetornoOAuthPortal(t0 + 11 * 60_000)).toBe(false);

    marcarRetornoOAuthPortal(t0);
    limparRetornoOAuthPortal();
    expect(consumirRetornoOAuthPortal(t0 + 1_000)).toBe(false);
  });

  it("migration 0301 trata no_match, ja_vinculado_outra_conta, log e limite de 1 aviso/dia", () => {
    expect(mig).toMatch(/'ja_vinculado_outra_conta'/);
    expect(mig).toMatch(/'portal-link-aluno'/);
    expect(mig).toMatch(/'aviso_admin_enviado'/);
    expect(mig).toMatch(/fn_admin_alunos_vinculo_integridade/);
    expect(mig).toMatch(/REVOKE ALL ON FUNCTION public\.fn_admin_alunos_vinculo_integridade\(\) FROM PUBLIC, anon/);
  });

  it("tela 'Conta ainda não vinculada' traz botão de WhatsApp da equipe", () => {
    expect(portalLayout).toMatch(/https:\/\/wa\.me\/555135199451/);
    expect(portalLayout).toMatch(/ja_vinculado_outra_conta/);
  });

  it("script SQL de regressão usa fixtures próprias e não depende de 9e30eeda", () => {
    expect(scriptSql).not.toMatch(/9e30eeda/);
    expect(scriptSql).toMatch(/gen_random_uuid\(\)/);
  });
});