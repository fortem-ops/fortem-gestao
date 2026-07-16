import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listAlunosTool from "./tools/list-alunos";
import getAlunoTool from "./tools/get-aluno";
import agendaDoDiaTool from "./tools/agenda-do-dia";

// Direct Supabase issuer — construído a partir do project ref, nunca do proxy .lovable.cloud.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "fortem-mcp",
  title: "Fortem Gestão Técnica",
  version: "0.1.0",
  instructions:
    "Ferramentas de leitura da Fortem Gestão Técnica. Use `list_alunos` para buscar alunos, `get_aluno` para detalhes de um aluno específico e `agenda_do_dia` para ver os agendamentos de uma data. Todas as ferramentas respeitam as permissões (RLS) do usuário autenticado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listAlunosTool, getAlunoTool, agendaDoDiaTool],
});
