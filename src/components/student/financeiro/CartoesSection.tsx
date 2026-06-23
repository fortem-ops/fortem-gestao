import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CreditCard, Star, StarOff, Lock, ChevronDown, ChevronUp,
  Smartphone, Link2, Building2,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";

// ---------- Types ----------
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
};

interface Props {
  student: { id: string; nome: string };
}

// ---------- Helpers ----------
function BrandBadge({ brand }: { brand: string | null }) {
  const b = (brand ?? "").toLowerCase();
  const label =
    b.includes("visa") ? "Visa" :
    b.includes("master") || b === "mc" ? "Mastercard" :
    b.includes("elo") ? "Elo" :
    b.includes("hiper") ? "Hipercard" :
    b.includes("amex") || b.includes("express") ? "Amex" :
    brand || "—";

  const color =
    label === "Visa" ? "bg-[#1A1F71]" :
    label === "Mastercard" ? "bg-[#EB001B]" :
    label === "Elo" ? "bg-black" :
    label === "Hipercard" ? "bg-[#B3131B]" :
    label === "Amex" ? "bg-[#2E77BC]" : "bg-muted";

  const short =
    label === "Mastercard" ? "MC" :
    label === "Hipercard" ? "HC" :
    label.slice(0, 4).toUpperCase();

  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center justify-center w-9 h-6 rounded text-[10px] font-bold text-white ${color}`}>
        {short}
      </span>
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

function OrigemBadge({ origem }: { origem: Cartao["origem"] }) {
  if (origem === "portal_aluno")
    return <Badge className="bg-green-600 hover:bg-green-600 gap-1 text-xs"><Smartphone className="h-3 w-3" />App do Aluno</Badge>;
  if (origem === "link_cadastro")
    return <Badge className="bg-blue-600 hover:bg-blue-600 gap-1 text-xs"><Link2 className="h-3 w-3" />Link de Cadastro</Badge>;
  return <Badge className="bg-orange-600 hover:bg-orange-600 gap-1 text-xs"><Building2 className="h-3 w-3" />Recepção</Badge>;
}

const fmtData = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR");

const fmtDataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

const fmtBRL = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ---------- Linha do cartão com histórico colapsável ----------
function CartaoRow({
  cartao,
  onSetDefault,
  onDeactivate,
}: {
  cartao: Cartao;
  onSetDefault: (c: Cartao) => void;
  onDeactivate: (c: Cartao) => void;
}) {
  const [open, setOpen] = useState(false);

  const { data: transacoes = [], isLoading: loadingTx } = useQuery({
    queryKey: ["pagamentos-rede-cartao", cartao.last4],
    queryFn: async () => {
      const { data } = await supabase
        .from("pagamentos_rede")
        .select("id, tid, return_code, return_message, amount, installments, status, created_at, raw_response")
        .order("created_at", { ascending: false });
      return ((data ?? []) as Transacao[]).filter(
        (t) => (t.raw_response as any)?.last4 === cartao.last4
      );
    },
    enabled: open,
  });

  return (
    <>
      <TableRow className={!cartao.ativo ? "opacity-50" : ""}>
        <TableCell className="whitespace-nowrap text-sm">{fmtData(cartao.created_at)}</TableCell>
        <TableCell><OrigemBadge origem={cartao.origem} /></TableCell>
        <TableCell><BrandBadge brand={cartao.brand} /></TableCell>
        <TableCell className="font-medium text-sm">{cartao.holder_name ?? "—"}</TableCell>
        <TableCell className="font-mono text-sm tracking-wider">•••• •••• •••• {cartao.last4}</TableCell>
        <TableCell className="font-mono text-sm">
          {String(cartao.expiration_month ?? "").padStart(2, "0")}/{cartao.expiration_year}
        </TableCell>
        <TableCell>
          {cartao.ativo
            ? <Badge className="bg-green-600 hover:bg-green-600 text-xs">Sim</Badge>
            : <Badge variant="destructive" className="text-xs">Não</Badge>}
          {cartao.is_default && cartao.ativo && (
            <Badge className="ml-1 bg-yellow-500 hover:bg-yellow-500 text-xs text-black">Padrão</Badge>
          )}
        </TableCell>
        <TableCell>
          <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                Histórico
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        </TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              title={cartao.is_default ? "Cartão padrão para renovação" : "Definir como padrão"}
              onClick={() => onSetDefault(cartao)}
              disabled={!cartao.ativo || cartao.is_default}
              className="h-7 w-7"
            >
              {cartao.is_default
                ? <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                : <StarOff className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title="Desativar cartão"
              onClick={() => onDeactivate(cartao)}
              disabled={!cartao.ativo}
              className="h-7 w-7"
            >
              <Lock className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>

      {open && (
        <TableRow>
          <TableCell colSpan={9} className="p-0 bg-muted/30">
            <Collapsible open={open}>
              <CollapsibleContent>
                <div className="p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Transações do cartão •••• {cartao.last4}
                  </p>
                  {loadingTx ? (
                    <p className="text-xs text-muted-foreground">Carregando…</p>
                  ) : transacoes.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhuma transação registrada.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Data</TableHead>
                          <TableHead className="text-xs">TID</TableHead>
                          <TableHead className="text-xs">Valor</TableHead>
                          <TableHead className="text-xs">Parc.</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs">Retorno</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transacoes.map((t) => (
                          <TableRow key={t.id}>
                            <TableCell className="text-xs whitespace-nowrap">{fmtDataHora(t.created_at)}</TableCell>
                            <TableCell className="font-mono text-xs">{t.tid}</TableCell>
                            <TableCell className="text-xs whitespace-nowrap">{fmtBRL(t.amount)}</TableCell>
                            <TableCell className="text-xs">{t.installments ?? 1}x</TableCell>
                            <TableCell>
                              <Badge
                                variant={t.status === "approved" ? "default" : "destructive"}
                                className={`text-xs ${t.status === "approved" ? "bg-green-600 hover:bg-green-600" : ""}`}
                              >
                                {t.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              <span className="font-mono">{t.return_code}</span>
                              <span className="text-muted-foreground ml-1">{t.return_message}</span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ---------- Main Section ----------
export function CartoesSection({ student }: Props) {
  const qc = useQueryClient();
  const [toDeactivate, setToDeactivate] = useState<Cartao | null>(null);

  const { data: cartoes = [], isLoading } = useQuery({
    queryKey: ["cartoes-salvos-aluno", student.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cartoes_salvos")
        .select("*")
        .eq("aluno_id", student.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Cartao[];
    },
  });

  async function definirPadrao(c: Cartao) {
    await supabase
      .from("cartoes_salvos")
      .update({ is_default: false })
      .eq("aluno_id", student.id);
    const { error } = await supabase
      .from("cartoes_salvos")
      .update({ is_default: true })
      .eq("id", c.id);
    if (error) return toast.error("Falha ao definir padrão: " + error.message);
    toast.success("Cartão definido como padrão para renovação automática");
    qc.invalidateQueries({ queryKey: ["cartoes-salvos-aluno", student.id] });
  }

  async function desativarConfirmado(c: Cartao) {
    const { error } = await supabase
      .from("cartoes_salvos")
      .update({ ativo: false, is_default: false })
      .eq("id", c.id);
    if (error) return toast.error("Falha ao desativar: " + error.message);

    try {
      await (supabase.from("planos") as any)
        .update({ cartao_token_id: null })
        .eq("cartao_token_id", c.id);
    } catch { /* ignore */ }

    toast.success(`Cartão •••• ${c.last4} desativado`);
    setToDeactivate(null);
    qc.invalidateQueries({ queryKey: ["cartoes-salvos-aluno", student.id] });
  }

  const ativos = cartoes.filter((c) => c.ativo).length;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Cartões de Crédito</CardTitle>
            </div>
            <span className="text-xs text-muted-foreground">
              {ativos} ativo{ativos !== 1 ? "s" : ""} · {cartoes.length} cadastrado{cartoes.length !== 1 ? "s" : ""}
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-sm text-muted-foreground p-6">Carregando…</p>
          ) : cartoes.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6">
              Nenhum cartão cadastrado para este aluno.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Cadastro</TableHead>
                    <TableHead className="text-xs">Local</TableHead>
                    <TableHead className="text-xs">Bandeira</TableHead>
                    <TableHead className="text-xs">Titular</TableHead>
                    <TableHead className="text-xs">Cartão Final</TableHead>
                    <TableHead className="text-xs">Validade</TableHead>
                    <TableHead className="text-xs">Ativo</TableHead>
                    <TableHead className="text-xs">Transações</TableHead>
                    <TableHead className="text-xs text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cartoes.map((c) => (
                    <CartaoRow
                      key={c.id}
                      cartao={c}
                      onSetDefault={definirPadrao}
                      onDeactivate={setToDeactivate}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!toDeactivate} onOpenChange={(o) => !o && setToDeactivate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar cartão?</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja desativar o cartão{" "}
              <span className="font-mono font-medium">•••• {toDeactivate?.last4}</span>{" "}
              de <strong>{toDeactivate?.holder_name}</strong>?
              {toDeactivate?.is_default && (
                <span className="block mt-2 text-orange-500 font-medium">
                  ⚠️ Este é o cartão padrão — a renovação automática dos planos vinculados será desativada.
                </span>
              )}
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
    </>
  );
}
