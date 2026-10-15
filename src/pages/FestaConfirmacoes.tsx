import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, MessageCircle, PartyPopper, Plus, Search, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRoles";
import { festa10AnosConfig as cfg } from "@/config/festa10anos";
import { brlCentavos, calcularTotalFesta, maskWhatsApp, whatsappValido } from "@/lib/festa10anos";
import { resumoFesta, type ConfirmacaoFesta } from "@/lib/festaResumo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const STATUS: Record<string, string> = { aguardando_pagamento: "Aguardando pagamento", confirmado: "Pago", isento: "Isento", cancelado: "Cancelado" };
const STATUS_COR: Record<string, string> = { aguardando_pagamento: "status-warning", confirmado: "status-active", isento: "status-info", cancelado: "" };
const rot = (lista: readonly { valor: string; rotulo: string }[], v: string) => lista.find((x) => x.valor === v)?.rotulo ?? v;
const lista = (l: readonly { valor: string; rotulo: string }[], vs: string[] | null) => (vs ?? []).map((v) => rot(l, v)).join(", ") || "—";
const fone = (w: string) => maskWhatsApp(w.replace(/^55/, ""));
const csv = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

type Pessoa = { nome: string; consumo: string[]; intolerancias: string[] };
type Edicao = { id?: string; nome: string; whatsapp: string; email: string; vinculo: string; consumo: string[]; intolerancias: string[]; acompanhantes: Pessoa[]; status: string; pagamento_forma: string; observacao: string };
const novaEdicao = (): Edicao => ({ nome: "", whatsapp: "", email: "", vinculo: "aluno_atual", consumo: [], intolerancias: [], acompanhantes: [], status: "aguardando_pagamento", pagamento_forma: "", observacao: "" });

function Marcar({ opcoes, valores, onChange }: { opcoes: readonly { valor: string; rotulo: string }[]; valores: string[]; onChange: (v: string[]) => void }) {
  return <div className="flex flex-wrap gap-3">{opcoes.map((o) => (
    <label key={o.valor} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={valores.includes(o.valor)} onChange={() => onChange(valores.includes(o.valor) ? valores.filter((x) => x !== o.valor) : [...valores, o.valor])} />{o.rotulo}</label>
  ))}</div>;
}

