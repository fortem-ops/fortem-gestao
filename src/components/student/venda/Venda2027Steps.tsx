import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/vendas";
import {
  calcularVenda2027,
  calcularServicos2027,
  itemVendavel2027,
  type FormaPlano2027,
  type FormaServicos2027,
} from "@/lib/vendas2027";
import { gerarDocumentoContrato } from "@/lib/contratosDocumentos";
import { invalidatePlanoCaches } from "@/lib/planoCache";
import {
  DURACOES_CONSULTORIA,
  FAMILIA_CONSULTORIA,
  deveGerarDocumento2027,
  ehCicloMensal2027,
  ehConsultoriaFamilia,
  ehPacoteConsultoria,
  formaEfetiva2027,
  maxParcelas2027,
  montarPayloadVenda2027,
  mostrarChipConsultoria,
  rotuloDuracao,
  selecionarItem2027,
} from "@/lib/vendaConsultoria2027";

const db = supabase as any;

const FAMILIAS = [
  { value: "start_2027", label: "Start" },
  { value: "power_2027", label: "Power" },
  { value: "pro_2027", label: "Pro" },
  { value: FAMILIA_CONSULTORIA, label: "Consultoria Online" },
  { value: "servicos", label: "Só serviços" },
];
export const AVISO_SERVICOS_PACOTE =
  "Pacotes da Consultoria não aceitam serviços na mesma venda. Registre os serviços em uma venda separada (Só serviços).";
const FREQS = [
  { value: "1x", label: "1x" },
  { value: "2x", label: "2x" },
  { value: "3x", label: "3x" },
  { value: "livre", label: "Livre" },
];

type Props = {
  alunoId: string;
  temPlanoAtivo: boolean;
  onDone: () => void;
};

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 py-2 text-sm transition-all",
        selected ? "border-primary bg-primary/10 text-foreground ring-2 ring-primary/20" : "border-border hover:border-primary/40",
      )}
    >
      {children}
    </button>
  );
}

