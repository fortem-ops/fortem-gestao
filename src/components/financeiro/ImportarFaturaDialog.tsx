import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useCategoriasDespesa, useCategoriaMutations } from "@/hooks/useDespesas";
import { extrairTextoDocumento, SenhaPdfError } from "@/lib/extrairTextoDocumento";
import { CONTAS_DESPESA, FORMAS_DESPESA, type DespesaCategoria, type DespesaTipo } from "@/types/despesas";

const ORIGEM = "fatura_cartao";
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
const dataBR = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");

type LinhaIA = { data: string | null; beneficiario: string; valor: number; sinal: "+" | "-"; parcela_atual: number | null; parcela_total: number | null };
type Fatura = { emissor: string | null; cartao_final: string | null; vencimento: string | null; valor_total: number | null; mes_referencia: string | null; linhas: LinhaIA[] };
type Cartao = { id: string; nome: string; identificador_pdf: string | null; dia_vencimento_padrao: number | null; forma_pagamento_padrao: string | null; conta_bancaria: string | null; ativo: boolean; pagar_automatico_no_vencimento: boolean };

function proximoDiaUtil(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
type Regra = { id: string; padrao: string; categoria_id: string };
type Linha = LinhaIA & {
  origemId: string; excluida: boolean; categoriaId: string; regra: boolean;
  lembrar: boolean; trecho: string; lancada: boolean; jaExistia: boolean; enviando: boolean; erro?: string;
};

/** UUID determinístico (SHA-256) para origem_id — impede duplicar a mesma linha. */
async function uuidDe(chave: string) {
  const h = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(chave))))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
  const v = (parseInt(h[16], 16) & 0x3 | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${v}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function trechoSugerido(b: string) {
  return norm(b).replace(/[*]/g, " ").replace(/\d+/g, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 2).join(" ");
}

export function ImportarFaturaDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [pedeSenha, setPedeSenha] = useState(false);
  const [senha, setSenha] = useState("");
  const [lendo, setLendo] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const [texto, setTexto] = useState("");
  const [fatura, setFatura] = useState<Fatura | null>(null);
  const [cartaoId, setCartaoId] = useState("");
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [lote, setLote] = useState(false);
  const [novoCartao, setNovoCartao] = useState(false);
  const [novaCatPara, setNovaCatPara] = useState<number | null>(null);

  const { data: categorias = [] } = useCategoriasDespesa(true);
  const cartoesQ = useQuery({
    queryKey: ["cartoes-fatura"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cartoes_fatura").select("*").eq("ativo", true).order("nome");
      if (error) throw error;
      return (data ?? []) as Cartao[];
    },
  });
  const cartoes = cartoesQ.data ?? [];
  const cartao = cartoes.find((c) => c.id === cartaoId);

  const grupos = useMemo(() => {
    const centrais = categorias.filter((c) => c.nivel === "central").sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    return centrais.map((c) => ({
      central: c,
      subs: categorias.filter((s) => s.nivel === "sub" && s.categoria_pai_id === c.id).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)),
    })).filter((g) => g.subs.length);
  }, [categorias]);

  const mesRef = useMemo(() => {
    const m = /^(\d{1,2})\/(\d{4})$/.exec(fatura?.mes_referencia ?? "");
    if (m) return { mes: Number(m[1]), ano: Number(m[2]) };
    if (fatura?.vencimento) { const [a, mm] = fatura.vencimento.split("-").map(Number); return { mes: mm, ano: a }; }
    const d = new Date(); return { mes: d.getMonth() + 1, ano: d.getFullYear() };
  }, [fatura]);
  const mesAno = `${String(mesRef.mes).padStart(2, "0")}/${mesRef.ano}`;

  const vencimento = useMemo(() => {
    if (fatura?.vencimento && /^\d{4}-\d{2}-\d{2}$/.test(fatura.vencimento)) return fatura.vencimento;
    if (!cartao?.dia_vencimento_padrao) return null;
    const ult = new Date(mesRef.ano, mesRef.mes, 0).getDate();
    const dia = Math.min(cartao.dia_vencimento_padrao, ult);
    return `${mesRef.ano}-${String(mesRef.mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  }, [fatura, cartao, mesRef]);

  async function montarLinhas(f: Fatura, cId: string) {
    const { data: rs } = await supabase.from("regras_categorizacao_fatura").select("id, padrao, categoria_id").eq("ativo", true).order("created_at");
    const regras = (rs ?? []) as Regra[];
    const cont = new Map<string, number>();
    const out: Linha[] = [];
    for (const l of f.linhas) {
      const base = `${cId}|${l.data ?? ""}|${norm(l.beneficiario)}|${Number(l.valor).toFixed(2)}|${l.parcela_atual ?? ""}/${l.parcela_total ?? ""}`;
      const n = (cont.get(base) ?? 0) + 1; cont.set(base, n);
      const origemId = await uuidDe(`${base}|${n}`);
      const b = norm(l.beneficiario);
      const regra = regras.find((r) => b.includes(norm(r.padrao)));
      out.push({
        ...l, origemId, excluida: l.sinal === "+", categoriaId: regra?.categoria_id ?? "", regra: !!regra,
        lembrar: true, trecho: trechoSugerido(l.beneficiario), lancada: false, jaExistia: false, enviando: false,
      });
    }
    const ids = out.filter((l) => !l.excluida).map((l) => l.origemId);
    if (ids.length) {
      const { data: ex } = await supabase.from("despesas").select("origem_id").eq("origem_tabela", ORIGEM).in("origem_id", ids);
      const set = new Set((ex ?? []).map((e) => e.origem_id));
      out.forEach((l) => { if (set.has(l.origemId)) { l.lancada = true; l.jaExistia = true; } });
    }
    setLinhas(out);
  }

  async function ler(file: File, pwd?: string) {
    setLendo(true);
    try {
      let t: string;
      try { t = await extrairTextoDocumento(file, pwd); }
      catch (e) {
        if (e instanceof SenhaPdfError) {
          setPedeSenha(true);
          toast.error(e.incorreta ? "Senha incorreta. Tente de novo." : "Fatura protegida — informe a senha.");
          return;
        }
        throw e;
      }
      setTexto(t);
      const { data, error } = await supabase.functions.invoke("ler-fatura-cartao", { body: { texto: t } });
      if (error || data?.error) {
        let msg = data?.error as string | undefined;
        try { msg ??= (await (error as { context?: Response })?.context?.json())?.error; } catch { /* ignore */ }
        throw new Error(msg || "Não foi possível ler a fatura.");
      }
      const f = data as Fatura;
      setFatura(f);
      const tn = norm(t), en = norm(f.emissor ?? "");
      const achado = cartoes.find((c) => c.identificador_pdf && (tn.includes(norm(c.identificador_pdf)) || en.includes(norm(c.identificador_pdf))));
      if (achado) { setCartaoId(achado.id); await montarLinhas(f, achado.id); }
      else toast.warning("Não reconheci o cartão desta fatura — escolha ou cadastre um.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível ler a fatura.");
    } finally {
      setLendo(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function escolher(file?: File | null) {
    if (!file) return;
    setArquivo(file); setPedeSenha(false); setSenha("");
    ler(file);
  }

  async function escolherCartao(id: string) {
    setCartaoId(id);
    if (fatura) await montarLinhas(fatura, id);
  }

  const upd = (i: number, p: Partial<Linha>) => setLinhas((ls) => ls && ls.map((l, j) => (j === i ? { ...l, ...p } : l)));

  async function lancarUma(i: number, l: Linha): Promise<boolean> {
    if (l.excluida || l.lancada || !l.categoriaId || !cartao || !vencimento) return false;
    upd(i, { enviando: true, erro: undefined });
    const uid = (await supabase.auth.getUser()).data.user?.id ?? null;
    const cat = categorias.find((c) => c.id === l.categoriaId);
    const parc = l.parcela_atual && l.parcela_total ? ` — Parcela ${l.parcela_atual}/${l.parcela_total}` : "";
    const valorLancado = Math.round(Number(l.valor) * 100) / 100;
    const pagaAuto = cartao.pagar_automatico_no_vencimento;
    const { error } = await supabase.from("despesas").insert({
      categoria_id: l.categoriaId,
      descricao: `${l.beneficiario.trim()} (${mesAno})${parc}`,
      valor: valorLancado,
      tipo: "variavel", status: pagaAuto ? "pago" : "pendente", data_competencia: vencimento,
      data_pagamento: pagaAuto ? proximoDiaUtil(vencimento) : null,
      valor_pago: pagaAuto ? valorLancado : null,
      forma_pagamento: "CARTÃO DE CRÉDITO", conta_bancaria: cartao.conta_bancaria,
      observacao: `Fatura ${cartao.nome}${fatura?.cartao_final ? ` final ${fatura.cartao_final}` : ""} ${mesAno} · compra em ${dataBR(l.data)}`,
      origem: "automatico", origem_tabela: ORIGEM, origem_id: l.origemId,
      created_by: uid, updated_by: uid,
    });
    if (error && error.code !== "23505") { upd(i, { enviando: false, erro: error.message }); return false; }
    if (!l.regra && l.lembrar && l.trecho.trim()) {
      await supabase.from("regras_categorizacao_fatura").insert({
        padrao: l.trecho.trim().toUpperCase(), categoria_id: l.categoriaId, descricao: cat ? `${cat.codigo ?? ""} ${cat.nome}`.trim() : null,
      });
    }
    upd(i, { enviando: false, lancada: true, jaExistia: error?.code === "23505" });
    return true;
  }

  async function lancarIndividual(i: number) {
    if (await lancarUma(i, linhas![i])) { toast.success("Despesa lançada."); qc.invalidateQueries({ queryKey: ["despesas"] }); }
  }

  async function lancarTodos() {
    if (!linhas) return;
    setLote(true);
    let ok = 0;
    for (let i = 0; i < linhas.length; i++) if (await lancarUma(i, linhas[i])) ok++;
    setLote(false);
    qc.invalidateQueries({ queryKey: ["despesas"] });
    const excl = linhas.filter((l) => l.excluida).length;
    const semCat = linhas.filter((l) => !l.excluida && !l.lancada && !l.categoriaId).length;
    toast.success(`${ok} lançada(s) · ${excl} excluída(s) (pagamento anterior) · ${semCat} sem categoria.`);
  }

  const ativas = (linhas ?? []).filter((l) => !l.excluida);
  const aLancar = ativas.filter((l) => !l.lancada && l.categoriaId);
  const semCategoria = ativas.filter((l) => !l.lancada && !l.categoriaId).length;
  const totalALancar = aLancar.reduce((s, l) => s + Number(l.valor), 0);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={`${linhas || fatura ? "max-w-4xl" : "max-w-lg"} max-h-[90vh] overflow-y-auto`}>
        <DialogHeader><DialogTitle>Importar fatura de cartão</DialogTitle></DialogHeader>
        <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => escolher(e.target.files?.[0])} />

        {!fatura ? (
          <div className="space-y-4 py-2">
            <button
              type="button" disabled={lendo}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); if (!lendo) setArrastando(true); }}
              onDragLeave={() => setArrastando(false)}
              onDrop={(e) => { e.preventDefault(); setArrastando(false); escolher(e.dataTransfer.files?.[0]); }}
              className={`w-full rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${arrastando ? "border-primary/70 bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/40"} ${lendo ? "opacity-60" : ""}`}
            >
              <FileUp className="mx-auto h-9 w-9 text-muted-foreground" />
              <p className="mt-3 font-medium">{lendo ? "Lendo fatura…" : "Subir fatura do cartão (PDF)"}</p>
              <p className="mt-1 text-sm text-muted-foreground">O arquivo não é guardado. Você também pode arrastá-lo aqui.</p>
            </button>
            {pedeSenha && arquivo && (
              <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); ler(arquivo, senha); }}>
                <div className="flex-1 space-y-1">
                  <Label>Senha da fatura</Label>
                  <Input type="password" autoFocus value={senha} onChange={(e) => setSenha(e.target.value)} />
                </div>
                <Button type="submit" disabled={lendo || !senha}>{lendo ? "Lendo…" : "Abrir"}</Button>
              </form>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
              Lançamentos lidos do PDF — confira antes de lançar. Nada foi salvo ainda.
            </div>
            <div className="grid gap-3 sm:grid-cols-4 text-sm">
              <div className="space-y-1 sm:col-span-2">
                <Label>Cartão</Label>
                <div className="flex gap-2">
                  <Select value={cartaoId} onValueChange={escolherCartao}>
                    <SelectTrigger><SelectValue placeholder="Escolha o cartão" /></SelectTrigger>
                    <SelectContent>{cartoes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button variant="outline" onClick={() => setNovoCartao(true)}>Novo</Button>
                </div>
                <p className="text-xs text-muted-foreground">Lido no PDF: {fatura.emissor ?? "?"}{fatura.cartao_final ? ` · final ${fatura.cartao_final}` : ""}</p>
              </div>
              <div><Label>Referência</Label><p className="mt-2">{mesAno}</p></div>
              <div>
                <Label>Vencimento</Label>
                <p className="mt-2">{dataBR(vencimento)}</p>
                <p className="text-xs text-muted-foreground">{fatura.vencimento ? "lido do PDF" : "pelo dia padrão do cartão"}</p>
              </div>
            </div>

            {linhas && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm">
                    <span className="font-semibold">{brl(totalALancar)}</span> a lançar ({aLancar.length})
                    {semCategoria > 0 && <span className="text-warning"> · {semCategoria} sem categoria</span>}
                    {fatura.valor_total != null && <span className="text-muted-foreground"> · total da fatura {brl(fatura.valor_total)}</span>}
                  </div>
                  <Button onClick={lancarTodos} disabled={lote || !aLancar.length || !vencimento}>{lote ? "Lançando…" : `Lançar todos (${aLancar.length})`}</Button>
                </div>
                <div className="space-y-2">
                  {linhas.map((l, i) => (
                    <div key={l.origemId} className={`rounded-md border p-2 text-sm ${l.erro ? "border-destructive/60" : ""} ${l.excluida ? "opacity-60" : ""}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="w-20 text-muted-foreground">{dataBR(l.data)}</span>
                        <span className={`min-w-0 flex-1 truncate font-medium ${l.excluida ? "line-through" : ""}`}>{l.beneficiario}</span>
                        {l.parcela_atual && l.parcela_total && <Badge variant="outline">Parcela {l.parcela_atual}/{l.parcela_total}</Badge>}
                        <span className={`w-28 text-right tabular-nums ${l.excluida ? "line-through" : ""}`}>{l.sinal === "+" ? "+" : ""}{brl(Number(l.valor))}</span>
                      </div>
                      {l.excluida ? (
                        <p className="mt-1 text-xs text-muted-foreground">Pagamento da fatura anterior — não lançado</p>
                      ) : (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <div className="min-w-[240px] flex-1">
                            <Select value={l.categoriaId} disabled={l.lancada} onValueChange={(v) => upd(i, { categoriaId: v, regra: false, erro: undefined })}>
                              <SelectTrigger className="h-8"><SelectValue placeholder="Escolha a categoria" /></SelectTrigger>
                              <SelectContent>
                                {grupos.map((g) => (
                                  <SelectGroup key={g.central.id}>
                                    <SelectLabel>{g.central.codigo} {g.central.nome}</SelectLabel>
                                    {g.subs.map((s) => <SelectItem key={s.id} value={s.id}>{s.codigo} {s.nome}</SelectItem>)}
                                  </SelectGroup>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button size="sm" variant="outline" className="h-8" disabled={l.lancada || lote} onClick={() => setNovaCatPara(i)}>Nova</Button>
                          {l.lancada ? <Badge variant="outline" className="border-success/40 text-success">{l.jaExistia ? "Já lançada antes" : "Lançada"}</Badge>
                            : l.regra ? <Badge variant="outline" className="border-success/40 text-success">Regra aplicada</Badge>
                            : !l.categoriaId ? <Badge variant="outline" className="border-warning/50 text-warning">Escolha a categoria</Badge> : null}
                          {!l.lancada && (
                            <Button size="sm" variant="outline" disabled={!l.categoriaId || l.enviando || lote || !vencimento} onClick={() => lancarIndividual(i)}>
                              {l.enviando ? "Lançando…" : "Lançar"}
                            </Button>
                          )}
                          {!l.lancada && !l.regra && l.categoriaId && (
                            <label className="flex w-full flex-wrap items-center gap-2 text-xs">
                              <Checkbox checked={l.lembrar} onCheckedChange={(b) => upd(i, { lembrar: !!b })} />
                              Lembrar esta categoria para
                              <Input className="h-7 w-48 text-xs" value={l.trecho} onChange={(e) => upd(i, { trecho: e.target.value })} />
                              nas próximas faturas
                            </label>
                          )}
                        </div>
                      )}
                      {l.erro && <p className="mt-1 text-xs text-destructive">{l.erro}</p>}
                    </div>
                  ))}
                </div>
              </>
            )}
            <DialogFooter>
              <Button variant="ghost" disabled={lote} onClick={() => { setFatura(null); setLinhas(null); setCartaoId(""); setTexto(""); }}>← Trocar PDF</Button>
              <Button variant="outline" onClick={onClose}>Fechar</Button>
            </DialogFooter>
          </div>
        )}
        {novoCartao && (
          <NovoCartaoDialog
            identificador={fatura?.emissor ?? (texto ? "" : "")}
            onClose={async (id) => {
              setNovoCartao(false);
              if (id) { await cartoesQ.refetch(); await escolherCartao(id); }
            }}
          />
        )}
        {novaCatPara !== null && (
          <NovaCategoriaDialog
            centrais={categorias.filter((c) => c.nivel === "central").sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))}
            onClose={(id) => {
              const i = novaCatPara;
              setNovaCatPara(null);
              if (id && i !== null && linhas?.[i] && !linhas[i].lancada) upd(i, { categoriaId: id, regra: false, erro: undefined });
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function NovoCartaoDialog({ identificador, onClose }: { identificador: string; onClose: (id?: string) => void }) {
  const [nome, setNome] = useState(identificador);
  const [ident, setIdent] = useState(identificador);
  const [dia, setDia] = useState("");
  const [forma, setForma] = useState("CARTÃO DE CRÉDITO");
  const [conta, setConta] = useState("BANCO INTER");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    const d = Number(dia);
    if (!nome.trim()) return toast.error("Informe o nome do cartão.");
    if (!(d >= 1 && d <= 31)) return toast.error("Dia de vencimento inválido.");
    setSalvando(true);
    const { data, error } = await supabase.from("cartoes_fatura").insert({
      nome: nome.trim(), identificador_pdf: ident.trim() || nome.trim(), dia_vencimento_padrao: d,
      forma_pagamento_padrao: forma, conta_bancaria: conta,
    }).select("id").single();
    setSalvando(false);
    if (error) return toast.error(error.message);
    toast.success("Cartão cadastrado.");
    onClose(data.id);
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Novo cartão</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Itaú Empresas" /></div>
          <div className="space-y-1">
            <Label>Texto que identifica a fatura no PDF</Label>
            <Input value={ident} onChange={(e) => setIdent(e.target.value)} placeholder="Ex.: Itaú" />
          </div>
          <div className="space-y-1"><Label>Dia de vencimento padrão</Label><Input type="number" min={1} max={31} value={dia} onChange={(e) => setDia(e.target.value)} /></div>
          <div className="space-y-1">
            <Label>Forma de pagamento</Label>
            <Select value={forma} onValueChange={setForma}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{FORMAS_DESPESA.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Conta bancária</Label>
            <Select value={conta} onValueChange={setConta}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CONTAS_DESPESA.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose()}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Cadastrar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
