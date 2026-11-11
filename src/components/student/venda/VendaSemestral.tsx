import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/vendas";
import { gerarDocumentoContrato } from "@/lib/contratosDocumentos";
import { invalidatePlanoCaches } from "@/lib/planoCache";
import { beneficiosSemestral, interpretarCobrancaSemestral, podeDesistirSemestral, type EstadoCobranca, type ItemSemestral, type RespostaCobranca } from "@/lib/semestral";
import { CadastrarCartaoDialog } from "@/components/pagamentos/CadastrarCartaoDialog";
import { useUserRoles } from "@/hooks/useUserRoles";
import { mensagemLinkSemestral, telefoneWhatsApp, urlWhatsAppSemestral } from "@/lib/semestralLink";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const CHAVE_SEMESTRAL = "semestral";

type RpcSemestral = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};
const db = supabase as unknown as RpcSemestral;

/** Itens que o servidor libera para o aluno (agregadora, CPF e prazo conferidos lá). */
export function useItensSemestral(alunoId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["semestral-itens", alunoId],
    enabled,
    queryFn: async () => {
      const { data, error } = await db.rpc("fn_semestral_itens_elegiveis", { p_aluno: alunoId });
      if (error) throw new Error(error.message);
      return (Array.isArray(data) ? data : []) as ItemSemestral[];
    },
  });
}

type Resultado = { venda_id?: string; contrato_id?: string; repetida?: boolean; retomada?: boolean; valor_centavos?: number };

