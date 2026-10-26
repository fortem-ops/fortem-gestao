import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { isToday, isYesterday } from "date-fns";
import { Archive, ArchiveRestore, Clock, Inbox, Mail, MailOpen, Pin, PinOff, Send, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { descricaoNotificacaoExibicao } from "@/lib/notificacaoTexto";
import {
  useNotificacoesRecebidas, useNotificacoesEnviadas, useNotificacaoRealtime, useComentariosResumo, useDestinatariosResumo, contarNovasDepois,
  type NotificacaoListItem as Item,
} from "@/hooks/useNotificacoes";
import { NewNotificacaoDialog } from "@/components/notificar/NewNotificacaoDialog";
import { NotificacaoDetail } from "@/components/notificar/NotificacaoDetail";
import { NotificacaoListItem } from "@/components/notificar/NotificacaoListItem";
import { NOTIF_CATEGORIAS, loteArquivar, loteFixar, loteMarcarLida, loteMarcarNaoLida } from "@/lib/notificar";

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
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [confirmArq, setConfirmArq] = useState(false);
  const [loteBusy, setLoteBusy] = useState(false);
  const qc = useQueryClient();
  useEffect(() => { setSelecionadas(new Set()); }, [pasta, chip, filterCat, search]);

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
  const fixadaMap = useMemo(() => {
    const m = new Map<string, string>();
    recebidas.forEach((n) => { if (n.fixada_em) m.set(n.id, n.fixada_em); });
    return m;
  }, [recebidas]);
  const { data: resumo = {} } = useComentariosResumo(allIds, user?.id);
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
    const usarFixadas = pasta !== "arquivadas";
    const fixadas = usarFixadas
      ? filtered.filter((n) => fixadaMap.has(n.id))
          .sort((a, b) => fixadaMap.get(b.id)!.localeCompare(fixadaMap.get(a.id)!))
      : [];
    filtered.forEach((n) => {
      if (usarFixadas && fixadaMap.has(n.id)) return;
      const d = new Date(n.created_at);
      g[isToday(d) ? 0 : isYesterday(d) ? 1 : 2].items.push(n);
    });
    return [{ label: "FIXADAS", items: fixadas }, ...g].filter((x) => x.items.length);
  }, [filtered, pasta, fixadaMap]);

  const toggleMarcada = (id: string) => setSelecionadas((prev) => {
    const s = new Set(prev);
    if (s.has(id)) s.delete(id); else s.add(id);
    return s;
  });

  const ids = [...selecionadas];
  const comoDestinatario = ids.filter((id) => recebidasIds.has(id));
  const comoCriador = ids.filter((id) => enviadas.some((n) => n.id === id && n.criado_por === user?.id));
  const naoDest = ids.length - comoDestinatario.length;
  const emArquivadas = pasta === "arquivadas";
  const todasFixadas = comoDestinatario.length > 0 && comoDestinatario.every((id) => fixadaMap.has(id));
  const plural = (n: number) => `${n} ${n === 1 ? "conversa" : "conversas"}`;

  const executarLote = async (acao: () => Promise<void>, msg: string, fecharDetalhe: boolean) => {
    setLoteBusy(true);
    try {
      await acao();
      qc.invalidateQueries({ queryKey: ["notif"] });
      toast.success(msg);
      if (fecharDetalhe && selected && selecionadas.has(selected)) setSelected(null);
      setSelecionadas(new Set());
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao aplicar ação em lote");
    } finally {
      setLoteBusy(false);
    }
  };

  const avisarIgnoradas = () => { if (naoDest > 0) toast.info(`${naoDest} ignoradas (você não é destinatário)`); };

  const acaoLida = () => {
    if (!comoDestinatario.length) { avisarIgnoradas(); return; }
    const n = comoDestinatario.length;
    executarLote(() => loteMarcarLida(comoDestinatario), `${plural(n)} ${n === 1 ? "marcada" : "marcadas"} como lida${n === 1 ? "" : "s"}`, false);
    avisarIgnoradas();
  };
  const acaoNaoLida = () => {
    if (!comoDestinatario.length) { avisarIgnoradas(); return; }
    const n = comoDestinatario.length;
    executarLote(() => loteMarcarNaoLida(comoDestinatario), `${plural(n)} ${n === 1 ? "marcada" : "marcadas"} como não lida${n === 1 ? "" : "s"}`, true);
    avisarIgnoradas();
  };
  const rodarArquivar = () => {
    const total = new Set([...comoDestinatario, ...comoCriador]).size;
    const verbo = emArquivadas ? (total === 1 ? "desarquivada" : "desarquivadas") : (total === 1 ? "arquivada" : "arquivadas");
    executarLote(() => loteArquivar(comoDestinatario, comoCriador, !emArquivadas), `${plural(total)} ${verbo}`, true);
  };
  const acaoArquivar = () => {
    if (!emArquivadas && comoCriador.length > 0) { setConfirmArq(true); return; }
    rodarArquivar();
  };
  const acaoFixar = () => {
    if (!comoDestinatario.length) { avisarIgnoradas(); return; }
    const alvo = todasFixadas ? comoDestinatario : comoDestinatario.filter((id) => !fixadaMap.has(id));
    const n = alvo.length;
    executarLote(() => loteFixar(alvo, !todasFixadas), `${plural(n)} ${todasFixadas ? (n === 1 ? "desafixada" : "desafixadas") : (n === 1 ? "fixada" : "fixadas")}`, false);
    avisarIgnoradas();
  };

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
          {selecionadas.size > 0 ? (
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-1 text-xs font-semibold">{selecionadas.size} {selecionadas.size === 1 ? "selecionada" : "selecionadas"}</span>
              {([
                { label: "Marcar como lida", icon: MailOpen, fn: acaoLida },
                { label: "Marcar como não lida", icon: Mail, fn: acaoNaoLida },
                emArquivadas
                  ? { label: "Desarquivar", icon: ArchiveRestore, fn: acaoArquivar }
                  : { label: "Arquivar", icon: Archive, fn: acaoArquivar },
                todasFixadas
                  ? { label: "Desafixar", icon: PinOff, fn: acaoFixar }
                  : { label: "Fixar", icon: Pin, fn: acaoFixar },
              ]).map((b) => (
                <button
                  key={b.label}
                  type="button"
                  title={b.label}
                  aria-label={b.label}
                  disabled={loteBusy}
                  onClick={b.fn}
                  className="flex h-7 w-7 items-center justify-center border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  <b.icon className="h-3.5 w-3.5" />
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSelecionadas(new Set(filtered.map((n) => n.id)))}
                className="ml-1 text-xs text-primary hover:underline"
              >
                Selecionar todas
              </button>
              <button
                type="button"
                title="Cancelar"
                aria-label="Cancelar seleção"
                onClick={() => setSelecionadas(new Set())}
                className="ml-auto flex h-7 items-center gap-1 border px-2 text-xs text-muted-foreground hover:bg-muted"
              >
                <X className="h-3.5 w-3.5" /> Cancelar
              </button>
            </div>
          ) : (
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
          )}
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
                  novas={
                    n.visualizado_em === null && n.ultima_leitura_em
                      ? contarNovasDepois(resumo[n.id], n.ultima_leitura_em)
                      : 0
                  }
                  destinatarios={mostraDestinatarios(n) ? destResumo?.[n.id] : undefined}
                  fixada={pasta !== "arquivadas" && fixadaMap.has(n.id)}
                  marcada={selecionadas.has(n.id)}
                  modoSelecao={selecionadas.size > 0}
                  onToggleMarcada={() => toggleMarcada(n.id)}
                  onClick={() => setSelected(n.id)}
                />
              ))}
            </div>
          ))}
        </div>
      </section>

      <div className="min-h-[70vh] overflow-hidden rounded-md border bg-card md:min-h-0">
        <NotificacaoDetail id={selected} onFechar={() => setSelected(null)} />
      </div>

      <AlertDialog open={confirmArq} onOpenChange={setConfirmArq}>
        <AlertDialogContent className="rounded-none">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {comoCriador.length === 1
                ? "Arquivar 1 conversa para todos os destinatários?"
                : `Arquivar ${comoCriador.length} conversas para todos os destinatários?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Conversas criadas por você serão arquivadas para todos. As demais selecionadas serão arquivadas só para você.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="rounded-none" onClick={() => { setConfirmArq(false); rodarArquivar(); }}>Arquivar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
