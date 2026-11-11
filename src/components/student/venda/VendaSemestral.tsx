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
import { beneficiosSemestral, type ItemSemestral } from "@/lib/semestral";

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

type Resultado = { venda_id?: string; contrato_id?: string; repetida?: boolean };

export function VendaSemestral({ alunoId, itens, onDone }: { alunoId: string; itens: ItemSemestral[]; onDone: () => void }) {
  const qc = useQueryClient();
  const [sel, setSel] = useState<string>(itens[0]?.id ?? "");
  const [observacoes, setObservacoes] = useState("");
  const [idem] = useState(() => crypto.randomUUID());
  const item = itens.find((i) => i.id === sel);

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
      return contratoOk;
    },
    onSuccess: (contratoOk) => {
      ["vendas-aluno", "creditos-aluno", "creditos_resumo", "creditos_aluno_lista", "contratos", "plano-vigente-venda", "contratos-ativos-venda", "semestral-itens"].forEach(
        (k) => qc.invalidateQueries({ queryKey: [k, alunoId] }),
      );
      qc.invalidateQueries({ queryKey: ["cobrancas"] });
      invalidatePlanoCaches(qc, alunoId);
      toast.success("Plano Semestral registrado. Cobre a 1ª mensalidade no cartão em Pagamentos.");
      if (!contratoOk) toast.warning("Modelo de contrato do Semestral ainda desligado: o documento não foi gerado.");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
        Recorrência mensal no cartão. Ciclo de 30 dias a partir de hoje; créditos do ciclo liberados após o pagamento.
        O plano da agregadora é encerrado na venda.
      </p>
      <div className="space-y-1">
        <Label>Observações</Label>
        <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} />
      </div>
      <Button className="w-full" disabled={!item || vender.isPending} onClick={() => vender.mutate()}>
        {vender.isPending ? "Registrando..." : "Registrar Plano Semestral"}
      </Button>
    </div>
  );
}
