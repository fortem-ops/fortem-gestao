import { useEffect, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Plus, Ban, Loader2, MessageCircle, Check, Minus } from "lucide-react";
import { toast } from "sonner";
import DisparosMensagem from "./DisparosMensagem";
import DisparosRevisao from "./DisparosRevisao";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { CHIPS, MOTIVO_LABEL, statusDosChips, dataParaIso, isoParaData, formatarDataBr, brParaIso, mascararDataBr, type CanalDisparo, type MotivoExclusao, type SituacaoChip } from "@/lib/disparos";
import DisparosOptout from "./DisparosOptout";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { selecaoVazia, aoMudarBusca, aoMudarRecorte, marcarIds, limparIds, filtroParaSalvar, type Selecao } from "@/lib/disparosSelecao";
import { X, CalendarIcon } from "lucide-react";

type Row = { id: string; nome: string; status: string; tem_email: boolean; tem_whats: boolean; motivo: MotivoExclusao | null; cliente_desde: string | null };
type Resp = { total: number; com_email: number; com_whats: number; elegiveis: number; excl_equipe: number; excl_optout: number; excl_confirmou: number; excl_sem_contato: number; rows: Row[] };
const POR_PAGINA = 50;
const PASSOS = ["Público", "Mensagem", "Revisão e envio"];

export type EstadoPublico = {
  filtro: { chips: SituacaoChip[]; busca: string; exclConfirmados: boolean; exclSemContato: boolean; clienteDesdeDe: string | null; clienteDesdeAte: string | null };
  selecao: { modo: "todos"; removidos: string[] } | { modo: "ids"; ids: string[] };
  selecionados: number;
};

