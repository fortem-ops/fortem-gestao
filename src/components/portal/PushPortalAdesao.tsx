import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { calcularAdesaoPush } from "@/hooks/portalPushAdesao";

export function PushPortalAdesao({ enabled }: { enabled: boolean }) {
  const adesao = useQuery({
    queryKey: ["portal-push-adesao"], enabled, refetchInterval: 60_000,
    queryFn: async () => {
      const ativos: string[] = [];
      const inscritos: string[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase.from("alunos").select("id").eq("status", "ativo").order("id").range(offset, offset + 999);
        if (error) throw error;
        ativos.push(...(data ?? []).map(a => a.id));
        if ((data?.length ?? 0) < 1000) break;
      }
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase.from("portal_push_subscriptions").select("aluno_id").order("id").range(offset, offset + 999);
        if (error) throw error;
        inscritos.push(...(data ?? []).map(s => s.aluno_id));
        if ((data?.length ?? 0) < 1000) break;
      }
      return calcularAdesaoPush(ativos, inscritos);
    },
  });
  return <section className="border-b border-border py-4 space-y-1" aria-label="Adesão ao push do portal">
    <h2 className="text-base font-bold">Notificações dos alunos</h2>
    {adesao.isPending ? <p className="text-sm text-muted-foreground">Consultando adesão...</p> : adesao.isError ? <p className="text-sm text-destructive">Não foi possível consultar a adesão.</p> : <p className="text-sm text-foreground">{adesao.data.quantidade} de {adesao.data.total} alunos ativos com push ativo ({adesao.data.percentual.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%)</p>}
  </section>;
}
