import { supabase } from "@/integrations/supabase/client";
import type { ExperimentalSchema } from "@/components/student/assessment/experimentalTemplate";

export type AvaliacaoEngine = "dinamico" | "funcional_fixo" | "composicao_pollock";

export interface AvaliacaoTipo {
  id: string;
  slug: string;
  nome: string;
  engine: AvaliacaoEngine;
  icone: string | null;
  ordem: number;
  ativo: boolean;
  is_sistema: boolean;
}

export interface AvaliacaoProtocolo {
  id: string;
  tipo_id: string;
  nome: string;
  descricao: string | null;
  schema: ExperimentalSchema | Record<string, unknown>;
  is_default: boolean;
  ativo: boolean;
  ordem: number;
}

export async function fetchTipos(): Promise<AvaliacaoTipo[]> {
  const { data, error } = await supabase
    .from("avaliacao_tipos" as never)
    .select("*")
    .order("ordem", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as AvaliacaoTipo[];
}

export async function fetchProtocolos(tipoId?: string): Promise<AvaliacaoProtocolo[]> {
  let q = supabase.from("avaliacao_protocolos" as never).select("*").order("ordem", { ascending: true });
  if (tipoId) q = q.eq("tipo_id", tipoId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as AvaliacaoProtocolo[];
}

export async function upsertTipo(t: Partial<AvaliacaoTipo> & { nome: string; slug: string; engine: AvaliacaoEngine }) {
  const payload = { ...t } as Record<string, unknown>;
  if (t.id) {
    const { error } = await supabase.from("avaliacao_tipos" as never).update(payload as never).eq("id", t.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("avaliacao_tipos" as never).insert(payload as never);
    if (error) throw error;
  }
}

export async function deleteTipo(id: string) {
  const { error } = await supabase.from("avaliacao_tipos" as never).delete().eq("id", id);
  if (error) throw error;
}

export async function upsertProtocolo(p: Partial<AvaliacaoProtocolo> & { tipo_id: string; nome: string }) {
  const payload = { ...p } as Record<string, unknown>;
  if (p.id) {
    const { error } = await supabase.from("avaliacao_protocolos" as never).update(payload as never).eq("id", p.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("avaliacao_protocolos" as never).insert(payload as never);
    if (error) throw error;
  }
}

export async function deleteProtocolo(id: string) {
  const { error } = await supabase.from("avaliacao_protocolos" as never).delete().eq("id", id);
  if (error) throw error;
}

export async function fetchProtocoloById(id: string): Promise<AvaliacaoProtocolo | null> {
  const { data, error } = await supabase
    .from("avaliacao_protocolos" as never)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as AvaliacaoProtocolo) ?? null;
}

export async function fetchDefaultProtocoloByTipoSlug(slug: string): Promise<AvaliacaoProtocolo | null> {
  const { data: tipo } = await supabase
    .from("avaliacao_tipos" as never)
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  const tipoId = (tipo as { id?: string } | null)?.id;
  if (!tipoId) return null;
  const { data } = await supabase
    .from("avaliacao_protocolos" as never)
    .select("*")
    .eq("tipo_id", tipoId)
    .eq("is_default", true)
    .maybeSingle();
  return (data as unknown as AvaliacaoProtocolo) ?? null;
}
