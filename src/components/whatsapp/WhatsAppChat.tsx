import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Send, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

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
};

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
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

  // Realtime: conversas
  useEffect(() => {
    const ch = supabase
      .channel("whatsapp_conversas_ch")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_conversas" },
        () => qc.invalidateQueries({ queryKey: ["whatsapp-conversas"] }),
      )
      .subscribe();
    return () => {
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

  // Zerar não lidas ao abrir
  useEffect(() => {
    if (!selectedId) return;
    supabase
      .from("whatsapp_conversas" as never)
      .update({ nao_lidas: 0 } as never)
      .eq("id", selectedId)
      .then(({ error }) => {
        if (!error) qc.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
      });
  }, [selectedId, qc]);

  // Scroll bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagensQuery.data]);

  const conversas = conversasQuery.data ?? [];
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return conversas;
    return conversas.filter(
      (c) =>
        c.telefone.toLowerCase().includes(s) ||
        (c.nome_contato ?? "").toLowerCase().includes(s),
    );
  }, [conversas, search]);

  const selected = conversas.find((c) => c.id === selectedId) ?? null;

  const handleSend = async () => {
    if (!selected || !draft.trim() || sending) return;
    setSending(true);
    const text = draft.trim();
    try {
      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: {
          to: selected.telefone,
          type: "text",
          text,
        },
      });
      if (error) throw error;
      if (data && typeof data === "object" && "error" in (data as any)) {
        throw new Error((data as any).error ?? "Falha ao enviar");
      }
      setDraft("");
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
                const label = c.nome_contato ?? formatPhone(c.telefone);
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => setSelectedId(c.id)}
                      className={cn(
                        "w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors flex flex-col gap-0.5",
                        isActive && "bg-muted",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm truncate">{label}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {formatTime(c.ultima_mensagem_at)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground truncate">
                          {c.ultima_mensagem ?? "—"}
                        </span>
                        {c.nao_lidas > 0 && (
                          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold">
                            {c.nao_lidas > 99 ? "99+" : c.nao_lidas}
                          </span>
                        )}
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
            <div className="p-3 border-b border-border">
              <div className="font-medium">
                {selected.nome_contato ?? formatPhone(selected.telefone)}
              </div>
              {selected.nome_contato && (
                <div className="text-xs text-muted-foreground">
                  {formatPhone(selected.telefone)}
                </div>
              )}
            </div>
            <ScrollArea className="flex-1 p-4">
              {mensagensQuery.isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-2">
                  {(mensagensQuery.data ?? []).map((m) => {
                    const enviada = m.direcao === "enviada";
                    return (
                      <div
                        key={m.id}
                        className={cn("flex", enviada ? "justify-end" : "justify-start")}
                      >
                        <div
                          className={cn(
                            "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                            enviada
                              ? "bg-primary text-primary-foreground rounded-br-sm"
                              : "bg-muted text-foreground rounded-bl-sm",
                          )}
                        >
                          <div className="whitespace-pre-wrap break-words">
                            {m.conteudo ?? `[${m.tipo}]`}
                          </div>
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
