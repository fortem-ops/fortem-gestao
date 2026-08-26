import { useState, FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CreditCard, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  alunoId: string;
  alunoNome?: string;
  origem: "portal_aluno" | "link_cadastro" | "recepcao";
  token?: string;               // apenas quando origem = link_cadastro
  compact?: boolean;            // true = layout no portal (sem Dialog wrapper)
  onSuccess?: () => void;
}

/* ---------- helpers de cartão ---------- */
function luhn(n: string): boolean {
  const d = n.replace(/\D/g, "");
  if (d.length < 12) return false;
  let s = 0, odd = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let dg = parseInt(d[i]);
    if (odd) { dg *= 2; if (dg > 9) dg -= 9; }
    s += dg; odd = !odd;
  }
  return s % 10 === 0;
}
function detectBrand(num: string): string {
  const n = num.replace(/\D/g, "");
  if (/^4/.test(n)) return "Visa";
  if (/^(5067|6277|6362|6363|4011|4312|4389|4514)/.test(n)) return "Elo";
  if (/^606282/.test(n)) return "Hipercard";
  if (/^(34|37)/.test(n)) return "Amex";
  if (/^5[1-5]/.test(n)) return "Mastercard";
  const bin4 = parseInt(n.slice(0, 4));
  if (bin4 >= 2221 && bin4 <= 2720) return "Mastercard";
  return "";
}
function formatCardNumber(v: string) {
  return v.replace(/\D/g, "").slice(0, 19).replace(/(.{4})/g, "$1 ").trim();
}

/* ---------- formulário reutilizável ---------- */
export function CartaoForm({
  alunoId, alunoNome, origem, token, onSuccess, onCancel,
}: {
  alunoId: string;
  alunoNome?: string;
  origem: Props["origem"];
  token?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const [numero, setNumero] = useState("");
  const [titular, setTitular] = useState(alunoNome ?? "");
  const [validade, setValidade] = useState("");
  const [cvv, setCvv] = useState("");
  const [loading, setLoading] = useState(false);

  const brand = detectBrand(numero);
  const numeroLimpo = numero.replace(/\D/g, "");
  const numeroValido = luhn(numeroLimpo);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!numeroValido) return toast.error("Número do cartão inválido");
    if (!titular.trim()) return toast.error("Informe o titular");
    const [mm, yy] = validade.split("/");
    if (!mm || !yy || parseInt(mm) < 1 || parseInt(mm) > 12)
      return toast.error("Validade inválida (MM/AA)");
    if (cvv.length < 3) return toast.error("CVV inválido");

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("rede-salvar-cartao", {
        body: {
          aluno_id: alunoId,
          card_number: numeroLimpo,
          card_holder: titular,
          expiration_month: mm,
          expiration_year: yy,
          security_code: cvv,
          origem,
          token,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "Falha ao salvar cartão");

      const substituido = data?.substituiu_last4 ?? data?.cartao_substituido_last4 ?? null;

      if (data?.status === "pending" || !data?.last4) {
        toast.success(
          "Cartão enviado para validação — ao ser aprovado, passará a ser o seu cartão principal para as próximas cobranças.",
        );
      } else if (substituido) {
        toast.success(
          `Cartão •••• ${data.last4} cadastrado como principal — substituiu o cartão anterior final ${substituido}.`,
        );
      } else {
        toast.success(
          `Cartão •••• ${data.last4} cadastrado como principal — será usado nas próximas cobranças automáticas.`,
        );
      }

      onSuccess?.();


    } catch (err: any) {
      toast.error(err.message ?? "Erro ao salvar cartão");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="num">Número do cartão</Label>
        <div className="relative">
          <Input
            id="num" inputMode="numeric" autoComplete="cc-number"
            placeholder="0000 0000 0000 0000"
            value={numero}
            onChange={(e) => setNumero(formatCardNumber(e.target.value))}
            className="pr-16 font-mono tracking-wider"
          />
          {brand && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
              {brand}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="titular">Titular (como no cartão)</Label>
        <Input
          id="titular" autoComplete="cc-name"
          value={titular}
          onChange={(e) => setTitular(e.target.value.toUpperCase())}
          placeholder="NOME COMO NO CARTÃO"
          className="uppercase"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="val">Validade (MM/AA)</Label>
          <Input
            id="val" inputMode="numeric" autoComplete="cc-exp"
            placeholder="MM/AA" maxLength={5}
            value={validade}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 4);
              setValidade(v.length > 2 ? `${v.slice(0, 2)}/${v.slice(2)}` : v);
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cvv">CVV</Label>
          <Input
            id="cvv" inputMode="numeric" autoComplete="cc-csc"
            placeholder="123" maxLength={4}
            value={cvv}
            onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
          />
        </div>
      </div>

      <div className="flex items-start gap-2 text-xs bg-primary/10 border border-primary/20 text-foreground rounded-lg p-3">
        <Star className="h-4 w-4 mt-0.5 text-primary shrink-0" />
        <p>
          Este cartão se tornará seu <strong>método de pagamento principal</strong> e será usado
          nas próximas cobranças automáticas. Se já houver um cartão com o mesmo final cadastrado,
          ele será substituído por este.
        </p>
      </div>

      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
        <ShieldCheck className="h-4 w-4 mt-0.5 text-primary shrink-0" />
        <p>
          O cartão será validado com uma pré-autorização de <strong>R$ 0,01</strong> cancelada
          imediatamente. Não armazenamos o número — apenas um token seguro via Rede.
        </p>
      </div>


      <div className="flex gap-2 justify-end pt-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={loading || !numeroValido}>
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CreditCard className="h-4 w-4 mr-2" />}
          Salvar cartão
        </Button>
      </div>
    </form>
  );
}

/* ---------- Wrapper Dialog (usado no perfil do aluno / portal) ---------- */
export function CadastrarCartaoDialog({
  open, onOpenChange, alunoId, alunoNome, origem, token, onSuccess,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cadastrar cartão de crédito</DialogTitle>
          <DialogDescription>
            Salve um cartão para cobranças futuras e renovação automática.
          </DialogDescription>
        </DialogHeader>
        <CartaoForm
          alunoId={alunoId}
          alunoNome={alunoNome}
          origem={origem}
          token={token}
          onSuccess={() => { onSuccess?.(); onOpenChange(false); }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