function CampoDataBr({ valor, onChange }: { valor: string | null; onChange: (v: string | null) => void }) {
  const [texto, setTexto] = useState(valor ? formatarDataBr(valor) : "");
  useEffect(() => { setTexto(valor ? formatarDataBr(valor) : ""); }, [valor]);
  const invalido = texto.length > 0 && !brParaIso(texto);
  return (
    <div className="flex items-center gap-1">
      <Input inputMode="numeric" placeholder="dd/mm/aaaa" value={texto} aria-invalid={invalido}
        className={cn("w-32 h-9 text-sm", invalido && "border-destructive focus-visible:ring-destructive")}
        onChange={(e) => {
          const t = mascararDataBr(e.target.value);
          setTexto(t);
          if (t === "") onChange(null);
          else { const iso = brParaIso(t); if (iso && iso !== valor) onChange(iso); }
        }} />
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Abrir calendário"><CalendarIcon className="h-4 w-4" /></Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={isoParaData(valor)} defaultMonth={isoParaData(valor)} onSelect={(d) => onChange(dataParaIso(d))} locale={ptBR} className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function Publico({ onEstado }: { onEstado: (e: EstadoPublico) => void }) {
  const canal: CanalDisparo = "whatsapp"; // dono: só WhatsApp no fluxo avulso por enquanto
  const [chips, setChips] = useState<SituacaoChip[]>(["ativos"]);
  const [busca, setBusca] = useState("");
  const [buscaD, setBuscaD] = useState("");
  const [exclConf, setExclConf] = useState(true);
  const [exclSem, setExclSem] = useState(true);
  const [desdeDe, setDesdeDe] = useState<string | null>(null);
  const [desdeAte, setDesdeAte] = useState<string | null>(null);
  const [pagina, setPagina] = useState(0);
  const [sel, setSel] = useState<Selecao>(selecaoVazia);
  const { todos, ids, removidos, nomes } = sel;

  useEffect(() => { const t = setTimeout(() => setBuscaD(busca), 300); return () => clearTimeout(t); }, [busca]);
  // Recorte mudou: ids marcados valiam para o recorte anterior → zera tudo.
  useEffect(() => { setPagina(0); setSel(aoMudarRecorte); }, [canal, chips, exclConf, exclSem, desdeDe, desdeAte]);
  // Busca mudou: só volta à 1ª página e desliga "todos"; seleção manual é mantida.
  useEffect(() => { setPagina(0); setSel(aoMudarBusca); }, [buscaD]);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["msg_publico", canal, chips, buscaD, exclConf, exclSem, desdeDe, desdeAte, pagina],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_msg_publico" as never, {
        p_status: statusDosChips(chips), p_busca: buscaD, p_canal: canal,
        p_excl_confirmados: exclConf, p_excl_sem_contato: exclSem, p_limit: POR_PAGINA, p_offset: pagina * POR_PAGINA,
        p_desde_de: desdeDe, p_desde_ate: desdeAte,
      } as never);
      if (error) throw error;
      return data as unknown as Resp;
    },
  });

  const rows = data?.rows ?? [];
  const elegiveisPagina = rows.filter((r) => !r.motivo);
  const marcado = (id: string) => (todos ? !removidos.has(id) : ids.has(id));
  const alternar = (id: string) => {
    if (todos) { const s = new Set(removidos); s.has(id) ? s.delete(id) : s.add(id); setSel({ ...sel, removidos: s }); }
    else { const r = rows.find((x) => x.id === id); setSel(marcarIds(sel, [{ id, nome: r?.nome ?? nomes.get(id) ?? "" }], !ids.has(id))); }
  };
  const paginaToda = elegiveisPagina.length > 0 && elegiveisPagina.every((r) => marcado(r.id));
  const alternarPaginaLote = () => {
    if (todos) { const s = new Set(removidos); elegiveisPagina.forEach((r) => (paginaToda ? s.add(r.id) : s.delete(r.id))); setSel({ ...sel, removidos: s }); }
    else setSel(marcarIds(sel, elegiveisPagina, !paginaToda));
  };
  const selecionados = todos ? Math.max(0, (data?.elegiveis ?? 0) - removidos.size) : ids.size;
  useEffect(() => {
    onEstado({
      filtro: filtroParaSalvar(todos, { chips, busca: buscaD, exclConfirmados: exclConf, exclSemContato: exclSem, clienteDesdeDe: desdeDe, clienteDesdeAte: desdeAte }, CHIPS.map((c) => c.v)),
      selecao: todos ? { modo: "todos", removidos: [...removidos] } : { modo: "ids", ids: [...ids] },
      selecionados,
    });
  }, [chips, buscaD, exclConf, exclSem, desdeDe, desdeAte, todos, removidos, ids, selecionados]); // eslint-disable-line react-hooks/exhaustive-deps
  const chipsSel = [...ids].slice(0, 10);
  const totalPaginas = Math.max(1, Math.ceil((data?.total ?? 0) / POR_PAGINA));

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MessageCircle className="h-4 w-4" />Canal: WhatsApp
        </div>
        <div className="flex flex-wrap gap-2">
          {CHIPS.map((c) => {
            const on = chips.includes(c.v);
            return (
              <Button key={c.v} size="sm" variant={on ? "default" : "outline"} className="rounded-full"
                onClick={() => setChips(on ? chips.filter((x) => x !== c.v) : [...chips, c.v])}>{c.l}</Button>
            );
          })}
        </div>
        <Input placeholder="Buscar por nome, e-mail ou telefone" value={busca} onChange={(e) => setBusca(e.target.value)} />
        {!todos && ids.size > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            <span className="text-muted-foreground">{ids.size} selecionados manualmente, independentes do filtro:</span>
            {chipsSel.map((id) => (
              <Badge key={id} variant="secondary" className="gap-1 pr-1">
                {nomes.get(id) || "—"}
                <button type="button" aria-label={`Remover ${nomes.get(id) ?? ""}`} onClick={() => setSel(marcarIds(sel, [{ id, nome: "" }], false))}><X className="h-3 w-3" /></button>
              </Badge>
            ))}
            {ids.size > 10 && <span className="text-muted-foreground">+ {ids.size - 10}</span>}
            <Button size="sm" variant="link" onClick={() => setSel(limparIds(sel))}>Limpar seleção</Button>
          </div>
        )}
        <div className="flex flex-wrap items-end gap-3">
          {([["Cliente desde (de)", desdeDe, setDesdeDe], ["Cliente desde (até)", desdeAte, setDesdeAte]] as const).map(([rotulo, val, set]) => (
            <div key={rotulo} className="space-y-1">
              <label className="text-xs text-muted-foreground">{rotulo}</label>
              <div className="flex items-center gap-1">
                <CampoDataBr valor={val} onChange={set} />
                {val && <Button size="sm" variant="ghost" onClick={() => set(null)}>limpar</Button>}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2"><Checkbox checked={exclConf} onCheckedChange={(v) => setExclConf(!!v)} />Excluir quem já confirmou presença na festa</label>
          <label className="flex items-center gap-2"><Checkbox checked={exclSem} onCheckedChange={(v) => setExclSem(!!v)} />Excluir quem está sem contato para o canal</label>
        </div>
        {data && data.elegiveis > 0 && (
          <div className="text-sm flex flex-wrap items-center gap-2">
            {todos
              ? <>Todos os {data.elegiveis} do filtro selecionados.<Button size="sm" variant="link" onClick={() => setSel(selecaoVazia())}>Limpar seleção</Button></>
              : <Button size="sm" variant="link" className="px-0" onClick={() => setSel({ ...sel, todos: true, removidos: new Set() })}>Selecionar todos os {data.elegiveis} do filtro</Button>}
          </div>
        )}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                  <th className="p-2 w-8"><Checkbox checked={paginaToda} onCheckedChange={alternarPaginaLote} aria-label="Selecionar página" /></th>
                  <th className="p-2">Nome</th><th className="p-2">Situação</th><th className="p-2">Cliente desde</th>
                  <th className="p-2 text-center">E-mail</th><th className="p-2 text-center">WhatsApp</th><th className="p-2">Exclusão</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? <tr><td colSpan={7} className="p-6 text-center"><Loader2 className="h-4 w-4 animate-spin inline" /></td></tr>
                  : error ? <tr><td colSpan={7} className="p-6 text-center text-destructive">Erro ao carregar o público.</td></tr>
                  : rows.length === 0 ? <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhum cadastro no filtro.</td></tr>
                  : rows.map((r) => (
                    <tr key={r.id} className={`border-b ${r.motivo ? "text-muted-foreground" : ""}`}>
                      <td className="p-2"><Checkbox disabled={!!r.motivo} checked={!r.motivo && marcado(r.id)} onCheckedChange={() => alternar(r.id)} /></td>
                      <td className="p-2">{r.nome}</td>
                      <td className="p-2 capitalize">{r.status}</td>
                      <td className="p-2">{formatarDataBr(r.cliente_desde)}</td>
                      <td className="p-2 text-center">{r.tem_email ? <Check className="h-4 w-4 inline text-primary" /> : <Minus className="h-4 w-4 inline" />}</td>
                      <td className="p-2 text-center">{r.tem_whats ? <Check className="h-4 w-4 inline text-primary" /> : <Minus className="h-4 w-4 inline" />}</td>
                      <td className="p-2">{r.motivo && <Badge variant="outline">{MOTIVO_LABEL[r.motivo]}</Badge>}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between p-2 text-sm">
            <span className="text-muted-foreground">Página {pagina + 1} de {totalPaginas}{isFetching ? "…" : ""}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>Anterior</Button>
              <Button size="sm" variant="outline" disabled={pagina + 1 >= totalPaginas} onClick={() => setPagina(pagina + 1)}>Próxima</Button>
            </div>
          </div>
        </Card>
      </div>
      <Card className="h-fit lg:sticky lg:top-4">
        <CardHeader className="pb-2"><CardTitle className="text-base">Resumo</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          {[
            ["Cadastros no filtro", data?.total], ["Com e-mail", data?.com_email], ["Com WhatsApp", data?.com_whats],
            ["Excluídos: equipe", data?.excl_equipe], ["Excluídos: opt-out", data?.excl_optout],
            ["Excluídos: já confirmou", data?.excl_confirmou], ["Excluídos: sem contato", data?.excl_sem_contato],
            ["Aptos", data?.elegiveis],
          ].map(([l, v]) => <div key={l as string} className="flex justify-between"><span className="text-muted-foreground">{l}</span><span>{v ?? "—"}</span></div>)}
          <div className="flex justify-between border-t pt-2 mt-2 font-medium"><span>Selecionados</span><span>{selecionados}</span></div>
          {!todos && ids.size > 0 && <p className="text-xs text-muted-foreground">{ids.size} selecionados manualmente, independentes do filtro.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

export default function DisparosAvulsos() {
  const [novo, setNovo] = useState(false);
  const [passo, setPasso] = useState(0);
  const [optout, setOptout] = useState(false);
  const [estado, setEstado] = useState<EstadoPublico | null>(null);
  const [campanhaId, setCampanhaId] = useState<string | null>(null);
  const [nome, setNome] = useState("Novo disparo");
  const [salvando, setSalvando] = useState(false);

  const irPara = async (i: number) => {
    if (i === 0 || (i === passo)) { setPasso(i); return; }
    if (!estado || estado.selecionados < 1) { toast.error("Selecione pelo menos 1 cadastro no Público."); return; }
    if (passo === 0) {
      setSalvando(true);
      const payload = { nome: nome.trim() || "Novo disparo", canal: "whatsapp", filtro: estado.filtro, selecao: estado.selecao };
      const q = campanhaId
        ? supabase.from("msg_campanhas").update(payload as never).eq("id", campanhaId).select("id").single()
        : supabase.from("msg_campanhas").insert({ ...payload, status: "rascunho" } as never).select("id").single();
      const { data, error } = await q;
      setSalvando(false);
      if (error) { toast.error("Não foi possível salvar o rascunho: " + error.message); return; }
      setCampanhaId((data as { id: string }).id);
    }
    setPasso(i);
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 justify-end">
        <Button variant="outline" onClick={() => setOptout(true)}><Ban className="h-4 w-4 mr-1" />Gerenciar opt-out</Button>
        {!novo && <Button onClick={() => { setNovo(true); setPasso(0); setCampanhaId(null); setNome("Novo disparo"); }}><Plus className="h-4 w-4 mr-1" />Novo disparo</Button>}
      </div>
      {novo ? (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {PASSOS.map((p, i) => (
                <Button key={p} size="sm" variant={passo === i ? "default" : "ghost"} disabled={salvando} onClick={() => irPara(i)}>{i + 1}. {p}</Button>
              ))}
              <Input className="h-8 w-48" value={nome} onChange={(e) => setNome(e.target.value)} aria-label="Nome do disparo" />
              {passo === 0 && <Button size="sm" disabled={salvando} onClick={() => irPara(1)}>{salvando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Avançar</Button>}
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setNovo(false)}>Fechar</Button>
            </div>
            <div className={passo === 0 ? "" : "hidden"}><Publico onEstado={setEstado} /></div>
            {passo === 1 && campanhaId && <DisparosMensagem campanhaId={campanhaId} />}
            {passo === 2 && campanhaId && <DisparosRevisao campanhaId={campanhaId} modoIds={estado?.selecao.modo === "ids"} chips={estado?.filtro.chips ?? []} clienteDesdeDe={estado?.filtro.clienteDesdeDe ?? null} clienteDesdeAte={estado?.filtro.clienteDesdeAte ?? null} selecionados={estado?.selecionados ?? 0} onVoltar={() => setPasso(1)} />}
            <Label className="sr-only">Assistente</Label>
          </CardContent>
        </Card>
      ) : <p className="text-sm text-muted-foreground text-center py-10">Clique em "Novo disparo" para montar o público.</p>}
      <DisparosOptout open={optout} onOpenChange={setOptout} />
    </div>
  );
}
