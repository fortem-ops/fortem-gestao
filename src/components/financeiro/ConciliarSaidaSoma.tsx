import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { somaCentavos, totalLiquidoFatura } from "@/lib/conciliacaoSaida";
import { Plus, Trash2 } from "lucide-react";

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
  despesa_ja_ligada: "Alguma despesa já está ligada a outra saída.",
  soma_diferente: "A soma não bate com o valor da saída.",
  selecione_varias: "Selecione pelo menos duas despesas (ou uma, com crédito).",
  creditos_invalidos: "Cada crédito precisa de descrição e valor maior que zero.",
};

/** Liga uma saída (ex.: fatura de cartão) à soma de várias despesas já lançadas, sem mudar valores. */
export function ConciliarSaidaSoma({ movId, data, valorBanco, onDone, onClose }: {
  movId: string; data: string; valorBanco: number; onDone: () => void; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState("");
  const [creditos, setCreditos] = useState<{ descricao: string; valor: string }[]>([]);
  const ini = addDias(data, -45);
  const fim = addDias(data, 5);

  const q = useQuery({
    queryKey: ["conciliar-saida-soma", movId],
    queryFn: async () => {
      const janela = `and(data_pagamento.gte.${ini},data_pagamento.lte.${fim}),and(data_pagamento.is.null,data_competencia.gte.${ini},data_competencia.lte.${fim})`;
      const { data: rows, error } = await supabase.from("despesas")
        .select("id, descricao, valor, data_pagamento, data_competencia, conta_bancaria, forma_pagamento, conciliado")
        .or(janela).order("data_competencia").limit(1000);
      if (error) throw error;
      const ids = (rows ?? []).map((r) => r.id);
      const ligados = new Set<string>();
      for (let i = 0; i < ids.length; i += 300) {
        const parte = ids.slice(i, i + 300);
        const [{ data: a }, { data: b }] = await Promise.all([
          supabase.from("conciliacoes_bancarias").select("registro_id").eq("desfeito", false).eq("tabela_origem", "despesas").in("registro_id", parte),
          supabase.from("conciliacao_saida_itens").select("despesa_id").eq("ativo", true).in("despesa_id", parte),
        ]);
        (a ?? []).forEach((x) => ligados.add(x.registro_id));
        (b ?? []).forEach((x) => ligados.add(x.despesa_id));
      }
      return (rows ?? []).filter((r) => !ligados.has(r.id)).map((r) => ({
        id: r.id, descricao: r.descricao, valor: Number(r.valor), data: r.data_pagamento ?? r.data_competencia,
        conta: r.conta_bancaria ?? "", forma: r.forma_pagamento ?? "",
        cartao: (r.forma_pagamento ?? "").toUpperCase().includes("CART"),
      })).sort((x, y) => Number(y.cartao) - Number(x.cartao));
    },
  });

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (q.data ?? []).filter((r) => !t || `${r.descricao} ${r.conta} ${r.forma}`.toLowerCase().includes(t));
  }, [q.data, busca]);
  const escolhidos = (q.data ?? []).filter((r) => sel.has(r.id));
  const soma = somaCentavos(escolhidos.map((r) => r.valor));
  const credVals = creditos.map((c) => Number(c.valor.replace(/\./g, "").replace(",", ".")) || 0);
  const totalCred = somaCentavos(credVals);
  const total = totalLiquidoFatura(escolhidos.map((r) => r.valor), credVals);
  const dif = Math.round((valorBanco - total) * 100) / 100;
  const credOk = creditos.every((c, i) => c.descricao.trim() && credVals[i] > 0);
  const minimo = creditos.length ? 1 : 2;
  const visiveisTodos = lista.length > 0 && lista.every((r) => sel.has(r.id));

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleTodos = () => setSel((s) => {
    const n = new Set(s);
    lista.forEach((r) => (visiveisTodos ? n.delete(r.id) : n.add(r.id)));
    return n;
  });

  const ligar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("fn_conciliar_saida_multiplas", { p_movimento_id: movId, p_despesa_ids: [...sel],
        p_creditos: creditos.map((c, i) => ({ descricao: c.descricao.trim(), valor: credVals[i] })) });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["saidas-sem-despesa"] }); toast.success("Saída ligada às despesas selecionadas"); onDone(); },
    onError: (e: { message?: string }) => toast.error(Object.entries(ERROS).find(([k]) => e?.message?.includes(k))?.[1] ?? e?.message ?? "Erro"),
  });

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Para faturas de cartão: marque as despesas já lançadas que compõem o pagamento ({fmtData(ini)} a {fmtData(fim)}). Os valores não são alterados. Lançamentos de cartão aparecem primeiro.
      </p>
      <Input placeholder="Buscar por descrição, conta ou forma (ex.: C6)" value={busca} onChange={(e) => setBusca(e.target.value)} />
      <div className="max-h-[300px] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><input type="checkbox" aria-label="Selecionar visíveis" checked={visiveisTodos} onChange={toggleTodos} /></TableHead>
              <TableHead>Descrição</TableHead><TableHead>Data</TableHead><TableHead>Conta / forma</TableHead><TableHead className="text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Carregando…</TableCell></TableRow>}
            {!q.isLoading && !lista.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhuma despesa disponível.</TableCell></TableRow>}
            {lista.map((r) => (
              <TableRow key={r.id} className={`cursor-pointer ${sel.has(r.id) ? "bg-muted" : ""}`} onClick={() => toggle(r.id)}>
                <TableCell><input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} onClick={(e) => e.stopPropagation()} /></TableCell>
                <TableCell>{r.descricao}</TableCell>
                <TableCell>{fmtData(r.data)}</TableCell>
                <TableCell className="text-xs">{[r.conta, r.forma].filter(Boolean).join(" · ")}</TableCell>
                <TableCell className="text-right">{brl(r.valor)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="space-y-2 rounded-md border p-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Créditos da fatura (estornos/devoluções)</p>
          <Button size="sm" variant="outline" onClick={() => setCreditos((c) => [...c, { descricao: "", valor: "" }])}>
            <Plus className="h-4 w-4 mr-1" />Adicionar crédito
          </Button>
        </div>
        {creditos.map((c, i) => (
          <div key={i} className="flex gap-2">
            <Input placeholder="Descrição (ex.: devolução de compra)" value={c.descricao} maxLength={200}
              onChange={(e) => setCreditos((l) => l.map((x, j) => (j === i ? { ...x, descricao: e.target.value } : x)))} />
            <Input className="w-36" inputMode="decimal" placeholder="0,00" value={c.valor}
              onChange={(e) => setCreditos((l) => l.map((x, j) => (j === i ? { ...x, valor: e.target.value } : x)))} />
            <Button size="icon" variant="ghost" aria-label="Remover crédito" onClick={() => setCreditos((l) => l.filter((_, j) => j !== i))}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {!creditos.length && <p className="text-xs text-muted-foreground">Use quando a fatura veio menor por um valor devolvido no cartão. O crédito é descontado da soma.</p>}
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <span>Saída: <strong>{brl(valorBanco)}</strong></span>
        <span>Selecionado ({escolhidos.length}): <strong>{brl(soma)}</strong></span>
        {creditos.length > 0 && <span>Créditos: <strong>− {brl(totalCred)}</strong></span>}
        {creditos.length > 0 && <span>Total: <strong>{brl(total)}</strong></span>}
        <span className={Math.abs(dif) <= 0.01 ? "text-success" : "text-destructive"}>Diferença: {brl(dif)}</span>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button disabled={escolhidos.length < minimo || !credOk || Math.abs(dif) > 0.01 || ligar.isPending} onClick={() => ligar.mutate()}>
          {ligar.isPending ? "Ligando…" : "Associar à soma"}
        </Button>
      </DialogFooter>
    </div>
  );
}
