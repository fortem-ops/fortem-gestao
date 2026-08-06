import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Bookmark, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useSupabaseMutation } from "@/hooks/useSupabaseMutation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface ComparativoSalvo {
  id: string;
  titulo: string;
  nota: string | null;
  modo: "auto" | "datas" | "intervalo";
  data_a: string | null;
  data_b: string | null;
  intervalo_de: string | null;
  intervalo_ate: string | null;
  created_at: string;
}

export function useComparativosSalvos(alunoId: string | null | undefined) {
  return useQuery({
    enabled: !!alunoId,
    queryKey: ["avaliacoes-comparativos-salvos", alunoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("avaliacoes_comparativos_salvos")
        .select("id, titulo, nota, modo, data_a, data_b, intervalo_de, intervalo_ate, created_at")
        .eq("aluno_id", alunoId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ComparativoSalvo[];
    },
  });
}

const fmt = (d: string | null) => (d ? format(parseISO(d), "dd/MM/yy") : "—");

function resumo(c: ComparativoSalvo) {
  if (c.modo === "datas") return `Datas: ${fmt(c.data_a)} → ${fmt(c.data_b)}`;
  if (c.modo === "intervalo") return `Intervalo: ${fmt(c.intervalo_de)} → ${fmt(c.intervalo_ate)}`;
  return "Automático (última vs. anterior)";
}

interface Props {
  alunoId: string;
  onAplicar: (c: ComparativoSalvo) => void;
}

export function ComparacoesSalvas({ alunoId, onAplicar }: Props) {
  const qc = useQueryClient();
  const { data: lista = [] } = useComparativosSalvos(alunoId);
  const [paraExcluir, setParaExcluir] = useState<ComparativoSalvo | null>(null);

  const excluir = useSupabaseMutation<void, string>({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("avaliacoes_comparativos_salvos")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    successMessage: "Comparação excluída",
    onSuccess: () => {
      setParaExcluir(null);
      qc.invalidateQueries({ queryKey: ["avaliacoes-comparativos-salvos", alunoId] });
    },
  });

  if (lista.length === 0) return null;

  return (
    <div className="bio-card p-4">
      <h3 className="bio-heading text-sm mb-3 flex items-center gap-2">
        <Bookmark className="w-4 h-4" /> Comparações salvas
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
        {lista.map((c) => (
          <div
            key={c.id}
            className="group flex items-start gap-2 rounded-lg border border-[hsl(var(--bio-line))] bg-[hsl(var(--bio-surface-2))] p-3 hover:bg-[hsl(var(--bio-surface-3))] transition-colors"
          >
            <button
              type="button"
              onClick={() => onAplicar(c)}
              className="flex-1 text-left min-w-0"
            >
              <p className="text-sm text-[hsl(var(--bio-ink))] font-medium truncate">{c.titulo}</p>
              <p className="text-[11px] text-[hsl(var(--bio-ink-muted))] mt-0.5">{resumo(c)}</p>
              {c.nota && <p className="text-[11px] text-[hsl(var(--bio-ink-muted))] mt-1 line-clamp-2">{c.nota}</p>}
              <p className="text-[10px] text-[hsl(var(--bio-ink-faint))] mt-1">
                Criado em {format(new Date(c.created_at), "dd/MM/yy HH:mm")}
              </p>
            </button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-[hsl(var(--bio-ink-faint))] hover:text-destructive"
              onClick={() => setParaExcluir(c)}
              aria-label={`Excluir ${c.titulo}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <AlertDialog open={!!paraExcluir} onOpenChange={(o) => !o && setParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir comparação?</AlertDialogTitle>
            <AlertDialogDescription>
              “{paraExcluir?.titulo}” será removida. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (paraExcluir) excluir.mutate(paraExcluir.id);
              }}
              disabled={excluir.isPending}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
