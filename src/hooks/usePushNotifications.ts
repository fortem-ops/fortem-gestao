import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStudentPortal } from "@/contexts/StudentPortalContext";
import { toast } from "sonner";
import { VAPID_PUBLIC_KEY } from "@/lib/vapid";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(Array.from(raw), (c) => c.charCodeAt(0));
}

export function usePushNotifications() {
  const { student } = useStudentPortal();
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window;
    setIsSupported(supported);
    if (supported) setPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (!isSupported || !student) return;
    navigator.serviceWorker.ready
      .then(async (registration) => {
        const sub = await registration.pushManager.getSubscription();
        setIsSubscribed(!!sub);
      })
      .catch(() => setIsSubscribed(false));
  }, [isSupported, student]);

  const subscribe = useCallback(async () => {
    if (!student || !isSupported) return;
    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;

      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        toast.error("Permissão de notificação negada.");
        return;
      }

      const keyArray = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyArray.buffer.slice(
          keyArray.byteOffset,
          keyArray.byteOffset + keyArray.byteLength,
        ) as ArrayBuffer,
      });

      const subJson = subscription.toJSON();
      const { error } = await (supabase as any)
        .from("portal_push_subscriptions")
        .upsert(
          {
            aluno_id: student.id,
            endpoint: subJson.endpoint,
            p256dh: (subJson.keys as any)?.p256dh ?? "",
            auth: (subJson.keys as any)?.auth ?? "",
            user_agent: navigator.userAgent.slice(0, 200),
          },
          { onConflict: "endpoint" }
        );

      if (error) throw error;
      setIsSubscribed(true);
      toast.success("Notificações ativadas! ✓");
    } catch (e: any) {
      console.error("Push subscribe error:", e);
      toast.error("Erro ao ativar notificações: " + e.message);
    } finally {
      setIsLoading(false);
    }
  }, [student, isSupported]);

  const unsubscribe = useCallback(async () => {
    if (!student) return;
    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await (supabase as any)
          .from("portal_push_subscriptions")
          .delete()
          .eq("endpoint", sub.endpoint);
      }
      setIsSubscribed(false);
      toast.success("Notificações desativadas.");
    } catch (e: any) {
      toast.error("Erro ao desativar: " + e.message);
    } finally {
      setIsLoading(false);
    }
  }, [student]);

  return { isSupported, permission, isSubscribed, isLoading, subscribe, unsubscribe };
}
