import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useDebounce } from "@/hooks/useDebounce";
import {
  migrateLegacyDados,
  EMPTY_DADOS,
  ensureFaseInicialQuestion,
  FASE_INICIAL_QUESTION_ID,
  type ExperimentalRecordDados,
  type ExperimentalSchema,
  type TemplateQuestion,
} from "./experimentalTemplate";
import { FASE_INICIAL_GROUPS, hasTreinoAtual, prescribeFaseInicial } from "@/lib/workoutImport";
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
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  student: Tables<"alunos">;
  tipoSlug: string;
  protocoloId: string;
  schema: ExperimentalSchema;
  avaliacaoId?: string;
  permiteUpload?: boolean;
}

/**
 * Avaliação dinâmica genérica baseada em um schema (sections/questions).
 * Usada por Pliometria, Força, Experimental e novos tipos dinâmicos.
 * Mantém autosave (debounce 800ms) e fluxo finalizar/reabrir.
 */
export function DynamicAssessment({ student, tipoSlug, protocoloId, schema: rawSchema, avaliacaoId, permiteUpload }: Props) {
  const schema = tipoSlug === "experimental" ? ensureFaseInicialQuestion(rawSchema) : rawSchema;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [id, setId] = useState<string | null>(avaliacaoId ?? null);
  const [dados, setDados] = useState<ExperimentalRecordDados>(EMPTY_DADOS);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
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
    if (!user || !initialized.current) return;
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
              tipo: tipoSlug,
              protocolo_id: protocoloId,
              dados: debounced as never,
            } as never)
            .select()
            .single();
          setCreating(false);
          if (error) throw error;
          currentId = data.id;
          setId(currentId);
        } else {
          const { error } = await supabase
            .from("avaliacoes")
            .update({ dados: debounced as never, protocolo_id: protocoloId } as never)
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
  }, [debounced, user, student.id, tipoSlug, protocoloId]);

  const setAnswer = (qid: string, value: unknown) => {
    setDados((d) => ({ ...d, answers: { ...d.answers, [qid]: value } }));
  };

  // ===== Fase Inicial → vincula treino =====
  const [pendingFase, setPendingFase] = useState<string | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [prescribing, setPrescribing] = useState(false);

  const handleFaseInicialChange = async (fase: string) => {
    const prev = (dados.answers[FASE_INICIAL_QUESTION_ID] as string) || "";
    setAnswer(FASE_INICIAL_QUESTION_ID, fase);
    if (!fase || fase === prev || !user) return;
    try {
      const exists = await hasTreinoAtual(student.id);
      if (exists) {
        setPendingFase(fase);
        setConfirmReplace(true);
      } else {
        await runPrescribe(fase);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao verificar treinos");
    }
  };

  const runPrescribe = async (fase: string) => {
    if (!user) return;
    try {
      setPrescribing(true);
      await prescribeFaseInicial(fase, student.id, user.id);
      toast.success(`Treino "${fase}" vinculado ao aluno.`);
      queryClient.invalidateQueries({ queryKey: ["treinos-aluno", student.id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao prescrever treino");
    } finally {
      setPrescribing(false);
      setPendingFase(null);
      setConfirmReplace(false);
    }
  };

  const finalizar = () => {
    if (!id) { toast.error("Preencha ao menos um campo antes de finalizar."); return; }
    setDados((d) => ({ ...d, status: "finalizado", finalized_at: new Date().toISOString() }));
    toast.success("Avaliação finalizada. Edições continuam permitidas.");
  };
  const reabrir = () => setDados((d) => ({ ...d, status: "rascunho", finalized_at: null }));

  if (!schema.sections || schema.sections.length === 0) {
    return (
      <div className="glass-card rounded-lg p-8 text-center text-sm text-muted-foreground">
        Este protocolo ainda não tem seções configuradas. Coordenadores/Administradores podem adicionar em Admin → Tipos de Avaliação.
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
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          {saving ? (<><Loader2 className="w-3 h-3 animate-spin" /> Salvando…</>)
            : lastSavedAt ? (<><CheckCircle2 className="w-3 h-3 text-success" /> Salvo às {format(lastSavedAt, "HH:mm:ss")}</>)
            : (<span>Comece a preencher — o sistema salva automaticamente</span>)}
        </div>
      </div>

      {schema.sections.map((section) => (
        <section key={section.id} className="glass-card rounded-lg p-5 space-y-5">
          <h3 className="font-heading font-semibold text-foreground">{section.title}</h3>
          {section.questions.map((q) => (
            <QuestionField
              key={q.id}
              question={q}
              value={dados.answers[q.id]}
              onChange={(v) => setAnswer(q.id, v)}
              onFaseInicialChange={q.type === "fase_inicial" ? handleFaseInicialChange : undefined}
              faseLoading={prescribing}
            />
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

      <AlertDialog open={confirmReplace} onOpenChange={(o) => { if (!o) { setConfirmReplace(false); setPendingFase(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Substituir treino atual?</AlertDialogTitle>
            <AlertDialogDescription>
              Já existe um treino "atual" prescrito para este aluno. Ao confirmar, ele será arquivado e o treino <strong>{pendingFase}</strong> entrará como atual (uma nova versão).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingFase && runPrescribe(pendingFase)} disabled={prescribing}>
              {prescribing ? "Aplicando..." : "Substituir e vincular"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function QuestionField({ question: q, value, onChange, onFaseInicialChange, faseLoading }: { question: TemplateQuestion; value: unknown; onChange: (v: unknown) => void; onFaseInicialChange?: (fase: string) => void; faseLoading?: boolean }) {
  switch (q.type) {
    case "fase_inicial": {
      const cur = (value as string) ?? "";
      return (
        <FieldWrap label={q.label}>
          <div className="mt-2 flex items-center gap-2">
            <Select value={cur} onValueChange={(v) => onFaseInicialChange?.(v)} disabled={faseLoading}>
              <SelectTrigger className="w-full sm:w-80">
                <SelectValue placeholder="Selecione a fase inicial..." />
              </SelectTrigger>
              <SelectContent>
                {FASE_INICIAL_GROUPS.map((grp) => (
                  <SelectGroup key={grp.label}>
                    <SelectLabel>{grp.label}</SelectLabel>
                    {grp.fases.map((f) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            {faseLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </div>
          {cur && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Treino vinculado: <strong>{cur}</strong> (importado do Banco de Treinos como versão atual).
            </p>
          )}
        </FieldWrap>
      );
    }
    case "sim_nao": {
      return (
        <FieldWrap label={q.label}>
          <SimNao value={(value as string) ?? ""} onChange={onChange} idKey={q.id} />
        </FieldWrap>
      );
    }
    case "sim_nao_detalhe": {
      const cur = (value as { v: string; detalhe: string } | undefined) ?? { v: "", detalhe: "" };
      return (
        <FieldWrap label={q.label}>
          <SimNao value={cur.v} onChange={(v) => onChange({ ...cur, v })} idKey={q.id} />
          {cur.v === "sim" && (
            <Textarea className="mt-2" placeholder={q.detalheLabel || "Detalhe"} rows={2} value={cur.detalhe} onChange={(e) => onChange({ ...cur, detalhe: e.target.value })} />
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
              <Input type="number" className="w-32" placeholder={q.detalheLabel || "Número"} value={cur.numero} onChange={(e) => onChange({ ...cur, numero: e.target.value })} />
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
