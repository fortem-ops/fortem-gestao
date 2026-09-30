import { useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth, addMonths, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExportMenu } from "@/components/relatorios/ExportMenu";
import { labelFormaPagamento } from "@/lib/formasRecebimento";
import { useDiaADiaPrevisibilidade, useRecebiveisPrevistos, type RecebivelRow } from "@/hooks/usePrevisibilidade";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (v: unknown) => Number(v ?? 0) || 0;
const compacto = (n: number) =>
  n >= 1000 ? `R$ ${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k` : `R$ ${n.toFixed(0)}`;
const dataBR = (d?: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : "—");

const ORIGEM_LABEL: Record<string, string> = { mensalidade: "Mensalidade", servico: "Serviço", produto: "Produto" };
const ORIGEM_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  mensalidade: "default", servico: "secondary", produto: "outline",
};

function OrigemBadge({ origem }: { origem: string }) {
  return <Badge variant={ORIGEM_VARIANT[origem] ?? "outline"}>{ORIGEM_LABEL[origem] ?? origem}</Badge>;
}

const LIMITE = 500;

export function RecebiveisList() {
  const { data = [], isLoading } = useRecebiveisPrevistos();
  const [ini, setIni] = useState("");
  const [fim, setFim] = useState("");
  const [origem, setOrigem] = useState("todos");
  const [forma, setForma] = useState("todas");
  const [busca, setBusca] = useState("");

  const formas = useMemo(
    () => Array.from(new Set(data.map((r) => r.forma_pagamento).filter(Boolean) as string[])).sort(),
    [data],
  );

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return data.filter((r) => {
      const d = r.data_recebimento_prevista ?? "";
      if (ini && d < ini) return false;
      if (fim && d > fim) return false;
      if (origem !== "todos" && r.origem !== origem) return false;
      if (forma !== "todas" && r.forma_pagamento !== forma) return false;
      if (q && !(r.aluno_nome ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, ini, fim, origem, forma, busca]);

  const exportRows = useMemo(() => filtradas.map((r) => ({
    data_recebimento_prevista: dataBR(r.data_recebimento_prevista),
    aluno_nome: r.aluno_nome ?? "",
    origem: ORIGEM_LABEL[r.origem] ?? r.origem,
    descricao: r.descricao ?? "",
    forma_pagamento: labelFormaPagamento(r.forma_pagamento),
    bandeira: r.bandeira ?? "",
    valor_bruto: num(r.valor_bruto).toFixed(2).replace(".", ","),
    taxa_percentual: num(r.taxa_percentual).toFixed(2).replace(".", ","),
    valor_liquido: num(r.valor_liquido).toFixed(2).replace(".", ","),
    data_vencimento: dataBR(r.data_vencimento),
  })), [filtradas]);

  const columns = [
    { key: "data_recebimento_prevista", label: "Data prevista" },
    { key: "aluno_nome", label: "Aluno" },
    { key: "origem", label: "Origem" },
    { key: "descricao", label: "Descrição" },
    { key: "forma_pagamento", label: "Forma de pagamento" },
    { key: "bandeira", label: "Bandeira" },
    { key: "valor_bruto", label: "Valor bruto" },
    { key: "taxa_percentual", label: "Taxa %" },
    { key: "valor_liquido", label: "Valor líquido" },
    { key: "data_vencimento", label: "Vencimento" },
  ];

  const exibidas = filtradas.slice(0, LIMITE);
  const totalLiq = filtradas.reduce((s, r) => s + num(r.valor_liquido), 0);

  return (
    <div className="space-y-4">
      <Card className="glass-card">
        <CardContent className="pt-4 flex flex-wrap items-end gap-3">
          <div><Label className="text-xs">De</Label><Input type="date" value={ini} onChange={(e) => setIni(e.target.value)} className="h-9" /></div>
          <div><Label className="text-xs">Até</Label><Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="h-9" /></div>
          <div className="w-40">
            <Label className="text-xs">Origem</Label>
            <Select value={origem} onValueChange={setOrigem}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="mensalidade">Mensalidade</SelectItem>
                <SelectItem value="servico">Serviço</SelectItem>
                <SelectItem value="produto">Produto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-52">
            <Label className="text-xs">Forma de pagamento</Label>
            <Select value={forma} onValueChange={setForma}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {formas.map((f) => <SelectItem key={f} value={f}>{labelFormaPagamento(f)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-48">
            <Label className="text-xs">Aluno</Label>
            <Input placeholder="Buscar por nome" value={busca} onChange={(e) => setBusca(e.target.value)} className="h-9" />
          </div>
          <ExportMenu filename="recebiveis-previstos" rows={exportRows} columns={columns} />
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        {filtradas.length} recebível(is) · total líquido {brl(totalLiq)}
        {filtradas.length > LIMITE && ` · mostrando os primeiros ${LIMITE} de ${filtradas.length}`}
      </p>

      <Card className="glass-card">
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data prevista</TableHead>
                <TableHead>Aluno</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Forma/Bandeira</TableHead>
                <TableHead className="text-right">Valor bruto</TableHead>
                <TableHead className="text-right">Taxa %</TableHead>
                <TableHead className="text-right">Valor líquido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exibidas.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="py-1.5 whitespace-nowrap">{dataBR(r.data_recebimento_prevista)}</TableCell>
                  <TableCell className="py-1.5">{r.aluno_nome ?? "—"}</TableCell>
                  <TableCell className="py-1.5"><OrigemBadge origem={r.origem} /></TableCell>
                  <TableCell className="py-1.5">{r.descricao ?? "—"}</TableCell>
                  <TableCell className="py-1.5">
                    {labelFormaPagamento(r.forma_pagamento)}
                    {r.bandeira && <span className="text-xs text-muted-foreground"> · {r.bandeira.toUpperCase()}</span>}
                  </TableCell>
                  <TableCell className="py-1.5 text-right">{brl(num(r.valor_bruto))}</TableCell>
                  <TableCell className="py-1.5 text-right">{num(r.taxa_percentual).toFixed(2)}%</TableCell>
                  <TableCell className="py-1.5 text-right font-medium">{brl(num(r.valor_liquido))}</TableCell>
                </TableRow>
              ))}
              {!isLoading && exibidas.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nenhum recebível</TableCell></TableRow>
              )}
              {isLoading && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Carregando…</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function CalendarioCaixa() {
  const [mesRef, setMesRef] = useState(() => startOfMonth(new Date()));
  const inicio = format(startOfMonth(mesRef), "yyyy-MM-dd");
  const fim = format(endOfMonth(mesRef), "yyyy-MM-dd");
  const { data: dias = [] } = useDiaADiaPrevisibilidade(inicio, fim);
  const { data: recebiveis = [] } = useRecebiveisPrevistos();
  const [sel, setSel] = useState<string | null>(null);

  const porDia = useMemo(() => new Map(dias.map((d) => [d.dia, d])), [dias]);
  const ultimo = endOfMonth(mesRef).getDate();
  const offset = getDay(startOfMonth(mesRef));
  const celulas: (string | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: ultimo }, (_, i) => format(new Date(mesRef.getFullYear(), mesRef.getMonth(), i + 1), "yyyy-MM-dd")),
  ];
  while (celulas.length % 7) celulas.push(null);

  const itensSel: RecebivelRow[] = sel ? recebiveis.filter((r) => r.data_recebimento_prevista === sel) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => setMesRef((d) => addMonths(d, -1))} aria-label="Mês anterior">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-40 text-center font-medium capitalize">{format(mesRef, "MMMM/yyyy", { locale: ptBR })}</span>
        <Button variant="outline" size="icon" onClick={() => setMesRef((d) => addMonths(d, 1))} aria-label="Próximo mês">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <Card className="glass-card">
        <CardContent className="pt-4">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {SEMANA.map((s) => <div key={s} className="text-xs uppercase text-center text-muted-foreground">{s}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {celulas.map((dia, i) => {
              if (!dia) return <div key={`v${i}`} className="min-h-20 rounded-md bg-muted/10" />;
              const d = porDia.get(dia);
              const valor = num(d?.previsto_liquido);
              const util = d ? d.dia_util : true;
              const tem = valor > 0;
              return (
                <button
                  key={dia}
                  type="button"
                  disabled={!tem}
                  onClick={() => setSel(dia)}
                  className={`min-h-20 rounded-md border p-2 text-left flex flex-col justify-between transition-colors ${
                    tem ? "border-primary/40 bg-primary/10 hover:bg-primary/20 cursor-pointer" : "border-border cursor-default"
                  }`}
                >
                  <span className={`text-sm ${util ? "font-medium" : "text-muted-foreground/60"}`}>{Number(dia.slice(8))}</span>
                  {tem && <span className="text-sm font-semibold text-primary">{compacto(valor)}</span>}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="capitalize">
              {sel && format(new Date(`${sel}T12:00:00`), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor líquido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itensSel.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="py-1.5">{r.aluno_nome ?? "—"}</TableCell>
                    <TableCell className="py-1.5"><OrigemBadge origem={r.origem} /></TableCell>
                    <TableCell className="py-1.5">{r.descricao ?? "—"}</TableCell>
                    <TableCell className="py-1.5 text-right">{brl(num(r.valor_liquido))}</TableCell>
                  </TableRow>
                ))}
                {itensSel.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhum item encontrado</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {itensSel.length > 0 && (
            <p className="text-sm text-right">Total: <strong>{brl(itensSel.reduce((s, r) => s + num(r.valor_liquido), 0))}</strong></p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
