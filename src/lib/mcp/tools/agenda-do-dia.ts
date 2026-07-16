import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "agenda_do_dia",
  title: "Agenda do dia",
  description:
    "Lista os agendamentos (agenda_servicos) de uma data específica (padrão: hoje). Inclui recorrentes do dia da semana e pontuais na data.",
  inputSchema: {
    data: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe("Data no formato YYYY-MM-DD. Se omitido, usa a data atual."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ data: dataArg }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };

    const target = dataArg ?? new Date().toISOString().slice(0, 10);
    const diaSemana = new Date(target + "T12:00:00").getDay();

    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("agenda_servicos")
      .select("id, atividade, local, horario_inicio, horario_fim, tipo, dia_semana, data_especifica, aluno_id, profissional_id")
      .or(
        `and(tipo.eq.recorrente,dia_semana.eq.${diaSemana}),and(tipo.eq.pontual,data_especifica.eq.${target})`,
      )
      .order("horario_inicio", { ascending: true });

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [
        {
          type: "text",
          text: `Agenda de ${target} (${data?.length ?? 0} itens):\n${JSON.stringify(data ?? [], null, 2)}`,
        },
      ],
      structuredContent: { data: target, itens: data ?? [] },
    };
  },
});
