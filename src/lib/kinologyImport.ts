import { supabase } from "@/integrations/supabase/client";
import {
  classifyForca,
  computeForcaScore,
  type ForcaExercicio,
  type ForcaInput,
} from "@/components/student/assessment/funcionalV2/bodyMapLogic";

export interface KinologyParsedExercise {
  nome: ForcaExercicio;
  direito_kg: number;
  esquerdo_kg: number;
  data?: string;
}

export interface KinologyParseResult {
  paciente: string | null;
  dataEmissao: string | null;
  exercicios: KinologyParsedExercise[];
  laudoPath: string;
  source: "deterministic" | "ai";
}


/**
 * Sanitiza nome de arquivo para uso como chave no Supabase Storage.
 * Remove acentos/diacríticos, troca caracteres fora de [a-zA-Z0-9._-] por "_",
 * mantém a extensão .pdf e limita o tamanho total.
 */
function sanitizeFileName(name: string): string {
  const dot = name.lastIndexOf(".");
  const rawBase = dot > 0 ? name.slice(0, dot) : name;
  const rawExt = dot > 0 ? name.slice(dot + 1) : "pdf";
  const clean = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
  const base = clean(rawBase).slice(0, 80) || "laudo";
  const ext = clean(rawExt).toLowerCase() || "pdf";
  return `${base}.${ext}`;
}

/**
 * Faz upload do PDF Kinology no bucket `aluno-files` e invoca a edge function
 * `parse-kinology-pdf` para extrair os exercícios via IA.
 */
export async function uploadAndParseKinology(
  alunoId: string,
  file: File,
): Promise<KinologyParseResult> {
  const safeName = sanitizeFileName(file.name);
  const path = `avaliacoes/laudos-dinamometria/${alunoId}/${Date.now()}-${safeName}`;
  const { error: upErr } = await supabase.storage
    .from("aluno-files")
    .upload(path, file, { contentType: "application/pdf", upsert: false });
  if (upErr) throw upErr;

  const { data, error } = await supabase.functions.invoke("parse-kinology-pdf", {
    body: { storage_path: path },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  const exercicios = (data?.exercicios ?? []) as KinologyParsedExercise[];
  return {
    paciente: data?.paciente ?? null,
    dataEmissao: data?.dataEmissao ?? null,
    exercicios,
    laudoPath: path,
    source: (data?.source === "deterministic" ? "deterministic" : "ai"),
  };

}

/**
 * Monta o objeto `dados.forca` no formato canônico gravado por funcional_v2.
 */
export function buildForcaPayload(result: KinologyParseResult) {
  const exercicios = result.exercicios.map((ex) => {
    const c = classifyForca(ex.direito_kg, ex.esquerdo_kg);
    return {
      nome: ex.nome,
      direito_kg: ex.direito_kg,
      esquerdo_kg: ex.esquerdo_kg,
      assimetria: Number(c.assimetria.toFixed(2)),
      classificacao: c.classification,
    };
  });
  const forcaInputs: ForcaInput[] = exercicios.map((e) => ({
    nome: e.nome,
    direito_kg: e.direito_kg,
    esquerdo_kg: e.esquerdo_kg,
  }));
  return {
    laudoPath: result.laudoPath,
    importadoEm: new Date().toISOString(),
    exercicios,
    scoreForca: computeForcaScore(forcaInputs),
  };
}

export interface FuncionalV2Row {
  id: string;
  data: string;
  dados: Record<string, unknown>;
}

/**
 * Procura a avaliação funcional_v2 mais recente do aluno que ainda esteja
 * "aguardando força" — ou seja: existe `dados.metricas` mas `dados.forca`
 * está ausente/vazia. Retorna `null` se não houver.
 */
export async function findFuncionalV2AguardandoForca(
  alunoId: string,
): Promise<FuncionalV2Row | null> {
  const { data, error } = await supabase
    .from("avaliacoes")
    .select("id, data, dados")
    .eq("aluno_id", alunoId)
    .eq("tipo", "funcional_v2")
    .order("data", { ascending: false })
    .limit(10);
  if (error) throw error;

  for (const row of data ?? []) {
    const dados = (row.dados as Record<string, unknown>) || {};
    const forca = dados.forca as { exercicios?: unknown[] } | null | undefined;
    const temForca = !!forca && Array.isArray(forca.exercicios) && forca.exercicios.length > 0;
    if (!temForca) {
      return { id: row.id, data: row.data, dados };
    }
  }
  return null;
}

/**
 * Retorna o id do protocolo default (is_default=true) do tipo `funcional_v2`.
 * Necessário para inserir uma nova linha `funcional_v2` só-força.
 */
export async function getFuncionalV2DefaultProtocoloId(): Promise<string | null> {
  const { data: tipo } = await supabase
    .from("avaliacao_tipos")
    .select("id")
    .eq("engine", "funcional_v2")
    .maybeSingle();
  if (!tipo?.id) return null;
  const { data: proto } = await supabase
    .from("avaliacao_protocolos")
    .select("id")
    .eq("tipo_id", tipo.id)
    .eq("is_default", true)
    .eq("ativo", true)
    .maybeSingle();
  return proto?.id ?? null;
}
