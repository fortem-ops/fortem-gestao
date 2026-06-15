import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Paperclip, Send, X, Minus, Maximize2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { addComentario, getAnexoUrl, markVisualizada } from "@/lib/notificar";
import { useNotificacaoDetail } from "@/hooks/useNotificacoes";
import { PrioridadeBadge } from "./NotificacaoBadge";
import { useNotifChat } from "@/contexts/NotifChatContext";

export function NotificacaoChatWindow({ id, offsetIndex }: { id: string; offsetIndex: number }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { minimize, dismiss } = useNotifChat();
  const { data, isLoading } = useNotificacaoDetail(id);
  const [comentario, setComentario] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // mark as viewed when opening
  useEffect(() => {
    if (id && user) {
      markVisualizada(id, user.id).then(() => qc.invalidateQueries({ queryKey: ["notif"] }));
    }
  }, [id, user, qc]);

  // realtime: new comments for this notification
  useEffect(() => {
    if (!id) return;
    const ch = supabase
      .channel(`notif-chat-${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notificacao_comentarios", filter: `notificacao_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["notif", "detail", id] })
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  // auto-dismiss if closed/archived
  useEffect(() => {
    const status = (data?.notif as any)?.status;
    if (status === "concluida" || status === "arquivada") dismiss(id);
  }, [data, id, dismiss]);

  // autoscroll to bottom on new messages
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [data?.coments?.length]);

  const { data: profileMap = {} } = useQuery({
    queryKey: ["profiles-map"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id,full_name");
      const map: Record<string, string> = {};
      (data ?? []).forEach((p) => { map[p.user_id] = p.full_name; });
      return map;
    },
  });

  const sendMut = useMutation({
    mutationFn: async () => {
      if (!id || (!comentario.trim() && !file)) return;
      await addComentario({ notificacaoId: id, comentario: comentario.trim() || "(anexo)", anexo: file });
    },
    onSuccess: () => {
      setComentario(""); setFile(null);
      qc.invalidateQueries({ queryKey: ["notif", "detail", id] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao enviar"),
  });

  const n = data?.notif as any;

  return (
    <div
      className="fixed bottom-4 right-2 sm:right-4 z-50 w-[calc(100vw-1rem)] max-w-[320px] h-[60vh] max-h-[420px] bg-card border border-border rounded-lg shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 sm:w-80"
      style={{ right: `${8 + offsetIndex * 12}px`, ['--offset' as any]: offsetIndex }}
    >
      <div className="px-3 py-2 border-b bg-muted/40 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{n?.titulo ?? "Carregando..."}</div>
          {n && <div className="flex items-center gap-1"><PrioridadeBadge prioridade={n.prioridade} /></div>}
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate("/notificar")} title="Abrir página">
          <Maximize2 className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => minimize(id)} title="Minimizar">
          <Minus className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => dismiss(id)} title="Fechar">
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="p-3 space-y-2">
          {isLoading && <p className="text-xs text-muted-foreground text-center">Carregando...</p>}
          {n && (
            <div className="text-xs bg-muted/40 rounded p-2 whitespace-pre-wrap">{n.descricao}</div>
          )}
          {(data?.coments ?? []).map((c: any) => (
            <ChatBubble key={c.id} c={c} mine={c.usuario_id === user?.id} authorName={profileMap[c.usuario_id]} />
          ))}
        </div>
      </ScrollArea>

      <div className="p-2 border-t space-y-1">
        {file && (
          <div className="flex items-center gap-1 text-[11px] bg-muted px-2 py-1 rounded">
            <Paperclip className="w-3 h-3" /><span className="truncate flex-1">{file.name}</span>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setFile(null)}><X className="w-3 h-3" /></Button>
          </div>
        )}
        <div className="flex items-center gap-1">
          <label className="cursor-pointer">
            <input type="file" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild><span><Paperclip className="w-4 h-4" /></span></Button>
          </label>
          <Input
            className="h-8 text-sm"
            placeholder="Mensagem..."
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMut.mutate(); } }}
          />
          <Button size="icon" className="h-8 w-8" onClick={() => sendMut.mutate()} disabled={sendMut.isPending}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ c, mine, authorName }: { c: any; mine: boolean; authorName?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (c.anexo_url) getAnexoUrl(c.anexo_url).then((u) => setUrl(u ?? null));
  }, [c.anexo_url]);

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-xs ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
        {!mine && <div className="text-[10px] font-semibold opacity-80 mb-0.5">{(authorName ?? "—").split(" ")[0]}</div>}
        <div className="whitespace-pre-wrap">{c.comentario}</div>
        {url && (
          <a href={url} target="_blank" rel="noreferrer" className="text-[10px] underline block mt-0.5">📎 {c.anexo_nome ?? "Anexo"}</a>
        )}
        <div className="text-[9px] opacity-70 mt-0.5">{format(new Date(c.created_at), "dd/MM HH:mm", { locale: ptBR })}</div>
      </div>
    </div>
  );
}
