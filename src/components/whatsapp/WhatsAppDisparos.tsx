import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertTriangle, Edit, Send } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

type DisparoConfig = {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: "evento" | "agendado";
  gatilho: string;
  destinatario: "aluno" | "profissional";
  atividades: string[] | null;
  ativo: boolean;
  modo_teste: boolean;
  template_texto: string;
  variaveis_disponiveis: string[];
  ordem: number;
};

type DisparoLog = {
  id: string;
  config_id: string | null;
  destinatario_nome: string | null;
  destinatario_telefone: string | null;
  mensagem_enviada: string | null;
  status: string;
  erro_detalhe: string | null;
  created_at: string;
};

type EditState = {
  open: boolean;
  config: DisparoConfig | null;
  texto: string;
  ativo: boolean;
  modoTeste: boolean;
};

const EXAMPLES: Record<string, string> = {
  "%NOME_ALUNO%": "João da Silva",
  "%TIPO_SERVICO%": "Treino Experimental",
  "%DIA_SEMANA%": "Quarta-feira",
  "%DATA%": "09/07/2026",
  "%HORA_INICIO%": "09:00",
  "%HORA_FIM%": "10:00",
  "%NOME_PROFISSIONAL%": "Maria Fernanda",
  "%CARGO_PROFISSIONAL%": "Treinador(a)",
  "%DATA_NASCIMENTO%": "15/03/1990",
  "%COMO_CONHECEU%": "Indicação",
  "%LIMITACOES%": "Nenhuma",
  "%ATIVIDADE_FISICA%": "Musculação 2x/semana",
  "%OBJETIVO%": "Hipertrofia",
  "%ULTIMA_AVALIACAO%": "02/03/2026",
  "%NOME_PLANO%": "Plano Mensal Premium",
  "%DIAS_VENCIMENTO%": "5",
};

