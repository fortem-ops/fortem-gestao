import { describe, it, expect } from "vitest";
import {
  formatDateBR,
  formatHora,
  diaSemanaFromISO,
  cargoFromRole,
  cargoFromAppRole,
  sanitizeTextParam,
  buildAgendaContext,
  buildTemplatePayload,
} from "../agenda-template";

/** Extrai os parâmetros do componente body de um payload de template. */
const params = (payload: any): Array<{ type: string; text: string }> =>
  payload.components[0].parameters;

const texts = (payload: any): string[] => params(payload).map((p) => p.text);

/** Conjunto completo de variáveis, todas preenchidas. */
const VARS_COMPLETAS: Record<string, string> = {
  "%TIPO_SERVICO%": "Treino Experimental",
  "%DIA_SEMANA%": "Sexta-feira",
  "%DATA%": "21/08/2026",
  "%HORA_INICIO%": "07:00",
  "%HORA_FIM%": "08:00",
  "%NOME_PROFISSIONAL%": "Carlos Silva",
  "%CARGO_PROFISSIONAL%": "Treinador(a)",
  "%NOME_ALUNO%": "Gustavo Caspani Dubois",
  "%DATA_NASCIMENTO%": "10/05/1990",
  "%LIMITACOES%": "Dor lombar",
  "%ATIVIDADE_FISICA%": "Corrida 2x/semana",
  "%OBJETIVO%": "Hipertrofia",
  "%COMO_CONHECEU%": "Instagram",
  "%QUEIXA%": "Dor no ombro",
  "%ULTIMA_AVALIACAO%": "01/03/2026",
  "%PROTOCOLO%": "Premium",
  "%OBSERVACOES%": "Primeira sessão",
};

/** Mesmas chaves, todas vazias — o cenário que gerava o erro 131008 da Meta. */
const VARS_VAZIAS: Record<string, string> = Object.fromEntries(
  Object.keys(VARS_COMPLETAS).map((k) => [k, ""]),
) as Record<string, string>;

const TEL = "5551999999999";

describe("helpers de formatação", () => {
  it("formatDateBR converte ISO para dd/mm/aaaa", () => {
    expect(formatDateBR("2026-08-21")).toBe("21/08/2026");
    expect(formatDateBR("2026-08-21T13:45:00Z")).toBe("21/08/2026");
  });

  // Comportamento ATUAL e intencional: retorna string vazia com null.
  // A proteção contra a Meta rejeitar o parâmetro fica a cargo do safe()
  // dentro de buildTemplatePayload, testado mais abaixo.
  it("formatDateBR com null retorna string vazia (protegido a jusante pelo safe)", () => {
    expect(formatDateBR(null)).toBe("");
  });

  it("formatHora corta os segundos", () => {
    expect(formatHora("07:30:00")).toBe("07:30");
  });

  it("formatHora com null retorna string vazia (protegido a jusante pelo safe)", () => {
    expect(formatHora(null)).toBe("");
  });

  it("diaSemanaFromISO resolve o dia real da data", () => {
    // 2026-08-21 é uma sexta-feira.
    expect(diaSemanaFromISO("2026-08-21", 0)).toBe("Sexta-feira");
  });

  it("diaSemanaFromISO usa o índice de fallback quando não há data", () => {
    expect(diaSemanaFromISO(null, 1)).toBe("Segunda-feira");
    expect(diaSemanaFromISO(null, 99)).toBe("");
  });

  it("cargoFromRole deriva o cargo da especialidade", () => {
    expect(cargoFromRole("fisioterapia")).toBe("Fisioterapeuta");
    expect(cargoFromRole("Nutricionista clínica")).toBe("Nutricionista");
    expect(cargoFromRole(null)).toBe("Treinador(a)");
  });

  it("cargoFromAppRole deriva o cargo do papel do app", () => {
    expect(cargoFromAppRole("fisioterapeuta")).toBe("Fisioterapeuta");
    expect(cargoFromAppRole("nutricionista")).toBe("Nutricionista");
    expect(cargoFromAppRole("professor")).toBe("Treinador(a)");
    expect(cargoFromAppRole(null)).toBe("Treinador(a)");
  });

  it("sanitizeTextParam remove quebras de linha e espaços duplicados", () => {
    expect(sanitizeTextParam("  linha1\nlinha2\t\tfim  ")).toBe("linha1 linha2 fim");
  });
});

