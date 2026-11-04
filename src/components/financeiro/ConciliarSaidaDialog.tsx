import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCategoriasDespesa, useFornecedores } from "@/hooks/useDespesas";
import { diferencaValor } from "@/lib/conciliacaoSaida";
import { ConciliarSaidaSoma } from "@/components/financeiro/ConciliarSaidaSoma";

const JANELA_DIAS = 15;
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : "—");
const addDias = (d: string, n: number) => {
  const dt = new Date(`${d}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
};

const ERROS: Record<string, string> = {
  sem_permissao: "Apenas administradores e coordenadores podem conciliar.",
  movimento_ja_vinculado: "Esta saída já foi conciliada.",
  despesa_invalida: "Esta despesa já está conciliada.",
  categoria_invalida: "Escolha uma categoria válida.",
  descricao_obrigatoria: "Informe a descrição.",
};
const msgErro = (e: unknown) => {
  const m = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
  return Object.entries(ERROS).find(([k]) => m.includes(k))?.[1] ?? m ?? "Erro ao conciliar";
};

export interface MovimentoSaida {
  id: string; data_entrada: string; valor: number; titulo: string | null; descricao: string | null;
}

export function ConciliarSaidaDialog({ mov, onClose }: { mov: MovimentoSaida; onClose: () => void }) {
  const qc = useQueryClient();
  const valorBanco = Math.round(Number(mov.valor) * 100) / 100;
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const textoExtrato = [mov.titulo, mov.descricao].filter(Boolean).join(" · ");
  const [descricao, setDescricao] = useState(textoExtrato);
  const [categoriaId, setCategoriaId] = useState("");
  const [tipo, setTipo] = useState<"fixa" | "variavel">("variavel");
  const [fornecedorId, setFornecedorId] = useState("");
  const { data: categorias } = useCategoriasDespesa(true);
  const { data: fornecedores } = useFornecedores();
  const catsNovas = useMemo(() => (categorias ?? []).filter((c) => c.nivel), [categorias]);

  const cands = useQuery({
    queryKey: ["conciliar-saida-candidatos", mov.id],
    queryFn: async () => {
      const ini = addDias(mov.data_entrada, -JANELA_DIAS);
      const fim = addDias(mov.data_entrada, JANELA_DIAS);
      const janela = `and(data_pagamento.gte.${ini},data_pagamento.lte.${fim}),and(data_pagamento.is.null,data_competencia.gte.${ini},data_competencia.lte.${fim})`;
      const [{ data, error }, { data: manuais, error: e2 }] = await Promise.all([
        supabase.from("despesas")
          .select("id, descricao, valor, status, data_pagamento, data_competencia, conta_bancaria")
          .eq("conciliado", false).or(janela).limit(300),
        supabase.from("despesas")
          .select("id, descricao, valor, status, data_pagamento, data_competencia, conta_bancaria")
          .eq("conciliado", true).eq("valor", valorBanco)
          .or(`and(data_pagamento.gte.${ini},data_pagamento.lte.${fim}),and(data_competencia.gte.${ini},data_competencia.lte.${fim})`)
          .limit(20),
      ]);
      if (error) throw error;
      if (e2) throw e2;
      // Conciliadas à mão sem ligação com nenhuma linha do extrato.
      const idsMan = (manuais ?? []).map((r) => r.id);
      let semVinculo = manuais ?? [];
      if (idsMan.length) {
        const { data: v, error: e3 } = await supabase.from("conciliacoes_bancarias")
          .select("registro_id").eq("desfeito", false).in("registro_id", idsMan);
        if (e3) throw e3;
        const lig = new Set((v ?? []).map((x) => x.registro_id));
        semVinculo = semVinculo.filter((r) => !lig.has(r.id));
      }
      const map = (r: NonNullable<typeof data>[number], manual: boolean) => ({
        id: r.id, descricao: r.descricao, valor: Number(r.valor), status: r.status,
        data: r.data_pagamento ?? r.data_competencia, conta: r.conta_bancaria, manual,
      });
      return [
        ...semVinculo.map((r) => map(r, true)),
        ...(data ?? []).map((r) => map(r, false)).sort((a, b) => Math.abs(a.valor - valorBanco) - Math.abs(b.valor - valorBanco)),
      ];
    },
  });

  const fim = (msg: string) => {
    toast.success(msg);
    qc.invalidateQueries({ queryKey: ["conciliacao-bancaria"] });
    qc.invalidateQueries({ queryKey: ["despesas"] });
    onClose();
  };

  const vincular = useMutation({
    mutationFn: async (id: string) => {
      const manual = cands.data?.find((c) => c.id === id)?.manual;
      const { error } = manual
        ? await supabase.rpc("fn_conciliar_saida_vincular_conciliada", { p_movimento_id: mov.id, p_despesa_id: id })
        : await supabase.rpc("fn_conciliar_saida_despesa", { p_movimento_id: mov.id, p_despesa_id: id });
      if (error) throw error;
      return manual;
    },
    onSuccess: (manual) => {
      qc.invalidateQueries({ queryKey: ["saidas-sem-despesa"] });
      fim(manual ? "Saída ligada à despesa já conciliada" : "Saída conciliada e valor da despesa ajustado");
    },
    onError: (e) => toast.error(msgErro(e)),
  });

  const criar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("fn_conciliar_saida_nova_despesa", {
        p_movimento_id: mov.id, p_descricao: descricao, p_categoria_id: categoriaId, p_tipo: tipo,
        p_fornecedor_id: fornecedorId || undefined, p_forma_pagamento: "PIX",
      });
      if (error) throw error;
    },
    onSuccess: () => fim("Nova despesa criada e conciliada"),
    onError: (e) => toast.error(msgErro(e)),
  });

  const sel = cands.data?.find((c) => c.id === escolhido);
  const dif = sel ? diferencaValor(sel.valor, valorBanco) : 0;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Conciliar saída de {brl(valorBanco)} em {fmtData(mov.data_entrada)}</DialogTitle>
        </DialogHeader>
        {textoExtrato && <p className="text-sm text-muted-foreground">Extrato: {textoExtrato}</p>}
        <Tabs defaultValue="existente">
          <TabsList>
            <TabsTrigger value="existente">Despesa existente</TabsTrigger>
            <TabsTrigger value="soma">Várias despesas (soma)</TabsTrigger>
            <TabsTrigger value="nova">Nova despesa</TabsTrigger>
          </TabsList>

          <TabsContent value="existente" className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Despesas já conciliadas à mão com o mesmo valor aparecem primeiro. Depois, despesas não conciliadas entre {fmtData(addDias(mov.data_entrada, -JANELA_DIAS))} e {fmtData(addDias(mov.data_entrada, JANELA_DIAS))}, pelo valor mais próximo. Se o valor for diferente, a despesa passa a ter o valor do banco.
            </p>
            <div className="max-h-[340px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow><TableHead /><TableHead>Descrição</TableHead><TableHead>Data</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Valor</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {cands.isLoading && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Carregando…</TableCell></TableRow>}
                  {!cands.isLoading && (cands.data ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhuma despesa no período. Use "Nova despesa".</TableCell></TableRow>
                  )}
                  {(cands.data ?? []).map((c) => (
                    <TableRow key={c.id} className={`cursor-pointer ${escolhido === c.id ? "bg-muted" : ""}`} onClick={() => setEscolhido(c.id)}>
                      <TableCell><input type="radio" checked={escolhido === c.id} onChange={() => setEscolhido(c.id)} /></TableCell>
                      <TableCell>{c.descricao}</TableCell>
                      <TableCell>{fmtData(c.data)}</TableCell>
                      <TableCell>{c.manual ? "Conciliada manualmente" : c.status}</TableCell>
                      <TableCell className="text-right">{brl(c.valor)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {sel && dif !== 0 && (
              <p className="text-sm">Valor lançado {brl(sel.valor)} → valor do banco <strong>{brl(valorBanco)}</strong></p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button disabled={!escolhido || vincular.isPending} onClick={() => escolhido && vincular.mutate(escolhido)}>
                {vincular.isPending ? "Conciliando…" : dif !== 0 ? "Ajustar valor e conciliar" : "Conciliar"}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="soma">
            <ConciliarSaidaSoma movId={mov.id} data={mov.data_entrada} valorBanco={valorBanco}
              onDone={() => fim("Conciliação registrada")} onClose={onClose} />
          </TabsContent>

          <TabsContent value="nova" className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-1">
                <Label>Descrição</Label>
                <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Categoria</Label>
                <Select value={categoriaId} onValueChange={(v) => {
                  setCategoriaId(v);
                  const c = catsNovas.find((x) => x.id === v);
                  if (c) setTipo(c.tipo);
                }}>
                  <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
                  <SelectContent>
                    {catsNovas.map((c) => <SelectItem key={c.id} value={c.id}>{c.codigo ? `${c.codigo} ` : ""}{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v as "fixa" | "variavel")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixa">Fixa</SelectItem>
                    <SelectItem value="variavel">Variável</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Fornecedor (opcional)</Label>
                <Select value={fornecedorId || "nenhum"} onValueChange={(v) => setFornecedorId(v === "nenhum" ? "" : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Nenhum</SelectItem>
                    {(fornecedores ?? []).map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Valor e data</Label>
                <p className="text-sm pt-2">{brl(valorBanco)} · paga em {fmtData(mov.data_entrada)} · Banco Inter</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button disabled={!categoriaId || !descricao.trim() || criar.isPending} onClick={() => criar.mutate()}>
                {criar.isPending ? "Salvando…" : "Criar despesa e conciliar"}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
