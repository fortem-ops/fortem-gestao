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
  name: "list_alunos",
  title: "Listar alunos",
  description:
    "Lista alunos da Fortem visíveis para o usuário autenticado. Suporta busca por nome/e-mail/CPF e filtro por status.",
  inputSchema: {
    busca: z.string().optional().describe("Trecho de nome, e-mail ou CPF."),
    status: z.enum(["ativo", "inativo"]).optional().describe("Filtra pelo status do aluno."),
    limite: z.number().int().min(1).max(100).optional().describe("Máximo de linhas (padrão 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ busca, status, limite }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };

    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("alunos")
      .select("id, nome, email, telefone, cpf, status, frequencia_semanal, cidade, uf")
      .order("nome", { ascending: true })
      .limit(limite ?? 25);
    if (status) q = q.eq("status", status);
    if (busca?.trim()) {
      const term = `%${busca.trim()}%`;
      q = q.or(`nome.ilike.${term},email.ilike.${term},cpf.ilike.${term}`);
    }

    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { alunos: data ?? [] },
    };
  },
});
