import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ClipboardList, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  alunoId: string;
}

const CAMPOS = [
  { key: "limitacoes", label: "Limitações de movimento, patologias, dores ou lesões" },
  { key: "atividade_fisica", label: "Pratica atividade física? Se não, há quanto tempo está parado(a)?" },
  { key: "objetivo_treinamento", label: "Objetivo com o treinamento" },
] as const;

type CampoKey = (typeof CAMPOS)[number]["key"];
type AnamneseForm = Record<CampoKey, string>;

const EMPTY: AnamneseForm = { limitacoes: "", atividade_fisica: "", objetivo_treinamento: "" };

export function AnamneseCard({ alunoId }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<AnamneseForm>(EMPTY);

  const { data: anamnese } = useQuery({
    queryKey: ["prospect_anamnese", alunoId],
    queryFn: async () => {
      const { data } = await supabase
        .from("prospect_anamnese")
        .select("limitacoes,atividade_fisica,objetivo_treinamento")
        .eq("aluno_id", alunoId)
        .maybeSingle();
      return (data as AnamneseForm | null) ?? null;
    },
  });

  useEffect(() => {
    if (open) {
      setForm({
        limitacoes: anamnese?.limitacoes || "",
        atividade_fisica: anamnese?.atividade_fisica || "",
        objetivo_treinamento: anamnese?.objetivo_treinamento || "",
      });
    }
  }, [open, anamnese]);

  const temDados = !!anamnese && CAMPOS.some((c) => (anamnese as any)[c.key]?.trim());

  async function salvar() {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("prospect_anamnese")
        .upsert(
          {
            aluno_id: alunoId,
            limitacoes: form.limitacoes.trim() || null,
            atividade_fisica: form.atividade_fisica.trim() || null,
            objetivo_treinamento: form.objetivo_treinamento.trim() || null,
          } as any,
          { onConflict: "aluno_id" },
        );
      if (error) throw error;
      toast.success("Anamnese atualizada");
      qc.invalidateQueries({ queryKey: ["prospect_anamnese", alunoId] });
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar anamnese");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-muted-foreground" />
          Anamnese inicial
        </h3>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
          <Pencil className="w-3.5 h-3.5" />
          {temDados ? "Editar" : "Preencher anamnese"}
        </Button>
      </div>

      {temDados ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {CAMPOS.map((c) => (
            <div key={c.key} className="glass-card rounded-lg p-4">
              <span className="text-xs text-muted-foreground">{c.label}</span>
              <p className="text-sm text-foreground mt-1.5 whitespace-pre-wrap">
                {(anamnese as any)?.[c.key]?.trim() || "—"}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card rounded-lg p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhuma anamnese registrada para este aluno.
          </p>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Anamnese inicial</DialogTitle>
            <DialogDescription>
              Atualize as informações conforme a situação atual do aluno.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {CAMPOS.map((c) => (
              <div key={c.key} className="space-y-1.5">
                <Label>{c.label}</Label>
                <Textarea
                  rows={3}
                  value={form[c.key]}
                  onChange={(e) => setForm({ ...form, [c.key]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
