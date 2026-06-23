import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Lock, Search, Star, StarOff, Smartphone, Link2, Building2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ---------- Types ----------
type Aluno = { id: string; nome: string | null; email: string | null } | null;
type Cartao = {
  id: string;
  aluno_id: string;
  token_rede: string;
  brand: string | null;
  last4: string | null;
  holder_name: string | null;
  expiration_month: number | null;
  expiration_year: number | null;
  ativo: boolean;
  is_default: boolean;
  origem: "portal_aluno" | "link_cadastro" | "recepcao";
  created_at: string;
  alunos: Aluno;
};
type Transacao = {
  id: string;
  tid: string | null;
  return_code: string | null;
  return_message: string | null;
  amount: number;
  installments: number | null;
  status: string;
  created_at: string;
  raw_response: any;
  vendas: { valor_final: number | null; alunos: { nome: string | null } | null } | null;
};

// ---------- Brand icon (inline SVG, neutral) ----------
function BrandIcon({ brand }: { brand: string | null }) {
  const b = (brand ?? "").toLowerCase();
  const label =
    b.includes("visa") ? "Visa" :
    b.includes("master") || b === "mc" ? "Mastercard" :
    b.includes("elo") ? "Elo" :
    b.includes("hiper") ? "Hipercard" :
    b.includes("amex") || b.includes("express") ? "Amex" :
    brand || "—";

  const color =
    label === "Visa" ? "#1A1F71" :
    label === "Mastercard" ? "#EB001B" :
    label === "Elo" ? "#000" :
    label === "Hipercard" ? "#B3131B" :
    label === "Amex" ? "#2E77BC" : "#6b7280";

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex items-center justify-center w-9 h-6 rounded text-[10px] font-bold text-white"
        style={{ backgroundColor: color }}
      >
        {label === "Mastercard" ? "MC" : label === "Hipercard" ? "HC" : label.slice(0, 4).toUpperCase()}
      </div>
      <span className="text-sm">{label}</span>
    </div>
  );
}

function OrigemBadge({ origem }: { origem: Cartao["origem"] }) {
  if (origem === "portal_aluno")
    return <Badge className="bg-green-600 hover:bg-green-600 gap-1"><Smartphone className="h-3 w-3" />App do Aluno</Badge>;
  if (origem === "link_cadastro")
    return <Badge className="bg-blue-600 hover:bg-blue-600 gap-1"><Link2 className="h-3 w-3" />Link de Cadastro</Badge>;
  return <Badge className="bg-orange-600 hover:bg-orange-600 gap-1"><Building2 className="h-3 w-3" />Recepção</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  const ok = status === "approved";
  return (
    <Badge variant={ok ? "default" : "destructive"} className={ok ? "bg-green-600 hover:bg-green-600" : ""}>
      {status}
    </Badge>
  );
}

