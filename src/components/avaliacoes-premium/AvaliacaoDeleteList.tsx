import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Mode = "forca" | "composicao" | "pliometria";

interface Props {
  alunoId: string;
  mode: Mode;
}

const CONFIG: Record<Mode, { tipo: string; title: string; empty: string; label: string }> = {
  forca: {
    tipo: "funcional_v2",
    title: "Dinamometrias importadas",
    empty: "Nenhuma dinamometria importada.",
    label: "dinamometria",
  },
  composicao: {
    tipo: "composicao_corporal",
    title: "Composições registradas",
    empty: "Nenhuma composição registrada.",
    label: "composição corporal",
  },
  pliometria: {
    tipo: "pliometria",
    title: "Pliometrias registradas",
    empty: "Nenhuma pliometria registrada.",
    label: "pliometria",
  },
};

interface Row {
  id: string;
  data: string;
  dados: Record<string, unknown>;
  resumo: string;
  laudoPath: string | null;
}

export function useCanDeleteAvaliacao() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is-coord-or-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.rpc("is_coordinator_or_admin", { _user_id: user!.id });
      return !!data;
    },
  });
}

export function AvaliacaoDeleteList({ alunoId, mode }: Props) {
  const qc = useQueryClient();
  const cfg = CONFIG[mode];
  const { data: canDelete } = useCanDeleteAvaliacao();
  const [target, setTarget] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["avaliacoes-delete-list", alunoId, mode],
    enabled: !!alunoId && !!canDelete,
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("avaliacoes")
        .select("id, data, dados")
        .eq("aluno_id", alunoId)
        .eq("tipo", cfg.tipo)
        .order("data", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      const list: Row[] = [];
      for (const r of data ?? []) {
        const dados = (r.dados as Record<string, unknown>) || {};
        const forca = dados.forca as { exercicios?: unknown[]; laudoPath?: string } | undefined;
        const exs = Array.isArray(forca?.exercicios) ? forca!.exercicios!.length : 0;
        if (mode === "forca") {
          if (exs === 0) continue;
          list.push({
            id: r.id,
            data: r.data,
            dados,
            resumo: `${exs} exercício(s)`,
            laudoPath: typeof forca?.laudoPath === "string" ? forca.laudoPath : null,
          });
        } else if (mode === "composicao") {
          const bf = dados.percentual_gordura;
          list.push({
            id: r.id,
            data: r.data,
            dados,
            resumo: typeof bf === "number" ? `${bf.toFixed(1)}% gordura` : "—",
            laudoPath: null,
          });
        } else {
          const keys = Object.keys(dados).filter((k) => typeof dados[k] === "number");
          list.push({
            id: r.id,
            data: r.data,
            dados,
            resumo: `${keys.length} métrica(s)`,
            laudoPath: null,
          });
        }
      }
      return list;
    },
  });

  async function handleDelete() {
    if (!target) return;
    setDeleting(true);
    try {
      if (mode === "forca") {
        const metricas = target.dados.metricas as unknown[] | undefined;
        const temMobilidade = Array.isArray(metricas) && metricas.length > 0;
        if (temMobilidade) {
          const novosDados = { ...target.dados };
          delete (novosDados as Record<string, unknown>).forca;
          const { error } = await supabase
            .from("avaliacoes")
            .update({ dados: novosDados } as never)
            .eq("id", target.id);
          if (error) throw error;
          toast.success("Dinamometria removida (mobilidade preservada)");
        } else {
          const { error } = await supabase.from("avaliacoes").delete().eq("id", target.id);
          if (error) throw error;
          toast.success("Dinamometria excluída");
        }
        if (target.laudoPath) {
          await supabase.storage.from("aluno-files").remove([target.laudoPath]);
        }
      } else {
        const { error } = await supabase.from("avaliacoes").delete().eq("id", target.id);
        if (error) throw error;
        toast.success(`Avaliação de ${cfg.label} excluída`);
      }
      setTarget(null);
      qc.invalidateQueries({ queryKey: ["aluno-avaliacoes-consolidadas", alunoId] });
      qc.invalidateQueries({ queryKey: ["avaliacoes-delete-list", alunoId] });
      qc.invalidateQueries({ queryKey: ["avaliacoes-aluno", alunoId] });
      qc.invalidateQueries({ queryKey: ["avaliacoes-global", alunoId] });
    } catch (e) {
      console.error("[AvaliacaoDeleteList] falha ao excluir", e);
      toast.error(e instanceof Error ? e.message : "Erro ao excluir avaliação");
    } finally {
      setDeleting(false);
    }
  }

  if (!canDelete) return null;

  return (
    <div className="bio-card p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="bio-heading text-sm">{cfg.title}</h3>
        <span className="bio-label">Coordenação / Admin</span>
      </div>

      {isLoading ? (
        <div className="py-3 flex justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-[hsl(var(--bio-ink-muted))]" />
        </div>
      ) : !rows || rows.length === 0 ? (
        <p className="text-sm text-[hsl(var(--bio-ink-muted))]">{cfg.empty}</p>
      ) : (
        <ul className="divide-y divide-[hsl(var(--bio-line))]">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="text-sm text-[hsl(var(--bio-ink))]">
                  {format(parseISO(r.data), "dd/MM/yyyy")}
                </p>
                <p className="text-xs text-[hsl(var(--bio-ink-muted))]">{r.resumo}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setTarget(r)}>
                <Trash2 className="w-4 h-4 mr-2" /> Excluir
              </Button>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir avaliação de {cfg.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              {target ? `Registro de ${format(parseISO(target.data), "dd/MM/yyyy")}. ` : ""}
              Esta ação não pode ser desfeita.
              {mode === "forca"
                ? " Se a mesma avaliação tiver métricas de mobilidade, elas serão preservadas."
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
            >
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