export default function FestaConfirmacoes() {
  const { user } = useAuth();
  const { data: roles, isLoading: carregandoRoles } = useUserRoles();
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [fStatus, setFStatus] = useState("todos");
  const [fVinculo, setFVinculo] = useState("todos");
  const [fOrigem, setFOrigem] = useState("todos");
  const [edit, setEdit] = useState<Edicao | null>(null);
  const [detalhe, setDetalhe] = useState<ConfirmacaoFesta | null>(null);
  const pode = !!roles?.isCoordAdmin;

  const { data: itens = [], isLoading } = useQuery({
    queryKey: ["festa-confirmacoes"],
    enabled: pode,
    queryFn: async () => {
      const { data, error } = await supabase.from("festa_confirmacoes").select("*, festa_acompanhantes(*)").order("criado_em", { ascending: false });
      if (error) throw error;
      return data as unknown as ConfirmacaoFesta[];
    },
  });

  const filtrados = useMemo(() => {
    const t = busca.trim().toLocaleLowerCase("pt-BR");
    return itens.filter((c) =>
      (!t || c.nome.toLocaleLowerCase("pt-BR").includes(t) || c.whatsapp.includes(t.replace(/\D/g, "") || "§") || c.festa_acompanhantes.some((a) => a.nome.toLocaleLowerCase("pt-BR").includes(t))) &&
      (fStatus === "todos" || c.status === fStatus) && (fVinculo === "todos" || c.vinculo === fVinculo) && (fOrigem === "todos" || c.origem === fOrigem));
  }, [itens, busca, fStatus, fVinculo, fOrigem]);

  const r = useMemo(() => resumoFesta(itens), [itens]);
  const invalidar = () => qc.invalidateQueries({ queryKey: ["festa-confirmacoes"] });

  const salvar = useMutation({
    mutationFn: async (e: Edicao) => {
      const n = e.acompanhantes.length;
      const total = e.status === "isento" ? 0 : calcularTotalFesta(n);
      const base = {
        nome: e.nome.trim(), whatsapp: `55${e.whatsapp.replace(/\D/g, "").replace(/^55(?=\d{11}$)/, "")}`, email: e.email.trim() || null, vinculo: e.vinculo,
        consumo: e.consumo, intolerancias: e.intolerancias, status: e.status, total_pessoas: 1 + n, total_centavos: total,
        observacao: e.observacao.trim() || null,
        pagamento_forma: e.status === "confirmado" ? (e.pagamento_forma || "manual") : null,
        pago_em: e.status === "confirmado" ? new Date().toISOString() : null,
        pago_valor_centavos: e.status === "confirmado" ? total : null,
      };
      let id = e.id;
      if (id) {
        const atual = itens.find((x) => x.id === id);
        const manterPagamento = atual?.status === "confirmado" && e.status === "confirmado";
        const { error } = await supabase.from("festa_confirmacoes").update(manterPagamento ? { ...base, pago_em: atual!.pago_em, pago_valor_centavos: atual!.pago_valor_centavos, pagamento_forma: atual!.pagamento_forma } : base).eq("id", id);
        if (error) throw error;
        const { error: e2 } = await supabase.from("festa_acompanhantes").delete().eq("confirmacao_id", id);
        if (e2) throw e2;
      } else {
        const { data, error } = await supabase.from("festa_confirmacoes").insert({ ...base, origem: "manual", acompanhantes: [], criado_por: user!.id }).select("id").single();
        if (error) throw error;
        id = data.id;
        await supabase.from("festa_eventos").insert({ confirmacao_id: id, acao: "criado_manual", usuario_id: user!.id });
      }
      if (n) {
        const { error } = await supabase.from("festa_acompanhantes").insert(e.acompanhantes.map((a) => ({ confirmacao_id: id!, nome: a.nome.trim(), consumo: a.consumo, intolerancias: a.intolerancias })));
        if (error) throw error;
      }
    },
    onSuccess: async () => { setEdit(null); await invalidar(); toast.success("Confirmação salva."); },
    onError: (e: any) => toast.error(e?.code === "23505" ? "Já existe uma confirmação ativa para este WhatsApp." : "Não foi possível salvar."),
  });

  const mudarStatus = useMutation({
    mutationFn: async ({ c, status, forma }: { c: ConfirmacaoFesta; status: string; forma?: string }) => {
      const pago = status === "confirmado";
      const { error } = await supabase.from("festa_confirmacoes").update({
        status, pagamento_forma: pago ? forma ?? "manual" : c.pagamento_forma,
        pago_em: pago ? new Date().toISOString() : c.pago_em, pago_valor_centavos: pago ? c.total_centavos : c.pago_valor_centavos,
      }).eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: async () => { setDetalhe(null); await invalidar(); toast.success("Atualizado."); },
    onError: () => toast.error("Não foi possível atualizar."),
  });

  const enviarWhats = async (c: ConfirmacaoFesta) => {
    const { data, error } = await supabase.functions.invoke("festa-confirmar", { body: { acao: "pix_equipe", id: c.id } });
    if (error || !data?.copia_e_cola) { toast.error("Não foi possível gerar o PIX agora."); return; }
    const msg = `Olá, ${c.nome.split(" ")[0]}. Para concluir sua confirmação na festa de 10 anos da FORTEM, o valor é ${brlCentavos(c.total_centavos)}. PIX copia e cola:\n\n${data.copia_e_cola}`;
    window.open(`https://wa.me/${c.whatsapp}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
  };

  const exportar = () => {
    const cab = ["Nome", "Tipo", "Titular", "WhatsApp", "E-mail", "Vínculo", "Consumo", "Intolerâncias", "Status", "Origem", "Total"];
    const linhas: unknown[][] = [];
    itens.filter((c) => c.status !== "cancelado").forEach((c) => {
      linhas.push([c.nome, "Convidado", "", fone(c.whatsapp), c.email ?? "", rot(cfg.vinculos, c.vinculo), lista(cfg.consumos, c.consumo), lista(cfg.intolerancias, c.intolerancias), STATUS[c.status], c.origem, brlCentavos(c.total_centavos)]);
      c.festa_acompanhantes.forEach((a) => linhas.push([a.nome, "Acompanhante", c.nome, fone(c.whatsapp), "", "", lista(cfg.consumos, a.consumo), lista(cfg.intolerancias, a.intolerancias), STATUS[c.status], c.origem, ""]));
    });
    const conteudo = [cab, ...linhas].map((l) => l.map(csv).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", conteudo], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "festa-fortem-10-anos.csv"; a.click(); URL.revokeObjectURL(url);
  };

  if (carregandoRoles) return <p className="p-8 text-sm text-muted-foreground">Carregando…</p>;
  if (!pode) return <p className="p-8 text-sm text-muted-foreground">Esta tela é restrita à gestão (coordenação e administração).</p>;

  const editValido = edit && edit.nome.trim().length >= 3 && whatsappValido(edit.whatsapp) && edit.acompanhantes.every((a) => a.nome.trim().length >= 2);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary"><PartyPopper className="h-5 w-5" /><span className="text-sm font-semibold">FORTEM · 10 ANOS</span></div>
          <h1 className="mt-2 text-2xl font-bold">Confirmações da festa</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportar} disabled={!itens.length}><Download className="mr-2 h-4 w-4" />Exportar CSV</Button>
          <Button onClick={() => setEdit(novaEdicao())}><Plus className="mr-2 h-4 w-4" />Adicionar manualmente</Button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5"><p className="text-sm text-muted-foreground">Pessoas confirmadas</p><p className="mt-1 text-3xl font-bold">{r.pessoasConfirmadas}</p></Card>
        <Card className="p-5"><p className="text-sm text-muted-foreground">Aguardando pagamento</p><p className="mt-1 text-3xl font-bold">{r.pessoasAguardando}</p><p className="text-xs text-muted-foreground">{r.confirmacoesAguardando} confirmações</p></Card>
        <Card className="p-5"><p className="text-sm text-muted-foreground">Valor recebido</p><p className="mt-1 text-2xl font-bold">{brlCentavos(r.recebidoCentavos)}</p></Card>
        <Card className="p-5"><p className="text-sm text-muted-foreground">Valor a receber</p><p className="mt-1 text-2xl font-bold">{brlCentavos(r.aReceberCentavos)}</p></Card>
      </div>
      <Card className="flex flex-wrap gap-x-8 gap-y-2 p-5 text-sm">
        {cfg.consumos.map((c) => <span key={c.valor}>{c.rotulo}: <strong>{r.consumo[c.valor] ?? 0}</strong></span>)}
        {cfg.intolerancias.map((c) => <span key={c.valor}>{c.rotulo}: <strong>{r.intolerancias[c.valor] ?? 0}</strong></span>)}
        <span className="text-muted-foreground">Contagem de convidados e acompanhantes não cancelados.</span>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Buscar" placeholder="Buscar por nome ou WhatsApp" value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" /></div>
          <Select value={fStatus} onValueChange={setFStatus}><SelectTrigger className="lg:w-52" aria-label="Status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os status</SelectItem>{Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
          <Select value={fVinculo} onValueChange={setFVinculo}><SelectTrigger className="lg:w-52" aria-label="Vínculo"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os vínculos</SelectItem>{cfg.vinculos.map((v) => <SelectItem key={v.valor} value={v.valor}>{v.rotulo}</SelectItem>)}</SelectContent></Select>
          <Select value={fOrigem} onValueChange={setFOrigem}><SelectTrigger className="lg:w-40" aria-label="Origem"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todas as origens</SelectItem><SelectItem value="site">Site</SelectItem><SelectItem value="manual">Manual</SelectItem></SelectContent></Select>
        </div>
        {isLoading ? <p className="p-8 text-center text-sm text-muted-foreground">Carregando…</p> : !filtrados.length ? <p className="p-8 text-center text-sm text-muted-foreground">Nenhuma confirmação encontrada.</p> : (
          <div className="overflow-x-auto"><Table>
            <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>WhatsApp</TableHead><TableHead>Vínculo</TableHead><TableHead>Acomp.</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead>Data</TableHead></TableRow></TableHeader>
            <TableBody>{filtrados.map((c) => (
              <TableRow key={c.id} className="cursor-pointer" onClick={() => setDetalhe(c)}>
                <TableCell className="font-medium">{c.nome}{c.origem === "manual" && <span className="ml-2 text-xs text-muted-foreground">manual</span>}</TableCell>
                <TableCell className="whitespace-nowrap">{fone(c.whatsapp)}</TableCell>
                <TableCell>{rot(cfg.vinculos, c.vinculo)}</TableCell>
                <TableCell>{c.festa_acompanhantes.length}</TableCell>
                <TableCell className="whitespace-nowrap">{brlCentavos(c.total_centavos)}</TableCell>
                <TableCell><Badge variant="outline" className={STATUS_COR[c.status]}>{STATUS[c.status]}</Badge></TableCell>
                <TableCell className="whitespace-nowrap">{format(new Date(c.criado_em), "dd/MM/yy HH:mm", { locale: ptBR })}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table></div>
        )}
      </Card>

      {/* Detalhe */}
      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent className="max-w-lg">
          {detalhe && <>
            <DialogHeader><DialogTitle>{detalhe.nome}</DialogTitle></DialogHeader>
            <div className="space-y-2 text-sm">
              <p>{fone(detalhe.whatsapp)}{detalhe.email ? ` · ${detalhe.email}` : ""}</p>
              <p>{rot(cfg.vinculos, detalhe.vinculo)} · origem {detalhe.origem} · <strong>{STATUS[detalhe.status]}</strong></p>
              <p>Consumo: {lista(cfg.consumos, detalhe.consumo)} · Intolerâncias: {lista(cfg.intolerancias, detalhe.intolerancias)}</p>
              {detalhe.festa_acompanhantes.map((a, i) => <p key={a.id} className="border-l-2 pl-3">Acompanhante {i + 1}: {a.nome} · {lista(cfg.consumos, a.consumo)} · {lista(cfg.intolerancias, a.intolerancias)}</p>)}
              <p>Total: <strong>{brlCentavos(detalhe.total_centavos)}</strong>{detalhe.pago_em ? ` · pago em ${format(new Date(detalhe.pago_em), "dd/MM HH:mm")} (${detalhe.pagamento_forma})` : ""}</p>
              {detalhe.observacao && <p className="text-muted-foreground">{detalhe.observacao}</p>}
            </div>
            <DialogFooter className="flex-wrap gap-2 sm:justify-start">
              <Button variant="outline" onClick={() => { const d = detalhe; setDetalhe(null); setEdit({ id: d.id, nome: d.nome, whatsapp: fone(d.whatsapp), email: d.email ?? "", vinculo: d.vinculo, consumo: d.consumo ?? [], intolerancias: d.intolerancias ?? [], acompanhantes: d.festa_acompanhantes.map((a) => ({ nome: a.nome, consumo: a.consumo ?? [], intolerancias: a.intolerancias ?? [] })), status: d.status, pagamento_forma: d.pagamento_forma ?? "", observacao: d.observacao ?? "" }); }}>Editar</Button>
              {detalhe.status === "aguardando_pagamento" && <>
                <Button onClick={() => mudarStatus.mutate({ c: detalhe, status: "confirmado", forma: "manual" })}>Marcar como pago (fora do PIX)</Button>
                {detalhe.total_centavos > 0 && <Button variant="outline" onClick={() => enviarWhats(detalhe)}><MessageCircle className="mr-2 h-4 w-4" />Enviar PIX por WhatsApp</Button>}
              </>}
              {detalhe.status !== "cancelado"
                ? <Button variant="destructive" onClick={() => mudarStatus.mutate({ c: detalhe, status: "cancelado" })}>Cancelar</Button>
                : <Button variant="outline" onClick={() => mudarStatus.mutate({ c: detalhe, status: "aguardando_pagamento" })}>Reativar</Button>}
            </DialogFooter>
          </>}
        </DialogContent>
      </Dialog>

      {/* Adicionar / editar */}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          {edit && <>
            <DialogHeader><DialogTitle>{edit.id ? "Editar confirmação" : "Adicionar manualmente"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Input aria-label="Nome completo" placeholder="Nome completo" value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input aria-label="WhatsApp" placeholder="(51) 99999-9999" value={edit.whatsapp} onChange={(e) => setEdit({ ...edit, whatsapp: maskWhatsApp(e.target.value) })} />
                <Input aria-label="E-mail" placeholder="E-mail (opcional)" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
              </div>
              <Select value={edit.vinculo} onValueChange={(v) => setEdit({ ...edit, vinculo: v })}><SelectTrigger aria-label="Vínculo"><SelectValue /></SelectTrigger><SelectContent>{cfg.vinculos.map((v) => <SelectItem key={v.valor} value={v.valor}>{v.rotulo}</SelectItem>)}</SelectContent></Select>
              <Marcar opcoes={cfg.consumos} valores={edit.consumo} onChange={(v) => setEdit({ ...edit, consumo: v })} />
              <Marcar opcoes={cfg.intolerancias} valores={edit.intolerancias} onChange={(v) => setEdit({ ...edit, intolerancias: v })} />
              <div className="space-y-3 border-t pt-4">
                <p className="text-sm font-medium">Acompanhantes ({edit.acompanhantes.length} de {cfg.limiteAcompanhantes})</p>
                {edit.acompanhantes.map((a, i) => (
                  <div key={i} className="space-y-2 rounded border p-3">
                    <div className="flex gap-2"><Input aria-label={`Acompanhante ${i + 1}`} placeholder="Nome" value={a.nome} onChange={(e) => setEdit({ ...edit, acompanhantes: edit.acompanhantes.map((x, j) => j === i ? { ...x, nome: e.target.value } : x) })} /><Button variant="ghost" size="icon" aria-label="Remover" onClick={() => setEdit({ ...edit, acompanhantes: edit.acompanhantes.filter((_, j) => j !== i) })}><X className="h-4 w-4" /></Button></div>
                    <Marcar opcoes={cfg.consumos} valores={a.consumo} onChange={(v) => setEdit({ ...edit, acompanhantes: edit.acompanhantes.map((x, j) => j === i ? { ...x, consumo: v } : x) })} />
                    <Marcar opcoes={cfg.intolerancias} valores={a.intolerancias} onChange={(v) => setEdit({ ...edit, acompanhantes: edit.acompanhantes.map((x, j) => j === i ? { ...x, intolerancias: v } : x) })} />
                  </div>
                ))}
                {edit.acompanhantes.length < cfg.limiteAcompanhantes && <Button variant="outline" size="sm" onClick={() => setEdit({ ...edit, acompanhantes: [...edit.acompanhantes, { nome: "", consumo: [], intolerancias: [] }] })}><Plus className="mr-1 h-4 w-4" />Adicionar acompanhante</Button>}
              </div>
              <Select value={edit.status} onValueChange={(v) => setEdit({ ...edit, status: v })}><SelectTrigger aria-label="Situação"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="aguardando_pagamento">Aguardando pagamento</SelectItem><SelectItem value="confirmado">Pago</SelectItem><SelectItem value="isento">Isento</SelectItem>{edit.id && <SelectItem value="cancelado">Cancelado</SelectItem>}</SelectContent></Select>
              {edit.status === "confirmado" && <Select value={edit.pagamento_forma || "manual"} onValueChange={(v) => setEdit({ ...edit, pagamento_forma: v })}><SelectTrigger aria-label="Forma de pagamento"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="manual">Fora do PIX do site</SelectItem><SelectItem value="dinheiro">Dinheiro</SelectItem><SelectItem value="pix">PIX</SelectItem></SelectContent></Select>}
              <Input aria-label="Observação" placeholder="Observação (opcional)" value={edit.observacao} onChange={(e) => setEdit({ ...edit, observacao: e.target.value })} />
              <p className="text-sm">Total: <strong>{brlCentavos(edit.status === "isento" ? 0 : calcularTotalFesta(edit.acompanhantes.length))}</strong></p>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button><Button disabled={!editValido || salvar.isPending} onClick={() => salvar.mutate(edit)}>Salvar</Button></DialogFooter>
          </>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
