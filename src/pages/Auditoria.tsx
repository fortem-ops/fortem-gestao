import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, ExternalLink, RefreshCw, Check, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUserRoles } from "@/hooks/useUserRoles";
import { CobrancaAutomaticaAviso } from "@/components/financeiro/CobrancaAutomaticaAviso";
import {
  useAuditoriaItens,
  useAuditoriaResumo,
  useResolverAuditoria,
  type AuditoriaItem,
} from "@/hooks/useAuditoria";
import { alternarSelecao, idsAbertos, loteValido } from "@/lib/auditoriaSelecao";

const SEVERIDADE_LABEL: Record<string, string> = {
  critico: "Crítico",
  atencao: "Atenção",
  info: "Informativo",
};

const CATEGORIA_LABEL: Record<string, string> = {
  pagamento: "Pagamentos",
  integracao: "Integrações",
  creditos: "Créditos",
  agenda_servicos: "Agenda de Serviços",
  pipeline: "Pipeline",
  contratos: "Contratos",
};

const STATUS_LABEL: Record<string, string> = {
  aberto: "Aberto",
  resolvido: "Resolvido",
  ignorado: "Ignorado",
};

function severidadeClass(sev: string) {
  if (sev === "critico") return "status-urgent";
  if (sev === "atencao") return "status-warning";
  return "";
}

