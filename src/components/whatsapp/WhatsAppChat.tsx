import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Send, Search, Bell, BellOff } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { setConversaAberta, somLigado, setSomLigado, tocarBeep } from "@/lib/whatsappEstado";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { separarReacoes, chaveTelefone, iniciais, indicePrimeiraNaoLida } from "@/lib/whatsappChat";

type Conversa = {
  id: string;
  telefone: string;
  nome_contato: string | null;
  ultima_mensagem: string | null;
  ultima_mensagem_at: string | null;
  nao_lidas: number;
};

type Mensagem = {
  id: string;
  conversa_id: string;
  direcao: "enviada" | "recebida";
  tipo: string;
  conteudo: string | null;
  status: string;
  created_at: string;
  enviado_por: string | null;
  wamid: string | null;
  reacao_a_wamid: string | null;
  media_id: string | null;
};

type ProfileInfo = { full_name: string | null; avatar_url: string | null };

function formatPhone(t: string) {
  const d = t.replace(/\D/g, "");
  if (d.length === 13) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 12) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  return t;
}

function formatTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function WhatsAppChat() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(params.get("c"));
  const [som, setSom] = useState(somLigado());
  useEffect(() => {
    const c = params.get("c");
    if (c) { setSelectedId(c); params.delete("c"); setParams(params, { replace: true }); }
  }, [params, setParams]);
  useEffect(() => { setConversaAberta(selectedId); return () => setConversaAberta(null); }, [selectedId]);
  const [search, setSearch] = useState("");
  const [soNaoLidas, setSoNaoLidas] = useState(false);
  const [naoLidasAoAbrir, setNaoLidasAoAbrir] = useState<{ id: string; n: number } | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const conversasQuery = useQuery({
    queryKey: ["whatsapp-conversas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_conversas" as never)
        .select("*")
        .order("ultima_mensagem_at", { ascending: false, nullsFirst: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as Conversa[];
    },
  });

  const mensagensQuery = useQuery({
    queryKey: ["whatsapp-mensagens", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_mensagens" as never)
        .select("*")
        .eq("conversa_id", selectedId!)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as Mensagem[];
    },
  });

  const alunosQuery = useQuery({
    queryKey: ["whatsapp-alunos-mapa"],
    queryFn: async () => {
      const { data } = await supabase.from("alunos").select("nome, telefone, foto_url").not("telefone", "is", null).limit(5000);
      const map: Record<string, { nome: string; foto: string | null }> = {};
      (data ?? []).forEach((a: any) => {
        const k = chaveTelefone(a.telefone);
        if (k && !map[k]) map[k] = { nome: a.nome, foto: a.foto_url ?? null };
      });
      return map;
    },
    staleTime: 10 * 60 * 1000,
  });

  const midiaIds = useMemo(
    () => (mensagensQuery.data ?? []).filter((m) => m.media_id).map((m) => m.id),
    [mensagensQuery.data],
  );
  const midiaQuery = useQuery({
    queryKey: ["whatsapp-midia", midiaIds.join(",")],
    enabled: midiaIds.length > 0,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("whatsapp-midia", { body: { ids: midiaIds } });
      return ((data as any)?.urls ?? {}) as Record<string, string>;
    },
  });

  const contato = (c: Conversa) => {
    const a = alunosQuery.data?.[chaveTelefone(c.telefone) ?? ""];
    return { nome: a?.nome ?? c.nome_contato ?? formatPhone(c.telefone), foto: a?.foto ?? null };
  };

  const profilesQuery = useQuery({
    queryKey: ["profiles-map-whatsapp"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles" as never)
        .select("user_id, full_name, avatar_url");
      const map: Record<string, ProfileInfo> = {};
      (data ?? []).forEach((p: any) => {
        if (p?.user_id) map[p.user_id] = { full_name: p.full_name ?? null, avatar_url: p.avatar_url ?? null };
      });
      return map;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Realtime: conversas (rajadas de eventos agrupadas numa única recarga da lista)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const ch = supabase
      .channel("whatsapp_conversas_ch")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_conversas" },
        () => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => qc.invalidateQueries({ queryKey: ["whatsapp-conversas"] }), 500);
        },
      )
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(ch);
    };
  }, [qc]);

  // Realtime: mensagens
  useEffect(() => {
    if (!selectedId) return;
    const ch = supabase
      .channel(`whatsapp_mensagens_${selectedId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_mensagens",
          filter: `conversa_id=eq.${selectedId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["whatsapp-mensagens", selectedId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [selectedId, qc]);

  // Zerar não lidas ao abrir — só grava se houver não lidas (evita escrita + evento realtime à toa).
  // O realtime da lista já recarrega as conversas depois da gravação.
  useEffect(() => {
    if (!selectedId) return;
    const conv = (qc.getQueryData<Conversa[]>(["whatsapp-conversas"]) ?? []).find((c) => c.id === selectedId);
    if (conv && !((conv as any).nao_lidas > 0)) return;
    setNaoLidasAoAbrir({ id: selectedId, n: conv?.nao_lidas ?? 0 });
    supabase
      .from("whatsapp_conversas" as never)
      .update({ nao_lidas: 0 } as never)
      .eq("id", selectedId)
      .then(() => {});
  }, [selectedId, qc]);

  // Scroll bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagensQuery.data]);

  const conversas = conversasQuery.data ?? [];
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const base = soNaoLidas ? conversas.filter((c) => c.nao_lidas > 0 || c.id === selectedId) : conversas;
    if (!s) return base;
    return base.filter(
      (c) =>
        c.telefone.toLowerCase().includes(s) ||
        (c.nome_contato ?? "").toLowerCase().includes(s) ||
        (alunosQuery.data?.[chaveTelefone(c.telefone) ?? ""]?.nome ?? "").toLowerCase().includes(s),
    );
  }, [conversas, search, soNaoLidas, selectedId, alunosQuery.data]);
  const totalNaoLidas = conversas.filter((c) => c.nao_lidas > 0).length;
  const { linha, reacoes } = useMemo(() => separarReacoes(mensagensQuery.data ?? []), [mensagensQuery.data]);
  const idxNaoLida = naoLidasAoAbrir && naoLidasAoAbrir.id === selectedId ? indicePrimeiraNaoLida(linha, naoLidasAoAbrir.n) : -1;

  const selected = conversas.find((c) => c.id === selectedId) ?? null;

  const handleSend = async () => {
    if (!selected || !draft.trim() || sending) return;
    setSending(true);
    const rawText = draft.trim();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const myProfile = user?.id ? profilesQuery.data?.[user.id] : null;
      const nomeFuncionario = myProfile?.full_name?.trim() || null;
      const text = nomeFuncionario ? `*${nomeFuncionario}:*\n\n${rawText}` : rawText;
      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: {
          to: selected.telefone,
          type: "text",
          text,
          enviado_por: user?.id ?? null,
        },
      });
      if (error) throw error;
      if (data && typeof data === "object" && "error" in (data as any)) {
        throw new Error((data as any).error ?? "Falha ao enviar");
      }
      setDraft("");
      await new Promise((resolve) => setTimeout(resolve, 500));
      await qc.invalidateQueries({ queryKey: ["whatsapp-mensagens", selectedId] });
      await qc.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
    } catch (err) {
      toast.error((err as Error).message ?? "Falha ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100vh-14rem)] min-h-[500px]">
      {/* Lista de conversas */}
      <div className="md:col-span-1 flex flex-col border border-border rounded-lg bg-card overflow-hidden">
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou número"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex gap-1 mt-2">
            <Button size="sm" variant="ghost" className="h-7 text-xs ml-auto order-last gap-1" title="Som de nova mensagem"
              onClick={() => { const v = !som; setSom(v); setSomLigado(v); if (v) tocarBeep(); }}>
              {som ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}{som ? "Som ligado" : "Som desligado"}
            </Button>
            <Button size="sm" variant={soNaoLidas ? "outline" : "secondary"} className="h-7 text-xs" onClick={() => setSoNaoLidas(false)}>Todas</Button>
            <Button size="sm" variant={soNaoLidas ? "secondary" : "outline"} className="h-7 text-xs" onClick={() => setSoNaoLidas(true)}>
              Não lidas{totalNaoLidas > 0 ? ` (${totalNaoLidas})` : ""}
            </Button>
          </div>
        </div>
        <ScrollArea className="flex-1">
          {conversasQuery.isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10 px-4">
              Nenhuma conversa ainda.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((c) => {
                const isActive = c.id === selectedId;
                const ct = contato(c);
                const label = ct.nome;
                const temNova = c.nao_lidas > 0;
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => setSelectedId(c.id)}
                      className={cn(
                        "w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors flex items-center gap-3",
                        isActive && "bg-muted",
                      )}
                    >
                      <Avatar nome={label} foto={ct.foto} />
                      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn("text-sm truncate", temNova ? "font-bold" : "font-medium")}>{label}</span>
                        <span className={cn("text-[10px] shrink-0", temNova ? "text-primary font-semibold" : "text-muted-foreground")}>
                          {formatTime(c.ultima_mensagem_at)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn("text-xs truncate", temNova ? "text-foreground font-semibold" : "text-muted-foreground")}>
                          {c.ultima_mensagem ?? "—"}
                        </span>
                        {c.nao_lidas > 0 && (
                          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold">
                            {c.nao_lidas > 99 ? "99+" : c.nao_lidas}
                          </span>
                        )}
                      </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </div>

      {/* Mensagens */}
      <div className="md:col-span-2 flex flex-col border border-border rounded-lg bg-card overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Selecione uma conversa para começar
          </div>
        ) : (
          <>
            <div className="p-3 border-b border-border flex items-center gap-3">
              <Avatar nome={contato(selected).nome} foto={contato(selected).foto} />
              <div>
                <div className="font-medium">{contato(selected).nome}</div>
                <div className="text-xs text-muted-foreground">{formatPhone(selected.telefone)}</div>
              </div>
            </div>
            <ScrollArea className="flex-1 p-4">
              {mensagensQuery.isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-2">
                  {linha.map((m, i) => {
                    const enviada = m.direcao === "enviada";
                    const emojis = m.wamid ? reacoes[m.wamid] : undefined;
                    const url = midiaQuery.data?.[m.id];
                    return (
                      <div key={m.id}>
                      {i === idxNaoLida && (
                        <div className="flex items-center gap-2 my-3 text-[11px] font-semibold text-primary">
                          <div className="flex-1 h-px bg-primary/40" />Mensagens não lidas<div className="flex-1 h-px bg-primary/40" />
                        </div>
                      )}
                      <div
                        className={cn("flex flex-col", enviada ? "items-end" : "items-start")}
                      >
                        <div
                          className={cn(
                            "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                            enviada
                              ? "bg-primary text-primary-foreground rounded-br-sm"
                              : "bg-muted text-foreground rounded-bl-sm",
                          )}
                        >
                          {m.media_id && (
                            url ? (
                              <a href={url} target="_blank" rel="noreferrer">
                                <img src={url} alt={m.tipo === "sticker" ? "Figurinha" : "Foto"} loading="lazy"
                                  className={cn("rounded-lg", m.tipo === "sticker" ? "w-40 h-40 object-contain" : "max-w-full max-h-72 object-cover")} />
                              </a>
                            ) : (
                              <div className="text-xs opacity-70 italic">{m.tipo === "sticker" ? "Figurinha" : "Foto"} {midiaQuery.isLoading ? "carregando…" : "indisponível"}</div>
                            )
                          )}
                          {(m.conteudo || !m.media_id) && (
                            <div className="whitespace-pre-wrap break-words">
                              {m.conteudo || `[${m.tipo}]`}
                            </div>
                          )}
                          <div
                            className={cn(
                              "text-[10px] mt-1 opacity-70",
                              enviada ? "text-right" : "text-left",
                            )}
                          >
                            {new Date(m.created_at).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                        {emojis && (
                          <div className="-mt-2 px-2 py-0.5 rounded-full bg-card border border-border text-sm shadow-sm relative">{emojis.join(" ")}</div>
                        )}
                        {enviada && m.enviado_por && profilesQuery.data?.[m.enviado_por]?.full_name && (
                          <div className="text-[10px] opacity-60 mt-0.5 text-right pr-1">
                            {profilesQuery.data[m.enviado_por].full_name}
                          </div>
                        )}
                      </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>
            <div className="p-3 border-t border-border flex gap-2">
              <Input
                placeholder="Digite uma mensagem"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={sending}
              />
              <Button onClick={handleSend} disabled={sending || !draft.trim()} className="gap-2">
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Enviar
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Avatar({ nome, foto }: { nome: string; foto: string | null }) {
  return foto ? (
    <img src={foto} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" loading="lazy" />
  ) : (
    <div className="w-9 h-9 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-semibold shrink-0">
      {iniciais(nome)}
    </div>
  );
}
