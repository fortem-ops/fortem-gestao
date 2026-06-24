import { useState, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNotificacoesRecebidas, useNotificacoesEnviadas, useNotificacaoRealtime } from "@/hooks/useNotificacoes";
import { NewNotificacaoDialog } from "@/components/notificar/NewNotificacaoDialog";
import { NotificacaoDetail } from "@/components/notificar/NotificacaoDetail";
import { CategoriaBadge, PrioridadeBadge, StatusBadge } from "@/components/notificar/NotificacaoBadge";
import { NOTIF_CATEGORIAS, NOTIF_PRIORIDADES } from "@/lib/notificar";

export default function Notificar() {
  useNotificacaoRealtime();
  const [tab, setTab] = useState<"recebidas" | "enviadas" | "arquivadas">("recebidas");
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterPrio, setFilterPrio] = useState<string>("todas");
  const [filterCat, setFilterCat] = useState<string>("todas");

  const recebidas = useNotificacoesRecebidas();
  const enviadas = useNotificacoesEnviadas();

  const all = tab === "enviadas" ? enviadas.data ?? [] : recebidas.data ?? [];
  const filtered = useMemo(() => {
    return all.filter((n) => {
      const globalArquivada = n.status === "arquivada" || n.status === "concluida";
      const destArquivada = n.dest_status === "arquivada";
      const isArquivada = tab === "enviadas" ? globalArquivada : (globalArquivada || destArquivada);
      if (tab === "arquivadas" && !isArquivada) return false;
      if (tab !== "arquivadas" && isArquivada) return false;
      if (search && !n.titulo.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterPrio !== "todas" && n.prioridade !== filterPrio) return false;
      if (filterCat !== "todas" && n.categoria !== filterCat) return false;
      return true;
    });
  }, [all, tab, search, filterPrio, filterCat]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Bell className="h-6 w-6 text-primary shrink-0" />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">Notificar</h1>
            <p className="text-sm text-muted-foreground">Comunicação interna entre profissionais</p>
          </div>
        </div>
        <NewNotificacaoDialog />
      </header>

      <Tabs value={tab} onValueChange={(v) => { setTab(v as any); setSelected(null); }}>
        <TabsList>
          <TabsTrigger value="recebidas">Recebidas</TabsTrigger>
          <TabsTrigger value="enviadas">Enviadas</TabsTrigger>
          <TabsTrigger value="arquivadas">Arquivadas</TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4 md:h-[calc(100vh-260px)]">
            <div className="border rounded-lg flex flex-col bg-card">
              <div className="p-3 space-y-2 border-b">
                <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
                <div className="grid grid-cols-2 gap-2">
                  <Select value={filterPrio} onValueChange={setFilterPrio}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Prioridade" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas prioridades</SelectItem>
                      {NOTIF_PRIORIDADES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={filterCat} onValueChange={setFilterCat}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas categorias</SelectItem>
                      {NOTIF_CATEGORIAS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <ScrollArea className="flex-1">
                {filtered.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground text-center">Nenhuma notificação.</p>
                ) : filtered.map((n) => {
                  const unread = tab === "recebidas" && !n.visualizado_em;
                  return (
                    <button
                      key={n.id}
                      onClick={() => setSelected(n.id)}
                      className={`w-full text-left p-3 border-b hover:bg-accent/50 transition ${selected === n.id ? "bg-accent" : ""} ${unread ? "border-l-2 border-l-primary" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className={`text-sm line-clamp-1 ${unread ? "font-semibold" : ""}`}>{n.titulo}</span>
                        <PrioridadeBadge prioridade={n.prioridade} />
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{n.descricao}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <CategoriaBadge categoria={n.categoria} />
                        <StatusBadge status={n.status} />
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {format(new Date(n.created_at), "dd/MM HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </ScrollArea>
            </div>
            <div className="border rounded-lg bg-card overflow-hidden">
              <NotificacaoDetail id={selected} />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