const fmtData = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");
const fmtDataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
const fmtBRL = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ---------- Page ----------
export default function CartoesCredito() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [bandeira, setBandeira] = useState<string>("todos");
  const [status, setStatus] = useState<string>("todos");
  const [selected, setSelected] = useState<Cartao | null>(null);
  const [toDeactivate, setToDeactivate] = useState<Cartao | null>(null);

  const { data: cartoes = [], isLoading } = useQuery({
    queryKey: ["cartoes-salvos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cartoes_salvos")
        .select(`*, alunos ( id, nome, email )`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Cartao[];
    },
  });

  const { data: transacoesAll = [] } = useQuery({
    queryKey: ["pagamentos-rede", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos_rede")
        .select(`*, vendas ( valor_final, alunos ( nome ) )`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Transacao[];
    },
    enabled: !!selected,
  });

  const transacoesCartao = useMemo(() => {
    if (!selected) return [];
    return transacoesAll.filter((t) => {
      const raw = t.raw_response ?? {};
      return raw?.last4 === selected.last4;
    });
  }, [transacoesAll, selected]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return cartoes.filter((c) => {
      if (q && !(c.holder_name ?? "").toLowerCase().includes(q) && !(c.last4 ?? "").includes(q)) return false;
      if (bandeira !== "todos" && !(c.brand ?? "").toLowerCase().includes(bandeira)) return false;
      if (status === "ativo" && !c.ativo) return false;
      if (status === "inativo" && c.ativo) return false;
      return true;
    });
  }, [cartoes, busca, bandeira, status]);

  const ativosCount = cartoes.filter((c) => c.ativo).length;

  async function definirPadrao(c: Cartao) {
    // remove default dos outros cartões do mesmo aluno e marca este
    const { error: e1 } = await supabase
      .from("cartoes_salvos")
      .update({ is_default: false })
      .eq("aluno_id", c.aluno_id);
    if (e1) return toast.error("Falha ao atualizar cartões: " + e1.message);

    const { error: e2 } = await supabase
      .from("cartoes_salvos")
      .update({ is_default: true })
      .eq("id", c.id);
    if (e2) return toast.error("Falha ao definir padrão: " + e2.message);

    toast.success("Cartão definido como padrão");
    qc.invalidateQueries({ queryKey: ["cartoes-salvos"] });
  }

  async function desativarConfirmado(c: Cartao) {
    const { error: e1 } = await supabase
      .from("cartoes_salvos")
      .update({ ativo: false, is_default: false })
      .eq("id", c.id);
    if (e1) return toast.error("Falha ao desativar: " + e1.message);

    // Remove vínculo em planos (se houver coluna)
    await supabase
      .from("planos" as any)
      .update({ cartao_token_id: null } as any)
      .eq("cartao_token_id", c.id)
      .then(() => {})
      .catch(() => {});

    toast.success(`Cartão **** ${c.last4} desativado`);
    setToDeactivate(null);
    qc.invalidateQueries({ queryKey: ["cartoes-salvos"] });
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <CreditCard className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Cartões de Crédito</h1>
            <p className="text-sm text-muted-foreground">
              {ativosCount} ativo{ativosCount === 1 ? "" : "s"} de {cartoes.length} cadastrado{cartoes.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por titular ou últimos 4 dígitos…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={bandeira} onValueChange={setBandeira}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Bandeira" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as bandeiras</SelectItem>
                <SelectItem value="visa">Visa</SelectItem>
                <SelectItem value="master">Mastercard</SelectItem>
                <SelectItem value="elo">Elo</SelectItem>
                <SelectItem value="hiper">Hipercard</SelectItem>
                <SelectItem value="amex">Amex</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cartões cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cadastro</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead>Bandeira</TableHead>
                  <TableHead>Titular</TableHead>
                  <TableHead>Cartão final</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead>Transações</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      Carregando…
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && filtrados.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      Nenhum cartão encontrado.
                    </TableCell>
                  </TableRow>
                )}
                {filtrados.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="whitespace-nowrap">{fmtData(c.created_at)}</TableCell>
                    <TableCell><OrigemBadge origem={c.origem} /></TableCell>
                    <TableCell><BrandIcon brand={c.brand} /></TableCell>
                    <TableCell>
                      <div className="font-medium">{c.holder_name ?? "—"}</div>
                      {c.alunos?.nome && (
                        <div className="text-xs text-muted-foreground">{c.alunos.nome}</div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">**** **** **** {c.last4}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {String(c.expiration_month ?? "").padStart(2, "0")}/{c.expiration_year}
                    </TableCell>
                    <TableCell>
                      {c.ativo
                        ? <Badge className="bg-green-600 hover:bg-green-600">Sim</Badge>
                        : <Badge variant="destructive">Não</Badge>}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => setSelected(c)}>
                        Ver histórico
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title={c.is_default ? "Cartão padrão" : "Definir como padrão"}
                          onClick={() => definirPadrao(c)}
                          disabled={!c.ativo}
                        >
                          {c.is_default
                            ? <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                            : <StarOff className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Desativar cartão"
                          onClick={() => setToDeactivate(c)}
                          disabled={!c.ativo}
                        >
                          <Lock className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Sheet histórico */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              Histórico — **** {selected?.last4} ({selected?.holder_name})
            </SheetTitle>
            <SheetDescription>
              Transações vinculadas a este cartão (identificadas pelos últimos 4 dígitos).
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>TID</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Parc.</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Retorno</TableHead>
                  <TableHead>Aluno</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transacoesCartao.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                      Nenhuma transação encontrada para este cartão.
                    </TableCell>
                  </TableRow>
                )}
                {transacoesCartao.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="whitespace-nowrap text-xs">{fmtDataHora(t.created_at)}</TableCell>
                    <TableCell className="font-mono text-xs">{t.tid}</TableCell>
                    <TableCell className="whitespace-nowrap">{fmtBRL(t.amount)}</TableCell>
                    <TableCell>{t.installments ?? 1}x</TableCell>
                    <TableCell><StatusBadge status={t.status} /></TableCell>
                    <TableCell className="text-xs">
                      <span className="font-mono">{t.return_code}</span>
                      <div className="text-muted-foreground">{t.return_message}</div>
                    </TableCell>
                    <TableCell className="text-xs">{t.vendas?.alunos?.nome ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SheetContent>
      </Sheet>

      {/* Confirmação desativar */}
      <AlertDialog open={!!toDeactivate} onOpenChange={(o) => !o && setToDeactivate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar cartão?</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja desativar o cartão <span className="font-mono">**** {toDeactivate?.last4}</span> de{" "}
              <strong>{toDeactivate?.holder_name}</strong>? Se este cartão for o padrão de algum plano,
              a renovação automática será desativada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toDeactivate && desativarConfirmado(toDeactivate)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
