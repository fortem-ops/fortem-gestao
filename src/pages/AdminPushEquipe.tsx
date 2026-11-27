import { PushPortalAdesao } from "@/components/portal/PushPortalAdesao";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUserRoles } from "@/hooks/useUserRoles";
import type { Tables } from "@/integrations/supabase/types";

type Linha = Pick<Tables<"equipe_push_log">, "id" | "user_id" | "gatilho" | "titulo" | "status" | "erro" | "criado_em" | "enviado_em">;

const fmt = (s: string | null) => (s ? new Date(s).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—");

export default function AdminPushEquipe() {
  const { data: roles } = useUserRoles();
  const qc = useQueryClient();
  const log = useQuery({
    queryKey: ["equipe-push-log"],
    enabled: !!roles?.isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("equipe_push_log")
        .select("id, user_id, gatilho, titulo, status, erro, criado_em, enviado_em")
        .order("criado_em", { ascending: false }).limit(100);
      if (error) throw error;
      const linhas = (data ?? []) as Linha[];
      const ids = [...new Set(linhas.map((l) => l.user_id))];
      const { data: perfis } = ids.length
        ? await supabase.from("profiles").select("user_id, full_name").in("user_id", ids)
        : { data: [] };
      const nomes = new Map((perfis ?? []).map((p) => [p.user_id, p.full_name]));
      return linhas.map((l) => ({ ...l, nome: nomes.get(l.user_id) ?? "—" }));
    },
  });
  const teste = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("send-push-equipe", { body: { acao: "teste" } });
      if (error) throw error;
      return data as { novos?: number };
    },
    onSuccess: () => { toast.success("Teste enviado. Confira o celular."); void qc.invalidateQueries({ queryKey: ["equipe-push-log"] }); },
    onError: (e: Error) => toast.error("Falha no teste: " + e.message),
  });

  if (roles && !roles.isAdmin) return <p className="text-muted-foreground">Área só para admin.</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Push da equipe</h1>
        <Button onClick={() => teste.mutate()} disabled={teste.isPending}>Enviar teste para mim</Button>
      </div>
      <PushPortalAdesao enabled={!!roles?.isAdmin} />
      <Card>
        <CardHeader><CardTitle className="text-base">Últimos 100 envios</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr><th className="py-2 pr-3">Quando</th><th className="pr-3">Para</th><th className="pr-3">Gatilho</th><th className="pr-3">Título</th><th className="pr-3">Situação</th><th>Erro</th></tr>
            </thead>
            <tbody>
              {(log.data ?? []).map((l) => (
                <tr key={l.id} className="border-t border-border">
                  <td className="py-2 pr-3 whitespace-nowrap">{fmt(l.enviado_em ?? l.criado_em)}</td>
                  <td className="pr-3">{l.nome}</td>
                  <td className="pr-3">{l.gatilho}</td>
                  <td className="pr-3">{l.titulo}</td>
                  <td className="pr-3"><Badge variant={l.status === "enviado" ? "default" : "secondary"}>{l.status}</Badge></td>
                  <td className="text-muted-foreground">{l.erro ?? ""}</td>
                </tr>
              ))}
              {log.data?.length === 0 && <tr><td colSpan={6} className="py-4 text-muted-foreground">Nenhum envio ainda.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
