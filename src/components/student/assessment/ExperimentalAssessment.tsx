import { useEffect, useMemo, useRef, useState } from "react";
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
import { Loader2, CheckCircle2, Lock } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useDebounce } from "@/hooks/useDebounce";

type SimNao = "sim" | "nao" | "";
type MobOpt = "movel" | "restrito" | "dificuldade" | "";

export interface ExperimentalDados {
  status: "rascunho" | "finalizado";
  anamnese: {
    saude: { tem: SimNao; detalhe: string };
    medicacao: { usa: SimNao; qual: string };
    gestante: { esta: SimNao; semanas: string };
    limitacoes: { tem: SimNao; quais: string };
    atividade: { pratica: SimNao; qual: string; tempo_parado: string };
    motivo_objetivo: string;
  };
  mobilidade: {
    gatinho: MobOpt;
    rocking: MobOpt;
    rotacao_ombro: MobOpt;
    hip_hinge: MobOpt;
    observacoes: string;
  };
  finalized_at: string | null;
}

const empty: ExperimentalDados = {
  status: "rascunho",
  anamnese: {
    saude: { tem: "", detalhe: "" },
    medicacao: { usa: "", qual: "" },
    gestante: { esta: "", semanas: "" },
    limitacoes: { tem: "", quais: "" },
    atividade: { pratica: "", qual: "", tempo_parado: "" },
    motivo_objetivo: "",
  },
  mobilidade: { gatinho: "", rocking: "", rotacao_ombro: "", hip_hinge: "", observacoes: "" },
  finalized_at: null,
};

interface Props {
  student: Tables<"alunos">;
  avaliacaoId?: string; // edição de existente
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

  const [id, setId] = useState<string | null>(avaliacaoId ?? null);
  const [dados, setDados] = useState<ExperimentalDados>(empty);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const lastSerialized = useRef<string>("");
  const initialized = useRef(false);

  // Carrega existente se houver id
  useEffect(() => {
    if (!avaliacaoId) return;
    (async () => {
      const { data } = await supabase.from("avaliacoes").select("*").eq("id", avaliacaoId).maybeSingle();
      if (data?.dados) {
        const merged = mergeDados(data.dados as Partial<ExperimentalDados>);
        setDados(merged);
        lastSerialized.current = JSON.stringify(merged);
        setId(data.id);
        initialized.current = true;
      }
    })();
  }, [avaliacaoId]);

  // Sem id em edição: marcar inicializado para permitir autosave após primeira interação
  useEffect(() => {
    if (!avaliacaoId) initialized.current = true;
  }, [avaliacaoId]);

  const debounced = useDebounce(dados, 800);

  // Autosave
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

  const finalizar = async () => {
    if (!id) {
      toast.error("Preencha ao menos um campo antes de finalizar.");
      return;
    }
    const next: ExperimentalDados = { ...dados, status: "finalizado", finalized_at: new Date().toISOString() };
    setDados(next);
    toast.success("Avaliação finalizada. Edições continuam permitidas.");
  };

  const reabrir = async () => {
    const next: ExperimentalDados = { ...dados, status: "rascunho", finalized_at: null };
    setDados(next);
  };

