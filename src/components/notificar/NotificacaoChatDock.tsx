import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifChat } from "@/contexts/NotifChatContext";
import { NotificacaoChatWindow } from "./NotificacaoChatWindow";
import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NotificacaoChatDock() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { openChats, minimizedChats, openChat, expand, dismiss } = useNotifChat();

  // Realtime: open chat on new notifications received
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`notif-dock-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notificacao_destinatarios", filter: `usuario_id=eq.${user.id}` },
        (payload: any) => {
          const notifId = payload.new?.notificacao_id;
          if (notifId) openChat(notifId);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notificacoes" },
        (payload: any) => {
          const status = payload.new?.status;
          const id = payload.new?.id;
          if (id && (status === "concluida" || status === "arquivada")) {
            dismiss(id);
            qc.invalidateQueries({ queryKey: ["notif"] });
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, openChat, dismiss, qc]);

  // titles for minimized pills
  const ids = [...openChats, ...minimizedChats];
  const { data: titles = {} } = useQuery({
    queryKey: ["notif-titles", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("notificacoes").select("id,titulo,status").in("id", ids);
      const map: Record<string, { titulo: string; status: string }> = {};
      (data ?? []).forEach((r: any) => { map[r.id] = { titulo: r.titulo, status: r.status }; });
      return map;
    },
  });

  // auto-dismiss any chat already closed/archived
  useEffect(() => {
    Object.entries(titles).forEach(([id, t]) => {
      if (t.status === "concluida" || t.status === "arquivada") dismiss(id);
    });
  }, [titles, dismiss]);

  if (!user) return null;

  return (
    <>
      {openChats.map((id, idx) => {
        if (onNotificarPage) return null; // avoid duplicating UI on the page itself
        return <NotificacaoChatWindow key={id} id={id} offsetIndex={idx} />;
      })}
      {minimizedChats.length > 0 && !onNotificarPage && (
        <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2 max-w-xs">
          {minimizedChats.map((id) => (
            <div key={id} className="flex items-center gap-2 bg-card border border-border rounded-full shadow-lg pl-3 pr-1 py-1">
              <MessageCircle className="w-3.5 h-3.5 text-primary shrink-0" />
              <button
                onClick={() => expand(id)}
                className="text-xs font-medium truncate max-w-[180px] hover:underline"
                title={titles[id]?.titulo}
              >
                {titles[id]?.titulo ?? "Notificação"}
              </button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => dismiss(id)}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
