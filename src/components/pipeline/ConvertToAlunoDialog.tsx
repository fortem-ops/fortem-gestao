import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchCep, formatCep } from "@/lib/viacep";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  alunoId: string;
  alunoNome: string;
  /** "Aluno ativo" para nova conversão; também usado para Renovação. */
  destinoStage?: string;
  /** Título do dialog. */
  title?: string;
  /** Se true, exige CPF/Email/Endereço (conversão). Se false, só plano (renovação). */
  fullConvert?: boolean;
  /** Callback opcional disparado após conversão/renovação bem-sucedida. */
  onConverted?: () => void;
}

export function ConvertToAlunoDialog({
  open,
  onOpenChange,
  alunoId,
  alunoNome,
  destinoStage = "Aluno ativo",
  title,
  fullConvert = true,
}: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [cep, setCep] = useState("");
  const [logradouro, setLogradouro] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [tipoPlano, setTipoPlano] = useState("Mensal");
  const [valor, setValor] = useState("");
  const [duracaoMeses, setDuracaoMeses] = useState("1");
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().slice(0, 10));

  // Pré-carrega dados existentes
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("alunos")
        .select("cpf,email,cep,logradouro,numero,complemento,bairro,cidade,uf" as any)
        .eq("id", alunoId)
        .maybeSingle();
      if (data) {
        const a: any = data;
        setCpf(a.cpf || "");
        setEmail(a.email || "");
        setCep(a.cep || "");
        setLogradouro(a.logradouro || "");
        setNumero(a.numero || "");
        setComplemento(a.complemento || "");
        setBairro(a.bairro || "");
        setCidade(a.cidade || "");
        setUf(a.uf || "");
      }
    })();
  }, [open, alunoId]);

  async function handleCepBlur() {
    const result = await fetchCep(cep);
    if (result) {
      setLogradouro(result.logradouro || logradouro);
      setBairro(result.bairro || bairro);
      setCidade(result.localidade || cidade);
      setUf(result.uf || uf);
    }
  }

  async function submit() {
    if (fullConvert) {
      if (!cpf.trim()) return toast.error("CPF é obrigatório");
      if (!email.trim()) return toast.error("Email é obrigatório");
    }
    const valorNum = parseFloat(valor.replace(",", "."));
    if (!valor || isNaN(valorNum)) return toast.error("Informe o valor do plano");
    const meses = parseInt(duracaoMeses, 10);
    if (!meses || meses < 1) return toast.error("Duração inválida");

    setBusy(true);

    if (fullConvert) {
      const { error: e1 } = await supabase
        .from("alunos")
        .update({
          cpf: cpf.trim(),
          email: email.trim(),
          cep: cep.trim() || null,
          logradouro: logradouro.trim() || null,
          numero: numero.trim() || null,
          complemento: complemento.trim() || null,
          bairro: bairro.trim() || null,
          cidade: cidade.trim() || null,
          uf: uf.trim() || null,
          status: "ativo",
        } as any)
        .eq("id", alunoId);
      if (e1) { setBusy(false); return toast.error(e1.message); }
    }

    // Cria plano
    const inicio = new Date(dataInicio);
    const fim = new Date(inicio);
    fim.setMonth(fim.getMonth() + meses);
    const { error: e2 } = await supabase.from("planos").insert({
      aluno_id: alunoId,
      tipo: tipoPlano,
      valor: valorNum,
      duracao_meses: meses,
      data_inicio: dataInicio,
      data_fim: fim.toISOString().slice(0, 10),
      ativo: true,
    } as any);
    if (e2) { setBusy(false); return toast.error(e2.message); }

    // Move pipeline
    const { error: e3 } = await supabase.rpc("fn_move_pipeline", {
      _aluno_id: alunoId,
      _to_stage_name: destinoStage,
      _source: "manual",
      _notes: fullConvert ? "Conversão para aluno" : "Renovação de plano",
      _moved_by: user?.id ?? null,
    } as any);
    setBusy(false);
    if (e3) return toast.error(e3.message);

    toast.success(fullConvert ? "Convertido em aluno!" : "Plano renovado!");
    qc.invalidateQueries({ queryKey: ["pipeline-alunos"] });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title || `Converter ${alunoNome} em aluno`}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {fullConvert && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">CPF *</Label>
                  <Input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" />
                </div>
                <div>
                  <Label className="text-xs">Email *</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase">Endereço</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">CEP</Label>
                    <Input
                      value={cep}
                      onChange={(e) => setCep(formatCep(e.target.value))}
                      onBlur={handleCepBlur}
                      placeholder="00000-000"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Logradouro</Label>
                    <Input value={logradouro} onChange={(e) => setLogradouro(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Número</Label>
                    <Input value={numero} onChange={(e) => setNumero(e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Complemento</Label>
                    <Input value={complemento} onChange={(e) => setComplemento(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <Label className="text-xs">Cidade</Label>
                    <Input value={cidade} onChange={(e) => setCidade(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">UF</Label>
                    <Input value={uf} onChange={(e) => setUf(e.target.value.toUpperCase().slice(0, 2))} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Bairro</Label>
                  <Input value={bairro} onChange={(e) => setBairro(e.target.value)} />
                </div>
              </div>
            </>
          )}

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase">Plano</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={tipoPlano} onValueChange={setTipoPlano}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Mensal">Mensal</SelectItem>
                    <SelectItem value="Trimestral">Trimestral</SelectItem>
                    <SelectItem value="Semestral">Semestral</SelectItem>
                    <SelectItem value="Anual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Duração (meses)</Label>
                <Input type="number" min={1} value={duracaoMeses} onChange={(e) => setDuracaoMeses(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Valor (R$)</Label>
                <Input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Data de início</Label>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Salvando..." : "Confirmar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
