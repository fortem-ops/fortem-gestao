import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ExternalLink, Loader2, MessageCircle, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ResultadoCicloPromo10 } from "@/lib/promo10";
import {
  diaDoCiclo,
  formatarDataBr,
  formatarMoedaBr,
  rotuloFrequencia,
  textoQuebraUpgrade,
} from "@/lib/promo10Texto";
import {
  type InteressePromo10Admin,
  type StatusInteressePromo10,
  STATUS_PROMO10_LISTA,
  linkWhatsAppAlunoPromo10,
  montarMensagemWhatsAppEquipePromo10,
  rotuloOfertaEquipePromo10,
  rotuloSegmentoPromo10,
  segmentoEfetivoPromo10,
} from "@/lib/promo10Admin";

interface RecalculoResposta {
  disponivel: boolean;
  motivo?: string;
  data_referencia?: string;
  oferta?: {
    valor_promocional: number;
    valor_sem_desconto: number;
    economia: number;
    calculo_promocional?: ResultadoCicloPromo10;
  };
}

interface Props {
  item: InteressePromo10Admin | null;
  onClose: () => void;
}

function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function Promo10DetalheSheet({ item, onClose }: Props) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<StatusInteressePromo10>("novo");
  const [observacao, setObservacao] = useState("");

  useEffect(() => {
    if (!item) return;
    setStatus(item.status);
    setObservacao(item.observacao ?? "");
  }, [item]);

  const ehUpgrade = item ? String(item.detalhes?.tipo ?? "") === "upgrade" : false;

  const recalculo = useQuery({
    queryKey: ["promo10-recalcular", item?.id],
    enabled: Boolean(item?.id && ehUpgrade),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_promo10_admin_recalcular", {
        p_interesse_id: item!.id,
      });
      if (error) throw error;
      return data as unknown as RecalculoResposta;
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      if (!item) return;
      const { error } = await supabase
        .from("promo10_interesses")
        .update({ status, observacao: observacao.trim() || null })
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Interesse atualizado");
      qc.invalidateQueries({ queryKey: ["promo10-interesses-admin"] });
      onClose();
    },
    onError: () => {
      toast.error("Não foi possível salvar as alterações");
    },
  });

  if (!item) return null;

  const seg = segmentoEfetivoPromo10(item.segmento, item.oferta, item.detalhes);
  const ofertaLegivel = rotuloOfertaEquipePromo10(item);
  const msgWhats = montarMensagemWhatsAppEquipePromo10({
    nomeAluno: item.aluno_nome,
    codigoPedido: item.codigo_pedido,
    ofertaLegivel,
  });
  const linkWhats = linkWhatsAppAlunoPromo10(item.aluno_telefone, msgWhats);
  const calcGravado = item.detalhes?.calculo_promocional as ResultadoCicloPromo10 | undefined;
  const economia = item.valor_sem_desconto != null ? Math.max(0, item.valor_sem_desconto - item.valor_promocional) : null;
  const valorHoje = recalculo.data?.disponivel ? recalculo.data.oferta?.valor_promocional : null;
  const valorMudou = valorHoje != null && Math.abs(valorHoje - item.valor_promocional) >= 0.01;

  return (
    <Sheet open={Boolean(item)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto space-y-5">
        <SheetHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="font-mono">{item.codigo_pedido}</Badge>
            <Badge variant="secondary">{rotuloSegmentoPromo10(seg)}</Badge>
          </div>
          <SheetTitle className="text-left">{ofertaLegivel}</SheetTitle>
        </SheetHeader>

        <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Aluno</span>
            <Link to={`/alunos/${item.aluno_id}`} className="font-medium text-primary hover:underline inline-flex items-center gap-1">
              {item.aluno_nome}
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Registrado em</span>
            <span>{formatarDataHora(item.created_at)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Valor no dia do interesse</span>
            <span className="font-semibold">{formatarMoedaBr(item.valor_promocional)}</span>
          </div>
          {item.valor_sem_desconto != null && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Sem desconto / Economia</span>
              <span>
                {formatarMoedaBr(item.valor_sem_desconto)}
                {economia != null ? ` (economia ${formatarMoedaBr(economia)})` : ""}
              </span>
            </div>
          )}
        </div>

        {ehUpgrade && (
          <div className="space-y-3 rounded-lg border border-border p-3 text-sm">
            <div className="flex items-center justify-between">
              <p className="font-medium">Detalhes do upgrade (gravados)</p>
              <Button variant="ghost" size="sm" onClick={() => recalculo.refetch()} disabled={recalculo.isFetching}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${recalculo.isFetching ? "animate-spin" : ""}`} />
                Recalcular
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground block">Plano / frequência</span>
                <span>
                  {String(item.detalhes?.plano_atual ?? "—")} ({rotuloFrequencia(String(item.detalhes?.frequencia_atual ?? ""))} →{" "}
                  {rotuloFrequencia(String(item.detalhes?.frequencia_destino ?? ""))})
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Início ciclo / fim plano</span>
                <span>
                  Dia {diaDoCiclo(String(item.detalhes?.data_inicio_ciclo ?? ""))} · até{" "}
                  {formatarDataBr(String(item.detalhes?.data_fim_plano ?? ""))}
                </span>
              </div>
            </div>
            {calcGravado && (
              <ul className="space-y-1 text-xs text-muted-foreground list-disc pl-4">
                {textoQuebraUpgrade(calcGravado).map((linha) => (
                  <li key={linha}>{linha}</li>
                ))}
              </ul>
            )}

            <div className="border-t border-border pt-3 space-y-1.5">
              <p className="font-medium">Valor para hoje (recalculado no servidor)</p>
              {recalculo.isLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Recalculando...
                </div>
              ) : recalculo.isError ? (
                <p className="text-xs text-destructive">Erro ao recalcular para hoje.</p>
              ) : recalculo.data?.disponivel && recalculo.data.oferta ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      Em {formatarDataBr(recalculo.data.data_referencia)}
                    </span>
                    <span className="font-semibold text-base">
                      {formatarMoedaBr(recalculo.data.oferta.valor_promocional)}
                    </span>
                  </div>
                  {valorMudou && (
                    <div className="flex items-start gap-2 rounded bg-yellow-500/10 border border-yellow-500/30 p-2 text-xs text-yellow-200">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>
                        O valor mudou desde o registro ({formatarMoedaBr(item.valor_promocional)} →{" "}
                        {formatarMoedaBr(recalculo.data.oferta.valor_promocional)}). Use o valor de hoje ao fechar.
                      </span>
                    </div>
                  )}
                  {recalculo.data.oferta.calculo_promocional && (
                    <ul className="space-y-1 text-xs text-muted-foreground list-disc pl-4">
                      {textoQuebraUpgrade(recalculo.data.oferta.calculo_promocional).map((linha) => (
                        <li key={linha}>{linha}</li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Oferta não disponível hoje ({recalculo.data?.motivo ?? "indisponível"}).
                </p>
              )}
            </div>
          </div>
        )}

        <div className="space-y-2">
          {linkWhats ? (
            <Button asChild variant="outline" className="w-full">
              <a href={linkWhats} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4 mr-2" />
                Abrir WhatsApp do aluno
              </a>
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">Aluno sem telefone válido cadastrado para WhatsApp.</p>
          )}
        </div>

        <div className="space-y-3 border-t border-border pt-4">
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as StatusInteressePromo10)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_PROMO10_LISTA.map((s) => (
                  <SelectItem key={s.valor} value={s.valor}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Observação</Label>
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Anotações do contato ou fechamento..."
              rows={3}
            />
          </div>

          {item.atualizado_em && (
            <p className="text-xs text-muted-foreground">
              Última atualização: {formatarDataHora(item.atualizado_em)}
              {item.atualizado_por_nome ? ` por ${item.atualizado_por_nome}` : ""}
            </p>
          )}

          <Button className="w-full" onClick={() => salvar.mutate()} disabled={salvar.isPending}>
            {salvar.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar alterações
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}