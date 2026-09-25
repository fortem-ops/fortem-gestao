import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Search, RotateCcw, UserCheck, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDebounce } from "@/hooks/useDebounce";
import { useUserRoles } from "@/hooks/useUserRoles";
import { ConvertToAvulsoButton } from "@/components/leads/ConvertToAvulsoButton";
import { ConvertToAlunoDialog } from "@/components/pipeline/ConvertToAlunoDialog";

const ETAPAS_RETOMADA = ["Novo lead", "Informações encaminhadas", "Prospect", "Treino experimental agendado", "Follow Up"];

interface Perdido {
  id: string;
  nome: string;
  telefone: string | null;
  responsavel_id: string | null;
  motivo_perda: string | null;
  perdido_em: string | null;
  etapa_anterior: string | null;
}

export default function AlunosPerdidos() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: roles } = useUserRoles();
  const isCoordAdmin = !!roles?.isCoordAdmin;
  const [search, setSearch] = useState("");
  const term = useDebounce(search, 250).trim().toLowerCase();
  const [motivoF, setMotivoF] = useState("todos");
  const [respF, setRespF] = useState("todos");
  const [retomar, setRetomar] = useState<Perdido | null>(null);
  const [etapa, setEtapa] = useState("");
  const [saving, setSaving] = useState(false);
  const [converter, setConverter] = useState<Perdido | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["alunos-perdidos"],
    queryFn: async () => {
      const { data: stages } = await supabase.from("pipeline_stages").select("id,name");
      const stageName: Record<string, string> = {};
      (stages || []).forEach((s: any) => { stageName[s.id] = s.name; });
      const perdidoId = (stages || []).find((s: any) => s.name === "Aluno perdido")?.id;
      if (!perdidoId) return { rows: [] as Perdido[], profiles: {} as Record<string, string> };
      const { data: alunos, error } = await supabase
        .from("alunos")
        .select("id,nome,telefone,responsavel_id,motivo_perda")
        .eq("current_pipeline_stage_id", perdidoId)
        .order("nome");
      if (error) throw error;
      const ids = (alunos || []).map((a: any) => a.id);
      const movs: Record<string, any> = {};
      if (ids.length) {
        const { data: m } = await supabase
          .from("pipeline_movements")
          .select("aluno_id,from_stage_id,moved_at")
          .eq("to_stage_id", perdidoId)
          .in("aluno_id", ids)
          .order("moved_at", { ascending: false });
        (m || []).forEach((x: any) => { if (!movs[x.aluno_id]) movs[x.aluno_id] = x; });
      }
      const { data: profs } = await supabase.from("profiles").select("user_id,full_name");
      const profiles: Record<string, string> = {};
      (profs || []).forEach((p: any) => { profiles[p.user_id] = p.full_name; });
      const rows: Perdido[] = (alunos || []).map((a: any) => ({
        ...a,
        perdido_em: movs[a.id]?.moved_at ?? null,
        etapa_anterior: movs[a.id]?.from_stage_id ? stageName[movs[a.id].from_stage_id] ?? null : null,
      }));
      return { rows, profiles };
    },
    staleTime: 30_000,
  });

  const rows = data?.rows ?? [];
  const profiles = data?.profiles ?? {};
  const motivos = useMemo(() => Array.from(new Set(rows.map((r) => r.motivo_perda).filter(Boolean))) as string[], [rows]);
  const resps = useMemo(() => Array.from(new Set(rows.map((r) => r.responsavel_id).filter(Boolean))) as string[], [rows]);

  const filtered = rows.filter((r) =>
    (!term || r.nome.toLowerCase().includes(term) || (r.telefone ?? "").includes(term)) &&
    (motivoF === "todos" || r.motivo_perda === motivoF) &&
    (respF === "todos" || r.responsavel_id === respF),
  );

  function refresh() {
    qc.invalidateQueries({ queryKey: ["alunos-perdidos"] });
    qc.invalidateQueries({ queryKey: ["pipeline-alunos"] });
  }

  function abrirRetomar(r: Perdido) {
    setEtapa(r.etapa_anterior && ETAPAS_RETOMADA.includes(r.etapa_anterior) ? r.etapa_anterior : "Prospect");
    setRetomar(r);
  }

  async function confirmarRetomar() {
    if (!retomar || !etapa) return;
    setSaving(true);
    const { error } = await supabase.rpc("fn_move_pipeline", {
      _aluno_id: retomar.id, _to_stage_name: etapa, _source: "manual",
      _notes: "Retomado de perdido", _moved_by: user?.id ?? null,
    } as any);
    if (!error) await supabase.from("alunos").update({ motivo_perda: null } as any).eq("id", retomar.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`${retomar.nome} retomado para ${etapa}`);
    setRetomar(null);
    refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Alunos Perdidos</h1>
        <p className="text-sm text-muted-foreground">Cadastros marcados como perdidos no funil. Retome para uma etapa ou converta.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou telefone" className="pl-8" />
        </div>
        <Select value={motivoF} onValueChange={setMotivoF}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Motivo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os motivos</SelectItem>
            {motivos.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={respF} onValueChange={setRespF}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Responsável" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os responsáveis</SelectItem>
            {resps.map((id) => <SelectItem key={id} value={id}>{profiles[id] || "—"}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground border-b border-border">
            <tr>
              <th className="text-left p-3">Nome</th>
              <th className="text-left p-3">Telefone</th>
              <th className="text-left p-3">Responsável</th>
              <th className="text-left p-3">Motivo</th>
              <th className="text-left p-3">Perdido em</th>
              <th className="text-left p-3">Etapa anterior</th>
              <th className="text-right p-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="p-3"><Skeleton className="h-8 w-full" /></td></tr>}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhum cadastro perdido.</td></tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-border/50 last:border-0">
                <td className="p-3 font-medium text-foreground">{r.nome}</td>
                <td className="p-3 text-muted-foreground">{r.telefone || "—"}</td>
                <td className="p-3 text-muted-foreground">{(r.responsavel_id && profiles[r.responsavel_id]) || "—"}</td>
                <td className="p-3">{r.motivo_perda ? <Badge variant="outline" className="status-urgent text-[10px]">{r.motivo_perda}</Badge> : "—"}</td>
                <td className="p-3 text-muted-foreground">{r.perdido_em ? new Date(r.perdido_em).toLocaleDateString("pt-BR") : "—"}</td>
                <td className="p-3 text-muted-foreground">{r.etapa_anterior || "—"}</td>
                <td className="p-3">
                  <div className="flex justify-end gap-1">
                    {isCoordAdmin && (
                      <Button size="icon" variant="ghost" className="h-8 w-8" title="Retomar para uma etapa" onClick={() => abrirRetomar(r)}>
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                    <ConvertToAvulsoButton alunoId={r.id} alunoNome={r.nome} variant="icon" onConverted={refresh} />
                    {isCoordAdmin && (
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" title="Converter em aluno" onClick={() => setConverter(r)}>
                        <UserCheck className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-8 w-8" title="Abrir perfil" onClick={() => navigate(`/alunos/${r.id}`)}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!retomar} onOpenChange={(v) => !v && setRetomar(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Retomar {retomar?.nome}</DialogTitle>
            <DialogDescription>Escolha a etapa do funil. O motivo da perda será apagado e a mudança ficará no histórico.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Etapa</Label>
            <Select value={etapa} onValueChange={setEtapa}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ETAPAS_RETOMADA.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRetomar(null)}>Cancelar</Button>
            <Button onClick={confirmarRetomar} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Retomar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {converter && (
        <ConvertToAlunoDialog
          open={!!converter}
          onOpenChange={(v) => !v && setConverter(null)}
          alunoId={converter.id}
          alunoNome={converter.nome}
          fullConvert
          destinoStage="Aluno ativo"
          onConverted={refresh}
        />
      )}
    </div>
  );
}
