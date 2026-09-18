import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, Plus, Lock, AlertTriangle, Upload } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useDebounce } from "@/hooks/useDebounce";
import { AvaliacaoAnexos } from "./AvaliacaoAnexos";
import { ImportarEvolucaoDialog } from "./ImportarEvolucaoDialog";
import type { SessaoImportada } from "@/lib/fisioEvolucaoImport";
import { fetchProtocolos } from "@/lib/avaliacaoProtocolos";
import type {
  ExperimentalSchema,
  TemplateQuestion,
} from "./experimentalTemplate";

export interface SessaoEvolucao {
  n: number;
  texto: string;
  finalizado_em: string | null;
  autor_id: string | null;
  autor_nome: string | null;
}

interface EvolucaoDados {
  status: "rascunho" | "finalizado";
  finalized_at: string | null;
  answers: Record<string, unknown>;
  sessoes: SessaoEvolucao[];
}

const EMPTY: EvolucaoDados = { status: "rascunho", finalized_at: null, answers: {}, sessoes: [] };

/** Identifica o protocolo "EVOLUÇÃO" (sem depender de acentuação/caixa). */
export function isProtocoloEvolucao(nome: string | null | undefined): boolean {
  return normalizar(nome).startsWith("evolucao");
}

/** Identifica o protocolo "Avaliação Fisioterapia". */
function isProtocoloFisio(nome: string | null | undefined): boolean {
  return normalizar(nome).includes("fisio");
}