function renderPreview(template: string): string {
  return template.replace(/%[A-Z_]+%/g, (m) => EXAMPLES[m] ?? m);
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function statusBadge(status: string) {
  if (status === "enviado") return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Enviado</Badge>;
  if (status === "bloqueado_teste") return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Bloqueado (teste)</Badge>;
  return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Erro</Badge>;
}

export default function WhatsAppDisparos() {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<EditState>({
    open: false, config: null, texto: "", ativo: false, modoTeste: true,
  });

  const configsQuery = useQuery({
    queryKey: ["whatsapp-disparos-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_disparos_config" as never)
        .select("*")
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as DisparoConfig[];
    },
  });

  const logsQuery = useQuery({
    queryKey: ["whatsapp-disparos-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_disparos_log" as never)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as DisparoLog[];
    },
  });

  const configs = configsQuery.data ?? [];
  const profissionais = configs.filter((c) => c.destinatario === "profissional");
  const alunos = configs.filter((c) => c.destinatario === "aluno");

  const alunosBloqueados = useMemo(
    () => alunos.filter((c) => c.modo_teste).length,
    [alunos],
  );

  const counts = useMemo(() => {
    const map: Record<string, { total: number; last: string | null }> = {};
    (logsQuery.data ?? []).forEach((l) => {
      if (!l.config_id) return;
      const cur = map[l.config_id] ?? { total: 0, last: null };
      cur.total += 1;
      if (!cur.last || l.created_at > cur.last) cur.last = l.created_at;
      map[l.config_id] = cur;
    });
    return map;
  }, [logsQuery.data]);

  const toggleAtivo = async (cfg: DisparoConfig, next: boolean) => {
    const { error } = await supabase
      .from("whatsapp_disparos_config" as never)
      .update({ ativo: next } as never)
      .eq("id", cfg.id);
    if (error) return toast.error("Erro ao alterar: " + error.message);
    toast.success(next ? "Disparo ativado" : "Disparo desativado");
    qc.invalidateQueries({ queryKey: ["whatsapp-disparos-config"] });
  };

  const openEdit = (cfg: DisparoConfig) => {
    setEdit({
      open: true, config: cfg, texto: cfg.template_texto,
      ativo: cfg.ativo, modoTeste: cfg.modo_teste,
    });
  };

  const insertVar = (v: string) => {
    setEdit((s) => ({ ...s, texto: s.texto + v }));
  };

  const saveEdit = async () => {
    if (!edit.config) return;
    const { error } = await supabase
      .from("whatsapp_disparos_config" as never)
      .update({
        template_texto: edit.texto,
        ativo: edit.ativo,
        modo_teste: edit.modoTeste,
      } as never)
      .eq("id", edit.config.id);
    if (error) return toast.error("Erro ao salvar: " + error.message);
    toast.success("Template atualizado");
    setEdit((s) => ({ ...s, open: false }));
    qc.invalidateQueries({ queryKey: ["whatsapp-disparos-config"] });
  };

  const renderCard = (cfg: DisparoConfig) => {
    const stats = counts[cfg.id];
    return (
      <Card key={cfg.id} className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Switch
              checked={cfg.ativo}
              onCheckedChange={(v) => toggleAtivo(cfg, v)}
              className="mt-1"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center flex-wrap gap-2">
                <h4 className="font-medium">{cfg.nome}</h4>
                {cfg.destinatario === "aluno" && cfg.modo_teste && (
                  <Badge variant="outline" className="border-amber-500/40 text-amber-400 bg-amber-500/10">
                    Modo teste — bloqueado
                  </Badge>
                )}
                {cfg.atividades?.map((a) => (
                  <Badge key={a} variant="secondary" className="text-xs">{a}</Badge>
                ))}
              </div>
              {cfg.descricao && (
                <p className="text-xs text-muted-foreground mt-1">{cfg.descricao}</p>
              )}
              <div className="text-[11px] text-muted-foreground mt-2">
                Total enviados: <span className="text-foreground">{stats?.total ?? 0}</span>
                {stats?.last && (
                  <> · Último: <span className="text-foreground">{formatDateTime(stats.last)}</span></>
                )}
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => openEdit(cfg)} className="gap-1.5">
              <Edit className="w-3.5 h-3.5" />
              Editar template
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (configsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Modo de testes */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-100">
              Modo de testes ativo — disparos para alunos estão bloqueados
            </p>
            <p className="text-xs text-amber-200/70 mt-1">
              Ative cada disparo individualmente (edite o template e desmarque "Modo teste") quando estiver pronto para produção.
            </p>
            <p className="text-xs text-amber-200/70 mt-2">
              <strong>{alunosBloqueados} de {alunos.length}</strong> disparos para alunos bloqueados
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Profissionais */}
      <div className="space-y-3">
        <div>
          <h3 className="font-heading text-lg font-semibold">Notificações para Profissionais</h3>
          <p className="text-xs text-muted-foreground">Enviadas ao telefone cadastrado no perfil do profissional.</p>
        </div>
        <div className="space-y-2">
          {profissionais.map(renderCard)}
        </div>
      </div>

      {/* Alunos */}
      <div className="space-y-3">
        <div>
          <h3 className="font-heading text-lg font-semibold">Notificações para Alunos</h3>
          <p className="text-xs text-muted-foreground">Enviadas ao telefone cadastrado do aluno.</p>
        </div>
        <div className="space-y-2">
          {alunos.map(renderCard)}
        </div>
      </div>

      {/* Histórico */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Send className="w-4 h-4" />
            Histórico de envios (últimos 20)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logsQuery.isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : (logsQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum disparo registrado ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Disparo</TableHead>
                    <TableHead>Destinatário</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Prévia</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(logsQuery.data ?? []).map((l) => {
                    const cfg = configs.find((c) => c.id === l.config_id);
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="text-xs whitespace-nowrap">{formatDateTime(l.created_at)}</TableCell>
                        <TableCell className="text-xs">{cfg?.nome ?? "—"}</TableCell>
                        <TableCell className="text-xs">
                          {l.destinatario_nome ?? "—"}
                          {l.destinatario_telefone && (
                            <div className="text-[10px] text-muted-foreground">{l.destinatario_telefone}</div>
                          )}
                        </TableCell>
                        <TableCell>{statusBadge(l.status)}</TableCell>
                        <TableCell className="text-xs max-w-[280px] truncate" title={l.mensagem_enviada ?? ""}>
                          {l.erro_detalhe ? (
                            <span className="text-red-400">{l.erro_detalhe}</span>
                          ) : (
                            l.mensagem_enviada?.slice(0, 80) ?? "—"
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal edição */}
      <Dialog open={edit.open} onOpenChange={(o) => setEdit((s) => ({ ...s, open: o }))}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar template — {edit.config?.nome}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={edit.ativo} onCheckedChange={(v) => setEdit((s) => ({ ...s, ativo: v }))} />
                Ativo
              </label>
              {edit.config?.destinatario === "aluno" && (
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={edit.modoTeste} onCheckedChange={(v) => setEdit((s) => ({ ...s, modoTeste: v }))} />
                  Modo teste (não envia)
                </label>
              )}
            </div>

            <div>
              <Label className="text-xs">Template</Label>
              <Textarea
                value={edit.texto}
                onChange={(e) => setEdit((s) => ({ ...s, texto: e.target.value }))}
                rows={10}
                className="font-mono text-sm"
              />
            </div>

            <div>
              <Label className="text-xs">Variáveis disponíveis (clique para inserir)</Label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {(edit.config?.variaveis_disponiveis ?? []).map((v) => (
                  <Button
                    key={v} type="button" size="sm" variant="secondary"
                    className="h-7 text-xs font-mono"
                    onClick={() => insertVar(v)}
                  >
                    {v}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs">Prévia com valores de exemplo</Label>
              <div className="mt-1.5 p-3 rounded-md bg-muted/40 border border-border whitespace-pre-wrap text-sm">
                {renderPreview(edit.texto)}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit((s) => ({ ...s, open: false }))}>Cancelar</Button>
            <Button onClick={saveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
