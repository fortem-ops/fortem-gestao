import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { VAPID_PUBLIC_KEY } from "@/lib/vapid";
import { estadoPushAparelho, type AmbientePush, type EstadoPushAparelho } from "@/lib/equipePush";

function chaveVapid(): ArrayBuffer {
  const padding = "=".repeat((4 - (VAPID_PUBLIC_KEY.length % 4)) % 4);
  const raw = window.atob((VAPID_PUBLIC_KEY + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(Array.from(raw), (c) => c.charCodeAt(0)).buffer;
}

function lerAmbiente(inscrito: boolean): AmbientePush {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return {
    temApis: "Notification" in window && "serviceWorker" in navigator && "PushManager" in window,
    ios: /(iPhone|iPad|iPod)/i.test(navigator.userAgent),
    standalone: window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true,
    permissao: "Notification" in window ? Notification.permission : "indisponivel",
    inscrito,
  };
}

export function useEquipePush() {
  const { user } = useAuth();
  const [estado, setEstado] = useState<EstadoPushAparelho>("desativado");
  const [carregando, setCarregando] = useState(false);

  const atualizar = useCallback(async () => {
    let inscrito = false;
    const amb = lerAmbiente(false);
    if (amb.temApis && user) {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        const { data } = await supabase.from("equipe_push_subscriptions").select("id").eq("endpoint", sub.endpoint).maybeSingle();
        inscrito = !!data;
      }
    }
    setEstado(estadoPushAparelho({ ...amb, inscrito }));
  }, [user]);

  useEffect(() => { void atualizar().catch(() => setEstado(estadoPushAparelho(lerAmbiente(false)))); }, [atualizar]);

  const ativar = useCallback(async () => {
    if (!user) return;
    setCarregando(true);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { toast.error("Permissão de notificação negada."); return; }
      const sub = (await reg.pushManager.getSubscription())
        ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveVapid() }));
      const j = sub.toJSON();
      const { error } = await supabase.from("equipe_push_subscriptions").upsert({
        user_id: user.id, endpoint: sub.endpoint, p256dh: j.keys?.p256dh ?? "", auth: j.keys?.auth ?? "",
        user_agent: navigator.userAgent.slice(0, 200),
      }, { onConflict: "endpoint" });
      if (error) throw error;
      toast.success("Notificações ativadas neste aparelho.");
    } catch (e) {
      toast.error("Não foi possível ativar: " + (e instanceof Error ? e.message : "erro"));
    } finally {
      setCarregando(false);
      void atualizar();
    }
  }, [user, atualizar]);

  const desativar = useCallback(async () => {
    setCarregando(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) await supabase.from("equipe_push_subscriptions").delete().eq("endpoint", sub.endpoint);
      toast.success("Notificações desativadas neste aparelho.");
    } catch (e) {
      toast.error("Não foi possível desativar: " + (e instanceof Error ? e.message : "erro"));
    } finally {
      setCarregando(false);
      void atualizar();
    }
  }, [atualizar]);

  return { estado, carregando, ativar, desativar };
}
