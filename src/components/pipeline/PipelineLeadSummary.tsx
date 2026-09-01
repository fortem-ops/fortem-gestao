import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  student: Tables<"alunos">;
}

function diffDays(from: string | null) {
  if (!from) return null;
  const ms = Date.now() - new Date(from).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("pt-BR");
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card/50 p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground mt-0.5 truncate">{value}</p>
    </div>
  );
}

export function PipelineLeadSummary({ student }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["pipeline-lead-summary", student.id],
    queryFn: async () => {
      const [{ data: meta }, { data: lastMove }, { data: lastDone }] = await Promise.all([
        supabase
          .from("pipeline_metadata")
          .select(
            "origem_lead, temperatura_lead, probabilidade_fechamento, valor_estimado_plano, data_prevista_fechamento, responsavel_comercial_id, last_contact_at, next_followup_at, plano_interesse",
          )
          .eq("aluno_id", student.id)
          .maybeSingle(),
        supabase
          .from("pipeline_movements")
          .select("moved_at")
          .eq("aluno_id", student.id)
          .order("moved_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("tarefas")
          .select("updated_at, data_limite, titulo")
          .eq("aluno_id", student.id)
          .eq("origem", "pipeline")
          .eq("status", "concluida")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const ids = [meta?.responsavel_comercial_id, student.responsavel_id].filter(Boolean) as string[];
      let nameMap: Record<string, string> = {};
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", ids);
        (profs || []).forEach((p) => { nameMap[p.user_id] = p.full_name; });
      }

      return { meta, lastMoveAt: lastMove?.moved_at ?? null, lastDone, nameMap };
    },
    staleTime: 30_000,
  });

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  const meta: any = data?.meta;
  const responsavelId = meta?.responsavel_comercial_id || student.responsavel_id;
  const dias = diffDays(data?.lastMoveAt ?? null);
  const ultimoContato =
    meta?.last_contact_at || (data?.lastDone as any)?.updated_at || null;

  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">Resumo comercial</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <Item label="Origem do lead" value={meta?.origem_lead || "—"} />
        <Item label="Responsável comercial" value={(responsavelId && data?.nameMap[responsavelId]) || "—"} />
        <Item label="Temperatura" value={meta?.temperatura_lead || "—"} />
        <Item
          label="Na etapa há"
          value={dias === null ? "—" : dias === 0 ? "hoje" : `${dias} dia${dias > 1 ? "s" : ""}`}
        />
        <Item label="Entrou na etapa em" value={fmtDate(data?.lastMoveAt)} />
        <Item label="Último contato" value={fmtDate(ultimoContato)} />
        <Item label="Próximo follow-up" value={fmtDate(meta?.next_followup_at)} />
        <Item label="Plano de interesse" value={meta?.plano_interesse || "—"} />
        <Item
          label="Valor estimado"
          value={
            meta?.valor_estimado_plano != null
              ? Number(meta.valor_estimado_plano).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
              : "—"
          }
        />
      </CardContent>
    </Card>
  );
}
