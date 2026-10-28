import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle, Info, Loader2, Lock, Send, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CHIPS, confirmacaoValida, STATUS_CAMPANHA_LABEL, AVISO_LOTE, resumoClienteDesde, type SituacaoChip } from "@/lib/disparos";
import { DestinatariosTabela, useContagem } from "./DisparosHistorico";

type Props = { campanhaId: string; chips: SituacaoChip[]; clienteDesdeDe?: string | null; clienteDesdeAte?: string | null; selecionados: number; onVoltar: () => void };
type Camp = {
  nome: string; status: string; modelo_id: string | null; total_preparado: number | null; deduplicados: number | null;
  preparado_em: string | null; lote_limite: number;
  modelo: { nome: string | null; meta_nome: string | null; status: string; ativo: boolean; canal: string } | null;
};
type Erro = { error?: string };

export default function DisparosRevisao({ campanhaId, chips, clienteDesdeDe, clienteDesdeAte, selecionados, onVoltar }: Props) {
  const qc = useQueryClient();
  const [preparando, setPreparando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [digitado, setDigitado] = useState("");

  const { data: c, isLoading } = useQuery({
    queryKey: ["msg_revisao", campanhaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("msg_campanhas")
        .select("nome, status, modelo_id, total_preparado, deduplicados, preparado_em, lote_limite, modelo:msg_modelos(nome, meta_nome, status, ativo, canal)")
        .eq("id", campanhaId).single();
      if (error) throw error;
      return data as unknown as Camp;
    },
  });
  const { data: testeOk } = useQuery({
    queryKey: ["msg_teste_ok", c?.modelo_id], enabled: !!c?.modelo_id,
    queryFn: async () => {
      const { count } = await supabase.from("msg_testes").select("id", { count: "exact", head: true })
        .eq("modelo_id", c!.modelo_id!).eq("status", "enviado");
      return (count ?? 0) > 0;
    },
  });
  const { data: liberado } = useQuery({
    queryKey: ["msg_config_real"],
    queryFn: async () => {
      const { data } = await supabase.from("msg_config").select("valor").eq("chave", "real_liberado").maybeSingle();
      return (data as { valor: unknown } | null)?.valor === true;
    },
  });
  const { data: k } = useContagem(campanhaId);

  const atualizar = () => {
    ["msg_revisao", "msg_contagem", "msg_dest"].forEach((q) => qc.invalidateQueries({ queryKey: [q, campanhaId] }));
    qc.invalidateQueries({ queryKey: ["msg_hist"] });
  };

  const preparar = async () => {
    setPreparando(true);
    const { data, error } = await supabase.functions.invoke("disparo-campanha", { body: { action: "preparar", campanha_id: campanhaId } });
    setPreparando(false);
    const msg = (data as Erro)?.error ?? (error ? await lerErro(error) : null);
    if (msg) { toast.error(msg); return; }
    toast.success(`Preparado: ${(data as { total: number }).total} destinatários.`);
    atualizar();
  };

  const enviar = async () => {
    if (!c || !confirmacaoValida(digitado, c.total_preparado)) return;
    setEnviando(true);
    const { data, error } = await supabase.functions.invoke("disparo-campanha", {
      body: { action: "enviar", campanha_id: campanhaId, confirmacao_total: Number(digitado.trim()) },
    });
    setEnviando(false);
    const msg = (data as Erro)?.error ?? (error ? await lerErro(error) : null);
    if (msg) { toast.error(msg); return; }
    const r = data as { enviados: number; falhas: number; ignorados: number; restantes: number };
    toast.success(`Lote: ${r.enviados} enviados, ${r.falhas} falhas, ${r.ignorados} ignorados. Restam ${r.restantes}.`);
    atualizar();
  };

  if (isLoading || !c) return <div className="py-12 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>;
  const modeloOk = !!c.modelo && c.modelo.canal === "whatsapp" && c.modelo.status === "aprovado" && c.modelo.ativo;
  const preparado = c.preparado_em != null && c.total_preparado != null;
  const lote = c.lote_limite ?? 50;
  const jaEnviou = (k?.enviado ?? 0) + (k?.falhou ?? 0) > 0;
  const podePreparar = ["rascunho", "pronta"].includes(c.status) && !jaEnviou;
  const travado = liberado !== true;
  const podeEnviar = !travado && preparado && ["pronta", "enviando", "pausada"].includes(c.status) && (k?.pendente ?? 0) > 0
    && confirmacaoValida(digitado, c.total_preparado) && !enviando;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Resumo</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p><span className="text-muted-foreground">Nome:</span> {c.nome}</p>
            <p><span className="text-muted-foreground">Público:</span> {CHIPS.filter((x) => chips.includes(x.v)).map((x) => x.l).join(", ") || "—"}</p>
            {resumoClienteDesde(clienteDesdeDe, clienteDesdeAte) && <p><span className="text-muted-foreground">Cliente desde:</span> {resumoClienteDesde(clienteDesdeDe, clienteDesdeAte)}</p>}
            <p><span className="text-muted-foreground">Modelo:</span> {c.modelo?.nome ?? "—"} {c.modelo?.meta_nome && <span className="text-muted-foreground">({c.modelo.meta_nome})</span>}</p>
            <p><span className="text-muted-foreground">Canal:</span> WhatsApp</p>
            <p><span className="text-muted-foreground">Selecionados no Público:</span> {selecionados}</p>
            <p><span className="text-muted-foreground">Situação:</span> <Badge variant="outline">{STATUS_CAMPANHA_LABEL[c.status] ?? c.status}</Badge></p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Conferir antes de enviar</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="flex items-center gap-2">
              {modeloOk ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <AlertTriangle className="h-4 w-4 text-destructive" />}
              {modeloOk ? "Modelo aprovado" : "Modelo não aprovado ou não escolhido"}
            </p>
            <p className="flex items-center gap-2">
              {testeOk ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <AlertTriangle className="h-4 w-4 text-warning" />}
              {testeOk ? "Teste enviado com este modelo" : "Nenhum teste enviado com este modelo ainda"}
            </p>
            <p className="flex items-center gap-2 text-muted-foreground">
              <Info className="h-4 w-4" />Confirmados da festa e opt-outs saem do público automaticamente na hora do envio.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={!modeloOk || !podePreparar || preparando} onClick={preparar}>
              {preparando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}{preparado ? "Preparar de novo" : "Preparar disparo"}
            </Button>
            {preparado && (
              <span className="text-sm">
                <b>{c.total_preparado}</b> destinatários · {c.deduplicados ?? 0} duplicados removidos por telefone · Primeiro lote: {Math.min(lote, c.total_preparado ?? 0)}
              </span>
            )}
          </div>
          {preparado && <DestinatariosTabela campanhaId={campanhaId} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Envio</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {travado && (
            <div className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 p-3">
              <Lock className="h-4 w-4" />Envio real bloqueado nesta fase.
            </div>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Digite o total exato para confirmar{preparado ? ` (${c.total_preparado})` : ""}</label>
              <Input className="w-40" inputMode="numeric" value={digitado} disabled={travado || !preparado}
                onChange={(e) => setDigitado(e.target.value)} />
            </div>
            <Button disabled={!podeEnviar} onClick={enviar}>
              {enviando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
              {(k?.enviado ?? 0) + (k?.falhou ?? 0) + (k?.ignorado ?? 0) > 0 ? "Enviar próximo lote" : `Enviar primeiro lote de ${lote}`}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{AVISO_LOTE}</p>
          {preparado && k && <p className="text-muted-foreground">Enviadas {k.enviado} · Falhas {k.falhou} · Ignoradas {k.ignorado} · Pendentes {k.pendente}</p>}
        </CardContent>
      </Card>

      <Button variant="ghost" onClick={onVoltar}><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Button>
    </div>
  );
}

async function lerErro(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response })?.context;
  try { const j = await ctx?.json(); if (j?.error) return j.error; } catch { /* ignore */ }
  return "Não foi possível concluir a ação.";
}
