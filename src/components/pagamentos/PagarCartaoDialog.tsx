import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CreditCard, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useCartoesCobranca, useCobrarCartaoSalvo, type CartaoCobravel } from "@/hooks/useCartoesCobranca";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  vendaId: string;
  alunoId: string;
  valor: number;
  onSuccess?: () => void;
  recorrencia?: boolean;
  parcelasTotais?: number;
  servicosInclusos?: { avaliacao_funcional: number; nutricao: number; reabilitacao: number; definir_depois: boolean } | null;
};


function luhn(n: string): boolean {
  const d = n.replace(/\D/g, "");
  if (d.length < 12) return false;
  let s = 0, odd = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let digit = parseInt(d[i]);
    if (odd) { digit *= 2; if (digit > 9) digit -= 9; }
    s += digit; odd = !odd;
  }
  return s % 10 === 0;
}

function detectBrand(num: string): string {
  const n = num.replace(/\D/g, "");
  if (/^4/.test(n)) {
    if (/^(4011|4312|4389|4514)/.test(n)) return "elo";
    return "visa";
  }
  if (/^(5067|6277|6362|6363)/.test(n)) return "elo";
  if (/^606282/.test(n)) return "hipercard";
  if (/^(34|37)/.test(n)) return "amex";
  if (/^(36|38)/.test(n)) return "diners";
  if (/^5[1-5]/.test(n)) return "master";
  const bin4 = parseInt(n.slice(0, 4));
  if (bin4 >= 2221 && bin4 <= 2720) return "master";
  return "desconhecida";
}

function formatCardNumber(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 19);
  return d.replace(/(.{4})/g, "$1 ").trim();
}

const brandLabel: Record<string, string> = {
  visa: "Visa", master: "Mastercard", elo: "Elo", hipercard: "Hipercard",
  amex: "Amex", diners: "Diners", desconhecida: "Bandeira",
};

/** "Mastercard ••••7452 · vence 10/2029" (curto: sem a validade). */
function rotuloCartao(c: CartaoCobravel, curto = false): string {
  const bandeira = brandLabel[(c.brand ?? "").toLowerCase()] ?? (c.brand ?? "Cartão");
  const base = `${bandeira} ••••${c.last4 ?? "????"}`;
  if (curto || !c.expiration_month || !c.expiration_year) return base;
  return `${base} · vence ${String(c.expiration_month).padStart(2, "0")}/${c.expiration_year}`;
}

