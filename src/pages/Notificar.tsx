import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { isToday, isYesterday } from "date-fns";
import { Archive, Clock, Inbox, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { descricaoNotificacaoExibicao } from "@/lib/notificacaoTexto";
import {
  useNotificacoesRecebidas, useNotificacoesEnviadas, useNotificacaoRealtime, useComentariosResumo, useDestinatariosResumo,
  type NotificacaoListItem as Item,
} from "@/hooks/useNotificacoes";
import { NewNotificacaoDialog } from "@/components/notificar/NewNotificacaoDialog";
import { NotificacaoDetail } from "@/components/notificar/NotificacaoDetail";
import { NotificacaoListItem } from "@/components/notificar/NotificacaoListItem";
import { NOTIF_CATEGORIAS } from "@/lib/notificar";

type Pasta = "entrada" | "enviadas" | "aguardando" | "arquivadas";
type Chip = "todas" | "nao_lidas" | "alta" | "prazo";

const CHIPS: { value: Chip; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "nao_lidas", label: "Não lidas" },
  { value: "alta", label: "Alta prioridade" },
  { value: "prazo", label: "Com prazo" },
];

const globalArq = (n: Item) => n.status === "arquivada" || n.status === "concluida";

export default function Notificar() {
  useNotificacaoRealtime();
  const { user } = useAuth();
  const [pasta, setPasta] = useState<Pasta>("entrada");
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [chip, setChip] = useState<Chip>("todas");
  const [filterCat, setFilterCat] = useState("todas");

  const recebidas = useNotificacoesRecebidas().data ?? [];
  const enviadas = useNotificacoesEnviadas().data ?? [];

  const { data: profileMap = {} } = useQuery({
    queryKey: ["profiles-map"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id,full_name");
      const map: Record<string, string> = {};
      (data ?? []).forEach((p) => { map[p.user_id] = p.full_name; });
      return map;
    },
  });

  const allIds = useMemo(
    () => Array.from(new Set([...recebidas, ...enviadas].map((n) => n.id))),
    [recebidas, enviadas],
  );
  const recebidasIds = useMemo(() => new Set(recebidas.map((n) => n.id)), [recebidas]);
  const { data: resumo = {} } = useComentariosResumo(allIds);
  const meusIds = useMemo(() => enviadas.filter((n) => n.criado_por === user?.id).map((n) => n.id), [enviadas, user?.id]);
  const { data: destResumo } = useDestinatariosResumo(meusIds);

  const pastas = useMemo(() => {
    const entrada = recebidas.filter((n) => !globalArq(n) && n.dest_status !== "arquivada");
    const env = enviadas.filter((n) => !globalArq(n));
    const aguardando = env.filter((n) => !(resumo[n.id]?.autores ?? []).some((a) => a !== user?.id));
    const arqMap = new Map<string, Item>();
    recebidas.filter((n) => globalArq(n) || n.dest_status === "arquivada").forEach((n) => arqMap.set(n.id, n));
    enviadas.filter(globalArq).forEach((n) => { if (!arqMap.has(n.id)) arqMap.set(n.id, n); });
    const arquivadas = [...arqMap.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
    return { entrada, enviadas: env, aguardando, arquivadas };
  }, [recebidas, enviadas, resumo, user?.id]);

  const isUnread = (n: Item) => n.visualizado_em === null;
  const naoLidas = pastas.entrada.filter(isUnread).length;
  const nomeRemetente = (n: Item) => profileMap[n.criado_por] ?? "—";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pastas[pasta].filter((n) => {
      if (q) {
        const hay = `${n.titulo} ${descricaoNotificacaoExibicao(n.descricao)} ${profileMap[n.criado_por] ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (chip === "nao_lidas" && !isUnread(n)) return false;
      if (chip === "alta" && n.prioridade !== "alta" && n.prioridade !== "urgente") return false;
      if (chip === "prazo" && !n.prazo) return false;
      if (filterCat !== "todas" && n.categoria !== filterCat) return false;
      return true;
    });
  }, [pastas, pasta, search, chip, filterCat, profileMap]);

  const grupos = useMemo(() => {
    const g: { label: string; items: Item[] }[] = [
      { label: "HOJE", items: [] }, { label: "ONTEM", items: [] }, { label: "ANTERIORES", items: [] },
    ];
    filtered.forEach((n) => {
      const d = new Date(n.created_at);
      g[isToday(d) ? 0 : isYesterday(d) ? 1 : 2].items.push(n);
    });
    return g.filter((x) => x.items.length);
  }, [filtered]);

  const PASTAS: { value: Pasta; label: string; icon: typeof Inbox; count?: number }[] = [
    { value: "entrada", label: "Caixa de entrada", icon: Inbox, count: naoLidas },
    { value: "enviadas", label: "Enviadas", icon: Send },
    { value: "aguardando", label: "Aguardando resposta", icon: Clock, count: pastas.aguardando.length },
    { value: "arquivadas", label: "Arquivadas", icon: Archive },
  ];

  const trocarPasta = (p: Pasta) => { setPasta(p); setSelected(null); };

  const mostraDestinatarios = (n: Item) =>
    n.criado_por === user?.id &&
    (pasta === "enviadas" ||
      pasta === "aguardando" ||
      (pasta === "arquivadas" && !recebidasIds.has(n.id)));

  return (
    <div className="grid grid-cols-1 gap-4 md:h-[calc(100vh-140px)] md:grid-cols-[232px_380px_minmax(0,1fr)]">
      <aside className="flex flex-col gap-3 md:min-h-0">
        <div>
          <h1 className="text-lg font-bold uppercase tracking-wide">Notificar</h1>
          <p className="text-xs text-muted-foreground">Comunicação interna entre profissionais</p>
        </div>
        <NewNotificacaoDialog />
        <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
          {PASTAS.map((p) => {
            const ativo = pasta === p.value;
            return (
              <button
                key={p.value}
                onClick={() => trocarPasta(p.value)}
                className={cn(
                  "relative flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted/60",
                  ativo ? "bg-muted font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {ativo && <span className="absolute inset-y-1 left-0 hidden w-[3px] rounded-full bg-primary md:block" />}
                <p.icon className="h-4 w-4" />
                <span className="whitespace-nowrap">{p.label}</span>
                {!!p.count && <span className="ml-auto pl-2 text-xs font-semibold text-primary">{p.count}</span>}
              </button>
            );
          })}
        </nav>
      </aside>

      <section className="flex min-h-[50vh] flex-col rounded-md border bg-card md:min-h-0">
        <div className="space-y-2 border-b p-3">
          <Input placeholder="Buscar por assunto, texto ou remetente..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="flex flex-wrap items-center gap-1.5">
            {CHIPS.map((c) => (
              <button
                key={c.value}
                onClick={() => setChip(c.value)}
                className={cn(
                  "rounded-md border px-2 py-0.5 text-xs transition-colors",
                  chip === c.value ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:bg-muted",
                )}
              >
                {c.label}
              </button>
            ))}
            <Select value={filterCat} onValueChange={setFilterCat}>
              <SelectTrigger className="ml-auto h-7 w-[120px] text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Categorias</SelectItem>
                {NOTIF_CATEGORIAS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {grupos.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">Nenhuma notificação neste filtro.</p>
          ) : grupos.map((g) => (
            <div key={g.label}>
              <div className="border-b bg-background/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{g.label}</div>
              {g.items.map((n) => (
                <NotificacaoListItem
                  key={n.id}
                  n={n}
                  remetente={nomeRemetente(n)}
                  unread={isUnread(n)}
                  selected={selected === n.id}
                  resumo={resumo[n.id]}
                  destinatarios={mostraDestinatarios(n) ? destResumo?.[n.id] : undefined}
                  onClick={() => setSelected(n.id)}
                />
              ))}
            </div>
          ))}
        </div>
      </section>

      <div className="min-h-[70vh] overflow-hidden rounded-md border bg-card md:min-h-0">
        <NotificacaoDetail id={selected} />
      </div>
    </div>
  );
}