describe("buildTemplatePayload — regressão do fallback '—' (erro 131008 da Meta)", () => {
  const casos: Array<[string, string, string]> = [
    ["agendamento_cancelado", "Qualquer Config", "cancelamento_aviso"],
    ["agendamento_criado", "Treino Experimental", "aviso_treino_experimental"],
    ["agendamento_criado", "Avaliação Funcional", "aviso_avaliacao_funcional"],
    ["agendamento_criado", "Reabilitação", "aviso_consulta_reabilitacao"],
    ["agendamento_criado", "Nutrição", "aviso_consulta_nutricao"],
  ];

  it.each(casos)(
    "gatilho=%s config=%s nunca emite parâmetro de texto vazio",
    (gatilho, configNome) => {
      const payload = buildTemplatePayload(configNome, gatilho, VARS_VAZIAS, TEL)!;
      expect(payload).not.toBeNull();
      for (const t of texts(payload)) {
        expect(t).not.toBe("");
        expect(t.trim().length).toBeGreaterThan(0);
        expect(t).toBe("—");
      }
    },
  );

  it("trata undefined e variáveis ausentes como '—'", () => {
    const payload = buildTemplatePayload("Treino Experimental", "x", {}, TEL)!;
    expect(texts(payload).every((t) => t === "—")).toBe(true);
  });

  it("trata string só de espaços em branco como '—'", () => {
    const payload = buildTemplatePayload(
      "Nutrição",
      "x",
      { ...VARS_COMPLETAS, "%NOME_ALUNO%": "   ", "%OBSERVACOES%": "\n\t " },
      TEL,
    )!;
    const [, , , nomeAluno, , observacoes] = texts(payload);
    expect(nomeAluno).toBe("—");
    expect(observacoes).toBe("—");
  });

  it("sanitiza valores preenchidos que contêm quebras de linha", () => {
    const payload = buildTemplatePayload(
      "Nutrição",
      "x",
      { ...VARS_COMPLETAS, "%OBSERVACOES%": "linha1\nlinha2" },
      TEL,
    )!;
    expect(texts(payload)[5]).toBe("linha1 linha2");
  });
});

describe("buildTemplatePayload — seleção de ramo e contagem de parâmetros", () => {
  it("agendamento_cancelado tem prioridade e monta 4 parâmetros", () => {
    const payload = buildTemplatePayload(
      "Treino Experimental",
      "agendamento_cancelado",
      VARS_COMPLETAS,
      TEL,
    )!;
    expect(payload.template_name).toBe("cancelamento_aviso");
    expect(params(payload)).toHaveLength(4);
    expect(texts(payload)).toEqual([
      "Treino Experimental",
      "21/08/2026",
      "07:00",
      "Gustavo Caspani Dubois",
    ]);
  });

  it("Treino Experimental monta 11 parâmetros", () => {
    const payload = buildTemplatePayload("Treino Experimental", "x", VARS_COMPLETAS, TEL)!;
    expect(payload.template_name).toBe("aviso_treino_experimental");
    expect(params(payload)).toHaveLength(11);
  });

  it("Resumo Treino Experimental cai no mesmo ramo do Treino Experimental", () => {
    const payload = buildTemplatePayload(
      "Resumo Treino Experimental",
      "x",
      VARS_COMPLETAS,
      TEL,
    )!;
    expect(payload.template_name).toBe("aviso_treino_experimental");
    expect(params(payload)).toHaveLength(11);
  });

  it("Avaliação Funcional monta 9 parâmetros", () => {
    const payload = buildTemplatePayload("Avaliação Funcional", "x", VARS_COMPLETAS, TEL)!;
    expect(payload.template_name).toBe("aviso_avaliacao_funcional");
    expect(params(payload)).toHaveLength(9);
  });

  it("Resumo Avaliação Funcional cai no mesmo ramo da Avaliação Funcional", () => {
    const payload = buildTemplatePayload(
      "Resumo Avaliação Funcional",
      "x",
      VARS_COMPLETAS,
      TEL,
    )!;
    expect(payload.template_name).toBe("aviso_avaliacao_funcional");
    expect(params(payload)).toHaveLength(9);
  });

  it("Reabilitação monta 7 parâmetros", () => {
    const payload = buildTemplatePayload("Reabilitação", "x", VARS_COMPLETAS, TEL)!;
    expect(payload.template_name).toBe("aviso_consulta_reabilitacao");
    expect(params(payload)).toHaveLength(7);
  });

  it("Nutrição monta 6 parâmetros", () => {
    const payload = buildTemplatePayload("Nutrição", "x", VARS_COMPLETAS, TEL)!;
    expect(payload.template_name).toBe("aviso_consulta_nutricao");
    expect(params(payload)).toHaveLength(6);
  });

  it("Reabilitação/Nutrição NÃO cai no ramo isolado de Reabilitação", () => {
    const payload = buildTemplatePayload("Reabilitação/Nutrição", "x", VARS_COMPLETAS, TEL)!;
    expect(payload.template_name).toBe("aviso_consulta_nutricao");
    expect(payload.template_name).not.toBe("aviso_consulta_reabilitacao");
    expect(params(payload)).toHaveLength(6);
  });

  it("Reabilitação/Nutrição com sufixo continua no ramo de nutrição", () => {
    const payload = buildTemplatePayload(
      "Reabilitação/Nutrição - Resumo",
      "x",
      VARS_COMPLETAS,
      TEL,
    )!;
    expect(payload.template_name).toBe("aviso_consulta_nutricao");
  });

  it("propaga o telefone de destino em todos os ramos", () => {
    const payload = buildTemplatePayload("Nutrição", "x", VARS_COMPLETAS, TEL)!;
    expect(payload.to).toBe(TEL);
    expect(payload.language).toBe("pt_BR");
  });

  it("retorna null quando nenhum gatilho ou atividade casa", () => {
    expect(buildTemplatePayload("Musculação", "agendamento_criado", VARS_COMPLETAS, TEL)).toBeNull();
    expect(buildTemplatePayload("", "", VARS_COMPLETAS, TEL)).toBeNull();
  });
});

