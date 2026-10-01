import { useEffect, useMemo, useRef, useState } from "react";
import { format, addMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, FileUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useFornecedores } from "@/hooks/useDespesas";
import { extrairTextoDocumento } from "@/lib/extrairTextoDocumento";

const CAT_COMISSOES = "fb292895-bc41-474a-9e57-58f6777748df";
const CAT_DSR = "5c86da2d-6ecd-4b85-ba33-56b3ea0e6687";
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (s: string) => { const v = Number(s.replace(",", ".")); return Number.isFinite(v) ? v : 0; };
const r2 = (n: number) => Math.round(n * 100) / 100;
const str = (n: number | undefined) => (n ? String(r2(n)) : "");

/** Campo numérico com auto-sugestão que para quando o usuário edita. */
function useAuto(sugestao: number | null, deps: unknown[]) {
  const [v, setV] = useState("");
  const [editado, setEditado] = useState(false);
  useEffect(() => {
    if (!editado) setV(sugestao ? String(r2(sugestao)) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, editado]);
  return { v, editado, set: (x: string) => { setV(x); setEditado(true); }, fixar: (x: string) => { setV(x); setEditado(true); }, reset: () => setEditado(false) };
}

export function LancarFolhaDialog({ mesTela, onClose }: { mesTela: Date; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: fornecedores = [] } = useFornecedores();
  const funcionarios = useMemo(() => fornecedores.filter((f) => f.eh_funcionario && f.ativo), [fornecedores]);
  const [fornId, setFornId] = useState("");
  const [comp, setComp] = useState(() => startOfMonth(addMonths(mesTela, -1)));
  const [horas, setHoras] = useState("");
  const [inss, setInss] = useState("");
  const [ferias, setFerias] = useState(false);
  const [horasFerias, setHorasFerias] = useState("");
  const [mediaFerias, setMediaFerias] = useState("");
  const [adiantFerias, setAdiantFerias] = useState("");
  const [outrosVenc, setOutrosVenc] = useState("");
  const [outrosVencDesc, setOutrosVencDesc] = useState("");
  const [outrosDesc, setOutrosDesc] = useState("");
  const [outrosDescDesc, setOutrosDescDesc] = useState("");
  const [outrosAberto, setOutrosAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [lendo, setLendo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const forn = funcionarios.find((f) => f.id === fornId);
  const confianca = !!forn?.cargo_confianca;
  const ini = format(comp, "yyyy-MM-dd");
  const fim = format(endOfMonth(comp), "yyyy-MM-dd");
  const dataPag = format(addMonths(comp, 1), "yyyy-MM-05");
  const vHoras = num(horas);

  const somasQ = useQuery({
    queryKey: ["folha-somas", fornId, ini],
    enabled: !!fornId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesas")
        .select("categoria_id, valor")
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

  const grat = useAuto(confianca && vHoras ? vHoras * 0.4 : null, [horas, confianca]);
  const vt = useAuto(vHoras ? vHoras * 0.06 : null, [horas]);
  const terco = useAuto(ferias && (vHoras || num(horasFerias)) ? (vHoras + num(horasFerias)) / 3 : null, [horas, horasFerias, ferias]);
  const com = useAuto(somasQ.data?.com || null, [somasQ.data?.com]);
  const dsr = useAuto(somasQ.data?.dsr || null, [somasQ.data?.dsr]);

  function trocarFuncionario(v: string) {
    setFornId(v);
    grat.reset(); vt.reset(); terco.reset(); com.reset(); dsr.reset();
  }

  const vGrat = confianca ? num(grat.v) : 0;
  const vCom = num(com.v), vDsr = num(dsr.v), vInss = num(inss), vVt = num(vt.v);
  const vHF = ferias ? num(horasFerias) : 0, vMF = ferias ? num(mediaFerias) : 0, vTerco = ferias ? num(terco.v) : 0, vAdF = ferias ? num(adiantFerias) : 0;
  const vOV = num(outrosVenc), vOD = num(outrosDesc);
  const totalVenc = r2(vHoras + vGrat + vHF + vMF + vTerco + vCom + vDsr + vOV);
  const totalDesc = r2(vInss + vVt + vAdF + vOD);
  const liquido = r2(totalVenc - totalDesc);

  const anos = Array.from({ length: new Date().getFullYear() + 1 - 2017 + 1 }, (_, i) => 2017 + i);

  async function importarPdf(file: File) {
    setLendo(true);
    try {
      const texto = await extrairTextoDocumento(file);
      const { data, error } = await supabase.functions.invoke("ler-holerite", { body: { texto } });
      if (error || data?.error) {
        let msg = data?.error as string | undefined;
        try { msg ??= (await (error as { context?: Response })?.context?.json())?.error; } catch { /* ignore */ }
        throw new Error(msg || "Não foi possível ler o holerite.");
      }
      const m = data.mapeado as { campos: Record<string, number>; outrosVenc: number; outrosVencDesc: string; outrosDesc: number; outrosDescDesc: string; ferias: boolean };
      const c = m.campos;
      // tenta identificar o funcionário pelo nome
      if (data.funcionario && !fornId) {
        const alvo = String(data.funcionario).toLowerCase();
        const f = funcionarios.find((x) => alvo.includes(x.nome.toLowerCase().split(" ")[0]) && alvo.includes(x.nome.toLowerCase().split(" ").slice(-1)[0]));
        if (f) setFornId(f.id);
      }
      const mc = /^(\d{1,2})\/(\d{4})$/.exec(String(data.competencia ?? ""));
      if (mc) setComp(new Date(Number(mc[2]), Number(mc[1]) - 1, 1));
      setHoras(str(c.horas));
      setInss(str(c.inss));
      if (c.grat) grat.fixar(str(c.grat));
      vt.fixar(str(c.vt)); com.fixar(str(c.com)); dsr.fixar(str(c.dsr));
      setFerias(m.ferias);
      setHorasFerias(str(c.horasFerias)); setMediaFerias(str(c.mediaFerias)); setAdiantFerias(str(c.adiantFerias));
      if (m.ferias) terco.fixar(str(c.tercoFerias));
      setOutrosVenc(str(m.outrosVenc)); setOutrosVencDesc(m.outrosVencDesc);
      setOutrosDesc(str(m.outrosDesc)); setOutrosDescDesc(m.outrosDescDesc);
      if (m.outrosVenc || m.outrosDesc) setOutrosAberto(true);
      toast.success("Valores importados do PDF — confira antes de salvar.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível ler o holerite.");
    } finally {
      setLendo(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function salvar() {
    if (!forn) return toast.error("Escolha o funcionário.");
    if (!forn.categoria_padrao_id) return toast.error("Este funcionário não tem subcategoria pessoal cadastrada em Fornecedores.");
    if (vHoras <= 0) return toast.error("Informe o valor de Horas Normais.");
    if ([vGrat, vCom, vDsr, vInss, vVt, vHF, vMF, vTerco, vAdF, vOV, vOD].some((x) => x < 0)) return toast.error("Valores não podem ser negativos.");
    const valor = r2(vHoras + vGrat + vHF + vMF + vTerco + vOV);
    const valorPago = r2(valor - vInss - vVt - vAdF - vOD);
    if (valorPago < 0) return toast.error("Os descontos são maiores que o salário.");
    const mesAbrev = format(comp, "MMM", { locale: ptBR }).replace(".", "");
    const partes: string[] = [`Horas Normais: ${brl(vHoras)}`];
    const p = (l: string, v: number, neg = false) => { if (v) partes.push(`${l}: ${neg ? "-" : ""}${brl(v)}`); };
    p("Gratificação", vGrat); p("Horas Férias", vHF); p("Média Valor Férias", vMF); p("1/3 Férias", vTerco);
    p("Comissões", vCom); p("DSR", vDsr);
    if (vOV) partes.push(`Outros Vencimentos${outrosVencDesc ? ` (${outrosVencDesc})` : ""}: ${brl(vOV)}`);
    p("INSS", vInss, true); p("Vale Transporte", vVt, true); p("Adiantamento Férias", vAdF, true);
    if (vOD) partes.push(`Outros Descontos${outrosDescDesc ? ` (${outrosDescDesc})` : ""}: -${brl(vOD)}`);
    partes.push(`Total Vencimentos: ${brl(totalVenc)}`, `Total Descontos: -${brl(totalDesc)}`, `Líquido: ${brl(liquido)}`);
    setSalvando(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("despesas").insert({
      categoria_id: forn.categoria_padrao_id,
      fornecedor_id: forn.id,
      descricao: `${ferias ? "Salário + Férias" : "Salário"} ${forn.nome} (${mesAbrev}/${format(comp, "yyyy")})`,
      valor,
      valor_pago: valorPago,
      status: "pago",
      tipo: "fixa",
      origem: "manual",
      data_competencia: dataPag,
      data_pagamento: dataPag,
      conta_bancaria: "BANCO INTER",
      observacao: partes.join(" | "),
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
  const Num = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <div><Label>{label}</Label><Input type="number" step="0.01" min="0" value={value} onChange={(e) => onChange(e.target.value)} /></div>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Lançar folha</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importarPdf(f); }} />
            <Button type="button" variant="outline" size="sm" disabled={lendo} onClick={() => fileRef.current?.click()}>
              <FileUp className="h-4 w-4 mr-1" />{lendo ? "Lendo holerite…" : "Importar de holerite (PDF)"}
            </Button>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={ferias} onCheckedChange={setFerias} />Este lançamento é de férias
            </label>
          </div>
          <div>
            <Label>Funcionário</Label>
            <Select value={fornId} onValueChange={trocarFuncionario}>
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
          <div className="grid grid-cols-2 gap-3">
            {Num({ label: "Horas Normais (R$)", value: horas, onChange: setHoras })}
            {confianca && Num({ label: "Gratificação de Função 40% (R$)", value: grat.v, onChange: grat.set })}
          </div>
          {ferias && (
            <div className="grid grid-cols-2 gap-3 rounded-md border p-3">
              {Num({ label: "Horas Férias (R$)", value: horasFerias, onChange: setHorasFerias })}
              {Num({ label: "Média Valor Férias (R$)", value: mediaFerias, onChange: setMediaFerias })}
              {Num({ label: "1/3 de Férias (R$)", value: terco.v, onChange: terco.set })}
              {Num({ label: "Adiantamento de Férias (desconto)", value: adiantFerias, onChange: setAdiantFerias })}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {Num({ label: somasQ.isFetching ? "Comissões do mês (…)" : "Comissões do mês", value: com.v, onChange: com.set })}
            {Num({ label: somasQ.isFetching ? "DSR do mês (…)" : "DSR do mês", value: dsr.v, onChange: dsr.set })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {Num({ label: "Dedução de INSS (R$)", value: inss, onChange: setInss })}
            {Num({ label: "Desconto de Vale Transporte (R$)", value: vt.v, onChange: vt.set })}
          </div>
          <Collapsible open={outrosAberto} onOpenChange={setOutrosAberto}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="px-0">
                <ChevronDown className={`h-4 w-4 mr-1 transition-transform ${outrosAberto ? "rotate-180" : ""}`} />Outros ajustes
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                {Num({ label: "Outros Vencimentos (R$)", value: outrosVenc, onChange: setOutrosVenc })}
                <div><Label>Descrição</Label><Input value={outrosVencDesc} onChange={(e) => setOutrosVencDesc(e.target.value)} placeholder="Ex.: Salário Família" /></div>
                {Num({ label: "Outros Descontos (R$)", value: outrosDesc, onChange: setOutrosDesc })}
                <div><Label>Descrição</Label><Input value={outrosDescDesc} onChange={(e) => setOutrosDescDesc(e.target.value)} /></div>
              </div>
            </CollapsibleContent>
          </Collapsible>
          <div className="rounded-md border p-3 space-y-1">
            <Linha label="Total de Vencimentos" valor={totalVenc} />
            <Linha label="Total de Descontos" valor={-totalDesc} />
            <Linha label="Valor Líquido" valor={liquido} forte />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando || lendo}>{salvando ? "Salvando…" : "Lançar salário"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
