import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { dataBrasilia, textoAvisoPortal, type AvisoPortal } from "../../supabase/functions/_shared/portal-push";
import { JUROS_PCT_MES, MULTA_PCT } from "../lib/encargosAtraso";

const migration = [
  "0309_push_portal_fase1_regras_referencias.sql",
  "0310_push_portal_reavaliacao_janela_15d.sql",
].map((arquivo) => readFileSync(resolve(__dirname, "../../drizzle/migrations", arquivo), "utf8")).join("\n");
const horariosFixos = readFileSync(resolve(__dirname, "../../supabase/functions/processar-horarios-fixos/index.ts"), "utf8");
const envioPush = readFileSync(resolve(__dirname, "../../supabase/functions/send-push-notification/index.ts"), "utf8");

function aviso(parceiro: Partial<AvisoPortal>): AvisoPortal {
  return {
    aluno_id: "aluno",
    gatilho: "reavaliacao_pendente",
    referencia: "referencia",
    url: "/portal",
    plano_tipo: null,
    data_referencia: null,
    valor: null,
    saldo: null,
    anos: null,
    ...parceiro,
  };
}

describe("push do portal — calendário e conteúdo variável", () => {
  it("usa o dia de Brasília, inclusive quando UTC já virou o dia seguinte", () => {
    expect(dataBrasilia(new Date("2026-11-28T02:59:59Z"))).toBe("2026-11-27");
    expect(dataBrasilia(new Date("2026-11-28T03:00:00Z"))).toBe("2026-11-28");
  });

  it("plano usa o tipo e a data final; mensal com renovação automática não entra", () => {
    const texto = textoAvisoPortal(aviso({
      gatilho: "plano_vencendo_30d",
      plano_tipo: "Power",
      data_referencia: "2026-12-31",
    }));
    expect(texto.body).toContain("Power");
    expect(texto.body).toContain("31/12");
    expect(migration).toContain("NOT COALESCE(p.renovacao_automatica, false)");
    expect(migration).toContain("p.data_fim = p_hoje + 30");
  });

  it("créditos informam o saldo do ciclo e cobrança usa os encargos vigentes", () => {
    const creditos = textoAvisoPortal(aviso({ gatilho: "creditos_baixos", saldo: 2 }));
    expect(creditos.body).toContain("Restam 2 créditos");
    const cobranca = textoAvisoPortal(aviso({
      gatilho: "cobranca_atrasada",
      valor: 1234.5,
      data_referencia: "2026-11-20",
    }));
    expect(cobranca.body).toContain("1.234,50");
    expect(cobranca.body).toContain("20/11");
    expect(cobranca.body).toContain(`multa de ${MULTA_PCT}%`);
    expect(cobranca.body).toContain(`juros de ${JUROS_PCT_MES}%`);
  });

  it("aniversário FORTEM usa anos completos e singular/plural corretos", () => {
    expect(textoAvisoPortal(aviso({ gatilho: "aniversario_fortem", anos: 1 })).title).toBe("1 ano de FORTEM");
    expect(textoAvisoPortal(aviso({ gatilho: "aniversario_fortem", anos: 3 })).title).toBe("3 anos de FORTEM");
  });
});

describe("push do portal — regressões das regras diárias", () => {
  it("atraso só considera D+1, D+3 e D+7 e mantém mensalidades 2027 do site de fora", () => {
    expect(migration).toContain("p_hoje - c.data_vencimento IN (1, 3, 7)");
    expect(migration).toContain("c.mensalidade_2027_id IS NULL");
  });

  it("reavaliação tem janela de 15 dias, para com agenda e reinicia com a nova avaliação", () => {
    expect(migration).toContain("floor((p_hoje - ((u.data + interval '4 months')::date + 1)) / 15.0)::integer");
    expect(migration).toContain("s.data_especifica >= p_hoje");
    expect(migration).toContain("'reavaliacao:' || r.aluno_id::text || ':' || r.data::text");
  });

  it("créditos são agrupados por ciclo e plano sem limite não gera saldo zero falso", () => {
    expect(migration).toContain("COALESCE(c.competencia, c.data_validade, c.created_at::date)");
    expect(migration).toContain("NOT COALESCE(c.ilimitado, false)");
    expect(migration).toContain("HAVING sum(c.quantidade_inicial - c.quantidade_usada) BETWEEN 0 AND 2");
  });

  it("aniversário usa cliente desde e somente alunos ativos", () => {
    expect(migration).toContain("public.fn_cliente_desde(a.id)");
    expect(migration).toContain("a.status = 'ativo'");
    expect(migration).toContain("extract(year FROM a.cliente_desde) < extract(year FROM p_hoje)");
  });

  it("a referência é única e reservada antes de consultar dispositivos inscritos", () => {
    expect(migration).toContain("UNIQUE INDEX IF NOT EXISTS uniq_portal_push_log_referencia");
    expect(migration).toContain("(aluno_id, gatilho, referencia)");
    expect(envioPush.indexOf('if (referencia) {')).toBeLessThan(envioPush.indexOf('from("portal_push_subscriptions")'));
    expect(envioPush).toContain('erro_detalhe: "sem_inscricao"');
    expect(envioPush).toContain('error.code === "23505"');
  });

  it("horário fixo sem vaga mantém a rotina, mas não chama mais o push", () => {
    expect(horariosFixos).toContain('rpc("fn_processar_horarios_fixos")');
    expect(horariosFixos).not.toContain("send-push-notification");
    expect(horariosFixos).not.toContain("horario_fixo_sem_vaga");
  });
});