describe("buildTemplatePayload — dataCompleta", () => {
  it("concatena dia da semana e data quando ambos existem", () => {
    const payload = buildTemplatePayload("Nutrição", "x", VARS_COMPLETAS, TEL)!;
    expect(texts(payload)[0]).toBe("Sexta-feira, 21/08/2026");
  });

  it("usa só a data quando não há dia da semana", () => {
    const payload = buildTemplatePayload(
      "Nutrição",
      "x",
      { ...VARS_COMPLETAS, "%DIA_SEMANA%": "" },
      TEL,
    )!;
    expect(texts(payload)[0]).toBe("21/08/2026");
  });

  it("vira '—' quando não há dia da semana nem data", () => {
    const payload = buildTemplatePayload(
      "Nutrição",
      "x",
      { ...VARS_COMPLETAS, "%DIA_SEMANA%": "", "%DATA%": "" },
      TEL,
    )!;
    expect(texts(payload)[0]).toBe("—");
  });
});

/**
 * Fake mínimo do client admin: cada tabela devolve o registro configurado,
 * seja via maybeSingle() seja via await direto na cadeia.
 */
function fakeAdmin(tabelas: Record<string, any>) {
  const acessos: string[] = [];
  const from = (table: string) => {
    acessos.push(table);
    const result = { data: tabelas[table] ?? null, error: null };
    const builder: any = {
      select: () => builder,
      eq: () => builder,
      order: () => builder,
      limit: () => builder,
      maybeSingle: () => Promise.resolve(result),
      then: (res: any, rej: any) => Promise.resolve(result).then(res, rej),
    };
    return builder;
  };
  return { admin: { from }, acessos };
}