export function Venda2027Steps({ alunoId, temPlanoAtivo, onDone }: Props) {
  const qc = useQueryClient();
  const hoje = format(new Date(), "yyyy-MM-dd");

  const [familia, setFamiliaState] = useState("power_2027");
  const [freq, setFreq] = useState("2x");
  const [duracao, setDuracaoState] = useState(1);
  const [pagamento, setPagamento] = useState<FormaPlano2027>("cartao_parcelado");
  const [parcelas, setParcelas] = useState(12);
  const [servicosSel, setServicosSel] = useState<string[]>([]);
  const [formaServicos, setFormaServicos] = useState<FormaServicos2027>("pix_vista");
  const [parcelasServicos, setParcelasServicos] = useState(6);
  const [dataInicio, setDataInicio] = useState(hoje);
  const [primeiroVenc, setPrimeiroVenc] = useState(hoje);
  const [substituir, setSubstituir] = useState(temPlanoAtivo);
  const [observacoes, setObservacoes] = useState("");
  const [desconto, setDesconto] = useState(0);
  const [descontoRecorrente, setDescontoRecorrente] = useState<"" | "primeiro" | "todos">("");
  const [idem] = useState(() => crypto.randomUUID());

  const { data: catalogo = [] } = useQuery({
    queryKey: ["planos-catalogo-2027"],
    queryFn: async () => {
      const { data, error } = await db.from("planos_catalogo").select("*").eq("versao", 2027);
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: servicos = [] } = useQuery({
    queryKey: ["servicos-catalogo-2027"],
    queryFn: async () => {
      const { data, error } = await db.from("servicos_catalogo").select("*").eq("versao", 2027).order("valor");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: alunoDeTeste = false } = useQuery({
    queryKey: ["vendas-2027-teste", alunoId],
    queryFn: async () => {
      const { data } = await db.from("sistema_config").select("valor").eq("chave", "vendas_2027_teste_aluno_ids").maybeSingle();
      return Array.isArray(data?.valor) && data.valor.includes(alunoId);
    },
  });

  const soServicos = familia === "servicos";
  const ehStart = familia === "start_2027";
  const consultoria = ehConsultoriaFamilia(familia);
  const pacote = ehPacoteConsultoria(familia, duracao);
  // Ciclo mensal (uma cobrança por ciclo): Start ou Consultoria Mensal.
  const cicloMensal = ehCicloMensal2027(familia, duracao);
  const forma: FormaPlano2027 = formaEfetiva2027(familia, duracao, pagamento);
  const modalidade = forma === "recorrencia" ? "recorrencia_mensal" : "anual";
  const maxParcelas = maxParcelas2027(familia, duracao);
  const item = soServicos ? null : selecionarItem2027(catalogo as any[], familia, freq, modalidade, duracao);
  const chipConsultoria = mostrarChipConsultoria(
    alunoDeTeste,
    catalogo.some((c: any) => c.familia === FAMILIA_CONSULTORIA && itemVendavel2027(c, hoje, false)),
  );

  const setFamilia = (f: string) => {
    if (ehConsultoriaFamilia(f) && !consultoria) {
      setDuracao(duracao);
    } else if (!ehConsultoriaFamilia(f) && consultoria) {
      setParcelas(12);
    }
    setFamiliaState(f);
  };
  function setDuracao(d: number) {
    setDuracaoState(d);
    if (d > 1) {
      setParcelas(d);
      setServicosSel([]);
      if (pagamento === "recorrencia") setPagamento("cartao_parcelado");
    }
  }
  const vendavel = soServicos ? servicosSel.length > 0 : item ? itemVendavel2027(item, hoje, alunoDeTeste) : false;
  const servicosItens = servicos.filter((s: any) => servicosSel.includes(s.id));

  const { calc, calcErro } = useMemo(() => {
    if (soServicos) {
      try {
        const sv = calcularServicos2027(
          servicosItens.map((s: any) => ({ codigo: s.codigo, valor: s.valor })),
          formaServicos,
          parcelasServicos,
        );
        return { calc: { plano: { forma: formaServicos, total: 0, parcelas: [] }, servicosAvulsos: sv, totalPlano: 0, totalServicos: sv.total, totalGeral: sv.total } as any, calcErro: null };
      } catch {
        return { calc: null, calcErro: null };
      }
    }
    if (!item) return { calc: null, calcErro: null };
    try {
      return {
        calc: calcularVenda2027({
          item,
          forma,
          parcelas,
          servicos: servicosItens.map((s: any) => ({ codigo: s.codigo, valor: s.valor })),
          formaServicos,
          parcelasServicos,
          descontoPlano: desconto,
        }),
        calcErro: null,
      };
    } catch (e: any) {
      return { calc: null, calcErro: consultoria ? String(e?.message ?? e) : null };
    }
  }, [soServicos, item, forma, parcelas, servicosItens, formaServicos, parcelasServicos, desconto, consultoria]);
  const faltaEscolhaStart = cicloMensal && desconto > 0 && !descontoRecorrente;

  const vender = useMutation({
    mutationFn: async () => {
      if (soServicos) {
        if (!calc) throw new Error("Escolha ao menos um serviço");
        const { error } = await db.rpc("fn_venda_servicos_2027_criar", {
          p: {
            aluno_id: alunoId,
            servicos: servicosSel,
            forma_servicos: formaServicos,
            parcelas_servicos: formaServicos === "cartao_parcelado" ? parcelasServicos : 1,
            data_inicio: dataInicio,
            observacoes,
            idempotency_key: idem,
          },
        });
        if (error) throw error;
        return { contratoOk: true };
      }
      if (!item || !calc) throw new Error("Escolha o plano");
      if (!vendavel) throw new Error("Este plano 2027 ainda não está liberado para venda");
      const { data, error } = await db.rpc("fn_venda_2027_criar", {
        p: {
          aluno_id: alunoId,
          catalogo_id: item.id,
          servicos: servicosSel,
          forma,
          parcelas: forma === "cartao_parcelado" ? parcelas : 1,
          forma_servicos: formaServicos,
          parcelas_servicos: formaServicos === "cartao_parcelado" ? parcelasServicos : 1,
          data_inicio: dataInicio,
          primeiro_vencimento: primeiroVenc,
          substituir,
          observacoes,
          idempotency_key: idem,
          desconto: desconto || 0,
          desconto_recorrente: ehStart && desconto > 0 && descontoRecorrente === "todos",
        },
      });
      if (error) throw error;
      let contratoOk = true;
      if (data?.contrato_id) {
        const r = await gerarDocumentoContrato({
          alunoId,
          contratoId: data.contrato_id,
          planoNome: item.nome,
          tipoCobranca: forma === "recorrencia" ? "recorrencia" : "tradicional",
          valorFinal: calc.totalGeral,
          catalogoId: item.id,
        });
        contratoOk = r.success;
      }
      return { contratoOk };
    },
    onSuccess: ({ contratoOk }) => {
      ["vendas-aluno", "creditos-aluno", "creditos_resumo", "creditos_aluno_lista", "contratos", "plano-vigente-venda", "contratos-ativos-venda"].forEach(
        (k) => qc.invalidateQueries({ queryKey: [k, alunoId] }),
      );
      qc.invalidateQueries({ queryKey: ["contratos"] });
      qc.invalidateQueries({ queryKey: ["cobrancas"] });
      invalidatePlanoCaches(qc, alunoId);
      toast.success("Venda 2027 registrada");
      if (!contratoOk) toast.warning("Contrato 2027 ainda desligado: o documento não foi gerado.");
      onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Badge variant="outline">Planos 2027</Badge>
        {alunoDeTeste && <Badge variant="destructive">TESTE 2027</Badge>}
      </div>

      <div className="space-y-2">
        <Label>Plano</Label>
        <div className="flex flex-wrap gap-2">
          {FAMILIAS.map((f) => (
            <Chip key={f.value} selected={familia === f.value} onClick={() => setFamilia(f.value)}>{f.label}</Chip>
          ))}
        </div>
      </div>

      {!soServicos && (<>
      <div className="space-y-2">
        <Label>Frequência</Label>
        <div className="flex flex-wrap gap-2">
          {FREQS.map((f) => (
            <Chip key={f.value} selected={freq === f.value} onClick={() => setFreq(f.value)}>{f.label}</Chip>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Pagamento do plano</Label>
        {ehStart ? (
          <p className="text-sm text-muted-foreground">Start: recorrência mensal no cartão, sem taxa e sem fidelidade.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Chip selected={pagamento === "cartao_parcelado"} onClick={() => setPagamento("cartao_parcelado")}>Cartão até 12x</Chip>
            <Chip selected={pagamento === "pix_vista"} onClick={() => setPagamento("pix_vista")}>Pix à vista</Chip>
            <Chip selected={pagamento === "recorrencia"} onClick={() => setPagamento("recorrencia")}>Recorrência mensal (+ taxa)</Chip>
          </div>
        )}
        {forma === "cartao_parcelado" && (
          <Select value={String(parcelas)} onValueChange={(v) => setParcelas(Number(v))}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {forma === "recorrencia" && (
          <p className="text-xs text-muted-foreground">
            {ehStart
              ? "Sem fidelidade: 1 mensalidade por ciclo, renovada todo mês até o cancelamento; baixa manual."
              : "12 mensalidades criadas de uma vez; baixa manual a cada pagamento."}
          </p>
        )}
      </div>
      </>)}

      <div className="space-y-2">
        <Label>Serviços complementares</Label>
        <div className="space-y-2">
          {servicos.map((s: any) => {
            const ok = itemVendavel2027(s, hoje, alunoDeTeste);
            return (
              <label key={s.id} className={cn("flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm", !ok && "opacity-50")}>
                <span className="flex items-center gap-2">
                  <Checkbox
                    disabled={!ok}
                    checked={servicosSel.includes(s.id)}
                    onCheckedChange={(v) =>
                      setServicosSel((prev) => (v ? [...prev, s.id] : prev.filter((x) => x !== s.id)))
                    }
                  />
                  {s.nome}
                </span>
                <span className="font-medium">{formatBRL(Number(s.valor))}</span>
              </label>
            );
          })}
        </div>
        {servicosSel.length > 0 && (soServicos || forma === "recorrencia") && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-muted-foreground">Serviços cobrados à parte:</span>
            <Chip selected={formaServicos === "pix_vista"} onClick={() => setFormaServicos("pix_vista")}>Pix à vista</Chip>
            <Chip selected={formaServicos === "cartao_parcelado"} onClick={() => setFormaServicos("cartao_parcelado")}>Cartão até 6x</Chip>
            {formaServicos === "cartao_parcelado" && (
              <Select value={String(parcelasServicos)} onValueChange={(v) => setParcelasServicos(Number(v))}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 6 }, (_, i) => i + 1).map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}
        {servicosSel.length > 0 && !soServicos && forma !== "recorrencia" && (
          <p className="text-xs text-muted-foreground">Os serviços entram nas mesmas parcelas do plano.</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Início</Label>
          <Input type="date" value={dataInicio} onChange={(e) => { setDataInicio(e.target.value); if (primeiroVenc < e.target.value) setPrimeiroVenc(e.target.value); }} />
        </div>
        <div className="space-y-1">
          <Label>1º vencimento</Label>
          <Input type="date" min={dataInicio} value={primeiroVenc} onChange={(e) => setPrimeiroVenc(e.target.value)} />
        </div>
      </div>

      {temPlanoAtivo && !soServicos && (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={substituir} onCheckedChange={(v) => setSubstituir(!!v)} />
          Encerrar o plano atual do aluno
        </label>
      )}

      {!soServicos && item && (
        <div className="space-y-2">
          <Label>Desconto sobre o plano (R$)</Label>
          <Input
            type="number" min={0} step="0.01" className="w-40"
            value={desconto || ""}
            onChange={(e) => setDesconto(Math.max(0, Number(e.target.value) || 0))}
          />
          {!ehStart && desconto > 0 && (
            <p className="text-xs text-muted-foreground">
              {forma === "recorrencia" ? "Abatido da 1ª mensalidade." : "Abatido do total do plano e dividido nas parcelas."}
            </p>
          )}
          {ehStart && desconto > 0 && (
            <div className="space-y-1">
              <p className="text-sm">Aplicar este desconto também nas mensalidades seguintes?</p>
              <div className="flex flex-wrap gap-2">
                <Chip selected={descontoRecorrente === "primeiro"} onClick={() => setDescontoRecorrente("primeiro")}>Só no 1º mês</Chip>
                <Chip selected={descontoRecorrente === "todos"} onClick={() => setDescontoRecorrente("todos")}>Em todos os meses</Chip>
              </div>
            </div>
          )}
          {desconto > 0 && !calc && <p className="text-xs text-destructive">Desconto maior que o valor do plano.</p>}
        </div>
      )}

      <div className="space-y-1">
        <Label>Observações</Label>
        <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} />
      </div>

      {!item && !soServicos && <Alert><AlertDescription>Combinação não existe no catálogo 2027.</AlertDescription></Alert>}
      {item && !vendavel && (
        <Alert variant="destructive"><AlertDescription>Este plano 2027 ainda não está liberado para venda.</AlertDescription></Alert>
      )}

      {calc && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-2">
          <div className="flex justify-between font-semibold">
            <span>{soServicos ? "Serviços 2027" : `${item?.nome_exibicao ?? item?.nome} ${freq === "livre" ? "Livre" : freq}`}</span>
            <span>{formatBRL(calc.totalGeral)}</span>
          </div>
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr><th className="text-left font-normal">Parcela</th><th className="text-right font-normal">Plano</th><th className="text-right font-normal">Serviços</th><th className="text-right font-normal">Total</th></tr>
            </thead>
            <tbody>
              {calc.plano.parcelas.map((p) => (
                <tr key={`p${p.numero}`}>
                  <td>{p.numero}/{calc.plano.parcelas.length}</td>
                  <td className="text-right">{formatBRL(p.plano)}</td>
                  <td className="text-right">{formatBRL(p.servicos)}</td>
                  <td className="text-right font-medium">{formatBRL(p.valor)}</td>
                </tr>
              ))}
              {calc.servicosAvulsos?.parcelas.map((p) => (
                <tr key={`s${p.numero}`} className="text-muted-foreground">
                  <td>Serviços {p.numero}/{calc.servicosAvulsos!.parcelas.length}</td>
                  <td className="text-right">—</td>
                  <td className="text-right">{formatBRL(p.servicos)}</td>
                  <td className="text-right font-medium">{formatBRL(p.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Button className="w-full" disabled={!calc || !vendavel || faltaEscolhaStart || vender.isPending} onClick={() => vender.mutate()}>
        {vender.isPending ? "Registrando..." : "Registrar venda 2027"}
      </Button>
    </div>
  );
}
