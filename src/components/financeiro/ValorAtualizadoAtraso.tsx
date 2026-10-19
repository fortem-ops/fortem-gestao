import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { calcularEncargosAtraso, type IndicesIpca } from "@/lib/encargosAtraso";

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const hojeIso = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);

/** Cache do IPCA; atualiza sob demanda (no máx. 1x/dia) e avisa se a fonte falhar. */
export function useIpca() {
  return useQuery({
    queryKey: ["ipca-indices"],
    staleTime: 3600000,
    queryFn: async () => {
      const ler = async () => {
        const { data } = await supabase.from("ipca_indices").select("mes, variacao, fonte, atualizado_em").order("mes");
        return data ?? [];
      };
      let linhas = await ler();
      let aviso: string | null = null;
      const ultimaAtualizacao = linhas.reduce((m, l) => (l.atualizado_em > m ? l.atualizado_em : m), "");
      if (!ultimaAtualizacao || Date.now() - new Date(ultimaAtualizacao).getTime() > 86400000) {
        const { data, error } = await supabase.functions.invoke("ipca-atualizar", { body: {} });
        if (error || !data?.ok) aviso = "Não foi possível atualizar o IPCA agora; usando o último índice salvo.";
        else linhas = await ler();
      }
      if (!linhas.length) aviso = "IPCA indisponível: valor atualizado sem correção monetária.";
      const indices: IndicesIpca = {};
      for (const l of linhas) indices[l.mes.slice(0, 7)] = Number(l.variacao);
      return { indices, aviso, fonte: linhas[linhas.length - 1]?.fonte ?? null };
    },
  });
}

/** Somente leitura: valor atualizado + memória de cálculo. Nenhuma cobrança é feita. */
export function ValorAtualizadoAtraso({ valorCentavos, vencimento }: { valorCentavos: number; vencimento: string }) {
  const { data: ipca } = useIpca();
  if (!ipca) return null;
  const hoje = hojeIso();
  const r = calcularEncargosAtraso({ principalCentavos: valorCentavos, vencimento, dataCalculo: hoje, indices: ipca.indices });
  if (r.diasAtraso === 0) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="ml-1 text-xs font-semibold text-destructive underline underline-offset-2">
          Valor atualizado {brl(r.total)}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 text-xs space-y-1">
        <p className="font-medium text-sm">Memória de cálculo</p>
        <p className="text-muted-foreground">{r.diasAtraso} dia(s) de atraso, até hoje ({hoje.split("-").reverse().join("/")})</p>
        <Linha l="Principal" v={brl(r.principal)} />
        <Linha l={`Correção IPCA (fator ${r.fatorIpca.toFixed(6)})`} v={brl(r.correcao)} />
        {r.meses.map((m) => (
          <p key={m.mes} className="pl-2 text-muted-foreground">
            {m.mes.split("-").reverse().join("/")}: {m.variacao.toLocaleString("pt-BR")}% × {m.dias}/{m.diasNoMes} dias
            {m.estimado ? " (último índice publicado)" : ""}
          </p>
        ))}
        {r.fatorIpcaBruto < 1 && <p className="pl-2 text-muted-foreground">IPCA negativo no período: valor não reduzido.</p>}
        <Linha l="Principal corrigido" v={brl(r.corrigido)} />
        <Linha l="Multa 2%" v={brl(r.multa)} />
        <Linha l={`Juros 1% a.m. (${r.diasAtraso}/30)`} v={brl(r.juros)} />
        <Linha l="Total atualizado" v={brl(r.total)} forte />
        {ipca.fonte && <p className="text-muted-foreground">Fonte: {ipca.fonte}</p>}
        {ipca.aviso && <p className="text-destructive">{ipca.aviso}</p>}
        <p className="text-muted-foreground">Apenas informativo: nada foi cobrado.</p>
      </PopoverContent>
    </Popover>
  );
}

const Linha = ({ l, v, forte }: { l: string; v: string; forte?: boolean }) => (
  <div className={`flex justify-between gap-2 ${forte ? "font-semibold border-t border-border pt-1" : ""}`}>
    <span>{l}</span><span>{v}</span>
  </div>
);

/** Bloco da ficha do aluno: mensalidades 2027 do contrato vencidas e não pagas. */
export function MensalidadesAtraso2027({ contratoId }: { contratoId: string }) {
  const { data = [] } = useQuery({
    queryKey: ["mensalidades-2027-atraso", contratoId],
    queryFn: async () => {
      const { data } = await supabase.from("planos_2027_mensalidades")
        .select("id, numero, vencimento, valor_centavos, status")
        .eq("contrato_id", contratoId).not("status", "in", "(pago,cancelado)")
        .lt("vencimento", hojeIso()).order("numero");
      return data ?? [];
    },
  });
  if (!data.length) return null;
  return (
    <div className="rounded-md border border-destructive/50 p-3 space-y-1">
      <p className="text-sm font-medium">Mensalidades em atraso (valor atualizado)</p>
      {data.map((m) => (
        <div key={m.id} className="text-xs">
          {m.numero}ª · venc. {m.vencimento.split("-").reverse().join("/")} · {brl(m.valor_centavos)} ·
          <ValorAtualizadoAtraso valorCentavos={m.valor_centavos} vencimento={m.vencimento} />
        </div>
      ))}
      <p className="text-xs text-muted-foreground">Somente consulta. Cobrar ou perdoar encargos ainda não está disponível.</p>
    </div>
  );
}
