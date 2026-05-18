import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, Lock, Settings2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useDebounce } from "@/hooks/useDebounce";
import {
  fetchExperimentalSchema,
  migrateLegacyDados,
  EMPTY_DADOS,
  type ExperimentalRecordDados,
  type TemplateQuestion,
  type ExperimentalAnswers,
} from "./experimentalTemplate";
import { ExperimentalTemplateEditor } from "./ExperimentalTemplateEditor";

// Re-export para compatibilidade com imports existentes
export type ExperimentalDados = ExperimentalRecordDados;

interface Props {
  student: Tables<"alunos">;
  avaliacaoId?: string;
}

export function ExperimentalAssessment({ student, avaliacaoId }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: canEdit, isLoading: loadingPerm } = useQuery({
    queryKey: ["is-coord-or-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.rpc("is_coordinator_or_admin", { _user_id: user!.id });
      return !!data;
    },
  });

  const { data: schema, isLoading: loadingSchema } = useQuery({
    queryKey: ["avaliacao-template", "experimental"],
    queryFn: fetchExperimentalSchema,
  });

  const [id, setId] = useState<string | null>(avaliacaoId ?? null);
  const [dados, setDados] = useState<ExperimentalRecordDados>(EMPTY_DADOS);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const lastSerialized = useRef<string>("");
  const initialized = useRef(false);

  useEffect(() => {
    if (!avaliacaoId) {
      initialized.current = true;
      return;
    }
    (async () => {
      const { data } = await supabase.from("avaliacoes").select("*").eq("id", avaliacaoId).maybeSingle();
      if (data?.dados) {
        const merged = migrateLegacyDados(data.dados as Record<string, unknown>);
        setDados(merged);
        lastSerialized.current = JSON.stringify(merged);
        setId(data.id);
        initialized.current = true;
      }
    })();
  }, [avaliacaoId]);

  const debounced = useDebounce(dados, 800);

  useEffect(() => {
    if (!canEdit || !user || !initialized.current) return;
    const serialized = JSON.stringify(debounced);
    if (serialized === lastSerialized.current) return;
    (async () => {
      try {
        setSaving(true);
        let currentId = id;
        if (!currentId) {
          if (creating) return;
          setCreating(true);
          const { data, error } = await supabase
            .from("avaliacoes")
            .insert({
              aluno_id: student.id,
              avaliador_id: user.id,
              tipo: "experimental",
              dados: debounced as never,
            })
            .select()
            .single();
          setCreating(false);
          if (error) throw error;
          currentId = data.id;
          setId(currentId);
        } else {
          const { error } = await supabase
            .from("avaliacoes")
            .update({ dados: debounced as never })
            .eq("id", currentId);
          if (error) throw error;
        }
        lastSerialized.current = serialized;
        setLastSavedAt(new Date());
        queryClient.invalidateQueries({ queryKey: ["avaliacoes-aluno", student.id] });
        queryClient.invalidateQueries({ queryKey: ["avaliacoes-global", student.id] });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao salvar");
      } finally {
        setSaving(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, canEdit, user, student.id]);

  const setAnswer = (qid: string, value: unknown) => {
    setDados((d) => ({ ...d, answers: { ...d.answers, [qid]: value } }));
  };

  const finalizar = () => {
    if (!id) { toast.error("Preencha ao menos um campo antes de finalizar."); return; }
    setDados((d) => ({ ...d, status: "finalizado", finalized_at: new Date().toISOString() }));
    toast.success("Avaliação finalizada. Edições continuam permitidas.");
  };
  const reabrir = () => setDados((d) => ({ ...d, status: "rascunho", finalized_at: null }));

  if (loadingPerm || loadingSchema) {
    return <div className="glass-card rounded-lg p-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }
  if (!canEdit) {
    return (
      <div className="glass-card rounded-lg p-8 text-center text-sm text-muted-foreground">
        <Lock className="w-6 h-6 mx-auto mb-3 text-muted-foreground" />
        Somente Coordenadores e Administradores podem preencher avaliações experimentais.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between glass-card rounded-lg px-4 py-2 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={dados.status === "finalizado" ? "border-success/40 text-success" : "border-warning/40 text-warning"}>
            {dados.status === "finalizado" ? "Finalizada" : "Rascunho"}
          </Badge>
          {dados.finalized_at && (
            <span className="text-xs text-muted-foreground">em {format(new Date(dados.finalized_at), "dd/MM/yyyy HH:mm")}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            {saving ? (<><Loader2 className="w-3 h-3 animate-spin" /> Salvando…</>)
              : lastSavedAt ? (<><CheckCircle2 className="w-3 h-3 text-success" /> Salvo às {format(lastSavedAt, "HH:mm:ss")}</>)
              : (<span>Comece a preencher — o sistema salva automaticamente</span>)}
          </div>
          <Button size="sm" variant="outline" onClick={() => setEditorOpen(true)}>
            <Settings2 className="w-4 h-4 mr-1" /> Editar formulário
          </Button>
        </div>
      </div>

      {schema?.sections.map((section) => (
        <section key={section.id} className="glass-card rounded-lg p-5 space-y-5">
          <h3 className="font-heading font-semibold text-foreground">{section.title}</h3>
          {section.questions.map((q) => (
            <QuestionField key={q.id} question={q} value={dados.answers[q.id]} onChange={(v) => setAnswer(q.id, v)} />
          ))}
        </section>
      ))}

      <div className="flex flex-wrap gap-2 justify-end">
        {dados.status === "rascunho" ? (
          <Button onClick={finalizar}><CheckCircle2 className="w-4 h-4 mr-2" /> Finalizar avaliação</Button>
        ) : (
          <Button variant="outline" onClick={reabrir}>Reabrir como rascunho</Button>
        )}
      </div>

      <ExperimentalTemplateEditor open={editorOpen} onOpenChange={setEditorOpen} />
    </div>
  );
}

function QuestionField({ question: q, value, onChange }: { question: TemplateQuestion; value: unknown; onChange: (v: unknown) => void }) {
  switch (q.type) {
    case "sim_nao": {
      const v = (value as string) ?? "";
      return (
        <FieldWrap label={q.label}>
          <SimNao value={v} onChange={onChange} idKey={q.id} />
        </FieldWrap>
      );
    }
    case "sim_nao_detalhe": {
      const cur = (value as { v: string; detalhe: string } | undefined) ?? { v: "", detalhe: "" };
      return (
        <FieldWrap label={q.label}>
          <SimNao value={cur.v} onChange={(v) => onChange({ ...cur, v })} idKey={q.id} />
          {cur.v === "sim" && (
            <Textarea
              className="mt-2"
              placeholder={q.detalheLabel || "Detalhe"}
              rows={2}
              value={cur.detalhe}
              onChange={(e) => onChange({ ...cur, detalhe: e.target.value })}
            />
          )}
        </FieldWrap>
      );
    }
    case "sim_nao_numero": {
      const cur = (value as { v: string; numero: string } | undefined) ?? { v: "", numero: "" };
      return (
        <FieldWrap label={q.label}>
          <SimNao value={cur.v} onChange={(v) => onChange({ ...cur, v })} idKey={q.id} />
          {cur.v === "sim" && (
            <div className="mt-2 flex items-center gap-2">
              <Input
                type="number"
                className="w-32"
                placeholder={q.detalheLabel || "Número"}
                value={cur.numero}
                onChange={(e) => onChange({ ...cur, numero: e.target.value })}
              />
              <span className="text-sm text-muted-foreground">{q.detalheLabel || ""}</span>
            </div>
          )}
        </FieldWrap>
      );
    }
    case "sim_nao_dupla": {
      const cur = (value as { v: string; sim: string; nao: string } | undefined) ?? { v: "", sim: "", nao: "" };
      return (
        <FieldWrap label={q.label}>
          <SimNao value={cur.v} onChange={(v) => onChange({ ...cur, v })} idKey={q.id} />
          {cur.v === "sim" && (
            <Textarea className="mt-2" rows={2} placeholder={q.labelSim || ""} value={cur.sim} onChange={(e) => onChange({ ...cur, sim: e.target.value })} />
          )}
          {cur.v === "nao" && (
            <Input className="mt-2" placeholder={q.labelNao || ""} value={cur.nao} onChange={(e) => onChange({ ...cur, nao: e.target.value })} />
          )}
        </FieldWrap>
      );
    }
    case "texto":
      return (
        <FieldWrap label={q.label}>
          <Textarea className="mt-2" rows={3} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />
        </FieldWrap>
      );
    case "numero":
      return (
        <FieldWrap label={q.label}>
          <Input className="mt-2 w-40" type="number" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />
        </FieldWrap>
      );
    case "opcoes": {
      const cur = (value as string) ?? "";
      return (
        <FieldWrap label={q.label}>
          <RadioGroup value={cur} onValueChange={onChange} className="flex flex-col sm:flex-row sm:flex-wrap gap-3 mt-2">
            {(q.options ?? []).map((o) => (
              <div key={o.value} className="flex items-center gap-2">
                <RadioGroupItem value={o.value} id={`${q.id}-${o.value}`} />
                <Label htmlFor={`${q.id}-${o.value}`} className="text-sm font-normal cursor-pointer">{o.label}</Label>
              </div>
            ))}
          </RadioGroup>
        </FieldWrap>
      );
    }
    case "opcoes_multi": {
      const cur = Array.isArray(value) ? (value as string[]) : [];
      const toggle = (v: string) => {
        const set = new Set(cur);
        if (set.has(v)) set.delete(v); else set.add(v);
        onChange(Array.from(set));
      };
      return (
        <FieldWrap label={q.label}>
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 mt-2">
            {(q.options ?? []).map((o) => {
              const checked = cur.includes(o.value);
              return (
                <label key={o.value} htmlFor={`${q.id}-${o.value}`} className="flex items-center gap-2 cursor-pointer">
                  <input
                    id={`${q.id}-${o.value}`}
                    type="checkbox"
                    className="h-4 w-4 rounded border-input"
                    checked={checked}
                    onChange={() => toggle(o.value)}
                  />
                  <span className="text-sm">{o.label}</span>
                </label>
              );
            })}
          </div>
        </FieldWrap>
      );
    }
    default:
      return null;
  }
}

function FieldWrap({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}

function SimNao({ value, onChange, idKey }: { value: string; onChange: (v: string) => void; idKey: string }) {
  return (
    <RadioGroup value={value} onValueChange={onChange} className="flex gap-4 mt-2">
      <div className="flex items-center gap-2">
        <RadioGroupItem value="sim" id={`${idKey}-sim`} />
        <Label htmlFor={`${idKey}-sim`} className="text-sm font-normal cursor-pointer">Sim</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="nao" id={`${idKey}-nao`} />
        <Label htmlFor={`${idKey}-nao`} className="text-sm font-normal cursor-pointer">Não</Label>
      </div>
    </RadioGroup>
  );
}

// Helper p/ render somente-leitura no visualizador
export function renderAnswerSummary(q: TemplateQuestion, value: unknown): { value: string; detail?: string } {
  switch (q.type) {
    case "sim_nao":
      return { value: value === "sim" ? "Sim" : value === "nao" ? "Não" : "—" };
    case "sim_nao_detalhe": {
      const c = value as { v?: string; detalhe?: string } | undefined;
      return { value: c?.v === "sim" ? "Sim" : c?.v === "nao" ? "Não" : "—", detail: c?.detalhe || undefined };
    }
    case "sim_nao_numero": {
      const c = value as { v?: string; numero?: string } | undefined;
      return { value: c?.v === "sim" ? "Sim" : c?.v === "nao" ? "Não" : "—", detail: c?.numero ? `${c.numero} ${q.detalheLabel || ""}`.trim() : undefined };
    }
    case "sim_nao_dupla": {
      const c = value as { v?: string; sim?: string; nao?: string } | undefined;
      return {
        value: c?.v === "sim" ? "Sim" : c?.v === "nao" ? "Não" : "—",
        detail: c?.v === "sim" ? c?.sim : c?.v === "nao" ? c?.nao : undefined,
      };
    }
    case "texto":
    case "numero":
      return { value: (value as string) || "—" };
    case "opcoes": {
      const opt = q.options?.find((o) => o.value === value);
      return { value: opt?.label || "—" };
    }
    default:
      return { value: "—" };
  }
}

export type { ExperimentalAnswers };
