import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { Loader2, RefreshCw, Download, CheckCircle2, XCircle, Search, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  getPipedriveStatus, listPipedriveLeads, importPipedriveLeads,
  type PipedriveLeadPreview,
} from "@/lib/pipedrive";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const UNMAPPED = "__none";

export function PipedriveImportSheet({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"open" | "won" | "lost" | "all_not_deleted">("open");
  const [since, setSince] = useState<string>("");
  const [limit, setLimit] = useState<number>(100);
  const [items, setItems] = useState<PipedriveLeadPreview[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [defaultResponsavel, setDefaultResponsavel] = useState<string>("__me");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  // Stage mapping state: pipedrive_stage_id (string) → fortem_stage_id (uuid) | UNMAPPED
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [savingMapping, setSavingMapping] = useState(false);

  const status = useQuery({
    queryKey: ["pipedrive-status"],
    queryFn: getPipedriveStatus,
    staleTime: 60_000,
    retry: false,
    enabled: open,
  });

  const profiles = useQuery({
    queryKey: ["pipedrive-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name").order("full_name");
      return data || [];
    },
    staleTime: 5 * 60_000,
    enabled: open,
  });

  const stages = useQuery({
    queryKey: ["fortem-pipeline-stages"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pipeline_stages")
        .select("id, name, funnel, position")
        .order("position");
      return data || [];
    },
    staleTime: 5 * 60_000,
    enabled: open,
  });

  const existingMapping = useQuery({
    queryKey: ["pipedrive-stage-mapping"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("pipedrive_stage_mapping")
        .select("pipedrive_stage_id, fortem_stage_id");
      return (data || []) as { pipedrive_stage_id: number; fortem_stage_id: string }[];
    },
    enabled: open,
  });

  // Seed mapping state from DB when both are loaded
  useEffect(() => {
    if (!existingMapping.data) return;
    setMapping((prev) => {
      const next = { ...prev };
      existingMapping.data.forEach((m) => {
        if (!next[String(m.pipedrive_stage_id)]) next[String(m.pipedrive_stage_id)] = m.fortem_stage_id;
      });
      return next;
    });
  }, [existingMapping.data]);

  const ownerOptions = useMemo(() => {
    const m = new Map<string, string>();
    items.forEach((i) => { if (i.ownerId) m.set(String(i.ownerId), i.ownerName); });
    return Array.from(m.entries()).map(([id, name]) => ({ id, name }));
  }, [items]);

  const stageOptionsFromItems = useMemo(() => {
    const m = new Map<string, string>();
    items.forEach((i) => {
      if (i.stageId) m.set(String(i.stageId), i.stageName || `Stage ${i.stageId}`);
    });
    return Array.from(m.entries()).map(([id, name]) => ({ id, name }));
  }, [items]);

  const visibleItems = useMemo(() => {
    return items.filter((i) => {
      if (stageFilter !== "all" && String(i.stageId) !== stageFilter) return false;
      if (ownerFilter !== "all" && String(i.ownerId) !== ownerFilter) return false;
      return true;
    });
  }, [items, stageFilter, ownerFilter]);

  const selectableVisible = visibleItems.filter((i) => !i.alreadyImported);

  const fortemStagesByFunnel = useMemo(() => {
    const grouped: Record<string, { id: string; name: string }[]> = { prospects: [], aluno: [], inativo: [] };
    (stages.data || []).forEach((s: any) => {
      const f = s.funnel || "prospects";
      if (!grouped[f]) grouped[f] = [];
      grouped[f].push({ id: s.id, name: s.name });
    });
    return grouped;
  }, [stages.data]);

  async function handleFetch() {
    setLoadingList(true);
    setSelected(new Set());
    try {
      const result = await listPipedriveLeads({
        since: since || null,
        limit,
        status: statusFilter,
      });
      setItems(result);
      toast.success(`${result.length} deal${result.length !== 1 ? "s" : ""} carregado${result.length !== 1 ? "s" : ""}`);
    } catch (e: any) {
      toast.error(e.message || "Erro ao buscar Pipedrive");
    } finally {
      setLoadingList(false);
    }
  }

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  function toggleAll(checked: boolean) {
    setSelected((s) => {
      const n = new Set(s);
      if (checked) selectableVisible.forEach((i) => n.add(i.dealId));
      else selectableVisible.forEach((i) => n.delete(i.dealId));
      return n;
    });
  }

  async function handleSaveMapping() {
    setSavingMapping(true);
    try {
      const rows = Object.entries(mapping)
        .filter(([, fortemId]) => fortemId && fortemId !== UNMAPPED)
        .map(([pdId, fortemId]) => ({
          pipedrive_stage_id: Number(pdId),
          pipedrive_stage_name: stageOptionsFromItems.find((s) => s.id === pdId)?.name || null,
          fortem_stage_id: fortemId,
          updated_at: new Date().toISOString(),
        }));
      const toDelete = Object.entries(mapping)
        .filter(([, fortemId]) => !fortemId || fortemId === UNMAPPED)
        .map(([pdId]) => Number(pdId));

      if (rows.length) {
        const { error } = await (supabase as any)
          .from("pipedrive_stage_mapping")
          .upsert(rows, { onConflict: "pipedrive_stage_id" });
        if (error) throw error;
      }
      if (toDelete.length) {
        await (supabase as any).from("pipedrive_stage_mapping").delete().in("pipedrive_stage_id", toDelete);
      }
      toast.success("Mapeamento de etapas salvo");
      qc.invalidateQueries({ queryKey: ["pipedrive-stage-mapping"] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar mapeamento");
    } finally {
      setSavingMapping(false);
    }
  }

  async function handleImport() {
    setImporting(true);
    try {
      const payload = items
        .filter((i) => selected.has(i.dealId) && !i.alreadyImported)
        .map((i) => ({
          dealId: i.dealId,
          personId: i.personId,
          name: i.name,
          phone: i.phone,
          email: i.email,
          pipedriveStageId: i.stageId,
        }));
      const responsavelId = defaultResponsavel === "__me" ? null : defaultResponsavel;
      const res = await importPipedriveLeads(payload, responsavelId);
      toast.success(
        `Importação: ${res.imported} criado(s), ${res.skipped} ignorado(s)${res.errors.length ? `, ${res.errors.length} erro(s)` : ""}`,
      );
      if (res.errors.length) {
        res.errors.slice(0, 3).forEach((e) => toast.error(`Deal ${e.dealId}: ${e.message}`));
      }
      qc.invalidateQueries({ queryKey: ["leads-list"] });
      qc.invalidateQueries({ queryKey: ["pipeline-alunos"] });
      await handleFetch();
      setConfirmOpen(false);
      setSelected(new Set());
    } catch (e: any) {
      toast.error(e.message || "Erro ao importar");
    } finally {
      setImporting(false);
    }
  }

  const statusBadge = status.isLoading ? (
    <Badge variant="outline" className="gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Verificando...</Badge>
  ) : status.data?.outcome === "verified" || status.data?.outcome === "skipped" ? (
    <Badge className="gap-1 bg-green-500/15 text-green-400 border-green-500/30">
      <CheckCircle2 className="w-3 h-3" /> Conectado · {status.data?.latency_ms ?? 0}ms
    </Badge>
  ) : (
    <Badge variant="destructive" className="gap-1">
      <XCircle className="w-3 h-3" /> {status.data?.error || status.error?.message || "Falha"}
    </Badge>
  );

  const stagesNeedingMapping = stageOptionsFromItems.filter(
    (s) => !mapping[s.id] || mapping[s.id] === UNMAPPED,
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[960px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between gap-2">
            <span>Importar do Pipedrive</span>
            <div className="flex items-center gap-2">
              {statusBadge}
              <Button size="sm" variant="ghost" onClick={() => status.refetch()} className="gap-1">
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </SheetTitle>
          <SheetDescription>
            Persons + Deals do Pipedrive viram leads do Fortem. Configure o mapeamento de etapas para que cada deal vá direto à etapa correta do funil.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {/* Filtros */}
          <div className="glass-card rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Status do deal</Label>
                <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Abertos</SelectItem>
                    <SelectItem value="won">Ganhos</SelectItem>
                    <SelectItem value="lost">Perdidos</SelectItem>
                    <SelectItem value="all_not_deleted">Todos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Stage Pipedrive</Label>
                <Select value={stageFilter} onValueChange={setStageFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {stageOptionsFromItems.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Owner</Label>
                <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {ownerOptions.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Desde</Label>
                <Input type="date" value={since} onChange={(e) => setSince(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Limite</Label>
                <Input
                  type="number" min={1} max={500} value={limit}
                  onChange={(e) => setLimit(Math.max(1, Math.min(500, Number(e.target.value) || 100)))}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" onClick={handleFetch} disabled={loadingList} className="gap-2">
                {loadingList ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Buscar leads
              </Button>
              <div className="flex items-center gap-2 ml-auto">
                <Label className="text-xs whitespace-nowrap">Atribuir a</Label>
                <Select value={defaultResponsavel} onValueChange={setDefaultResponsavel}>
                  <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__me">Eu mesmo</SelectItem>
                    {(profiles.data || []).map((p) => (
                      <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || p.user_id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Mapeamento de etapas */}
          {stageOptionsFromItems.length > 0 && (
            <div className="glass-card rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-heading font-semibold text-foreground">Mapeamento de etapas</h4>
                  <p className="text-xs text-muted-foreground">
                    Vincule cada stage do Pipedrive a uma etapa do funil Fortem. Sem mapeamento → "Novo lead".
                  </p>
                </div>
                <Button size="sm" onClick={handleSaveMapping} disabled={savingMapping} className="gap-2">
                  {savingMapping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar mapeamento
                </Button>
              </div>
              <div className="space-y-2">
                {stageOptionsFromItems.map((s) => (
                  <div key={s.id} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <Badge variant="outline" className="text-xs">Pipedrive · Stage {s.id}</Badge>
                      <span className="ml-2 text-sm text-foreground truncate">{s.name}</span>
                    </div>
                    <span className="text-muted-foreground text-xs">→</span>
                    <Select
                      value={mapping[s.id] || UNMAPPED}
                      onValueChange={(v) => setMapping((m) => ({ ...m, [s.id]: v }))}
                    >
                      <SelectTrigger className="w-[280px]"><SelectValue placeholder="Não mapeado (Novo lead)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNMAPPED}>Não mapeado · cai em "Novo lead"</SelectItem>
                        {(["prospects", "aluno", "inativo"] as const).map((funnel) => (
                          fortemStagesByFunnel[funnel]?.length ? (
                            <SelectGroup key={funnel}>
                              <SelectLabel className="capitalize">{funnel}</SelectLabel>
                              {fortemStagesByFunnel[funnel].map((st) => (
                                <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>
                              ))}
                            </SelectGroup>
                          ) : null
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              {stagesNeedingMapping.length > 0 && (
                <p className="text-xs text-amber-400">
                  {stagesNeedingMapping.length} stage(s) sem mapeamento — esses deals cairão em "Novo lead".
                </p>
              )}
            </div>
          )}

          {/* Barra de seleção */}
          {items.length > 0 && (
            <div className="glass-card rounded-lg p-3 flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {visibleItems.length} visível{visibleItems.length !== 1 ? "is" : ""} ·{" "}
                {selected.size} selecionado{selected.size !== 1 ? "s" : ""}
              </p>
              <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={selected.size === 0} className="gap-2">
                <Download className="w-4 h-4" /> Importar selecionados
              </Button>
            </div>
          )}

          {/* Tabela */}
          <div className="glass-card rounded-lg overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-3 w-10">
                    <Checkbox
                      checked={
                        selectableVisible.length > 0 &&
                        selectableVisible.every((i) => selected.has(i.dealId))
                      }
                      onCheckedChange={(v) => toggleAll(!!v)}
                      aria-label="Selecionar todos"
                    />
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-3">Nome</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-3 hidden md:table-cell">Telefone</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-3 hidden md:table-cell">Stage PD → Fortem</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-3 hidden lg:table-cell">Owner</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-3 hidden lg:table-cell">Adicionado</th>
                  <th className="text-right text-xs font-medium text-muted-foreground p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {!loadingList && items.length === 0 && (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">
                    Use os filtros e clique em "Buscar leads".
                  </td></tr>
                )}
                {loadingList && (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Carregando...
                  </td></tr>
                )}
                {visibleItems.map((i) => {
                  const mappedStageId = i.stageId != null ? mapping[String(i.stageId)] : undefined;
                  const fortemName = mappedStageId && mappedStageId !== UNMAPPED
                    ? (stages.data || []).find((s: any) => s.id === mappedStageId)?.name || "—"
                    : "Novo lead";
                  return (
                    <tr key={i.dealId} className="border-b border-border/50 hover:bg-secondary/30">
                      <td className="p-3">
                        <Checkbox
                          checked={selected.has(i.dealId)}
                          disabled={i.alreadyImported}
                          onCheckedChange={() => toggle(i.dealId)}
                          aria-label={`Selecionar ${i.name}`}
                        />
                      </td>
                      <td className="p-3 font-medium text-foreground">{i.name}</td>
                      <td className="p-3 hidden md:table-cell text-muted-foreground">{i.phone || "—"}</td>
                      <td className="p-3 hidden md:table-cell text-xs">
                        <span className="text-muted-foreground">{i.stageName || `Stage ${i.stageId}`}</span>
                        <span className="mx-1 text-muted-foreground">→</span>
                        <span className="text-foreground">{fortemName}</span>
                      </td>
                      <td className="p-3 hidden lg:table-cell text-muted-foreground">{i.ownerName}</td>
                      <td className="p-3 hidden lg:table-cell text-xs text-muted-foreground">
                        {i.addedAt ? format(new Date(i.addedAt.replace(" ", "T")), "dd/MM/yyyy") : "—"}
                      </td>
                      <td className="p-3 text-right">
                        {i.alreadyImported ? (
                          <Badge variant="secondary" className="text-xs">Já importado</Badge>
                        ) : (
                          <Badge className="text-xs bg-primary/15 text-primary border-primary/30">Novo</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Importar {selected.size} lead{selected.size !== 1 ? "s" : ""}?</AlertDialogTitle>
              <AlertDialogDescription>
                Cada deal será criado como aluno com origem "Pipedrive" e movido para a etapa do Fortem conforme o mapeamento.
                Deals já importados são ignorados automaticamente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={importing}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleImport} disabled={importing}>
                {importing ? "Importando..." : "Importar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}