  if (loadingPerm) {
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
      {/* Status bar */}
      <div className="flex items-center justify-between glass-card rounded-lg px-4 py-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={dados.status === "finalizado" ? "border-success/40 text-success" : "border-warning/40 text-warning"}>
            {dados.status === "finalizado" ? "Finalizada" : "Rascunho"}
          </Badge>
          {dados.finalized_at && (
            <span className="text-xs text-muted-foreground">em {format(new Date(dados.finalized_at), "dd/MM/yyyy HH:mm")}</span>
          )}
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          {saving ? (
            <><Loader2 className="w-3 h-3 animate-spin" /> Salvando…</>
          ) : lastSavedAt ? (
            <><CheckCircle2 className="w-3 h-3 text-success" /> Salvo às {format(lastSavedAt, "HH:mm:ss")}</>
          ) : (
            <span>Comece a preencher — o sistema salva automaticamente</span>
          )}
        </div>
      </div>

      {/* Anamnese */}
      <section className="glass-card rounded-lg p-5 space-y-5">
        <h3 className="font-heading font-semibold text-foreground">Anamnese</h3>

        <SimNaoField
          label="Histórico de saúde: você possui alguma condição de saúde diagnosticada (cardíaca, respiratória, metabólica, ortopédica, etc.)?"
          value={dados.anamnese.saude.tem}
          onChange={(v) => setDados(d => ({ ...d, anamnese: { ...d.anamnese, saude: { ...d.anamnese.saude, tem: v } } }))}
        >
          {dados.anamnese.saude.tem === "sim" && (
            <Textarea
              placeholder="Quais condições?"
              value={dados.anamnese.saude.detalhe}
              onChange={(e) => setDados(d => ({ ...d, anamnese: { ...d.anamnese, saude: { ...d.anamnese.saude, detalhe: e.target.value } } }))}
              rows={2}
              className="mt-2"
            />
          )}
        </SimNaoField>

        <SimNaoField
          label="Você faz uso de alguma medicação?"
          value={dados.anamnese.medicacao.usa}
          onChange={(v) => setDados(d => ({ ...d, anamnese: { ...d.anamnese, medicacao: { ...d.anamnese.medicacao, usa: v } } }))}
        >
          {dados.anamnese.medicacao.usa === "sim" && (
            <Textarea
              placeholder="Qual(is) medicação(ões)?"
              value={dados.anamnese.medicacao.qual}
              onChange={(e) => setDados(d => ({ ...d, anamnese: { ...d.anamnese, medicacao: { ...d.anamnese.medicacao, qual: e.target.value } } }))}
              rows={2}
              className="mt-2"
            />
          )}
        </SimNaoField>

        <SimNaoField
          label="Está gestante?"
          value={dados.anamnese.gestante.esta}
          onChange={(v) => setDados(d => ({ ...d, anamnese: { ...d.anamnese, gestante: { ...d.anamnese.gestante, esta: v } } }))}
        >
          {dados.anamnese.gestante.esta === "sim" && (
            <div className="mt-2 flex items-center gap-2">
              <Input
                type="number"
                placeholder="Semanas"
                value={dados.anamnese.gestante.semanas}
                onChange={(e) => setDados(d => ({ ...d, anamnese: { ...d.anamnese, gestante: { ...d.anamnese.gestante, semanas: e.target.value } } }))}
                className="w-32"
              />
              <span className="text-sm text-muted-foreground">semanas</span>
            </div>
          )}
        </SimNaoField>

        <SimNaoField
          label="Possui limitações de movimentos, dores ou lesões (antigas ou recentes)?"
          value={dados.anamnese.limitacoes.tem}
          onChange={(v) => setDados(d => ({ ...d, anamnese: { ...d.anamnese, limitacoes: { ...d.anamnese.limitacoes, tem: v } } }))}
        >
          {dados.anamnese.limitacoes.tem === "sim" && (
            <Textarea
              placeholder="Quais limitações, dores ou lesões?"
              value={dados.anamnese.limitacoes.quais}
              onChange={(e) => setDados(d => ({ ...d, anamnese: { ...d.anamnese, limitacoes: { ...d.anamnese.limitacoes, quais: e.target.value } } }))}
              rows={2}
              className="mt-2"
            />
          )}
        </SimNaoField>

        <SimNaoField
          label="Você pratica alguma atividade física com regularidade?"
          value={dados.anamnese.atividade.pratica}
          onChange={(v) => setDados(d => ({ ...d, anamnese: { ...d.anamnese, atividade: { ...d.anamnese.atividade, pratica: v } } }))}
        >
          {dados.anamnese.atividade.pratica === "sim" && (
            <Textarea
              placeholder="Qual atividade?"
              value={dados.anamnese.atividade.qual}
              onChange={(e) => setDados(d => ({ ...d, anamnese: { ...d.anamnese, atividade: { ...d.anamnese.atividade, qual: e.target.value } } }))}
              rows={2}
              className="mt-2"
            />
          )}
          {dados.anamnese.atividade.pratica === "nao" && (
            <Input
              placeholder="Há quanto tempo está parado(a)?"
              value={dados.anamnese.atividade.tempo_parado}
              onChange={(e) => setDados(d => ({ ...d, anamnese: { ...d.anamnese, atividade: { ...d.anamnese.atividade, tempo_parado: e.target.value } } }))}
              className="mt-2"
            />
          )}
        </SimNaoField>

        <div>
          <Label className="text-sm">O que te trouxe até a Fortem (na procura deste tipo de serviço) e qual é o seu principal objetivo?</Label>
          <Textarea
            value={dados.anamnese.motivo_objetivo}
            onChange={(e) => setDados(d => ({ ...d, anamnese: { ...d.anamnese, motivo_objetivo: e.target.value } }))}
            rows={3}
            className="mt-2"
            placeholder="Descreva o motivo e objetivo principal..."
          />
        </div>
      </section>

      {/* Avaliação de mobilidade */}
      <section className="glass-card rounded-lg p-5 space-y-5">
        <h3 className="font-heading font-semibold text-foreground">Avaliação de Mobilidade</h3>

        <MobField label="Gatinho" value={dados.mobilidade.gatinho}
          onChange={(v) => setDados(d => ({ ...d, mobilidade: { ...d.mobilidade, gatinho: v } }))} />
        <MobField label="Rocking" value={dados.mobilidade.rocking}
          onChange={(v) => setDados(d => ({ ...d, mobilidade: { ...d.mobilidade, rocking: v } }))} />
        <MobField label="Rotação Interna e Externa de Ombro na Parede" value={dados.mobilidade.rotacao_ombro}
          onChange={(v) => setDados(d => ({ ...d, mobilidade: { ...d.mobilidade, rotacao_ombro: v } }))} />
        <MobField label="Hip Hinge com bastão nas costas" value={dados.mobilidade.hip_hinge}
          onChange={(v) => setDados(d => ({ ...d, mobilidade: { ...d.mobilidade, hip_hinge: v } }))} />

        <div>
          <Label className="text-sm">Observações sobre os padrões de mobilidade</Label>
          <Textarea
            value={dados.mobilidade.observacoes}
            onChange={(e) => setDados(d => ({ ...d, mobilidade: { ...d.mobilidade, observacoes: e.target.value } }))}
            rows={3}
            className="mt-2"
            placeholder="Anotações livres..."
          />
        </div>
      </section>

      <div className="flex flex-wrap gap-2 justify-end">
        {dados.status === "rascunho" ? (
          <Button onClick={finalizar}><CheckCircle2 className="w-4 h-4 mr-2" /> Finalizar avaliação</Button>
        ) : (
          <Button variant="outline" onClick={reabrir}>Reabrir como rascunho</Button>
        )}
      </div>
    </div>
  );
}

