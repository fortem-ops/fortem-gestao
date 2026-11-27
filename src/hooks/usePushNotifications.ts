import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStudentPortal } from "@/contexts/StudentPortalContext";
import { toast } from "sonner";
import { VAPID_PUBLIC_KEY } from "@/lib/vapid";

function urlBase64ToUint8Array(value: string): Uint8Array {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const raw = window.atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(Array.from(raw), (c) => c.charCodeAt(0));
}

export function usePushNotifications() {
  const { student } = useStudentPortal();
  const qc = useQueryClient();
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isLoading, setIsLoading] = useState(false);
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const needsInstall = isIOS && !isStandalone;
  const isSupported = "Notification" in window && "serviceWorker" in navigator && "PushManager" in window && !needsInstall;
  const key = ["portal-push-aparelho", student?.id];

  useEffect(() => {
    const refresh = () => { if ("Notification" in window) setPermission(Notification.permission); };
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  const subscription = useQuery({
    queryKey: key,
    enabled: isSupported && !!student,
    queryFn: async () => {
      if (!student || Notification.permission !== "granted") return false;
      const registration = await navigator.serviceWorker.getRegistration("/");
      const sub = await registration?.pushManager.getSubscription();
      if (!sub) return false;
      const { data, error } = await supabase.from("portal_push_subscriptions")
        .select("id").eq("endpoint", sub.endpoint).eq("aluno_id", student.id).maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });

  const subscribe = useCallback(async () => {
    if (!student || !isSupported || Notification.permission === "denied") return;
    setIsLoading(true);
    try {
      // Solicitar no próprio gesto do usuário, antes de qualquer espera assíncrona (iOS).
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return;
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const keyArray = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const sub = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyArray.buffer.slice(keyArray.byteOffset, keyArray.byteOffset + keyArray.byteLength) as ArrayBuffer,
      });
      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error("Inscrição incompleta");
      const { error } = await supabase.from("portal_push_subscriptions").upsert({
        aluno_id: student.id, endpoint: json.endpoint, p256dh: json.keys.p256dh,
        auth: json.keys.auth, user_agent: navigator.userAgent.slice(0, 200),
      }, { onConflict: "endpoint" });
      if (error) throw error;
      qc.setQueryData(["portal-push-aparelho", student.id], true);
      toast.success("Notificações ativadas.");
    } catch (e: unknown) {
      toast.error("Erro ao ativar notificações: " + (e instanceof Error ? e.message : "Tente novamente mais tarde."));
    } finally { setIsLoading(false); }
  }, [student, isSupported, qc]);

  const unsubscribe = useCallback(async () => {
    if (!student || !isSupported) return;
    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const sub = await registration?.pushManager.getSubscription();
      if (sub) {
        const { error } = await supabase.from("portal_push_subscriptions").delete().eq("endpoint", sub.endpoint).eq("aluno_id", student.id);
        if (error) throw error;
        await sub.unsubscribe();
      }
      qc.setQueryData(["portal-push-aparelho", student.id], false);
      toast.success("Notificações desativadas.");
    } catch (e: unknown) {
      toast.error("Erro ao desativar: " + (e instanceof Error ? e.message : "Tente novamente mais tarde."));
    } finally { setIsLoading(false); }
  }, [student, isSupported, qc]);

  return { isSupported, needsInstall, permission, isSubscribed: subscription.data === true,
    isChecking: isSupported && !!student && subscription.isPending, isLoading, subscribe, unsubscribe };
}
