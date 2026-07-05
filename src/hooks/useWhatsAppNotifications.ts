import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export function useWhatsAppNotifications(enabled: boolean = true) {
  const location = useLocation();
  const navigate = useNavigate();
  const lastMessageId = useRef<string | null>(null);
  const pathRef = useRef(location.pathname);

  useEffect(() => {
    pathRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;

    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    const channel = supabase
      .channel("whatsapp-new-messages-notify")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "whatsapp_mensagens",
          filter: "direcao=eq.recebida",
        },
        async (payload) => {
          const msg = payload.new as any;

          if (msg.id === lastMessageId.current) return;
          lastMessageId.current = msg.id;

          if (pathRef.current.startsWith("/whatsapp")) return;
          if (Notification.permission !== "granted") return;

          const { data: conversa } = await supabase
            .from("whatsapp_conversas" as never)
            .select("nome_contato, telefone")
            .eq("id", msg.conversa_id)
            .maybeSingle();

          const contato =
            (conversa as any)?.nome_contato ||
            (conversa as any)?.telefone ||
            "Novo contato";
          const texto = msg.conteudo || "Nova mensagem";

          const notification = new Notification(`💬 ${contato}`, {
            body: texto.length > 80 ? texto.substring(0, 80) + "…" : texto,
            icon: "/favicon.ico",
            tag: `whatsapp-${msg.conversa_id}`,
            ...({ renotify: true } as any),
          });

          notification.onclick = () => {
            window.focus();
            navigate("/whatsapp");
            notification.close();
          };

          setTimeout(() => notification.close(), 6000);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, navigate]);
}
