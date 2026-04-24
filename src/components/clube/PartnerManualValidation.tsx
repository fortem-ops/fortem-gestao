import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { hashCpfClient, formatCpfMask, isValidCpf, NIVEL_LABEL, STATUS_LABEL } from "@/lib/clube";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2, Search } from "lucide-react";

interface PartnerManualValidationProps {
  parceiroId: string;
}

interface MembroInfo {
  aluno_id: string;
  fortem_id: string;
  nivel_membro: string;
  status_membro: string;
  nome: string;
}

export function PartnerManualValidation({ parceiroId }: PartnerManualValidationProps) {
  const [cpf, setCpf] = useState("");
  const [searching, setSearching] = useState(false);
  const [membro, setMembro] = useState<MembroInfo | null>(null);
  const [beneficioId, setBeneficioId] = useState("");
  const [validating, setValidating] = useState(false);

  const { data: beneficios = [] } = useQuery({
    queryKey: ["scanner-beneficios", parceiroId],
    queryFn: async () => {
      const { data } = await supabase
        .from("beneficios")
        .select("id, titulo")
        .eq("parceiro_id", parceiroId)
        .eq("ativo", true)
        .order("titulo");
      return data || [];
    },
    enabled: !!parceiroId,
  });

  async function buscar() {
    if (!isValidCpf(cpf)) {
      toast.error("CPF inválido");
      return;
    }
    setSearching(true);
    setMembro(null);
    try {
      const hash = await hashCpfClient(cpf);
      const { data: m, error } = await supabase
        .from("clube_fortem_membros")
        .select("aluno_id, fortem_id, nivel_membro, status_membro")
        .eq("cpf_hash", hash)
        .maybeSingle();
      if (error) throw error;
      if (!m) {
        toast.error("Membro não encontrado");
        return;
      }
      const { data: aluno } = await supabase.from("alunos").select("nome").eq("id", m.aluno_id).single();
      setMembro({ ...m, nome: aluno?.nome || "—" });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSearching(false);
    }
  }

  async function validar() {
    if (!membro || !beneficioId) return;
    setValidating(true);
    try {
      const { error } = await supabase.from("uso_beneficios").insert({
        aluno_id: membro.aluno_id,
        cpf_hash: await hashCpfClient(cpf),
        beneficio_id: beneficioId,
        parceiro_id: parceiroId,
        status_validacao: membro.status_membro === "ativo" ? "valido" : "bloqueado",
        motivo_recusa: membro.status_membro === "ativo" ? null : `Membro ${membro.status_membro}`,
        origem_validacao: "cpf_manual",
      });
      if (error) throw error;
      toast.success(membro.status_membro === "ativo" ? "Benefício validado!" : "Uso bloqueado registrado.");
      setMembro(null);
      setCpf("");
      setBeneficioId("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setValidating(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">CPF do aluno</label>
        <div className="flex gap-2">
          <Input
            value={formatCpfMask(cpf)}
            onChange={(e) => setCpf(e.target.value)}
            placeholder="000.000.000-00"
            maxLength={14}
          />
          <Button onClick={buscar} disabled={searching}>
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>
      </Card>

      {membro && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold">{membro.nome}</h3>
              <p className="text-xs font-mono text-muted-foreground">{membro.fortem_id}</p>
            </div>
            <Badge variant={membro.status_membro === "ativo" ? "default" : "destructive"}>
              {STATUS_LABEL[membro.status_membro as keyof typeof STATUS_LABEL]}
            </Badge>
          </div>
          <div className="text-sm">
            Nível: <Badge variant="outline">{NIVEL_LABEL[membro.nivel_membro as keyof typeof NIVEL_LABEL]}</Badge>
          </div>
          <Select value={beneficioId} onValueChange={setBeneficioId}>
            <SelectTrigger>
              <SelectValue placeholder="Benefício a validar" />
            </SelectTrigger>
            <SelectContent>
              {beneficios.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.titulo}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            className="w-full gap-2"
            onClick={validar}
            disabled={!beneficioId || validating || membro.status_membro !== "ativo"}
          >
            {membro.status_membro === "ativo" ? (
              <>
                <CheckCircle2 className="w-4 h-4" /> Validar benefício
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4" /> Bloqueado
              </>
            )}
          </Button>
        </Card>
      )}
    </div>
  );
}