function normalizar(v: string | null | undefined): string {
  return (v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/** Converte a resposta de qualquer tipo de pergunta em texto legível. */
function respostaTexto(q: TemplateQuestion, value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    const labels = value.map((v) => q.options?.find((o) => o.value === v)?.label ?? String(v));
    return labels.join(", ");
  }
  if (typeof value === "object") {
    const o = value as { v?: string; detalhe?: string; numero?: string; sim?: string; nao?: string };
    if (!o.v) return "";
    const base = o.v === "sim" ? "Sim" : "Não";
    const extra = o.detalhe || o.numero || (o.v === "sim" ? o.sim : o.nao) || "";
    return extra ? `${base} — ${extra}` : base;
  }
  return "";
}

/** Migra respostas antigas das perguntas fixas "SESSÃO N" para o array de sessões. */
function migrarSessoesDoSchema(
  dados: EvolucaoDados,
  schema: ExperimentalSchema,
): EvolucaoDados {
  if (dados.sessoes.length > 0) return dados;
  const encontradas: SessaoEvolucao[] = [];
  for (const s of schema.sections ?? []) {
    for (const q of s.questions ?? []) {
      const m = /^sessao\s*(\d+)/.exec(normalizar(q.label));
      if (!m) continue;
      const texto = typeof dados.answers[q.id] === "string" ? (dados.answers[q.id] as string) : "";
      if (!texto.trim()) continue;
      encontradas.push({
        n: parseInt(m[1], 10),
        texto,
        finalizado_em: dados.finalized_at,
        autor_id: null,
        autor_nome: null,
      });
    }
  }
  if (encontradas.length === 0) return dados;
  encontradas.sort((a, b) => a.n - b.n);
  return { ...dados, sessoes: encontradas };
}

interface Props {
  student: Tables<"alunos">;
  tipoId: string;
  tipoSlug: string;
  protocoloId: string;
  schema: ExperimentalSchema;
  permiteUpload?: boolean;
}

/**
 * Evolução da Reabilitação: prontuário contínuo por aluno.
 * Sessão 1 = resumo (somente leitura) da Avaliação Fisioterapia mais recente.
 * Sessões seguintes são criadas sob demanda e ficam todas no mesmo registro.
 */
export function ReabilitacaoEvolucao({ student, tipoId, tipoSlug, protocoloId, schema, permiteUpload }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [id, setId] = useState<string | null>(null);
  const [dados, setDados] = useState<EvolucaoDados>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const lastSerialized = useRef<string>(JSON.stringify(EMPTY));
  const initialized = useRef(false);
  const creating = useRef(false);

  // ===== Avaliação Fisioterapia do aluno (resumo da Sessão 1) =====
  const { data: protocolos = [] } = useQuery({
    queryKey: ["avaliacao-protocolos", tipoId],
    enabled: !!tipoId,
    queryFn: () => fetchProtocolos(tipoId),
  });
  const protoFisio = useMemo(() => protocolos.find((p) => isProtocoloFisio(p.nome)) ?? null, [protocolos]);

  const { data: fisio, isLoading: loadingFisio } = useQuery({
    queryKey: ["reabilitacao-fisio", student.id, protoFisio?.id],
    enabled: !!protoFisio?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("avaliacoes")
        .select("*")
        .eq("aluno_id", student.id)
        .eq("protocolo_id", protoFisio!.id)
        .order("data", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const resumoFisio = useMemo(() => {
    if (!fisio || !protoFisio) return [];
    const s = (protoFisio.schema as ExperimentalSchema) ?? { sections: [] };
    const answers = ((fisio.dados as Record<string, unknown>)?.answers as Record<string, unknown>) ?? {};
    const linhas: { label: string; valor: string }[] = [];
    for (const sec of s.sections ?? []) {
      for (const q of sec.questions ?? []) {
        const valor = respostaTexto(q, answers[q.id]);
        if (valor.trim()) linhas.push({ label: q.label, valor });
      }
    }
    return linhas;
  }, [fisio, protoFisio]);

  const temFisio = resumoFisio.length > 0;

  // ===== Carrega o registro único de Evolução do aluno =====
  useEffect(() => {
    let cancelado = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("avaliacoes")
        .select("*")
        .eq("aluno_id", student.id)
        .eq("tipo", tipoSlug)
        .eq("protocolo_id", protocoloId)
        .order("data", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelado) return;
      if (data) {
        const raw = (data.dados as Partial<EvolucaoDados>) ?? {};
        const base: EvolucaoDados = {
          status: raw.status === "finalizado" ? "finalizado" : "rascunho",
          finalized_at: raw.finalized_at ?? null,
          answers: raw.answers ?? {},
          sessoes: Array.isArray(raw.sessoes) ? raw.sessoes : [],
        };
        const migrado = migrarSessoesDoSchema(base, schema);
        setDados(migrado);
        lastSerialized.current = JSON.stringify(migrado);
        setId(data.id);
      }
      initialized.current = true;
      setLoading(false);
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student.id, tipoSlug, protocoloId]);

  // ===== Autosave =====
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
          if (creating.current) return;
          creating.current = true;
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
          creating.current = false;
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
        toast.error((e as { message?: string })?.message || "Erro ao salvar");
      } finally {
        setSaving(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, user, student.id, tipoSlug, protocoloId]);

  // ===== Sessões =====
  const primeiraNumeracao = temFisio ? 2 : 1;

  const setTexto = (n: number, texto: string) => {
    setDados((d) => ({
      ...d,
      sessoes: d.sessoes.map((s) => (s.n === n ? { ...s, texto } : s)),
    }));
  };

  const novaSessao = () => {
    setDados((d) => {
      const proximo = d.sessoes.length ? Math.max(...d.sessoes.map((s) => s.n)) + 1 : primeiraNumeracao;
      return {
        ...d,
        sessoes: [
          ...d.sessoes,
          { n: proximo, texto: "", finalizado_em: null, autor_id: null, autor_nome: null },
        ],
      };
    });
  };

  const finalizarSessao = (n: number) => {
    const alvo = dados.sessoes.find((s) => s.n === n);
    if (!alvo || !alvo.texto.trim()) {
      toast.error("Preencha a sessão antes de finalizar.");
      return;
    }
    setDados((d) => ({
      ...d,
      sessoes: d.sessoes.map((s) =>
        s.n === n
          ? {
              ...s,
              finalizado_em: new Date().toISOString(),
              autor_id: user?.id ?? null,
              autor_nome: user?.email ?? null,
            }
          : s,
      ),
    }));
    toast.success(`Sessão ${n} registrada.`);
  };

  const reabrirSessao = (n: number) => {
    setDados((d) => ({
      ...d,
      sessoes: d.sessoes.map((s) => (s.n === n ? { ...s, finalizado_em: null } : s)),
    }));
  };

  const sessoesOrdenadas = useMemo(
    () => [...dados.sessoes].sort((a, b) => a.n - b.n),
    [dados.sessoes],
  );

  if (loading || loadingFisio) {
    return (
      <div className="glass-card rounded-lg p-8 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between glass-card rounded-lg px-4 py-2 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-primary/40 text-primary">
            Evolução contínua
          </Badge>
          <span className="text-xs text-muted-foreground">
            {sessoesOrdenadas.filter((s) => s.finalizado_em).length} sessão(ões) registrada(s)
          </span>
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          {saving ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" /> Salvando…
            </>
          ) : lastSavedAt ? (
            <>
              <CheckCircle2 className="w-3 h-3 text-success" /> Salvo às {format(lastSavedAt, "HH:mm:ss")}
            </>
          ) : (
            <span>O sistema salva automaticamente</span>
          )}
        </div>
      </div>

      {/* Sessão 1 — Avaliação Fisioterapia (somente leitura) */}
      {temFisio ? (
        <section className="glass-card rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 className="font-heading font-semibold text-foreground flex items-center gap-2">
              <Lock className="w-4 h-4 text-muted-foreground" />
              Sessão 1 — Avaliação Fisioterapia
            </h3>
            {fisio?.data && (
              <span className="text-xs text-muted-foreground">
                {format(new Date(`${fisio.data}T12:00:00`), "dd/MM/yyyy")}
              </span>
            )}
          </div>
          <dl className="space-y-3">
            {resumoFisio.map((l) => (
              <div key={l.label}>
                <dt className="text-xs text-muted-foreground">{l.label}</dt>
                <dd className="text-sm text-foreground whitespace-pre-wrap">{l.valor}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : (
        <section className="glass-card rounded-lg p-5 space-y-3">
          <h3 className="font-heading font-semibold text-foreground flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            Sessão 1
          </h3>
          <p className="text-xs text-muted-foreground">
            Este aluno ainda não tem Avaliação Fisioterapia registrada. Preencha a Sessão 1 manualmente
            ou crie a Avaliação Fisioterapia na categoria correspondente.
          </p>
        </section>
      )}

      {/* Demais sessões */}
      {sessoesOrdenadas.map((s) => {
        const finalizada = !!s.finalizado_em;
        return (
          <section key={s.n} className="glass-card rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h3 className="font-heading font-semibold text-foreground">Sessão {s.n}</h3>
              <div className="flex items-center gap-2">
                {finalizada && (
                  <Badge variant="outline" className="border-success/40 text-success">
                    Registrada em {format(new Date(s.finalizado_em!), "dd/MM/yyyy HH:mm")}
                  </Badge>
                )}
                {finalizada ? (
                  <Button size="sm" variant="outline" onClick={() => reabrirSessao(s.n)}>
                    Reabrir
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => finalizarSessao(s.n)}>
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Finalizar sessão
                  </Button>
                )}
              </div>
            </div>
            {finalizada ? (
              <p className="text-sm text-foreground whitespace-pre-wrap">{s.texto}</p>
            ) : (
              <div>
                <Label className="text-sm">Evolução da sessão</Label>
                <Textarea
                  className="mt-2"
                  rows={4}
                  value={s.texto}
                  onChange={(e) => setTexto(s.n, e.target.value)}
                />
              </div>
            )}
            {finalizada && s.autor_nome && (
              <p className="text-[11px] text-muted-foreground">Preenchido por {s.autor_nome}</p>
            )}
          </section>
        );
      })}

      <div className="flex justify-end">
        <Button variant="outline" onClick={novaSessao}>
          <Plus className="w-4 h-4 mr-2" /> Nova sessão
        </Button>
      </div>

      {permiteUpload && <AvaliacaoAnexos avaliacaoId={id} />}
    </div>
  );
}
