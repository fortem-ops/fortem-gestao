import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useWhatsAppUnread(enabled: boolean = true) {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const fetchTotal = async () => {
      // Só as conversas com mensagens não lidas (antes baixava todas a cada evento).
      const { data } = await supabase
        .from("whatsapp_conversas" as never)
        .select("nao_lidas")
        .gt("nao_lidas" as never, 0 as never);
      if (!active) return;
      const sum = (data ?? []).reduce(
        (acc: number, c: any) => acc + (c.nao_lidas ?? 0),
        0,
      );
      setTotal(sum);
    };

    // Agrupa rajadas de eventos (várias mensagens/atualizações seguidas) numa única busca.
    const scheduleFetch = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(fetchTotal, 800);
    };

    fetchTotal();

    const channel = supabase
      .channel("whatsapp-unread-badge")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_conversas" },
        scheduleFetch,
      )
      .subscribe();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [enabled]);

  return total;
}
