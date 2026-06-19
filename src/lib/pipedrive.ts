import { supabase } from "@/integrations/supabase/client";

export interface PipedriveLeadPreview {
  dealId: string;
  personId: string | null;
  name: string;
  phone: string;
  email: string;
  ownerName: string;
  ownerId: number | null;
  stageId: number | null;
  stageName: string | null;
  value: number | null;
  currency: string | null;
  addedAt: string | null;
  alreadyImported: boolean;
}

export interface PipedriveImportResult {
  imported: number;
  skipped: number;
  errors: { dealId: string; message: string }[];
  importedAlunoIds: string[];
}

export interface PipedriveStatus {
  status: number;
  outcome: "verified" | "skipped" | "failed" | string;
  latency_ms: number;
  error?: string;
}

export async function getPipedriveStatus(): Promise<PipedriveStatus> {
  const { data, error } = await supabase.functions.invoke<PipedriveStatus>("pipedrive-status", {
    body: {},
  });
  if (error) throw error;
  return data!;
}

export interface ListLeadsFilters {
  stageId?: number | null;
  ownerId?: number | null;
  since?: string | null;
  limit?: number;
}

export async function listPipedriveLeads(filters: ListLeadsFilters = {}): Promise<PipedriveLeadPreview[]> {
  const { data, error } = await supabase.functions.invoke<{ items: PipedriveLeadPreview[] }>(
    "pipedrive-list-leads",
    { body: filters },
  );
  if (error) throw error;
  return data?.items ?? [];
}

export interface ImportLeadItem {
  dealId: string;
  personId: string | null;
  name: string;
  phone?: string;
  email?: string;
  responsavelId?: string | null;
}

export async function importPipedriveLeads(
  items: ImportLeadItem[],
  defaultResponsavelId?: string | null,
): Promise<PipedriveImportResult> {
  const { data, error } = await supabase.functions.invoke<PipedriveImportResult>(
    "pipedrive-import-leads",
    { body: { items, defaultResponsavelId: defaultResponsavelId ?? null } },
  );
  if (error) throw error;
  return data!;
}