export default function Auditoria() {
  const { data: roles } = useUserRoles();
  const isAdmin = !!roles?.isAdmin;

  const [categoria, setCategoria] = useState("todas");
  const [severidade, setSeveridade] = useState("todas");
  const [status, setStatus] = useState("aberto");
  const [rodando, setRodando] = useState(false);
  const [alvo, setAlvo] = useState<{ itens: AuditoriaItem[]; acao: "resolvido" | "ignorado" } | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [nota, setNota] = useState("");

  const { data: itens = [], isLoading, refetch } = useAuditoriaItens({ categoria, severidade, status });
  const { data: resumo } = useAuditoriaResumo();
  const resolver = useResolverAuditoria();

  useEffect(() => {
    setSelecionados(new Set());
  }, [categoria, severidade, status]);

  const abertosVisiveis = idsAbertos(itens);
  const lote = loteValido(selecionados, itens);
  const todosMarcados = abertosVisiveis.size > 0 && lote.length === abertosVisiveis.size;

  const abrirLote = (acao: "resolvido" | "ignorado") => {
    const ids = new Set(lote);
    setAlvo({ itens: itens.filter((i) => ids.has(i.id)), acao });
    setNota("");
  };

  const rodarAgora = async () => {
    setRodando(true);
    try {
      const { data, error } = await supabase.functions.invoke("auditoria-fiscal-pagamentos");
      if (error) throw error;
      const d = data as Record<string, Record<string, number> | undefined>;
      const r = { ...(d?.resultado ?? {}), ...(d?.resultado_creditos ?? {}), ...(d?.resultado_agenda ?? {}), ...(d?.resultado_pipeline ?? {}), ...(d?.resultado_contratos ?? {}) };
      const novos = Object.entries(r)
        .filter(([k]) => k !== "executado_em")
        .reduce((s, [, v]) => s + (Number(v) || 0), 0);
      toast.success(novos > 0 ? `${novos} novo(s) item(ns) encontrado(s)` : "Nenhuma nova inconsistência encontrada");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao executar a verificação");
    } finally {
      setRodando(false);
    }
  };

  const confirmar = () => {
    if (!alvo) return;
    resolver.mutate(
      { ids: alvo.itens.map((i) => i.id), status: alvo.acao, nota },
      {
        onSuccess: (n) => {
          toast.success(n === 1 ? "1 item atualizado" : `${n} itens atualizados`);
          setSelecionados(new Set());
          setAlvo(null);
          setNota("");
        },
      },
    );
  };

  const linkDoItem = (item: AuditoriaItem) => {
    if (item.aluno_id) return `/alunos/${item.aluno_id}`;
    return null;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <CobrancaAutomaticaAviso />
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-primary" />
            Auditoria
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Inconsistências detectadas automaticamente. Somente a equipe encerra um item.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {resumo && (
            <>
              <Badge variant="outline">{resumo.abertos} abertos</Badge>
              {resumo.criticos > 0 && <Badge variant="destructive">{resumo.criticos} críticos</Badge>}
            </>
          )}
          <Button size="sm" variant="outline" onClick={rodarAgora} disabled={rodando}>
            <RefreshCw className={`w-4 h-4 mr-1 ${rodando ? "animate-spin" : ""}`} />
            Verificar agora
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={categoria} onValueChange={setCategoria}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as categorias</SelectItem>
            <SelectItem value="pagamento">Pagamentos</SelectItem>
            <SelectItem value="integracao">Integrações</SelectItem>
            <SelectItem value="creditos">Créditos</SelectItem>
            <SelectItem value="agenda_servicos">Agenda de Serviços</SelectItem>
            <SelectItem value="pipeline">Pipeline</SelectItem>
            <SelectItem value="contratos">Contratos</SelectItem>
          </SelectContent>
        </Select>

        <Select value={severidade} onValueChange={setSeveridade}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as severidades</SelectItem>
            <SelectItem value="critico">Crítico</SelectItem>
            <SelectItem value="atencao">Atenção</SelectItem>
            <SelectItem value="info">Informativo</SelectItem>
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="aberto">Abertos</SelectItem>
            <SelectItem value="resolvido">Resolvidos</SelectItem>
            <SelectItem value="ignorado">Ignorados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : itens.length === 0 ? (
        <div className="glass-card rounded-lg p-8 text-center text-sm text-muted-foreground">
          Nenhum item encontrado com esses filtros 🎉
        </div>
      ) : (
        <div className="space-y-2">
          {isAdmin && abertosVisiveis.size > 0 && (
            <div className="glass-card rounded-lg p-3 flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={todosMarcados}
                  onCheckedChange={(v) => setSelecionados(v ? idsAbertos(itens) : new Set())}
                />
                Selecionar todos os visíveis
              </label>
              <span className="text-xs text-muted-foreground">{lote.length} selecionado(s)</span>
              {lote.length > 0 && (
                <div className="flex items-center gap-2 ml-auto">
                  <Button size="sm" variant="outline" onClick={() => abrirLote("resolvido")}>
                    <Check className="w-4 h-4 mr-1" /> Resolver selecionados
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => abrirLote("ignorado")}>
                    <EyeOff className="w-4 h-4 mr-1" /> Ignorar selecionados
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelecionados(new Set())}>
                    Limpar seleção
                  </Button>
                </div>
              )}
            </div>
          )}
          {itens.map((item) => {
            const link = linkDoItem(item);
            return (
              <div key={item.id} className="glass-card rounded-lg p-4 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-3 min-w-0">
                  {isAdmin && item.status === "aberto" && (
                    <Checkbox
                      className="mt-1"
                      aria-label="Selecionar item"
                      checked={selecionados.has(item.id)}
                      onCheckedChange={() => setSelecionados((s) => alternarSelecao(s, item))}
                    />
                  )}
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={severidadeClass(item.severidade)}>
                        {SEVERIDADE_LABEL[item.severidade] ?? item.severidade}
                      </Badge>
                      <Badge variant="outline">{CATEGORIA_LABEL[item.categoria] ?? item.categoria}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.detectado_em).toLocaleString("pt-BR")}
                      </span>
                      {item.status !== "aberto" && (
                        <Badge variant="secondary">{STATUS_LABEL[item.status]}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-foreground">{item.descricao}</p>
                    {item.aluno_nome && (
                      <p className="text-xs text-muted-foreground">Aluno: {item.aluno_nome}</p>
                    )}
                    {item.nota_resolucao && (
                      <p className="text-xs text-muted-foreground">Nota: {item.nota_resolucao}</p>
                    )}
                  </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {link && (
                      <Button asChild size="sm" variant="ghost">
                        <Link to={link}>
                          <ExternalLink className="w-4 h-4 mr-1" /> Abrir
                        </Link>
                      </Button>
                    )}
                    {isAdmin && item.status === "aberto" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => { setAlvo({ itens: [item], acao: "resolvido" }); setNota(""); }}>
                          <Check className="w-4 h-4 mr-1" /> Resolvido
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setAlvo({ itens: [item], acao: "ignorado" }); setNota(""); }}>
                          <EyeOff className="w-4 h-4 mr-1" /> Ignorar
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!alvo} onOpenChange={(o) => !o && setAlvo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {(() => {
                const n = alvo?.itens.length ?? 0;
                if (alvo?.acao === "resolvido") return n > 1 ? `Marcar ${n} itens como resolvidos` : "Marcar como resolvido";
                return n > 1 ? `Ignorar ${n} itens` : "Ignorar item";
              })()}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-1">
                {alvo?.itens.slice(0, 5).map((i) => (
                  <p key={i.id} className="line-clamp-2">• {i.descricao}</p>
                ))}
                {alvo && alvo.itens.length > 5 && <p>e mais {alvo.itens.length - 5}</p>}
              </div>
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Nota (opcional)"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAlvo(null)}>Cancelar</Button>
            <Button onClick={confirmar} disabled={resolver.isPending}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
