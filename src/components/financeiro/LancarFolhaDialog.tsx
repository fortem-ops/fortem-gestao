import { useEffect, useMemo, useState } from "react";
import { format, addMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useFornecedores } from "@/hooks/useDespesas";

const CAT_COMISSOES = "fb292895-bc41-474a-9e57-58f6777748df";
const CAT_DSR = "5c86da2d-6ecd-4b85-ba33-56b3ea0e6687";
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (s: string) => { const v = Number(s.replace(",", ".")); return Number.isFinite(v) ? v : 0; };
const r2 = (n: number) => Math.round(n * 100) / 100;

export function LancarFolhaDialog({ mesTela, onClose }: { mesTela: Date; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: fornecedores = [] } = useFornecedores();
  const funcionarios = useMemo(() => fornecedores.filter((f) => f.eh_funcionario && f.ativo), [fornecedores]);
  const [fornId, setFornId] = useState("");
  const [comp, setComp] = useState(() => startOfMonth(addMonths(mesTela, -1)));
  const [horas, setHoras] = useState("");
  const [grat, setGrat] = useState("");
  const [gratEditada, setGratEditada] = useState(false);
  const [inss, setInss] = useState("");
  const [salvando, setSalvando] = useState(false);

  const forn = funcionarios.find((f) => f.id === fornId);
  const confianca = !!forn?.cargo_confianca;
  const ini = format(comp, "yyyy-MM-dd");
  const fim = format(endOfMonth(comp), "yyyy-MM-dd");
  const dataPag = format(addMonths(comp, 1), "yyyy-MM-05");

  useEffect(() => {
    if (confianca && !gratEditada) setGrat(horas ? String(r2(num(horas) * 0.4)) : "");
  }, [horas, confianca, gratEditada]);

  const somasQ = useQuery({
    queryKey: ["folha-somas", fornId, ini],
    enabled: !!fornId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesas")
        .select("categoria_id, valor, valor_pago")
        .eq("fornecedor_id", fornId)
        .eq("status", "pago")
        .in("categoria_id", [CAT_COMISSOES, CAT_DSR])
        .gte("data_pagamento", ini)
        .lte("data_pagamento", fim);
      if (error) throw error;
      let com = 0, dsr = 0;
      for (const d of data ?? []) {
        const v = Number(d.valor) || 0;
        if (d.categoria_id === CAT_COMISSOES) com += v; else dsr += v;
      }
      return { com: r2(com), dsr: r2(dsr) };
    },
  });
  const com = somasQ.data?.com ?? 0;
  const dsr = somasQ.data?.dsr ?? 0;
  const vHoras = num(horas);
  const vGrat = confianca ? num(grat) : 0;
  const vInss = num(inss);
  const totalVenc = r2(vHoras + vGrat + com + dsr);
  const liquido = r2(totalVenc - vInss);

  const anos = Array.from({ length: new Date().getFullYear() + 1 - 2017 + 1 }, (_, i) => 2017 + i);

  async function salvar() {
    if (!forn) return toast.error("Escolha o funcionário.");
    if (!forn.categoria_padrao_id) return toast.error("Este funcionário não tem subcategoria pessoal cadastrada em Fornecedores.");
    if (vHoras <= 0) return toast.error("Informe o valor de Horas Normais.");
    if (vInss < 0 || vGrat < 0) return toast.error("Valores não podem ser negativos.");
    const valor = r2(vHoras + vGrat);
    const valorPago = r2(valor - vInss);
    if (valorPago < 0) return toast.error("O INSS é maior que o salário.");
    const mesAbrev = format(comp, "MMM", { locale: ptBR }).replace(".", "");
    const obs = `Horas Normais: ${brl(vHoras)} | Gratificação: ${brl(vGrat)} | Comissões: ${brl(com)} | DSR: ${brl(dsr)} | INSS: -${brl(vInss)} | Líquido: ${brl(liquido)}`;
    setSalvando(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("despesas").insert({
      categoria_id: forn.categoria_padrao_id,
      fornecedor_id: forn.id,
      descricao: `Salário ${forn.nome} (${mesAbrev}/${format(comp, "yyyy")})`,
      valor,
      valor_pago: valorPago,
      status: "pago",
      tipo: "fixa",
      origem: "manual",
      data_competencia: dataPag,
      data_pagamento: dataPag,
      conta_bancaria: "BANCO INTER",
      observacao: obs,
      created_by: u.user?.id ?? null,
    } as never);
    setSalvando(false);
    if (error) return toast.error("Não foi possível lançar a folha: " + error.message);
    toast.success("Salário lançado.");
    qc.invalidateQueries({ queryKey: ["despesas"] });
    onClose();
  }

  const Linha = ({ label, valor, forte }: { label: string; valor: number; forte?: boolean }) => (
    <div className={`flex justify-between text-sm ${forte ? "font-semibold" : ""}`}>
      <span className="text-muted-foreground">{label}</span><span>{brl(valor)}</span>
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Lançar folha</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Funcionário</Label>
            <Select value={fornId} onValueChange={(v) => { setFornId(v); setGratEditada(false); }}>
              <SelectTrigger><SelectValue placeholder="Escolha…" /></SelectTrigger>
              <SelectContent>{funcionarios.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Mês de competência</Label>
            <div className="flex gap-2">
              <Select value={String(comp.getMonth())} onValueChange={(m) => setComp(new Date(comp.getFullYear(), Number(m), 1))}>
                <SelectTrigger aria-label="Mês de competência"><SelectValue /></SelectTrigger>
                <SelectContent>{MESES.map((n, i) => <SelectItem key={i} value={String(i)}>{n}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={String(comp.getFullYear())} onValueChange={(y) => setComp(new Date(Number(y), comp.getMonth(), 1))}>
                <SelectTrigger aria-label="Ano de competência" className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>{anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Vencimento e pagamento: {format(new Date(dataPag + "T12:00:00"), "dd/MM/yyyy")}</p>
          </div>
          <div>
            <Label>Horas Normais (R$)</Label>
            <Input type="number" step="0.01" min="0" value={horas} onChange={(e) => setHoras(e.target.value)} />
          </div>
          {confianca && (
            <div>
              <Label>Gratificação de Função 40% (R$)</Label>
              <Input type="number" step="0.01" min="0" value={grat} onChange={(e) => { setGrat(e.target.value); setGratEditada(true); }} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Comissões do mês</Label><Input readOnly value={somasQ.isFetching ? "…" : brl(com)} className="bg-muted" /></div>
            <div><Label>DSR do mês</Label><Input readOnly value={somasQ.isFetching ? "…" : brl(dsr)} className="bg-muted" /></div>
          </div>
          <div>
            <Label>Dedução de INSS (R$)</Label>
            <Input type="number" step="0.01" min="0" value={inss} onChange={(e) => setInss(e.target.value)} />
          </div>
          <div className="rounded-md border p-3 space-y-1">
            <Linha label="Total de Vencimentos" valor={totalVenc} />
            <Linha label="INSS" valor={-vInss} />
            <Linha label="Valor Líquido" valor={liquido} forte />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando || somasQ.isFetching}>{salvando ? "Salvando…" : "Lançar salário"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