export function PagarCartaoDialog({ open, onOpenChange, vendaId, alunoId, valor, onSuccess, recorrencia, parcelasTotais = 12, servicosInclusos = null }: Props) {
  const [num, setNum] = useState("");
  const [holder, setHolder] = useState("");
  const [mes, setMes] = useState("");
  const [ano, setAno] = useState("");
  const [cvv, setCvv] = useState("");
  const [parcelas, setParcelas] = useState("1");
  const [salvar, setSalvar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<{ status: "ok" | "erro" | "pending"; msg: string } | null>(null);

  // ── Cobrança de um clique com cartão salvo (somente admin) ──
  const { data: roles, isLoading: carregandoRoles } = useUserRoles();
  const isAdmin = !!roles?.isAdmin;
  const { data: cartoes = [], isLoading: carregandoLista } = useCartoesCobranca(alunoId, open && isAdmin);
  const cobrarSalvoMut = useCobrarCartaoSalvo();

  const [modo, setModo] = useState<"salvo" | "manual">("manual");
  const [cartaoSel, setCartaoSel] = useState<string | null>(null);
  const [travado, setTravado] = useState(false);
  const chaveRef = useRef<string>("");
  const emCursoRef = useRef(false);

  const temCartaoApto = isAdmin && cartoes.some((c) => c.apto);
  const carregandoCartoes = open && (carregandoRoles || (isAdmin && carregandoLista));

  useEffect(() => {
    if (!open) return;
    chaveRef.current = crypto.randomUUID();
    emCursoRef.current = false;
    setTravado(false);
  }, [open]);

  useEffect(() => {
    if (!open || carregandoCartoes) return;
    const aptos = cartoes.filter((c) => c.apto);
    if (aptos.length === 0) { setModo("manual"); return; }
    setModo("salvo");
    setCartaoSel((atual) => atual ?? (aptos.find((c) => c.is_default) ?? aptos[0]).id);
  }, [open, carregandoCartoes, cartoes]);

  const cartaoAtual = cartoes.find((c) => c.id === cartaoSel) ?? null;
  const modoSalvo = modo === "salvo" && temCartaoApto;
  const podeCobrarSalvo = !!cartaoAtual?.apto && !loading && !travado;
  const textoBotaoSalvo = cartaoAtual
    ? `Cobrar ${valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} no ${rotuloCartao(cartaoAtual, true)}`
    : "Cobrar";

  async function cobrarSalvo() {
    if (emCursoRef.current || travado || !cartaoAtual?.apto) return;
    emCursoRef.current = true;
    setLoading(true);
    setResultado(null);
    try {
      const r = await cobrarSalvoMut.mutateAsync({
        vendaId,
        cartaoId: cartaoAtual.id,
        installments: recorrencia ? 1 : Number(parcelas),
        idempotencyKey: chaveRef.current,
      });

      if (r.success) {
        const bandeira = brandLabel[(r.brand ?? cartaoAtual.brand ?? "").toLowerCase()] ?? (r.brand ?? "");
        toast.success(
          `Aprovado · ${valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · ${bandeira} ••••${r.last4 ?? cartaoAtual.last4 ?? ""} · TID ${r.tid ?? "—"}`,
        );
        if (r.aviso) toast.warning(r.aviso);
        onSuccess?.();
        onOpenChange(false);
        return;
      }

      if (r.incerto || r.em_processamento) {
        setTravado(true);
        setResultado({
          status: "pending",
          msg: r.motivo ?? r.error ?? "Resultado incerto — confira na Rede antes de tentar de novo.",
        });
        return;
      }

      // Recusa definitiva ou erro "nada foi cobrado": nova chave libera nova tentativa.
      chaveRef.current = crypto.randomUUID();
      setResultado({ status: "erro", msg: r.motivo ?? r.error ?? "Cobrança não autorizada" });
    } catch (e: unknown) {
      chaveRef.current = crypto.randomUUID();
      setResultado({ status: "erro", msg: e instanceof Error ? e.message : "Erro inesperado" });
    } finally {
      emCursoRef.current = false;
      setLoading(false);
    }
  }

  const brand = useMemo(() => detectBrand(num), [num]);
  const numClean = num.replace(/\D/g, "");
  const cvvMax = brand === "amex" ? 4 : 3;
  const luhnOk = numClean.length >= 12 && luhn(numClean);


  const canSubmit =
    luhnOk && holder.trim().length >= 3 && /^(0[1-9]|1[0-2])$/.test(mes) &&
    /^\d{4}$/.test(ano) && cvv.length >= 3 && !loading;

  async function submit() {
    setLoading(true);
    setResultado(null);
    try {
      const { data, error } = await supabase.functions.invoke("rede-cobrar-cartao", {
        body: {
          venda_id: vendaId,
          aluno_id: alunoId,
          card_number: numClean,
          card_holder: holder.trim().toUpperCase(),
          expiration_month: mes.padStart(2, "0"),
          expiration_year: ano.length === 2 ? "20" + ano : ano,

          security_code: cvv,
          installments: recorrencia ? 1 : Number(parcelas),
          save_card: salvar,
          servicos_inclusos: servicosInclusos,
        },

      });
      if (error) throw error;
      if (data?.success) {
        setResultado({ status: "ok", msg: `Aprovado · TID ${data.tid ?? "—"}` });
        toast.success("Pagamento aprovado");
        onSuccess?.();
      } else {
        setResultado({
          status: "erro",
          msg: `${data?.return_message ?? "Negado"} (cód ${data?.return_code ?? "?"})`,
        });
      }
    } catch (e: any) {
      setResultado({ status: "erro", msg: e?.message ?? "Erro inesperado" });
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setNum(""); setHolder(""); setMes(""); setAno(""); setCvv("");
    setParcelas("1"); setSalvar(false); setResultado(null);
    setTravado(false); emCursoRef.current = false;
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" /> Cobrar no cartão
          </DialogTitle>
        </DialogHeader>

        {carregandoCartoes ? (
          <div className="space-y-2 py-2" data-testid="cartoes-carregando">
            <div className="h-4 w-32 bg-muted animate-pulse rounded" />
            <div className="h-12 w-full bg-muted animate-pulse rounded" />
            <div className="h-9 w-full bg-muted animate-pulse rounded" />
          </div>
        ) : modoSalvo ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Valor</span>
            <span className="font-semibold">
              {valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
          </div>

          <div className="space-y-1.5">
            <Label>Cartão salvo</Label>
            <div className="space-y-1.5">
              {cartoes.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={cartaoSel === c.id}
                  disabled={!c.apto}
                  onClick={() => setCartaoSel(c.id)}
                  className={`w-full flex items-center justify-between rounded-lg border p-2.5 text-left text-sm transition ${
                    cartaoSel === c.id ? "border-primary bg-primary/5" : "border-border"
                  } ${c.apto ? "" : "opacity-50 cursor-not-allowed"}`}
                >
                  <span className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 shrink-0" />
                    <span>
                      {rotuloCartao(c)}
                      {c.is_default && <span className="text-muted-foreground"> · Padrão</span>}
                    </span>
                  </span>
                  {!c.apto && (
                    <Badge variant="outline" className="text-[10px]">{c.motivo_inapto ?? "indisponível"}</Badge>
                  )}
                </button>
              ))}
            </div>
          </div>

          {recorrencia ? (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs leading-relaxed">
              Será cobrada a <strong>1ª mensalidade</strong> de{" "}
              <strong>{valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong> agora.
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Parcelas</Label>
              <Select value={parcelas} onValueChange={setParcelas}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}x de {(valor / n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      {n === 1 ? " à vista" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {resultado && (
            <div className={`text-xs p-2 rounded flex items-start gap-2 ${
              resultado.status === "ok" ? "bg-success/10 text-success border border-success/30" :
              resultado.status === "pending" ? "bg-warning/10 text-warning border border-warning/30" :
              "bg-destructive/10 text-destructive border border-destructive/30"
            }`}>
              {resultado.status === "ok" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> :
               resultado.status === "pending" ? <Clock className="w-4 h-4 shrink-0" /> :
               <XCircle className="w-4 h-4 shrink-0" />}
              <span>{resultado.msg}</span>
            </div>
          )}

          <button
            type="button"
            className="text-xs text-primary underline underline-offset-2"
            onClick={() => { setModo("manual"); setResultado(null); }}
          >
            Usar outro cartão (digitar os dados)
          </button>

          <DialogFooter className="pt-1">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Fechar
            </Button>
            <Button onClick={cobrarSalvo} disabled={!podeCobrarSalvo}>
              {loading ? "Processando..." : textoBotaoSalvo}
            </Button>
          </DialogFooter>
        </div>
        ) : (
        <>
        <div className="space-y-3">

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Valor</span>
            <span className="font-semibold">
              {valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
          </div>

          <div className="space-y-1.5">
            <Label>Número do cartão</Label>
            <div className="relative">
              <Input
                value={formatCardNumber(num)}
                onChange={(e) => setNum(e.target.value)}
                placeholder="0000 0000 0000 0000"
                inputMode="numeric"
                autoComplete="cc-number"
              />
              {numClean.length >= 4 && (
                <Badge variant="outline" className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px]">
                  {brandLabel[brand]}
                </Badge>
              )}
            </div>
            {numClean.length >= 12 && !luhnOk && (
              <p className="text-xs text-destructive">Número inválido</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Nome do titular (como impresso)</Label>
            <Input
              value={holder}
              onChange={(e) => setHolder(e.target.value.toUpperCase())}
              placeholder="NOME SOBRENOME"
              autoComplete="cc-name"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label>Mês</Label>
              <Input
                value={mes}
                onChange={(e) => setMes(e.target.value.replace(/\D/g, "").slice(0, 2))}
                placeholder="MM" inputMode="numeric" maxLength={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Ano</Label>
              <Input
                value={ano}
                onChange={(e) => setAno(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="AAAA" inputMode="numeric" maxLength={4}
              />
            </div>
            <div className="space-y-1.5">
              <Label>CVV</Label>
              <Input
                type="password"
                value={cvv}
                onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, cvvMax))}
                placeholder={"•".repeat(cvvMax)}
                inputMode="numeric" maxLength={cvvMax}
              />
            </div>
          </div>

          {recorrencia ? (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs leading-relaxed">
              Será cobrada a <strong>1ª mensalidade</strong> de{" "}
              <strong>{valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong> agora.
              As demais <strong>{Math.max(0, parcelasTotais - 1)} mensalidades</strong> ficam agendadas no contrato
              para cobrança automática.
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Parcelas</Label>
              <Select value={parcelas} onValueChange={setParcelas}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}x de {(valor / n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      {n === 1 ? " à vista" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-start gap-2 pt-1">
            <Checkbox id="salvar" checked={salvar} onCheckedChange={(v) => setSalvar(!!v)} />
            <label htmlFor="salvar" className="text-xs leading-tight cursor-pointer">
              Salvar este cartão para renovação automática
              <span className="block text-muted-foreground">Tokenizamos com a Rede — não guardamos o número.</span>
            </label>
          </div>

          {resultado && (
            <div className={`text-xs p-2 rounded flex items-center gap-2 ${
              resultado.status === "ok" ? "bg-success/10 text-success border border-success/30" :
              resultado.status === "pending" ? "bg-warning/10 text-warning border border-warning/30" :
              "bg-destructive/10 text-destructive border border-destructive/30"
            }`}>
              {resultado.status === "ok" ? <CheckCircle2 className="w-4 h-4" /> :
               resultado.status === "pending" ? <Clock className="w-4 h-4" /> :
               <XCircle className="w-4 h-4" />}
              <span>{resultado.msg}</span>
            </div>
          )}

          {temCartaoApto && (
            <button
              type="button"
              className="text-xs text-primary underline underline-offset-2"
              onClick={() => { setModo("salvo"); setResultado(null); }}
            >
              Usar cartão salvo
            </button>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Fechar
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {loading ? "Processando..." : "Cobrar"}
          </Button>
        </DialogFooter>
        </>
        )}
      </DialogContent>
    </Dialog>
  );
}

