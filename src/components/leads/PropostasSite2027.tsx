import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { waMeLink } from "@/lib/pipeline";
import { useUserRoles } from "@/hooks/useUserRoles";
import { estadoAtivacao, podeAtivarAgora } from "@/lib/ativacao2027";
import { AssinaturaSite2027 } from "./AssinaturaSite2027";

type Proposta = {
  id: string; nome: string; whatsapp: string; email: string; plano_codigo: string; familia: string; frequencia: string;
  forma_plano: string; parcelas_plano: number; servicos_codigos: string[]; forma_servicos: string | null;
  parcelas_servicos: number | null; corrida: boolean; corrida_valor_mensal: number | null; valor_total_centavos: number;
  status: string; previa: boolean; teste_admin?: boolean; assinatura_cancelada_em: string | null; aluno_id: string | null; lead_erro: string | null; created_at: string;
  pago_em?: string | null; ativada_em?: string | null; aluno_ativado_id?: string | null; ativacao_erro?: string | null;
};

const FORMA: Record<string, string> = { recorrencia: "Recorrência mensal no cartão", cartao_parcelado: "Cartão", pix_vista: "Pix à vista" };
const FAM: Record<string, string> = { start_2027: "Start", power_2027: "Power", pro_2027: "Pro" };

/** Situação da ativação (plano, contrato e créditos no perfil) + botão "Ativar agora" para admin. */
function AtivacaoLinha({ p }: { p: Proposta }) {
  const { data: roles } = useUserRoles();
  const qc = useQueryClient();
  const [enviando, setEnviando] = useState(false);
  const estado = estadoAtivacao(p);
  if (estado === "nao_paga") return null;

  const ativar = async () => {
    setEnviando(true);
    try {
      const { data, error } = await (supabase.rpc as any)("fn_checkout_2027_ativar_admin", { p_proposta_id: p.id });
      if (error) throw error;
      if (data?.erro) toast.error(`Não foi possível ativar: ${data.erro}`);
      else toast.success("Plano, contrato e créditos criados no perfil do aluno.");
      qc.invalidateQueries({ queryKey: ["propostas-planos-2027"] });
    } catch {
      toast.error("Não foi possível ativar agora.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
      {estado === "ativada" ? (
        <>
          <Badge variant="outline">{p.teste_admin ? "Ativada (teste)" : "Ativada"}</Badge>
          {p.aluno_ativado_id && (
            <Link to={`/alunos/${p.aluno_ativado_id}`} className="text-primary underline">Abrir perfil do aluno</Link>
          )}
        </>
      ) : (
        <>
          <Badge variant="destructive">Paga — ativação pendente</Badge>
          {p.ativacao_erro && <span className="text-muted-foreground">{p.ativacao_erro}</span>}
          {podeAtivarAgora({ isAdmin: !!roles?.isAdmin, ...p }) && (
            <Button size="sm" onClick={ativar} disabled={enviando}>{enviando ? "Ativando..." : "Ativar agora"}</Button>
          )}
        </>
      )}
    </div>
  );
}

/** Propostas enviadas pela página pública /planos. Assinatura no cartão: equipe cancela ou dá baixa manual; a venda é feita no VendaDialog. */
export function PropostasSite2027() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["propostas-planos-2027"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("propostas_planos_2027" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as Proposta[];
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (data.length === 0) return <p className="text-sm text-muted-foreground">Nenhuma proposta recebida pelo site ainda.</p>;

  return (
    <div className="space-y-3">
      {data.map((p) => (
        <div key={p.id} className="glass-card rounded-lg p-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-foreground">{p.nome}</span>
              {p.previa && <Badge variant="outline">Prévia</Badge>}
              {p.lead_erro && <Badge variant="destructive">Lead não criado</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">
              {FAM[p.familia] ?? p.familia} {p.frequencia} · {FORMA[p.forma_plano] ?? p.forma_plano}
              {p.forma_plano === "cartao_parcelado" ? ` ${p.parcelas_plano}x` : ""}
              {p.servicos_codigos.length > 0 ? ` · ${p.servicos_codigos.length} acompanhamento(s)` : ""}
              {p.corrida ? " · Grupo de corrida" : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(p.created_at), "dd/MM/yyyy HH:mm")} · {p.email}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="font-semibold">{(p.valor_total_centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
            <a href={waMeLink(p.whatsapp, `Olá ${p.nome.split(" ")[0]}, aqui é da FORTEM sobre o plano que você montou no site.`) ?? undefined} target="_blank" rel="noreferrer" className="text-sm text-primary underline">WhatsApp</a>
          </div>
        </div>
        <AtivacaoLinha p={p} />
        {p.forma_plano === "recorrencia" && (
          <AssinaturaSite2027 propostaId={p.id} familia={p.familia} cancelada={!!p.assinatura_cancelada_em} testeAdmin={!!p.teste_admin} />
        )}
        </div>
      ))}
    </div>
  );
}
