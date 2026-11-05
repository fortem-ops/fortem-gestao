import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { BuscaIndicador } from "@/components/indicacoes/IndicadoPorField";
import {
  corrigirIndicador, listarIndicacoes, MOTIVO_SEM_PONTOS_EQUIPE, ORIGEM_REGISTRO, recusarIndicacao, reverterIndicacao,
  STATUS_INDICACAO, vincularIndicacaoAntiga, type IndicacaoLinha, type IndicadorOpcao,
} from "@/lib/indicacoes";

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");
const hoje = () => new Date().toISOString().slice(0, 10);
const inicioAno = () => `${new Date().getFullYear()}-01-01`;

type Acao = { tipo: "recusar" | "reverter" | "corrigir"; linha: IndicacaoLinha } | { tipo: "vincular"; aluno: { aluno_id: string; nome: string } };

export function AdminIndicacoes() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("todos");
  const [padrinho, setPadrinho] = useState<IndicadorOpcao | null>(null);
  const [de, setDe] = useState(inicioAno());
  const [ate, setAte] = useState(hoje());
  const [acao, setAcao] = useState<Acao | null>(null);
  const [motivo, setMotivo] = useState("");
  const [novoIndicador, setNovoIndicador] = useState<IndicadorOpcao | null>(null);
  const [salvando, setSalvando] = useState(false);

  const filtros = { status: status === "todos" ? null : status, padrinho: padrinho?.aluno_id ?? null, de, ate };
  const { data: lista = [], isLoading } = useQuery({
    queryKey: ["admin-indicacoes", filtros],
    queryFn: () => listarIndicacoes(filtros),
  });
  const { data: resumo } = useQuery({
    queryKey: ["admin-indicacoes-resumo", de, ate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_indicacoes_resumo" as any, { p_de: de, p_ate: ate } as any);
      if (error) throw error;
      return data as any;
    },
  });
  const { data: semIndicador = [] } = useQuery({
    queryKey: ["admin-indicacoes-sem-indicador"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_indicacoes_sem_indicador" as any);
      if (error) throw error;
      return (data as { aluno_id: string; nome: string; status: string; created_at: string }[]) || [];
    },
  });

  // CRM: conversão por indicador no período filtrado.
  const porIndicador = useMemo(() => {
    const m = new Map<string, { id: string; nome: string; total: number; convertidas: number; pontos: number }>();
    lista.forEach((i) => {
      const r = m.get(i.padrinho_id) ?? { id: i.padrinho_id, nome: i.padrinho_nome, total: 0, convertidas: 0, pontos: 0 };
      r.total++; if (i.status === "convertida") { r.convertidas++; r.pontos += i.pontos_pagos; }
      m.set(i.padrinho_id, r);
    });
    return [...m.values()].sort((a, b) => b.convertidas - a.convertidas || b.total - a.total);
  }, [lista]);

  function fechar() { setAcao(null); setMotivo(""); setNovoIndicador(null); }

  async function confirmar() {
    if (!acao) return;
    setSalvando(true);
    try {
      if (acao.tipo === "recusar") await recusarIndicacao(acao.linha.id, motivo);
      if (acao.tipo === "reverter") await reverterIndicacao(acao.linha.id);
      if (acao.tipo === "corrigir") { if (!novoIndicador) throw new Error("Escolha o novo indicador."); await corrigirIndicador(acao.linha.id, novoIndicador.aluno_id); }
      if (acao.tipo === "vincular") { if (!novoIndicador) throw new Error("Escolha o indicador."); await vincularIndicacaoAntiga(acao.aluno.aluno_id, novoIndicador.aluno_id); }
      toast.success("Indicação atualizada");
      ["admin-indicacoes", "admin-indicacoes-resumo", "admin-indicacoes-sem-indicador", "indicacoes-mapa"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      fechar();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSalvando(false);
    }
  }

  const kpis = [
    { rotulo: "Indicações", valor: resumo?.indicacoes ?? "—" },
    { rotulo: "Convertidas", valor: resumo?.convertidas ?? "—" },
    { rotulo: "Taxa de conversão", valor: resumo ? `${String(resumo.taxa).replace(".", ",")}%` : "—" },
    { rotulo: "Pontos pagos", valor: resumo?.pontos_pagos ?? "—" },
    { rotulo: "No teto de 10 no ano", valor: resumo?.no_teto ?? "—" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <Card key={k.rotulo}><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{k.rotulo}</p>
            <p className="mt-1 text-2xl font-bold">{k.valor}</p>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Indicações</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {Object.entries(STATUS_INDICACAO).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>De</Label><Input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Até</Label><Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Indicador</Label><BuscaIndicador value={padrinho} onChange={setPadrinho} /></div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="p-2">Indicador</th><th className="p-2">Indicado</th><th className="p-2">Origem</th>
                  <th className="p-2">Status</th><th className="p-2">Pontos</th><th className="p-2">Motivo sem pontos</th>
                  <th className="p-2">Datas</th><th className="p-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? <tr><td colSpan={8} className="p-4 text-muted-foreground">Carregando…</td></tr>
                  : lista.length === 0 ? <tr><td colSpan={8} className="p-4 text-muted-foreground">Nenhuma indicação no filtro.</td></tr>
                  : lista.map((i) => (
                    <tr key={i.id} className="border-b border-border/50 align-top">
                      <td className="p-2"><Link to={`/alunos/${i.padrinho_id}`} className="text-primary hover:underline">{i.padrinho_nome}</Link>
                        {!i.padrinho_ativo && <span className="ml-1 text-[10px] text-muted-foreground">(inativo)</span>}</td>
                      <td className="p-2"><Link to={`/alunos/${i.indicado_id}`} className="text-primary hover:underline">{i.indicado_nome}</Link></td>
                      <td className="p-2">{ORIGEM_REGISTRO[i.origem] || i.origem}</td>
                      <td className="p-2"><Badge variant="outline">{STATUS_INDICACAO[i.status] || i.status}</Badge>
                        {i.motivo_recusa && <p className="mt-1 text-xs text-muted-foreground">{i.motivo_recusa}</p>}</td>
                      <td className="p-2">{i.pontos_pagos}{i.pontos_indicado > 0 && <span className="text-xs text-muted-foreground"> (+{i.pontos_indicado} indicado)</span>}</td>
                      <td className="p-2 text-xs">{i.sem_pontos_motivo ? MOTIVO_SEM_PONTOS_EQUIPE[i.sem_pontos_motivo] || i.sem_pontos_motivo : "—"}</td>
                      <td className="p-2 text-xs text-muted-foreground">
                        Criada {fmt(i.criada_em)}<br />
                        {i.convertido_em ? `Convertida ${fmt(i.convertido_em)}` : i.status === "pendente" ? `Expira ${fmt(i.expira_em)}` : ""}
                      </td>
                      <td className="p-2 text-right whitespace-nowrap">
                        {i.status === "pendente" && <>
                          <Button size="sm" variant="ghost" onClick={() => setAcao({ tipo: "corrigir", linha: i })}>Corrigir indicador</Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setAcao({ tipo: "recusar", linha: i })}>Recusar</Button>
                        </>}
                        {i.status === "convertida" && <Button size="sm" variant="ghost" onClick={() => setAcao({ tipo: "reverter", linha: i })}>Reverter</Button>}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Conversão por indicador (período)</CardTitle></CardHeader>
        <CardContent>
          {porIndicador.length === 0 ? <p className="text-sm text-muted-foreground">Sem indicações no período.</p> : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground"><tr className="border-b border-border">
                <th className="p-2">Indicador</th><th className="p-2">Indicações</th><th className="p-2">Convertidas</th><th className="p-2">Taxa</th><th className="p-2">Pontos</th>
              </tr></thead>
              <tbody>{porIndicador.map((r) => (
                <tr key={r.id} className="border-b border-border/50">
                  <td className="p-2"><Link to={`/alunos/${r.id}`} className="text-primary hover:underline">{r.nome}</Link></td>
                  <td className="p-2">{r.total}</td><td className="p-2">{r.convertidas}</td>
                  <td className="p-2">{Math.round((r.convertidas / r.total) * 100)}%</td><td className="p-2">{r.pontos}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prospects de origem Indicação sem indicador ({semIndicador.length})</CardTitle>
          <p className="text-xs text-muted-foreground">
            Indicações registradas aqui contam como anteriores ao programa: ficam no histórico, mas não geram pontos (motivo "anterior ao programa").
          </p>
        </CardHeader>
        <CardContent>
          {semIndicador.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum pendente.</p> : (
            <div className="divide-y divide-border">
              {semIndicador.map((a) => (
                <div key={a.aluno_id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <div>
                    <Link to={`/alunos/${a.aluno_id}`} className="font-medium text-primary hover:underline">{a.nome}</Link>
                    <p className="text-xs text-muted-foreground">{a.status} · cadastro {fmt(a.created_at)}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setAcao({ tipo: "vincular", aluno: a })}>Preencher indicador</Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!acao} onOpenChange={(o) => !o && fechar()}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>
              {acao?.tipo === "recusar" ? "Recusar indicação" : acao?.tipo === "reverter" ? "Reverter conversão"
                : acao?.tipo === "corrigir" ? "Corrigir indicador" : "Preencher indicador"}
            </DialogTitle>
            <DialogDescription>
              {acao?.tipo === "reverter" && "Volta a indicação para pendente (ou expirada) e estorna os pontos do indicador e do indicado. Permitido até 30 dias após a conversão."}
              {acao?.tipo === "vincular" && `${acao.aluno.nome}: a indicação fica registrada como anterior ao programa, sem pontos.`}
              {(acao?.tipo === "recusar" || acao?.tipo === "corrigir") && `Indicado: ${acao.linha.indicado_nome}`}
            </DialogDescription>
          </DialogHeader>
          {acao?.tipo === "recusar" && (
            <div className="space-y-1.5"><Label>Motivo *</Label><Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} /></div>
          )}
          {(acao?.tipo === "corrigir" || acao?.tipo === "vincular") && (
            <div className="space-y-1.5"><Label>{acao.tipo === "corrigir" ? "Novo indicador" : "Indicado por"}</Label>
              <BuscaIndicador value={novoIndicador} onChange={setNovoIndicador}
                excluirId={acao.tipo === "corrigir" ? acao.linha.indicado_id : acao.aluno.aluno_id} /></div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={fechar}>Cancelar</Button>
            <Button onClick={confirmar} disabled={salvando} variant={acao?.tipo === "recusar" ? "destructive" : "default"}>
              {salvando ? "Salvando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