describe("buildAgendaContext", () => {
  const AGENDA = {
    id: "ag-1",
    atividade: "Treino Experimental",
    profissional_id: "prof-1",
    aluno_id: "aluno-1",
    data_especifica: "2026-08-21",
    dia_semana: 5,
    horario_inicio: "07:00:00",
    horario_fim: "08:00:00",
    protocolo: "Premium",
    observacoes: "Trazer tênis",
  };

  it("monta todas as variáveis a partir dos dados do banco", async () => {
    const { admin } = fakeAdmin({
      agenda_servicos: AGENDA,
      alunos: { id: "aluno-1", nome: "Gustavo", data_nascimento: "1990-05-10", telefone: "5551988887777" },
      profiles: { user_id: "prof-1", full_name: "Carlos Silva", phone: "5551977776666", specialty: "fisioterapia" },
      prospect_anamnese: { limitacoes: "Dor lombar", atividade_fisica: "Corrida", objetivo_treinamento: "Hipertrofia" },
      avaliacoes: { data_avaliacao: "2026-03-01" },
      pipeline_metadata: { origem_lead: "Instagram" },
      user_roles: { role: "fisioterapeuta" },
    });

    const ctx = (await buildAgendaContext(admin, "ag-1"))!;

    expect(ctx).not.toBeNull();
    expect(ctx.vars["%TIPO_SERVICO%"]).toBe("Treino Experimental");
    expect(ctx.vars["%DIA_SEMANA%"]).toBe("Sexta-feira");
    expect(ctx.vars["%DATA%"]).toBe("21/08/2026");
    expect(ctx.vars["%HORA_INICIO%"]).toBe("07:00");
    expect(ctx.vars["%HORA_FIM%"]).toBe("08:00");
    expect(ctx.vars["%NOME_ALUNO%"]).toBe("Gustavo");
    expect(ctx.vars["%DATA_NASCIMENTO%"]).toBe("10/05/1990");
    expect(ctx.vars["%NOME_PROFISSIONAL%"]).toBe("Carlos Silva");
    expect(ctx.vars["%CARGO_PROFISSIONAL%"]).toBe("Fisioterapeuta");
    expect(ctx.vars["%OBJETIVO%"]).toBe("Hipertrofia");
    expect(ctx.vars["%COMO_CONHECEU%"]).toBe("Instagram");
    expect(ctx.vars["%ULTIMA_AVALIACAO%"]).toBe("01/03/2026");
    expect(ctx.vars["%OBSERVACOES%"]).toBe("Trazer tênis");
    expect(ctx.profTelefone).toBe("5551977776666");
    expect(ctx.alunoTelefone).toBe("5551988887777");
  });

  it("retorna null quando a agenda não existe", async () => {
    const { admin } = fakeAdmin({ agenda_servicos: null });
    expect(await buildAgendaContext(admin, "inexistente")).toBeNull();
  });

  it("usa o snapshot sem consultar agenda_servicos", async () => {
    const { admin, acessos } = fakeAdmin({
      alunos: null,
      profiles: null,
      user_roles: null,
    });
    const ctx = (await buildAgendaContext(admin, "ag-1", { ...AGENDA, aluno_id: null }))!;
    expect(acessos).not.toContain("agenda_servicos");
    expect(ctx.agenda.id).toBe("ag-1");
    expect(ctx.vars["%TIPO_SERVICO%"]).toBe("Treino Experimental");
  });

  it("preenche campos de anamnese ausentes com '—' na origem", async () => {
    const { admin } = fakeAdmin({
      agenda_servicos: { ...AGENDA, protocolo: null, observacoes: null },
      alunos: { id: "aluno-1", nome: "Gustavo", data_nascimento: null, telefone: null },
      profiles: { user_id: "prof-1", full_name: "Carlos", phone: null, specialty: null },
      prospect_anamnese: null,
      avaliacoes: null,
      pipeline_metadata: null,
      user_roles: null,
    });

    const ctx = (await buildAgendaContext(admin, "ag-1"))!;

    expect(ctx.vars["%LIMITACOES%"]).toBe("—");
    expect(ctx.vars["%ATIVIDADE_FISICA%"]).toBe("—");
    expect(ctx.vars["%OBJETIVO%"]).toBe("—");
    expect(ctx.vars["%COMO_CONHECEU%"]).toBe("—");
    expect(ctx.vars["%QUEIXA%"]).toBe("—");
    expect(ctx.vars["%PROTOCOLO%"]).toBe("—");
    expect(ctx.vars["%OBSERVACOES%"]).toBe("—");
    expect(ctx.vars["%ULTIMA_AVALIACAO%"]).toBe("Nenhuma");
  });

  it("aluno sem data de nascimento gera var vazia, mas o payload final vira '—'", async () => {
    const { admin } = fakeAdmin({
      agenda_servicos: AGENDA,
      alunos: { id: "aluno-1", nome: "Thaís", data_nascimento: null, telefone: null },
      profiles: { user_id: "prof-1", full_name: "Carlos", phone: null, specialty: null },
      prospect_anamnese: null,
      avaliacoes: null,
      pipeline_metadata: null,
      user_roles: null,
    });

    const ctx = (await buildAgendaContext(admin, "ag-1"))!;
    // Estado bruto: a var fica vazia...
    expect(ctx.vars["%DATA_NASCIMENTO%"]).toBe("");

    // ...mas o payload enviado à Meta jamais carrega texto vazio.
    const payload = buildTemplatePayload("Treino Experimental", "x", ctx.vars, TEL)!;
    expect(texts(payload)[5]).toBe("—");
    expect(texts(payload).some((t) => t === "")).toBe(false);
  });

  it("não consulta dados de aluno quando a agenda não tem aluno_id", async () => {
    const { admin, acessos } = fakeAdmin({
      agenda_servicos: { ...AGENDA, aluno_id: null },
      profiles: { user_id: "prof-1", full_name: "Carlos", phone: null, specialty: null },
      user_roles: null,
    });

    const ctx = (await buildAgendaContext(admin, "ag-1"))!;

    expect(acessos).not.toContain("prospect_anamnese");
    expect(acessos).not.toContain("avaliacoes");
    expect(ctx.aluno).toBeNull();
    expect(ctx.vars["%NOME_ALUNO%"]).toBe("");
  });
});
