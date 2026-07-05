import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export function useWhatsAppNotifications(enabled: boolean = true) {
  const navigate = useNavigate();
  const locationRef = useRef(useLocation().pathname);
  const lastMessageId = useRef<string | null>(null);

  // Mantém pathname atualizado sem re-subscribing
  const location = useLocation();
  useEffect(() => {
    locationRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;

    // Solicita permissão se ainda não foi decidido
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    const channel = supabase
      .channel("whatsapp-notifications-v2")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "whatsapp_mensagens",
        },
        async (payload) => {
          const msg = payload.new as any;

          // Só para mensagens recebidas
          if (msg.direcao !== "recebida") return;

          // Deduplicação
          if (msg.id === lastMessageId.current) return;
          lastMessageId.current = msg.id;

          // Não notifica se já está na página /whatsapp
          if (locationRef.current.startsWith("/whatsapp")) return;

          // Verifica permissão em runtime (pode ter sido concedida depois)
          if (Notification.permission !== "granted") return;

          // Busca nome do contato
          const { data: conversa } = await supabase
            .from("whatsapp_conversas" as never)
            .select("nome_contato, telefone")
            .eq("id", msg.conversa_id)
            .maybeSingle();

          const contato =
            (conversa as any)?.nome_contato ||
            (conversa as any)?.telefone ||
            "WhatsApp Fortem";
          const texto = msg.conteudo || "Nova mensagem";
          const body = texto.length > 100 ? texto.substring(0, 100) + "…" : texto;

          try {
            const notification = new Notification(`💬 ${contato}`, {
              body,
              icon: "/favicon.ico",
              tag: `whatsapp-${msg.conversa_id}`,
            });

            notification.onclick = () => {
              window.focus();
              navigate("/whatsapp");
              notification.close();
            };

            setTimeout(() => notification.close(), 6000);
          } catch (e) {
            console.error("[WhatsApp Notification] erro:", e);
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
