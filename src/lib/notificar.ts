import { supabase } from "@/integrations/supabase/client";

export const NOTIF_CATEGORIAS = [
  { value: "pauta_tecnica", label: "Pauta Técnica" },
  { value: "reuniao", label: "Reunião" },
  { value: "manutencao", label: "Manutenção" },
  { value: "administrativo", label: "Administrativo" },
  { value: "aluno", label: "Aluno" },
  { value: "financeiro", label: "Financeiro" },
  { value: "comercial", label: "Comercial" },
  { value: "marketing", label: "Marketing" },
  { value: "estrutura", label: "Estrutura" },
  { value: "equipamentos", label: "Equipamentos" },
  { value: "emergencial", label: "Emergencial" },
  { value: "outro", label: "Outro" },
] as const;

export const NOTIF_PRIORIDADES = [
  { value: "baixa", label: "Baixa", className: "prio-baixa" },
  { value: "media", label: "Média", className: "prio-media" },
  { value: "alta", label: "Alta", className: "prio-alta" },
  { value: "urgente", label: "Urgente", className: "prio-urgente" },
] as const;

export const NOTIF_TIPOS = [
  { value: "simples", label: "Notificação simples" },
  { value: "solicitacao", label: "Solicitação" },
  { value: "reuniao", label: "Reunião" },
  { value: "manutencao", label: "Manutenção" },
] as const;

export const NOTIF_STATUS = [
  { value: "nao_visualizada", label: "Não visualizada" },
  { value: "visualizada", label: "Visualizada" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "respondida", label: "Respondida" },
  { value: "concluida", label: "Concluída" },
  { value: "arquivada", label: "Arquivada" },
] as const;

export type NotifPrioridade = (typeof NOTIF_PRIORIDADES)[number]["value"];
export type NotifCategoria = (typeof NOTIF_CATEGORIAS)[number]["value"];
export type NotifTipo = (typeof NOTIF_TIPOS)[number]["value"];
export type NotifStatus = (typeof NOTIF_STATUS)[number]["value"];

export interface RecipientGroup {
  type: "user" | "all_admins" | "all_coordenadores" | "all_professores" | "all_profissionais" | "role";
  userId?: string;
  role?: string;
}

export async function expandRecipients(groups: RecipientGroup[]): Promise<string[]> {
  const ids = new Set<string>();
  for (const g of groups) {
    if (g.type === "user" && g.userId) {
      ids.add(g.userId);
    } else {
      let role: string | null = null;
      if (g.type === "all_admins") role = "admin";
      else if (g.type === "all_coordenadores") role = "coordenador";
      else if (g.type === "all_professores") role = "professor";
      else if (g.type === "role" && g.role) role = g.role;

      if (g.type === "all_profissionais") {
        const { data } = await supabase
          .from("user_roles")
          .select("user_id")
          .in("role", ["admin", "coordenador", "professor", "nutricionista", "fisioterapeuta"] as any);
        data?.forEach((r) => ids.add(r.user_id));
      } else if (role) {
        const { data } = await (supabase.from("user_roles") as any).select("user_id").eq("role", role);
        data?.forEach((r) => ids.add(r.user_id));
      }
    }
  }
  return Array.from(ids);
}

export async function createNotificacao(input: {
  titulo: string;
  descricao: string;
  categoria: NotifCategoria;
  prioridade: NotifPrioridade;
  tipo: NotifTipo;
  prazo?: string | null;
  aluno_id?: string | null;
  reuniao_data?: string | null;
  reuniao_local?: string | null;
  destinatarios: RecipientGroup[];
}) {
  const { data: sess } = await supabase.auth.getSession();
  if (!sess.session) {
    await supabase.auth.refreshSession();
  }
  const { data: sess2 } = await supabase.auth.getSession();
  const uid = sess2.session?.user?.id;
  if (!uid) throw new Error("Sessão expirada — faça login novamente");

  const { data: notif, error } = await supabase
    .from("notificacoes")
    .insert({
      titulo: input.titulo,
      descricao: input.descricao,
      categoria: input.categoria,
      prioridade: input.prioridade,
      tipo: input.tipo,
      prazo: input.prazo || null,
      aluno_id: input.aluno_id || null,
      reuniao_data: input.reuniao_data || null,
      reuniao_local: input.reuniao_local || null,
      criado_por: uid,
    })
    .select("id")
    .single();
  if (error) throw error;

  const userIds = await expandRecipients(input.destinatarios);
  // Sempre inclui o criador como destinatário para vê-la na lista "Recebidas"? Não — fica em Enviadas.
  const rows = userIds
    .filter((id) => id !== uid)
    .map((usuario_id) => ({ notificacao_id: notif.id, usuario_id }));

  if (rows.length) {
    const { error: e2 } = await supabase.from("notificacao_destinatarios").insert(rows);
    if (e2) throw e2;
  }

  return notif.id;
}

export async function markVisualizada(notificacaoId: string, userId: string) {
  await supabase
    .from("notificacao_destinatarios")
    .update({ visualizado_em: new Date().toISOString(), status: "visualizada" })
    .eq("notificacao_id", notificacaoId)
    .eq("usuario_id", userId)
    .is("visualizado_em", null);
}

export async function updateStatus(notificacaoId: string, status: NotifStatus) {
  const { error } = await supabase.from("notificacoes").update({ status }).eq("id", notificacaoId);
  if (error) throw error;
}

export async function addComentario(input: {
  notificacaoId: string;
  comentario: string;
  anexo?: File | null;
}) {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error("Não autenticado");

  let anexo_url: string | null = null;
  let anexo_nome: string | null = null;
  let anexo_tipo: string | null = null;

  if (input.anexo) {
    const path = `${input.notificacaoId}/${Date.now()}-${input.anexo.name}`;
    const { error: upErr } = await supabase.storage.from("notificacao-anexos").upload(path, input.anexo);
    if (upErr) throw upErr;
    anexo_url = path;
    anexo_nome = input.anexo.name;
    anexo_tipo = input.anexo.type;
  }

  const { error } = await supabase.from("notificacao_comentarios").insert({
    notificacao_id: input.notificacaoId,
    usuario_id: uid,
    comentario: input.comentario,
    anexo_url,
    anexo_nome,
    anexo_tipo,
  });
  if (error) throw error;
}

export async function getAnexoUrl(path: string) {
  const { data } = await supabase.storage.from("notificacao-anexos").createSignedUrl(path, 3600);
  return data?.signedUrl;
}
