import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export function useWhatsAppNotifications(enabled: boolean = true) {
  const navigate = useNavigate();
  const lastMessageId = useRef<string | null>(null);
  const location = useLocation();
  const locationRef = useRef(location.pathname);

  useEffect(() => {
    locationRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    console.log("[WhatsApp Notification] hook iniciado, enabled:", enabled);
    console.log("[WhatsApp Notification] permissão:", typeof window !== "undefined" ? Notification.permission : "N/A");

    if (!enabled) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;

    if (Notification.permission === "default") {
      Notification.requestPermission().then(p => {
        console.log("[WhatsApp Notification] permissão concedida:", p);
      });
    }

    const channel = supabase
      .channel("whatsapp-notifications-v3")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "whatsapp_mensagens",
        },
        async (payload) => {
          console.log("[WhatsApp Notification] evento recebido:", payload.new);
          const msg = payload.new as any;

          if (msg.direcao !== "recebida") return;
          if (msg.id === lastMessageId.current) return;
          lastMessageId.current = msg.id;
          if (locationRef.current.startsWith("/whatsapp")) return;
          if (Notification.permission !== "granted") return;

          const { data: conversa } = await supabase
            .from("whatsapp_conversas" as never)
            .select("nome_contato, telefone")
            .eq("id", msg.conversa_id)
            .maybeSingle();

          const contato = (conversa as any)?.nome_contato || (conversa as any)?.telefone || "WhatsApp Fortem";
          const texto = msg.conteudo || "Nova mensagem";
          const body = texto.length > 100 ? texto.substring(0, 100) + "…" : texto;

          console.log("[WhatsApp Notification] disparando notificação para:", contato);

          try {
            const notification = new Notification(`💬 ${contato}`, { body });
            notification.onclick = () => {
              window.focus();
              navigate("/whatsapp");
              notification.close();
            };
            setTimeout(() => notification.close(), 6000);
          } catch (e) {
            console.error("[WhatsApp Notification] erro ao criar notificação:", e);
          }
        }
      )
      .subscribe((status) => {
        console.log("[WhatsApp Notification] channel status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, navigate]);
}