function mergeDados(partial: Partial<ExperimentalDados>): ExperimentalDados {
  return {
    status: partial.status ?? empty.status,
    finalized_at: partial.finalized_at ?? null,
    anamnese: { ...empty.anamnese, ...(partial.anamnese as object) } as ExperimentalDados["anamnese"],
    mobilidade: { ...empty.mobilidade, ...(partial.mobilidade as object) } as ExperimentalDados["mobilidade"],
  };
}

function SimNaoField({
  label, value, onChange, children,
}: { label: string; value: SimNao; onChange: (v: SimNao) => void; children?: React.ReactNode }) {
  return (
    <div>
      <Label className="text-sm">{label}</Label>
      <RadioGroup value={value} onValueChange={(v) => onChange(v as SimNao)} className="flex gap-4 mt-2">
        <div className="flex items-center gap-2">
          <RadioGroupItem value="sim" id={`${label}-sim`} />
          <Label htmlFor={`${label}-sim`} className="text-sm font-normal cursor-pointer">Sim</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="nao" id={`${label}-nao`} />
          <Label htmlFor={`${label}-nao`} className="text-sm font-normal cursor-pointer">Não</Label>
        </div>
      </RadioGroup>
      {children}
    </div>
  );
}

function MobField({ label, value, onChange }: { label: string; value: MobOpt; onChange: (v: MobOpt) => void }) {
  const opts: { v: MobOpt; l: string }[] = [
    { v: "movel", l: "Móvel" },
    { v: "restrito", l: "Restrito" },
    { v: "dificuldade", l: "Dificuldade de compreensão e execução" },
  ];
  return (
    <div>
      <Label className="text-sm">{label}</Label>
      <RadioGroup value={value} onValueChange={(v) => onChange(v as MobOpt)} className="flex flex-col sm:flex-row sm:flex-wrap gap-3 mt-2">
        {opts.map((o) => (
          <div key={o.v} className="flex items-center gap-2">
            <RadioGroupItem value={o.v} id={`${label}-${o.v}`} />
            <Label htmlFor={`${label}-${o.v}`} className="text-sm font-normal cursor-pointer">{o.l}</Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}
