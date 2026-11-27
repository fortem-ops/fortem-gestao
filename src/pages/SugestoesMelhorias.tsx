import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  SUGESTAO_CATEGORIAS,
  labelCategoriaSugestao,
  labelStatusSugestao,
  validarRespostaSugestao,
  type SugestaoRow,
} from "@/lib/portalSugestoes";

interface SugestaoComAluno extends SugestaoRow {
  aluno_nome: string;
  respondido_por_nome: string | null;
}

export default function SugestoesMelhorias() {
  const { data: userRoles } = useUserRoles();
  const queryClient = useQueryClient();
  const permitido = Boolean(userRoles?.isCoordAdmin);

  const [filtroStatus, setFiltroStatus] = useState<string>("pendente");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [selecionada, setSelecionada] = useState<SugestaoComAluno | null>(null);
  const [resposta, setResposta] = useState("");

  const { data: sugestoes = [], isLoading } = useQuery<SugestaoComAluno[]>({
    queryKey: ["equipe-sugestoes"],
    enabled: permitido,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("portal_sugestoes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const list = rows ?? [];
      const alunoIds = Array.from(new Set(list.map((r) => r.aluno_id)));
      const responderIds = Array.from(
        new Set(list.map((r) => r.respondido_por).filter((id): id is string => Boolean(id))),
      );

      const [alunosRes, profilesRes] = await Promise.all([
        alunoIds.length > 0
          ? supabase.from("alunos").select("id, nome").in("id", alunoIds)
          : Promise.resolve({ data: [] as { id: string; nome: string }[], error: null }),
        responderIds.length > 0
          ? supabase.from("profiles").select("user_id, full_name").in("user_id", responderIds)
          : Promise.resolve({ data: [] as { user_id: string; full_name: string }[], error: null }),
      ]);

      const alunoMap = new Map<string, string>(
        (alunosRes.data ?? []).map((a) => [a.id, a.nome] as const),
      );
      const profileMap = new Map<string, string>(
        (profilesRes.data ?? []).map((p) => [p.user_id, p.full_name] as const),
      );

      return list.map((r) => ({
        ...r,
        aluno_nome: alunoMap.get(r.aluno_id) ?? "Aluno",
        respondido_por_nome: r.respondido_por ? (profileMap.get(r.respondido_por) ?? "Equipe") : null,
      }));
    },
  });

  const pendentesCount = useMemo(
    () => sugestoes.filter((s) => s.status === "pendente").length,
    [sugestoes],
  );

  const filtradas = useMemo(() => {
    return sugestoes.filter((s) => {
      if (filtroStatus !== "todos" && s.status !== filtroStatus) return false;
      if (filtroCategoria !== "todas" && s.categoria !== filtroCategoria) return false;
      return true;
    });
  }, [sugestoes, filtroStatus, filtroCategoria]);

  const responderMutation = useMutation({
    mutationFn: async (status: "aprovada" | "recusada") => {
      if (!selecionada) throw new Error("Nenhuma sugestão selecionada.");
      const erro = validarRespostaSugestao({ status, resposta });
      if (erro) throw new Error(erro);

      const { error } = await supabase.rpc("fn_responder_sugestao", {
        p_sugestao_id: selecionada.id,
        p_status: status,
        p_resposta: resposta.trim() || undefined,
      });
      if (error) throw error;
    },
    onSuccess: (_data, status) => {
      toast.success(status === "aprovada" ? "Sugestão aprovada e aluno notificado." : "Sugestão recusada e aluno notificado.");
      setSelecionada(null);
      setResposta("");
      queryClient.invalidateQueries({ queryKey: ["equipe-sugestoes"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Não foi possível salvar a resposta.");
    },
  });

  if (!permitido) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Acesso restrito a coordenadores e administradores.
          </CardContent>
        </Card>
      </div>
    );
  }

  const badgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    if (status === "aprovada") return "default";
    if (status === "recusada") return "destructive";
    return "secondary";
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sugestões de Melhorias</h1>
          <p className="text-sm text-muted-foreground">
            Avalie, responda e aprove ou recuse feedbacks enviados pelos alunos no portal.
          </p>
        </div>
        <Badge variant="secondary" className="text-sm px-3 py-1">
          {pendentesCount} {pendentesCount === 1 ? "pendente" : "pendentes"}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="pendente">Em análise</SelectItem>
            <SelectItem value="aprovada">Aprovadas</SelectItem>
            <SelectItem value="recusada">Recusadas</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as categorias</SelectItem>
            {SUGESTAO_CATEGORIAS.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Carregando sugestões...</CardContent>
        </Card>
      ) : filtradas.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Nenhuma sugestão encontrada para os filtros selecionados.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtradas.map((item) => (
            <Card
              key={item.id}
              className="cursor-pointer transition-colors hover:border-primary/50"
              onClick={() => {
                setSelecionada(item);
                setResposta(item.resposta ?? "");
              }}
            >
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">{item.titulo}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{labelCategoriaSugestao(item.categoria)}</Badge>
                    <Badge variant={badgeVariant(item.status)}>{labelStatusSugestao(item.status)}</Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {item.aluno_nome} · {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-foreground/90 line-clamp-2">{item.descricao}</p>
                {item.resposta && (
                  <p className="text-xs text-muted-foreground border-t pt-2">
                    Respondida por {item.respondido_por_nome}
                    {item.respondido_em ? ` em ${format(new Date(item.respondido_em), "dd/MM/yyyy", { locale: ptBR })}` : ""}: {item.resposta}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={Boolean(selecionada)} onOpenChange={(open) => { if (!open) setSelecionada(null); }}>
        <DialogContent className="max-w-lg">
          {selecionada && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle>{selecionada.titulo}</DialogTitle>
                <p className="text-xs text-muted-foreground">
                  {selecionada.aluno_nome} · {labelCategoriaSugestao(selecionada.categoria)} ·{" "}
                  {format(new Date(selecionada.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </DialogHeader>

              <div className="rounded-md border p-3 text-sm whitespace-pre-line">
                {selecionada.descricao}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="resposta-sugestao" className="text-xs font-medium text-foreground">
                  Resposta ao aluno (obrigatória ao recusar)
                </label>
                <Textarea
                  id="resposta-sugestao"
                  rows={4}
                  value={resposta}
                  onChange={(e) => setResposta(e.target.value)}
                  placeholder="Escreva o retorno que o aluno verá no portal..."
                />
              </div>

              {selecionada.respondido_em && (
                <p className="text-xs text-muted-foreground">
                  Última atualização por {selecionada.respondido_por_nome} em{" "}
                  {format(new Date(selecionada.respondido_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}.
                </p>
              )}

              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  disabled={responderMutation.isPending}
                  onClick={() => responderMutation.mutate("recusada")}
                >
                  Recusar
                </Button>
                <Button
                  type="button"
                  disabled={responderMutation.isPending}
                  onClick={() => responderMutation.mutate("aprovada")}
                >
                  Aprovar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}