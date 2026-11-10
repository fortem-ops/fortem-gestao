import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { diaDebito, somaItens, tetoSugerido, type ItemPixDisponivel } from "@/lib/pixAutomaticoGrupo";
import { CodigoPixAutorizacao, gerarCodigoGrupo, mensagemErroPix, type CodigoGerado } from "./pixAutomaticoGrupoUi";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  alunoId: string;
  onDone: () => void;
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBr = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");
const FORMA: Record<string, string> = {
  cartao_recorrencia: "Cartão", cartao_credito: "Cartão", pix_automatico: "Pix Automático", pix: "Pix", pendente: "Pendente",
};

export function AtivarPixDialog({ open, onOpenChange, alunoId, onDone }: Props) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [teto, setTeto] = useState("");
  const [tetoEditado, setTetoEditado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [codigo, setCodigo] = useState<CodigoGerado | null>(null);

  const itensQ = useQuery({
    queryKey: ["pix_aut_itens_disp", alunoId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_pix_aut_itens_disponiveis", { p_aluno: alunoId });
      if (error) throw error;
      return (data ?? []) as unknown as ItemPixDisponivel[];
    },
  });

  const itens = useMemo(() => itensQ.data ?? [], [itensQ.data]);
  const escolhidos = useMemo(() => itens.filter((i) => sel.has(`${i.tipo}:${i.id}`)), [itens, sel]);
  const soma = somaItens(escolhidos);
  const dia = diaDebito(escolhidos);

  useEffect(() => {
    if (!tetoEditado) setTeto(soma > 0 ? tetoSugerido(soma).toFixed(2).replace(".", ",") : "");
  }, [soma, tetoEditado]);

  useEffect(() => {
    if (!open) { setSel(new Set()); setTeto(""); setTetoEditado(false); setCodigo(null); }
  }, [open]);

  function toggle(key: string) {
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  }

  async function handleSubmit() {
    const t = Number(teto.replace(/\./g, "").replace(",", "."));
    if (escolhidos.length === 0) { toast.error("Escolha ao menos um item"); return; }
    if (!isFinite(t) || t < soma) { toast.error("O valor máximo não pode ser menor que a soma dos itens"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("fn_pix_aut_grupo_criar", {
        p_aluno: alunoId,
        p_itens: escolhidos.map((i) => ({ tipo: i.tipo, id: i.id })),
        p_teto: t,
      });
      if (error) throw new Error(mensagemErroPix(error.message));
      const grupoId = (data as { grupo_id?: string } | null)?.grupo_id;
      if (!grupoId) throw new Error("Rascunho não criado");
      onDone();
      const c = await gerarCodigoGrupo(grupoId);
      setCodigo(c);
      onDone();
      toast.success("Código de autorização gerado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar a autorização");
      onDone();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Pix Automático</DialogTitle>
          <DialogDescription>
            Escolha os itens que passam para o Pix Automático. Os outros continuam como estão.
          </DialogDescription>
        </DialogHeader>

        {codigo ? (
          <CodigoPixAutorizacao codigo={codigo} />
        ) : (
          <div className="space-y-4">
            {itensQ.isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : itens.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum contrato ou plano ativo com valor para ligar.</p>
            ) : (
              <div className="divide-y border rounded-md">
                {itens.map((i) => {
                  const key = `${i.tipo}:${i.id}`;
                  const ocupado = !!i.vinculado_grupo;
                  return (
                    <label key={key} className={`flex items-center gap-3 p-3 text-sm ${ocupado ? "opacity-50" : "cursor-pointer"}`}>
                      <Checkbox checked={sel.has(key)} disabled={ocupado} onCheckedChange={() => toggle(key)} />
                      <div className="flex-1">
                        <div className="font-medium">{i.descricao ?? "Item"}</div>
                        <div className="text-xs text-muted-foreground">
                          {i.tipo === "plano" ? "Plano adicional" : "Contrato"} · hoje: {FORMA[i.forma_pagamento ?? ""] ?? i.forma_pagamento ?? "—"} · vence {dataBr(i.vencimento)}
                          {ocupado ? " · já está em um Pix Automático" : ""}
                        </div>
                      </div>
                      <div className="font-medium">{brl(Number(i.valor))}</div>
                    </label>
                  );
                })}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Soma mensal</div>
                <div className="font-semibold">{brl(soma)}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Dia do débito</div>
                <div className="font-semibold">{dataBr(dia)}</div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="teto">Valor máximo sugerido ao aluno (R$)</Label>
              <Input id="teto" inputMode="decimal" value={teto}
                onChange={(e) => { setTeto(e.target.value); setTetoEditado(true); }} />
              <p className="text-xs text-muted-foreground">
                Sugestão: soma + 15%. O aluno confirma o valor máximo no app do banco; ele não poderá escolher menos que este valor.
              </p>
            </div>

            <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs">
              A cobrança mensal automática ainda não está ativa. Por enquanto só a autorização é criada;
              as mensalidades continuam sendo cobradas como hoje.
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            {codigo ? "Fechar" : "Cancelar"}
          </Button>
          {!codigo && (
            <Button onClick={handleSubmit} disabled={loading || escolhidos.length === 0}>
              {loading ? "Gerando..." : "Gerar código de autorização"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
