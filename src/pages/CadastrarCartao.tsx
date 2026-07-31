import { useState, useEffect } from "react";
import { useSearchParams, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, CreditCard, Lock, AlertTriangle, Loader2 } from "lucide-react";

type Estado = "validando" | "formulario" | "enviando" | "sucesso" | "invalido";

function detectBrand(n: string): string {
  const d = n.replace(/\D/g, "");
  if (/^4/.test(d)) return "Visa";
  if (/^5[1-5]/.test(d) || /^2[2-7]/.test(d)) return "Mastercard";
  if (/^6(36368|04175|0[45])/.test(d)) return "Elo";
  if (/^6062/.test(d)) return "Hipercard";
  if (/^3[47]/.test(d)) return "Amex";
  return "";
}

function formatCardNumber(v: string): string {
  return v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}

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

export default function CadastrarCartao() {
  const [params] = useSearchParams();
  const routeParams = useParams<{ token?: string }>();
  const token = params.get("token") ?? routeParams.token ?? "";

  const [estado, setEstado] = useState<Estado>("validando");
  const [nomeAluno, setNomeAluno] = useState("");
  const [erroMsg, setErroMsg] = useState("");

  const [numero, setNumero]     = useState("");
  const [titular, setTitular]   = useState("");
  const [validade, setValidade] = useState("");
  const [cvv, setCvv]           = useState("");

  const brand = detectBrand(numero);
  const [mes, ano] = validade.split("/");
  const numeroValido = luhn(numero);
  const formOk = numeroValido && titular.trim().length >= 3 && !!mes && ano?.length === 2 && cvv.length >= 3;

  useEffect(() => {
    if (!token) { setEstado("invalido"); return; }
    (supabase as any)
      .rpc("fn_validar_link_cartao", { p_token: token })
      .then(({ data, error }: any) => {
        if (error || !data) { setEstado("invalido"); return; }
        if (!data.valido) {
          if (data.motivo === "usado") setErroMsg("Este link já foi utilizado.");
          else if (data.motivo === "expirado") setErroMsg("Este link expirou. Solicite um novo na recepção.");
          setEstado("invalido");
          return;
        }
        setNomeAluno(data.nome ?? "");
        setEstado("formulario");
      });
  }, [token]);


  async function handleSubmit() {
    if (!formOk) return;
    setEstado("enviando");
    setErroMsg("");
    try {
      const { data, error } = await supabase.functions.invoke("rede-salvar-cartao", {
        body: {
          link_token:       token,
          card_number:      numero.replace(/\D/g, ""),
          card_holder:      titular.trim().toUpperCase(),
          expiration_month: mes,
          expiration_year:  "20" + ano,
          security_code:    cvv,
          origem:           "link_cadastro",
        },
      });
      if (error) throw error;
      if (!data?.success) {
        setErroMsg(data?.error ?? data?.return_message ?? "Cartão não autorizado. Verifique os dados e tente novamente.");
        setEstado("formulario");
        return;
      }
      setEstado("sucesso");
    } catch (e: any) {
      setErroMsg(e?.message ?? "Erro inesperado. Tente novamente.");
      setEstado("formulario");
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold tracking-tight">FORTEM</h1>
          <p className="text-sm text-muted-foreground">Cadastro de cartão de crédito</p>
        </div>

        {estado === "validando" && (
          <Card>
            <CardContent className="flex items-center justify-center py-12 gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">Validando link…</span>
            </CardContent>
          </Card>
        )}

        {estado === "invalido" && (
          <Card>
            <CardContent className="py-10 text-center space-y-3">
              <AlertTriangle className="h-10 w-10 mx-auto text-destructive" />
              <p className="font-medium">Link inválido ou expirado</p>
              <p className="text-sm text-muted-foreground">
                {erroMsg || "Este link não é válido. Solicite um novo link na recepção da Fortem."}
              </p>
            </CardContent>
          </Card>
        )}

        {(estado === "formulario" || estado === "enviando") && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="h-5 w-5" />
                Cadastrar cartão
              </CardTitle>
              {nomeAluno && (
                <CardDescription>
                  Olá, <strong>{nomeAluno}</strong>! Preencha os dados do seu cartão para ativar pagamentos automáticos.
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {erroMsg && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{erroMsg}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label>
                  Número do cartão{" "}
                  {brand && <span className="text-muted-foreground font-normal">— {brand}</span>}
                </Label>
                <Input
                  placeholder="0000 0000 0000 0000"
                  value={numero}
                  onChange={(e) => setNumero(formatCardNumber(e.target.value))}
                  maxLength={19}
                  inputMode="numeric"
                  className={numero.replace(/\D/g, "").length >= 13 && !numeroValido ? "border-destructive" : ""}
                />
                {numero.replace(/\D/g, "").length >= 13 && !numeroValido && (
                  <p className="text-xs text-destructive">Número de cartão inválido</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Nome do titular</Label>
                <Input
                  placeholder="Como impresso no cartão"
                  value={titular}
                  onChange={(e) => setTitular(e.target.value.toUpperCase())}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Validade (MM/AA)</Label>
                  <Input
                    placeholder="MM/AA"
                    value={validade}
                    maxLength={5}
                    inputMode="numeric"
                    onChange={(e) => {
                      let v = e.target.value.replace(/\D/g, "");
                      if (v.length >= 3) v = v.slice(0, 2) + "/" + v.slice(2, 4);
                      setValidade(v);
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>CVV</Label>
                  <Input
                    placeholder="123"
                    value={cvv}
                    maxLength={4}
                    inputMode="numeric"
                    onChange={(e) => setCvv(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
              </div>

              <Button
                className="w-full gap-2"
                onClick={handleSubmit}
                disabled={!formOk || estado === "enviando"}
              >
                {estado === "enviando" ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Cadastrando…</>
                ) : (
                  <><Lock className="h-4 w-4" /> Cadastrar cartão com segurança</>
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                🔒 Seus dados são transmitidos com criptografia diretamente para a Rede Itaú (PCI DSS Nível 1).
                A Fortem não armazena o número do cartão.
              </p>
            </CardContent>
          </Card>
        )}

        {estado === "sucesso" && (
          <Card>
            <CardContent className="py-10 text-center space-y-3">
              <CheckCircle className="h-12 w-12 mx-auto text-emerald-500" />
              <p className="text-lg font-semibold">Cartão cadastrado!</p>
              <p className="text-sm text-muted-foreground">
                Seu cartão foi cadastrado com segurança. As próximas cobranças serão feitas automaticamente
                na data de vencimento do seu plano.
              </p>
              <p className="text-xs text-muted-foreground mt-4">Você pode fechar esta janela.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
