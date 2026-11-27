import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { textoAvisoPortal, type AvisoPortal } from "../../supabase/functions/_shared/portal-push";

const migration = readFileSync(resolve(__dirname, "../../drizzle/migrations/0311_push_portal_fase2_novos_avisos.sql"), "utf8");
const rotina = readFileSync(resolve(__dirname, "../../supabase/functions/check-push-triggers/index.ts"), "utf8");

function aviso(patch: Partial<AvisoPortal>): AvisoPortal {
  return {
    aluno_id: "aluno",
    gatilho: "aniversario_aluno",
    referencia: "referencia",
    url: "/portal",
    plano_tipo: null,
    data_referencia: null,
    valor: null,
    saldo: null,
    anos: null,
    ...patch,
  };
}

describe("push do portal — Fase 2", () => {
  it("aniversário usa o primeiro nome e uma referência anual somente para ativos", () => {
    const texto = textoAvisoPortal(aviso({ nome: "Maria" }));
    expect(texto.title).toBe("Feliz aniversário, Maria!");
    expect(migration).toContain("'aniversario_aluno:' || a.id::text || ':' || extract(year FROM p_hoje)");
    expect(migration).toContain("a.data_nascimento IS NOT NULL");
    expect(migration).toContain("a.status = 'ativo'");
    expect(migration).toContain("NOT COALESCE(a.is_equipe, false)");
  });

  it("documentos informam o total, usam plural correto e têm referência semanal", () => {
    expect(textoAvisoPortal(aviso({ gatilho: "documentos_pendentes", documentos: 1 })).body).toContain("1 documento aguardando");
    expect(textoAvisoPortal(aviso({ gatilho: "documentos_pendentes", documentos: 3 })).body).toContain("3 documentos aguardando");
    expect(migration).toContain("to_char(p_hoje, 'IYYY-\"W\"IW')");
    expect(migration).toContain("d.aceite = false");
    expect(migration).not.toContain("template_id IS NOT NULL");
  });

  it("baixa frequência usa os cinco marcos e inclui as agregadoras", () => {
    expect(textoAvisoPortal(aviso({ gatilho: "baixa_frequencia", dias: 15 })).body).toContain("Faz 15 dias");
    expect(migration).toContain("p_hoje - u.data IN (7, 10, 15, 20, 30)");
    expect(migration).toContain("c.plano_tipo IN ('gympass', 'wellhub', 'totalpass')");
    expect(migration).toContain("p_hoje BETWEEN l.data_inicio AND l.data_fim");
    expect(migration).toContain("c.status = 'suspenso'");
  });

  it("a referência de ausência muda quando um novo check-in reinicia o período", () => {
    expect(migration).toContain("'ausencia:' || a.id::text || ':' || u.data::text");
    expect(migration).toContain("max(c.data) AS data");
    expect(migration).toContain("t.checkin_em IS NOT NULL");
    expect(migration).toContain("t.status = 'realizado'");
    expect(migration).toContain("s.concluido_em IS NOT NULL");
  });

  it("conquista usa pontos quando existem e suprime carga retroativa", () => {
    expect(migration).toContain("'Nova conquista: ' || _badge.nome");
    expect(migration).toContain("_badge.pontos_bonus || ' pontos no Clube FORTEM.'");
    expect(migration).toContain("'Você desbloqueou ' || _badge.nome || ' no Clube FORTEM.'");
    expect(migration).toContain("current_setting('fortem.clube_backfill', true) IS DISTINCT FROM 'on'");
    expect(migration).toContain("ON CONFLICT (aluno_id, badge_id) DO NOTHING");
    expect(migration).not.toContain("CREATE TRIGGER");
  });

  it("a rotina diária acrescenta a Fase 2 sem substituir a seleção da Fase 1", () => {
    expect(rotina).toContain('rpc("fn_portal_push_avisos", { p_hoje: hoje })');
    expect(rotina).toContain('rpc("fn_portal_push_avisos_fase2", { p_hoje: hoje })');
    expect(rotina.indexOf("fase1.data")).toBeLessThan(rotina.indexOf("fase2.data"));
  });
});
