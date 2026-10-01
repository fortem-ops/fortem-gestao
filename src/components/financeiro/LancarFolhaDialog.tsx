import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { format, addMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, FileUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Fornecedor } from "@/types/despesas";
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

type Mapeado = { campos: Record<string, number>; outrosVenc: number; outrosVencDesc: string; outrosDesc: number; outrosDescDesc: string; ferias: boolean };
export type RegistroHolerite = {
  funcionario?: string | null; cpf?: string | null; competencia?: string | null;
  total_vencimentos?: number | null; total_descontos?: number | null; valor_liquido?: number | null;
  mapeado?: Mapeado; erro?: string;
};
type Func = Fornecedor;
export type FolhaFormHandle = { lancar: () => Promise<string | null> };

const compDe = (c?: string | null) => { const mc = /^(\d{1,2})\/(\d{4})$/.exec(String(c ?? "")); return mc ? new Date(Number(mc[2]), Number(mc[1]) - 1, 1) : null; };

const FolhaForm = forwardRef<FolhaFormHandle, {
  mesTela: Date; funcionarios: Func[]; fornIdInicial?: string; registro?: RegistroHolerite;
  onFornChange?: (id: string) => void; children?: (ctx: { importar: (r: RegistroHolerite) => void; ferias: boolean; setFerias: (b: boolean) => void }) => React.ReactNode;
}>(function FolhaForm({ mesTela, funcionarios, fornIdInicial, registro, onFornChange, children }, ref) {
  const [fornId, setFornIdRaw] = useState(fornIdInicial ?? "");
  const setFornId = (v: string) => { setFornIdRaw(v); onFornChange?.(v); };
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

  function aplicar(data: RegistroHolerite, tentarFuncionario: boolean) {
    const m = data.mapeado;
    if (!m) return;
    const c = m.campos;
    if (tentarFuncionario && data.funcionario && !fornId) {
      const f = casarFuncionario(String(data.funcionario), funcionarios);
      if (f.id) setFornId(f.id);
    }
    const cd = compDe(data.competencia);
    if (cd) setComp(cd);
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
  }
  const aplicado = useRef(false);
  useEffect(() => {
    if (registro && !aplicado.current) { aplicado.current = true; aplicar(registro, false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registro]);

  async function lancar(): Promise<string | null> {
    if (!forn) return "Escolha o funcionário.";
    if (!forn.categoria_padrao_id) return "Este funcionário não tem subcategoria pessoal cadastrada em Fornecedores.";
    if (vHoras <= 0) return "Informe o valor de Horas Normais.";
    if ([vGrat, vCom, vDsr, vInss, vVt, vHF, vMF, vTerco, vAdF, vOV, vOD].some((x) => x < 0)) return "Valores não podem ser negativos.";
    const valor = r2(vHoras + vGrat + vHF + vMF + vTerco + vOV);
    const valorPago = r2(valor - vInss - vVt - vAdF - vOD);
    if (valorPago < 0) return "Os descontos são maiores que o salário.";
    const mesAbrev = format(comp, "MMM", { locale: ptBR }).replace(".", "");
    const partes: string[] = [`Horas Normais: ${brl(vHoras)}`];
    const p = (l: string, v: number, neg = false) => { if (v) partes.push(`${l}: ${neg ? "-" : ""}${brl(v)}`); };
    p("Gratificação", vGrat); p("Horas Férias", vHF); p("Média Valor Férias", vMF); p("1/3 Férias", vTerco);
    p("Comissões", vCom); p("DSR", vDsr);
    if (vOV) partes.push(`Outros Vencimentos${outrosVencDesc ? ` (${outrosVencDesc})` : ""}: ${brl(vOV)}`);
    p("INSS", vInss, true); p("Vale Transporte", vVt, true); p("Adiantamento Férias", vAdF, true);
    if (vOD) partes.push(`Outros Descontos${outrosDescDesc ? ` (${outrosDescDesc})` : ""}: -${brl(vOD)}`);
    partes.push(`Total Vencimentos: ${brl(totalVenc)}`, `Total Descontos: -${brl(totalDesc)}`, `Líquido: ${brl(liquido)}`);
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
    if (error) return "Não foi possível lançar a folha: " + error.message;
    return null;
  }
  useImperativeHandle(ref, () => ({ lancar }));

  const Linha = ({ label, valor, forte }: { label: string; valor: number; forte?: boolean }) => (
    <div className={`flex justify-between text-sm ${forte ? "font-semibold" : ""}`}>
      <span className="text-muted-foreground">{label}</span><span>{brl(valor)}</span>
    </div>
  );
  const Num = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <div><Label>{label}</Label><Input type="number" step="0.01" min="0" value={value} onChange={(e) => onChange(e.target.value)} /></div>
  );

  return (
        <div className="space-y-3">
          {children ? children({ importar: (r) => aplicar(r, true), ferias, setFerias }) : (
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={ferias} onCheckedChange={setFerias} />Este lançamento é de férias
            </label>
          )}
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
  );
});

const normNome = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

/** Casa um nome do PDF com o cadastro: exato, aproximado ("confirme") ou não encontrado. */
function casarFuncionario(nome: string, funcs: Func[]): { id: string; status: "ok" | "confirme" | "nao" } {
  const alvo = normNome(nome);
  const exato = funcs.find((f) => normNome(f.nome) === alvo);
  if (exato) return { id: exato.id, status: "ok" };
  const ta = alvo.split(" ").filter((t) => t.length > 2);
  let melhor: Func | null = null, score = 0;
  for (const f of funcs) {
    const tf = normNome(f.nome).split(" ").filter((t) => t.length > 2);
    const comum = ta.filter((t) => tf.includes(t)).length;
    let sc = comum / Math.max(ta.length, tf.length, 1);
    if (ta[0] && ta[0] === tf[0] && ta[ta.length - 1] === tf[tf.length - 1]) sc = Math.max(sc, 0.7);
    if (sc > score) { score = sc; melhor = f; }
  }
  if (melhor && score >= 0.4) return { id: melhor.id, status: "confirme" };
  return { id: "", status: "nao" };
}

async function lerPdf(file: File): Promise<{ modo: "recibo" | "extrato"; registro?: RegistroHolerite; registros?: RegistroHolerite[] }> {
  const texto = await extrairTextoDocumento(file);
  const { data, error } = await supabase.functions.invoke("ler-holerite", { body: { texto } });
  if (error || data?.error) {
    let msg = data?.error as string | undefined;
    try { msg ??= (await (error as { context?: Response })?.context?.json())?.error; } catch { /* ignore */ }
    throw new Error(msg || "Não foi possível ler o holerite.");
  }
  if (data.modo === "extrato") return { modo: "extrato", registros: data.registros };
  return { modo: "recibo", registro: data };
}

export function LancarFolhaDialog({ mesTela, onClose }: { mesTela: Date; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: fornecedores = [] } = useFornecedores();
  const funcionarios = useMemo(() => fornecedores.filter((f) => f.eh_funcionario && f.ativo), [fornecedores]);
  const [lendo, setLendo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [extrato, setExtrato] = useState<RegistroHolerite[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<FolhaFormHandle>(null);

  async function importar(file: File, aplicarRecibo: (r: RegistroHolerite) => void) {
    setLendo(true);
    try {
      const r = await lerPdf(file);
      if (r.modo === "extrato") {
        setExtrato(r.registros ?? []);
        toast.success(`Extrato com ${r.registros?.length ?? 0} funcionários — confira cada um antes de lançar.`);
      } else {
        aplicarRecibo(r.registro!);
        toast.success("Valores importados do PDF — confira antes de salvar.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível ler o holerite.");
    } finally {
      setLendo(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function salvar() {
    setSalvando(true);
    const erro = await formRef.current?.lancar();
    setSalvando(false);
    if (erro) return toast.error(erro);
    toast.success("Salário lançado.");
    qc.invalidateQueries({ queryKey: ["despesas"] });
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={`${extrato ? "max-w-3xl" : "max-w-lg"} max-h-[90vh] overflow-y-auto`}>
        <DialogHeader><DialogTitle>{extrato ? "Lançar folha — Extrato mensal" : "Lançar folha"}</DialogTitle></DialogHeader>
        {extrato ? (
          <ExtratoLista registros={extrato} mesTela={mesTela} funcionarios={funcionarios} onVoltar={() => setExtrato(null)} onClose={onClose} />
        ) : (
          <>
            <FolhaForm ref={formRef} mesTela={mesTela} funcionarios={funcionarios}>
              {({ importar: aplicar, ferias, setFerias }) => (
                <div className="flex items-center justify-between gap-2">
                  <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importar(f, aplicar); }} />
                  <Button type="button" variant="outline" size="sm" disabled={lendo} onClick={() => fileRef.current?.click()}>
                    <FileUp className="h-4 w-4 mr-1" />{lendo ? "Lendo PDF…" : "Importar recibo ou extrato (PDF)"}
                  </Button>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={ferias} onCheckedChange={setFerias} />Este lançamento é de férias
                  </label>
                </div>
              )}
            </FolhaForm>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button onClick={salvar} disabled={salvando || lendo}>{salvando ? "Salvando…" : "Lançar salário"}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

type EstadoLinha = { fornId: string; match: "ok" | "confirme" | "nao"; pular: boolean; aberto: boolean; lancado: boolean; erro?: string; enviando: boolean };

function ExtratoLista({ registros, mesTela, funcionarios, onVoltar, onClose }: {
  registros: RegistroHolerite[]; mesTela: Date; funcionarios: Func[]; onVoltar: () => void; onClose: () => void;
}) {
  const qc = useQueryClient();
  const refs = useRef<(FolhaFormHandle | null)[]>([]);
  const [linhas, setLinhas] = useState<EstadoLinha[]>(() => registros.map((r) => {
    const m = r.erro || !r.funcionario ? { id: "", status: "nao" as const } : casarFuncionario(r.funcionario, funcionarios);
    return { fornId: m.id, match: m.status, pular: !!r.erro, aberto: false, lancado: false, enviando: false };
  }));
  const [lote, setLote] = useState(false);
  const upd = (i: number, p: Partial<EstadoLinha>) => setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));

  async function lancarUma(i: number): Promise<"ok" | "erro" | "pulado"> {
    const l = linhas[i];
    if (l.lancado) return "pulado";
    if (!l.fornId) { upd(i, { erro: "Selecione o funcionário no cadastro.", aberto: true }); return "erro"; }
    upd(i, { enviando: true });
    const erro = (await refs.current[i]?.lancar()) ?? "Formulário não carregado.";
    upd(i, { enviando: false, erro: erro ?? undefined, lancado: !erro, aberto: erro ? true : false });
    return erro ? "erro" : "ok";
  }

  async function lancarIndividual(i: number) {
    const r = await lancarUma(i);
    if (r === "ok") { toast.success("Salário lançado."); qc.invalidateQueries({ queryKey: ["despesas"] }); }
    else if (r === "erro") toast.error("Não foi possível lançar este funcionário. Veja o aviso na linha.");
  }

  async function lancarTodos() {
    setLote(true);
    let ok = 0, pulados = 0, erros = 0;
    for (let i = 0; i < linhas.length; i++) {
      if (linhas[i].lancado) continue;
      if (linhas[i].pular) { pulados++; continue; }
      const r = await lancarUma(i);
      if (r === "ok") ok++; else if (r === "erro") erros++;
    }
    setLote(false);
    qc.invalidateQueries({ queryKey: ["despesas"] });
    const msg = `${ok} lançado(s), ${pulados} pulado(s)${erros ? `, ${erros} com erro` : ""}.`;
    if (erros) toast.warning(msg + " Confira as linhas marcadas em vermelho."); else toast.success(msg);
  }

  const pendentes = linhas.filter((l) => !l.lancado && !l.pular).length;

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
        Valores importados do PDF — confira cada funcionário antes de lançar. Nada foi salvo ainda.
      </div>
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onVoltar} disabled={lote}>← Voltar</Button>
        <Button onClick={lancarTodos} disabled={lote || pendentes === 0}>{lote ? "Lançando…" : `Lançar todos (${pendentes})`}</Button>
      </div>
      <div className="space-y-2">
        {registros.map((r, i) => {
          const l = linhas[i];
          const cd = compDe(r.competencia);
          return (
            <div key={i} className={`rounded-md border ${l.erro ? "border-destructive/60" : ""} ${l.lancado || l.pular ? "opacity-70" : ""}`}>
              <div className="flex flex-wrap items-center gap-2 p-2">
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={!!r.erro} onClick={() => upd(i, { aberto: !l.aberto })} aria-label="Expandir">
                  {l.aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{r.funcionario || "(nome não lido)"}</div>
                  <div className="text-xs text-muted-foreground">
                    {cd ? format(cd, "MM/yyyy") : "competência ?"} · Venc. {brl(Number(r.total_vencimentos) || 0)} · Desc. {brl(Number(r.total_descontos) || 0)} · Líq. {brl(Number(r.valor_liquido) || 0)}
                  </div>
                </div>
                {r.mapeado?.ferias && <Badge variant="outline">Férias</Badge>}
                {l.lancado ? <Badge className="bg-success/20 text-success border-success/40" variant="outline">Lançado</Badge>
                  : r.erro ? <Badge variant="destructive">Não lido</Badge>
                  : l.match === "ok" ? <Badge variant="outline" className="border-success/40 text-success">Encontrado</Badge>
                  : l.match === "confirme" ? <Badge variant="outline" className="border-warning/50 text-warning">Confirme</Badge>
                  : <Badge variant="destructive">Não encontrado</Badge>}
                {!l.lancado && (
                  <label className="flex items-center gap-1 text-xs"><Switch checked={l.pular} onCheckedChange={(b) => upd(i, { pular: b })} />Pular</label>
                )}
              </div>
              {(l.erro || r.erro) && <p className="px-3 pb-2 text-xs text-destructive">{l.erro || r.erro}</p>}
              {!r.erro && (
                <div className={l.aberto ? "border-t p-3 space-y-3" : "hidden"}>
                  <FolhaForm
                    ref={(h) => { refs.current[i] = h; }}
                    mesTela={mesTela} funcionarios={funcionarios} fornIdInicial={l.fornId} registro={r}
                    onFornChange={(id) => upd(i, { fornId: id, match: "ok", erro: undefined })}
                  />
                  {!l.lancado && (
                    <div className="flex justify-end">
                      <Button size="sm" onClick={() => lancarIndividual(i)} disabled={l.enviando || lote}>{l.enviando ? "Lançando…" : "Lançar"}</Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>Fechar</Button></DialogFooter>
    </div>
  );
}
