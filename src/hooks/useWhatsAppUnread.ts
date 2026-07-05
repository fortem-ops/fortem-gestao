import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useWhatsAppUnread(enabled: boolean = true) {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    let active = true;

    const fetchTotal = async () => {
      const { data } = await supabase
        .from("whatsapp_conversas" as never)
        .select("nao_lidas");
      if (!active) return;
      const sum = (data ?? []).reduce(
        (acc: number, c: any) => acc + (c.nao_lidas ?? 0),
        0,
      );
      setTotal(sum);
    };

    fetchTotal();

    const channel = supabase
      .channel("whatsapp-unread-badge")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_conversas" },
        () => fetchTotal(),
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [enabled]);

  return total;
}