export function VendaSemestral({ alunoId, itens, onDone }: { alunoId: string; itens: ItemSemestral[]; onDone: () => void }) {
  const qc = useQueryClient();
  const [sel, setSel] = useState<string>(itens[0]?.id ?? "");
  const [observacoes, setObservacoes] = useState("");
  const [idem] = useState(() => crypto.randomUUID());
  const item = itens.find((i) => i.id === sel);
  const [venda, setVenda] = useState<Resultado | null>(null);

  const vender = useMutation({
    mutationFn: async () => {
      if (!item) throw new Error("Escolha o plano");
      const { data, error } = await db.rpc("fn_venda_semestral_criar", {
        p: { aluno_id: alunoId, catalogo_id: item.id, observacoes, idempotency_key: idem },
      });
      if (error) throw new Error(error.message);
      const r = (data ?? {}) as Resultado;
      let contratoOk = true;
      if (r.contrato_id && !r.repetida) {
        const g = await gerarDocumentoContrato({
          alunoId, contratoId: r.contrato_id, planoNome: item.nome, tipoCobranca: "recorrencia",
          valorFinal: Number(item.valor), catalogoId: item.id,
        });
        contratoOk = g.success;
      }
      return { r, contratoOk };
    },
    onSuccess: ({ r, contratoOk }) => {
      ["vendas-aluno", "creditos-aluno", "creditos_resumo", "creditos_aluno_lista", "contratos", "plano-vigente-venda", "contratos-ativos-venda", "semestral-itens"].forEach(
        (k) => qc.invalidateQueries({ queryKey: [k, alunoId] }),
      );
      qc.invalidateQueries({ queryKey: ["cobrancas"] });
      invalidatePlanoCaches(qc, alunoId);
      if (r.retomada) toast.info("Venda já registrada aguardando a 1ª mensalidade: continue o pagamento.");
      if (!contratoOk) toast.warning("Modelo de contrato do Semestral ainda desligado: o documento não foi gerado.");
      setVenda(r);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (venda?.venda_id) {
    return (
      <PagamentoSemestral
        alunoId={alunoId}
        vendaId={venda.venda_id}
        valorCentavos={venda.valor_centavos ?? Math.round(Number(item?.valor ?? 0) * 100)}
        onDesistiu={() => {
          ["vendas-aluno", "contratos", "semestral-itens"].forEach((k) => qc.invalidateQueries({ queryKey: [k, alunoId] }));
          qc.invalidateQueries({ queryKey: ["cobrancas"] });
          invalidatePlanoCaches(qc, alunoId);
          onDone();
        }}
        onAprovado={() => {
          ["vendas-aluno", "creditos-aluno", "creditos_resumo", "creditos_aluno_lista", "contratos", "plano-vigente-venda", "contratos-ativos-venda", "semestral-itens"].forEach(
            (k) => qc.invalidateQueries({ queryKey: [k, alunoId] }),
          );
          qc.invalidateQueries({ queryKey: ["cobrancas"] });
          invalidatePlanoCaches(qc, alunoId);
          onDone();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Plano Semestral">
        {itens.map((i) => (
          <button
            key={i.id}
            type="button"
            role="radio"
            aria-checked={sel === i.id}
            onClick={() => setSel(i.id)}
            className={cn(
              "rounded-lg border p-3 text-left text-sm transition-all",
              sel === i.id ? "border-primary bg-primary/10 ring-2 ring-primary/20" : "border-border hover:border-primary/40",
            )}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold">{i.nome_exibicao ?? i.nome}</span>
              <span className="font-semibold">{formatBRL(Number(i.valor))}/mês</span>
            </div>
            <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
              {beneficiosSemestral(i).map((b) => <li key={b}>{b}</li>)}
            </ul>
          </button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        Recorrência mensal no cartão. A 1ª mensalidade é cobrada agora; o plano, os créditos do ciclo e o encerramento
        da agregadora só valem com o pagamento aprovado.
      </p>
      <div className="space-y-1">
        <Label>Observações</Label>
        <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} />
      </div>
      <Button className="w-full" disabled={!item || vender.isPending} onClick={() => vender.mutate()}>
        {vender.isPending ? "Registrando..." : "Continuar para o pagamento"}
      </Button>
    </div>
  );
}

type CartaoSalvo = { id: string; last4: string | null; brand: string | null; confirmado: boolean };

function PagamentoSemestral({ alunoId, vendaId, valorCentavos, onAprovado, onDesistiu }: {
  alunoId: string; vendaId: string; valorCentavos: number; onAprovado: () => void; onDesistiu: () => void;
}) {
  const { data: roles } = useUserRoles();
  const [cartaoId, setCartaoId] = useState("");
  const [novoCartao, setNovoCartao] = useState(false);
  const [estado, setEstado] = useState<EstadoCobranca | null>(null);

  const cartoes = useQuery({
    queryKey: ["semestral-cartoes", alunoId],
    queryFn: async (): Promise<CartaoSalvo[]> => {
      const { data: cs, error } = await supabase.from("cartoes_salvos").select("id,last4,brand").eq("aluno_id", alunoId).eq("ativo", true);
      if (error) throw new Error(error.message);
      const ids = (cs ?? []).map((c) => c.id);
      const { data: tk } = ids.length
        ? await supabase.from("rede_tokenizacoes").select("cartao_salvo_id,status").in("cartao_salvo_id", ids).is("proposta_id", null)
        : { data: [] as { cartao_salvo_id: string | null; status: string | null }[] };
      const ok = new Set((tk ?? []).filter((t) => t.status === "active").map((t) => t.cartao_salvo_id));
      return (cs ?? []).map((c) => ({ id: c.id, last4: c.last4, brand: c.brand, confirmado: ok.has(c.id) }));
    },
  });

  const cobrar = useMutation({
    mutationFn: async (): Promise<EstadoCobranca> => {
      const { error: e1 } = await db.rpc("fn_semestral_definir_cartao", { p_venda: vendaId, p_cartao: cartaoId });
      if (e1) throw new Error(e1.message);
      const { data, error } = await supabase.functions.invoke("rede-cobrar-token", {
        body: { venda_id: vendaId, cartao_id: cartaoId, amount: valorCentavos / 100 },
      });
      // Resposta 409 (resultado incerto) chega como erro: nunca tentar de novo automaticamente.
      if (error && !data) return interpretarCobrancaSemestral({ incerto: true, error: error.message });
      return interpretarCobrancaSemestral(data as RespostaCobranca);
    },
    onSuccess: (e) => {
      setEstado(e);
      if (e.estado === "aprovado") { toast.success(e.mensagem); onAprovado(); }
      else if (e.estado === "recusado") toast.error(e.mensagem);
      else toast.warning(e.mensagem);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const desistir = useMutation({
    mutationFn: async () => {
      const { error } = await db.rpc("fn_semestral_desistir", { p_venda: vendaId, p_motivo: "Desistência da venda (sem pagamento)" });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { toast.success("Venda cancelada. Nada foi ligado e a agregadora continua ativa."); onDesistiu(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const bloqueado = estado != null && !estado.podeTentarDeNovo;
  const lista = cartoes.data ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-3 text-sm">
        <div className="flex justify-between font-semibold"><span>1ª mensalidade</span><span>{formatBRL(valorCentavos / 100)}</span></div>
        <p className="mt-1 text-xs text-muted-foreground">Cobrada agora, em 1x. O cartão fica salvo para os ciclos seguintes.</p>
      </div>
      <div className="space-y-2" role="radiogroup" aria-label="Cartão do aluno">
        <Label>Cartão</Label>
        {lista.length === 0 && !cartoes.isLoading && <p className="text-sm text-muted-foreground">Nenhum cartão salvo.</p>}
        {lista.map((c) => (
          <button key={c.id} type="button" role="radio" aria-checked={cartaoId === c.id} disabled={!c.confirmado}
            onClick={() => setCartaoId(c.id)}
            className={cn("w-full rounded-lg border p-2 text-left text-sm", cartaoId === c.id ? "border-primary bg-primary/10" : "border-border",
              !c.confirmado && "opacity-60")}>
            {(c.brand ?? "Cartão").toUpperCase()} •••• {c.last4 ?? "----"}
            {!c.confirmado && <span className="ml-2 text-xs text-muted-foreground">aguardando confirmação da Rede</span>}
          </button>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => setNovoCartao(true)} disabled={cobrar.isPending}>
          Cadastrar outro cartão
        </Button>
      </div>
      {estado && estado.estado !== "aprovado" && (
        <p className={cn("text-sm", estado.estado === "recusado" ? "text-destructive" : "text-muted-foreground")}>{estado.mensagem}</p>
      )}
      <Button className="w-full" disabled={!cartaoId || cobrar.isPending || bloqueado} onClick={() => cobrar.mutate()}>
        {cobrar.isPending ? "Cobrando..." : estado?.estado === "recusado" ? "Tentar de novo" : `Cobrar ${formatBRL(valorCentavos / 100)} agora`}
      </Button>
      {roles?.isCoordAdmin && estado?.estado !== "aprovado" && <LinkPagamentoSemestral vendaId={vendaId} />}
      {podeDesistirSemestral(!!roles?.isCoordAdmin, estado) && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="ghost" className="w-full" disabled={cobrar.isPending || desistir.isPending}>Desistir da venda</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Desistir da venda do Plano Semestral?</AlertDialogTitle>
              <AlertDialogDescription>
                A venda fica cancelada, nenhum plano ou crédito é liberado e o plano da agregadora continua ativo. Nada é cobrado.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction onClick={() => desistir.mutate()}>Desistir da venda</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      <CadastrarCartaoDialog open={novoCartao} onOpenChange={setNovoCartao} alunoId={alunoId} origem="recepcao"
        onSuccess={() => { setNovoCartao(false); setEstado(null); cartoes.refetch(); }} />
    </div>
  );
}

type LinkGerado = { token: string; expira_em: string; primeiro_nome: string; telefone: string; plano: string; valor: number };
const BASE_LINK = "https://soufortem.com.br/pagamento/";

/** Link para o próprio aluno aceitar o contrato, cadastrar o cartão e pagar a 1ª mensalidade (só admin/coordenador). */
function LinkPagamentoSemestral({ vendaId }: { vendaId: string }) {
  const [link, setLink] = useState<LinkGerado | null>(null);
  const gerar = useMutation({
    mutationFn: async () => {
      const { data, error } = await db.rpc("fn_semestral_link_criar", { p_venda: vendaId });
      if (error) throw new Error(error.message);
      return data as LinkGerado;
    },
    onSuccess: setLink,
    onError: (e: Error) => toast.error(e.message),
  });
  const url = link ? `${BASE_LINK}${link.token}` : "";
  const tel = telefoneWhatsApp(link?.telefone);
  const whats = link && tel
    ? urlWhatsAppSemestral(tel, mensagemLinkSemestral({ primeiroNome: link.primeiro_nome, plano: link.plano, valor: Number(link.valor), link: url }))
    : null;
  return (
    <div className="space-y-2 rounded-lg border p-3">
      {!link ? (
        <Button type="button" variant="outline" className="w-full" disabled={gerar.isPending} onClick={() => gerar.mutate()}>
          {gerar.isPending ? "Gerando link..." : "Enviar link de pagamento ao aluno"}
        </Button>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Link válido até {new Date(link.expira_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}.
            O aluno aceita o contrato, cadastra o cartão e paga a 1ª mensalidade.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            {whats && (
              <Button asChild className="flex-1"><a href={whats} target="_blank" rel="noopener noreferrer">Enviar pelo WhatsApp</a></Button>
            )}
            <Button type="button" variant="outline" className="flex-1"
              onClick={() => navigator.clipboard.writeText(url).then(() => toast.success("Link copiado"), () => toast.error("Não foi possível copiar"))}>
              Copiar link
            </Button>
          </div>
          {!tel && <p className="text-xs text-muted-foreground">Aluno sem telefone no cadastro: copie o link e envie.</p>}
        </>
      )}
    </div>
  );
}
