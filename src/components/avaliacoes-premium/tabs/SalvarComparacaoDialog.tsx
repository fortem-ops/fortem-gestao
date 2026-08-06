import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSupabaseMutation } from "@/hooks/useSupabaseMutation";
import { toastError } from "@/lib/toast-helpers";

interface Params {
  modo: "auto" | "datas" | "intervalo";
  data_a: string | null;
  data_b: string | null;
  intervalo_de: string | null;
  intervalo_ate: string | null;
}

interface Props {
  alunoId: string;
  params: Params;
}

export function SalvarComparacaoDialog({ alunoId, params }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [nota, setNota] = useState("");

  const salvar = useSupabaseMutation<void, void>({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Sessão expirada. Faça login novamente.");
      const { error } = await supabase.from("avaliacoes_comparativos_salvos").insert({
        aluno_id: alunoId,
        titulo: titulo.trim(),
        nota: nota.trim() || null,
        modo: params.modo,
        data_a: params.data_a,
        data_b: params.data_b,
        intervalo_de: params.intervalo_de,
        intervalo_ate: params.intervalo_ate,
        criado_por: uid,
      });
      if (error) throw error;
    },
    successMessage: "Comparação salva",
    onSuccess: () => {
      setOpen(false);
      setTitulo("");
      setNota("");
      qc.invalidateQueries({ queryKey: ["avaliacoes-comparativos-salvos", alunoId] });
    },
  });

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-9 gap-2 border-white/15 bg-white/5 text-white hover:bg-white/10"
        onClick={() => setOpen(true)}
      >
        <Save className="w-3.5 h-3.5" /> Salvar esta comparação
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Salvar comparação</DialogTitle>
            <DialogDescription>
              Guardamos apenas os parâmetros (modo e datas). Os números são recalculados a cada
              abertura, refletindo correções feitas depois.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="cmp-titulo">Título</Label>
              <Input
                id="cmp-titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex.: Ciclo 1 vs. Ciclo 2"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="cmp-nota">Nota (opcional)</Label>
              <Textarea
                id="cmp-nota"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                rows={3}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!titulo.trim()) {
                  toastError(new Error("Informe um título."), "Título obrigatório");
                  return;
                }
                salvar.mutate();
              }}
              disabled={salvar.isPending}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
