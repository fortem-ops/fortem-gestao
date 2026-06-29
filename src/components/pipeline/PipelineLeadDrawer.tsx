import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowRight, Phone, Mail, ExternalLink, MessageCircle, Save, History,
  FileText, AlertCircle,
} from "lucide-react";
import {
  PLANO_BADGE_CLASSES, PLANOS_INTERESSE, formatCurrencyBRL,
  computeTemperature, TEMP_DOT_CLASS, TEMP_DOT_LABEL, isLostStage,
} from "@/lib/pipeline";
import { waMeLink } from "@/lib/pipeline";
import { cn } from "@/lib/utils";
import type { PipelineCardData } from "./PipelineCard";

interface Stage { id: string; name: string; position: number; funnel: string; probabilidade: number | null }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  student: PipelineCardData | null;
  stages: Stage[];
}

export function PipelineLeadDrawer({ open, onOpenChange, student, stages }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [notas, setNotas] = useState("");
  const [plano, setPlano] = useState<string>("");
  const [valor, setValor] = useState<string>("");
  const [taskTitulo, setTaskTitulo] = useState("");
  const [taskData, setTaskData] = useState("");
  const [savingMeta, setSavingMeta] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [moving, setMoving] = useState(false);

  const alunoId = student?.id || null;

  const { data: aluno } = useQuery({
    queryKey: ["drawer-aluno", alunoId],
    enabled: !!alunoId && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("alunos")
        .select("id,nome,telefone,email,motivo_perda")
        .eq("id", alunoId!)
        .maybeSingle();
      return data;
    },
  });

  const { data: meta } = useQuery({
    queryKey: ["drawer-meta", alunoId],
    enabled: !!alunoId && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("pipeline_metadata")
        .select("*")
        .eq("aluno_id", alunoId!)
        .maybeSingle();
      return data;
    },
  });

  const { data: movements = [] } = useQuery({
    queryKey: ["drawer-movements", alunoId],
    enabled: !!alunoId && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("pipeline_movements")
        .select("id,moved_at,notes,source,to_stage_id,from_stage_id")
        .eq("aluno_id", alunoId!)
        .order("moved_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["drawer-tasks", alunoId],
    enabled: !!alunoId && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("tarefas")
        .select("id,titulo,descricao,status,data_limite,created_at,updated_at")
        .eq("aluno_id", alunoId!)
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  useEffect(() => {
    if (open && meta) {
      setNotas((meta as any).notas || "");
      setPlano((meta as any).plano_interesse || "");
      setValor((meta as any).valor_estimado_plano ? String((meta as any).valor_estimado_plano) : "");
    } else if (open && student) {
      setNotas("");
      setPlano(student.meta?.plano_interesse || "");
      setValor(student.meta?.valor_estimado_plano ? String(student.meta.valor_estimado_plano) : "");
    }
    setTaskTitulo("");
    setTaskData("");
  }, [open, meta, student?.id]);

  const stagesByFunnel = useMemo(() => {
    const curStage = stages.find((s) => s.name === student?.current_stage_name);
    if (!curStage) return [];
    return stages.filter((s) => s.funnel === curStage.funnel).sort((a, b) => a.position - b.position);
  }, [stages, student]);

  const nextStage = useMemo(() => {
    const curStage = stages.find((s) => s.name === student?.current_stage_name);
    if (!curStage) return null;
    const idx = stagesByFunnel.findIndex((s) => s.id === curStage.id);
    if (idx < 0) return null;
    for (let i = idx + 1; i < stagesByFunnel.length; i++) {
      if (!isLostStage(stagesByFunnel[i].name)) return stagesByFunnel[i];
    }
    return null;
  }, [stages, stagesByFunnel, student]);

  const stageMap = useMemo(() => {
    const m: Record<string, string> = {};
    stages.forEach((s) => { m[s.id] = s.name; });
    return m;
  }, [stages]);

  // Timeline unificada
  const timeline = useMemo(() => {
    const items: { ts: string; type: "move" | "task"; title: string; subtitle?: string }[] = [];
    (movements as any[]).forEach((m) => {
      const to = stageMap[m.to_stage_id] || "?";
      const from = m.from_stage_id ? stageMap[m.from_stage_id] : null;
      items.push({
        ts: m.moved_at,
        type: "move",
        title: from ? `${from} → ${to}` : `Entrou em ${to}`,
        subtitle: m.notes || `Origem: ${m.source}`,
      });
    });
    (tasks as any[]).forEach((t) => {
      items.push({
        ts: t.updated_at || t.created_at,
        type: "task",
        title: t.titulo,
        subtitle: t.status === "concluida" ? "Tarefa concluída" : `Tarefa ${t.status}${t.data_limite ? ` · vence ${t.data_limite}` : ""}`,
      });
    });
    return items.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  }, [movements, tasks, stageMap]);

  if (!student) return null;

  const activityCandidates = [(meta as any)?.last_contact_at, (meta as any)?.updated_at, student.last_moved_at]
    .filter(Boolean) as string[];
  const lastActivity = activityCandidates.length
    ? new Date(Math.max(...activityCandidates.map((d) => new Date(d).getTime()))).toISOString()
    : null;
  const temp = computeTemperature(lastActivity);

  async function saveMeta() {
    if (!alunoId) return;
    setSavingMeta(true);
    const payload: any = {
      aluno_id: alunoId,
      notas: notas || null,
      plano_interesse: plano || null,
      valor_estimado_plano: valor ? Number(valor.replace(",", ".")) : null,
    };
    const { error } = await supabase.from("pipeline_metadata").upsert(payload, { onConflict: "aluno_id" });
    setSavingMeta(false);
    if (error) return toast.error(error.message);
    toast.success("Dados salvos");
    qc.invalidateQueries({ queryKey: ["pipeline-metadata"] });
    qc.invalidateQueries({ queryKey: ["drawer-meta", alunoId] });
  }

  async function createTask() {
    if (!alunoId) return;
    if (!taskTitulo.trim()) return toast.error("Informe o título");
    setSavingTask(true);
    const { error } = await supabase.from("tarefas").insert({
      titulo: taskTitulo.trim(),
      aluno_id: alunoId,
      responsavel_id: student?.responsavel_id || user?.id || null,
      criado_por_id: user?.id || null,
      status: "pendente",
      prioridade: "media",
      data_limite: taskData || null,
    } as any);
    setSavingTask(false);
    if (error) return toast.error(error.message);
    toast.success("Próxima ação agendada");
    setTaskTitulo("");
    setTaskData("");
    qc.invalidateQueries({ queryKey: ["drawer-tasks", alunoId] });
    qc.invalidateQueries({ queryKey: ["pipeline-next-tasks"] });
  }

  async function moveNext() {
    if (!alunoId || !nextStage) return;
    setMoving(true);
    const { error } = await supabase.rpc("fn_move_pipeline", {
      _aluno_id: alunoId,
      _to_stage_name: nextStage.name,
      _source: "manual",
      _notes: "Movido pelo drawer",
      _moved_by: user?.id ?? null,
    } as any);
    setMoving(false);
    if (error) return toast.error(error.message);
    toast.success(`Movido para ${nextStage.name}`);
    qc.invalidateQueries({ queryKey: ["pipeline-alunos"] });
    qc.invalidateQueries({ queryKey: ["pipeline-last-moves"] });
    onOpenChange(false);
  }

  const phone = (aluno as any)?.telefone;
  const email = (aluno as any)?.email;
  const motivoPerda = (aluno as any)?.motivo_perda;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[480px] p-0 flex flex-col">
        <SheetHeader className="p-5 pb-3 border-b border-border">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <SheetTitle className="truncate">{student.nome}</SheetTitle>
              <SheetDescription className="flex items-center gap-2 mt-1">
                <span className={cn("w-2 h-2 rounded-full", TEMP_DOT_CLASS[temp])} />
                <span>{TEMP_DOT_LABEL[temp]}</span>
                {student.current_stage_name && <span className="mx-1">·</span>}
                {student.current_stage_name && <span>{student.current_stage_name}</span>}
              </SheetDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={() => navigate(`/alunos/${student.id}`)} title="Abrir perfil completo">
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
          {student.current_stage_probabilidade != null && !isLostStage(student.current_stage_name) && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                <span>Probabilidade de fechamento</span>
                <span className="tabular-nums text-foreground">{student.current_stage_probabilidade}%</span>
              </div>
              <Progress value={student.current_stage_probabilidade} className="h-1.5" />
            </div>
          )}
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-5 space-y-5">
            {/* Contatos */}
            <div className="flex flex-wrap gap-2">
              {phone && (
                <>
                  <Button asChild size="sm" variant="outline" className="gap-1.5">
                    <a href={`tel:${phone}`}><Phone className="w-3.5 h-3.5" /> Ligar</a>
                  </Button>
                  {waMeLink(phone, `Olá ${student.nome}!`) && (
                    <Button asChild size="sm" variant="outline" className="gap-1.5">
                      <a href={waMeLink(phone, `Olá ${student.nome}!`)!} target="_blank" rel="noreferrer">
                        <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                      </a>
                    </Button>
                  )}
                </>
              )}
              {email && (
                <Button asChild size="sm" variant="outline" className="gap-1.5">
                  <a href={`mailto:${email}`}><Mail className="w-3.5 h-3.5" /> E-mail</a>
                </Button>
              )}
            </div>

            {/* Dados do lead */}
            <div className="space-y-2 rounded-lg border border-border bg-card/40 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Dados
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Telefone: </span>{phone || "—"}</div>
                <div className="truncate"><span className="text-muted-foreground">E-mail: </span>{email || "—"}</div>
                <div><span className="text-muted-foreground">Responsável: </span>{student.responsavel_nome || "—"}</div>
                <div><span className="text-muted-foreground">Origem: </span>{student.meta?.origem_lead || "—"}</div>
              </div>
              {motivoPerda && (
                <div className="mt-1 flex items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-200">
                  <AlertCircle className="w-3 h-3" /> Motivo da perda: {motivoPerda}
                </div>
              )}
            </div>

            {/* Plano + valor (editável) */}
            <div className="space-y-2 rounded-lg border border-border bg-card/40 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Negócio</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Plano de interesse</Label>
                  <Select value={plano || "none"} onValueChange={(v) => setPlano(v === "none" ? "" : v)}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {PLANOS_INTERESSE.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Valor mensal (R$)</Label>
                  <Input
                    className="h-8"
                    inputMode="decimal"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    placeholder="0,00"
                  />
                </div>
              </div>
              {plano && PLANO_BADGE_CLASSES[plano] && (
                <div className="flex items-center gap-2 pt-1">
                  <Badge variant="outline" className={cn("text-[10px]", PLANO_BADGE_CLASSES[plano])}>{plano}</Badge>
                  {valor && (
                    <span className="text-xs text-emerald-300 font-semibold">
                      {formatCurrencyBRL(Number(valor.replace(",", ".")))}/mês
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Anotações */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Anotações</Label>
              <Textarea
                rows={4}
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Anote informações relevantes do lead..."
              />
              <Button size="sm" onClick={saveMeta} disabled={savingMeta} className="gap-1.5">
                <Save className="w-3.5 h-3.5" /> {savingMeta ? "Salvando..." : "Salvar dados e anotações"}
              </Button>
            </div>

            <Separator />

            {/* Próxima ação */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Próxima ação</p>
              <Input
                value={taskTitulo}
                onChange={(e) => setTaskTitulo(e.target.value)}
                placeholder="Ex: Ligar para confirmar avaliação"
              />
              <Input type="date" value={taskData} onChange={(e) => setTaskData(e.target.value)} />
              <Button size="sm" variant="outline" onClick={createTask} disabled={savingTask} className="gap-1.5">
                {savingTask ? "Salvando..." : "Agendar próxima ação"}
              </Button>
            </div>

            <Separator />

            {/* Histórico */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" /> Histórico
              </p>
              {timeline.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Sem atividades registradas.</p>
              ) : (
                <ol className="relative border-l border-border/60 pl-4 space-y-3">
                  {timeline.map((it, i) => (
                    <li key={i} className="relative">
                      <span className={cn(
                        "absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full ring-2 ring-background",
                        it.type === "move" ? "bg-primary" : "bg-amber-400",
                      )} />
                      <p className="text-xs font-medium text-foreground">{it.title}</p>
                      {it.subtitle && <p className="text-[11px] text-muted-foreground">{it.subtitle}</p>}
                      <p className="text-[10px] text-muted-foreground/80 mt-0.5">
                        {new Date(it.ts).toLocaleString("pt-BR")}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </ScrollArea>

        <div className="border-t border-border p-3 bg-card/60">
          <Button
            className="w-full gap-2"
            disabled={!nextStage || moving}
            onClick={moveNext}
          >
            {nextStage ? <>Mover para <strong>{nextStage.name}</strong> <ArrowRight className="w-4 h-4" /></> : "Sem próxima etapa"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
