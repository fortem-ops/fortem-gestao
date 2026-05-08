import { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface StudentData {
  nome: string;
  dataNascimento: string;
  cpf: string;
  telefone: string;
  email: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
}

interface StudentDataFormProps {
  data: StudentData;
  onChange: (data: StudentData) => void;
  errors: Partial<Record<keyof StudentData, string>>;
}

const formatCPF = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  }
  return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
};

export const validateCPF = (cpf: string): boolean => {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let check = 11 - (sum % 11);
  if (check >= 10) check = 0;
  if (parseInt(digits[9]) !== check) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  check = 11 - (sum % 11);
  if (check >= 10) check = 0;
  return parseInt(digits[10]) === check;
};

const StudentDataForm = ({ data, onChange, errors }: StudentDataFormProps) => {
  const lastFetchedCpf = useRef<string>("");

  const handleChange = (field: keyof StudentData, value: string) => {
    let formatted = value;
    if (field === "cpf") formatted = formatCPF(value);
    if (field === "telefone" || field === "emergencyContactPhone") formatted = formatPhone(value);
    onChange({ ...data, [field]: formatted });
  };

  useEffect(() => {
    const digits = data.cpf.replace(/\D/g, "");
    if (digits.length !== 11 || !validateCPF(data.cpf)) return;
    if (lastFetchedCpf.current === digits) return;
    lastFetchedCpf.current = digits;

    (async () => {
      const { data: result, error } = await supabase.functions.invoke("lookup-by-cpf", {
        body: { cpf: data.cpf },
      });
      if (error || !result?.found || !result.data) return;
      const existing = result.data;
      onChange({
        ...data,
        nome: existing.nome ?? data.nome,
        dataNascimento: existing.data_nascimento ?? data.dataNascimento,
        telefone: existing.telefone ?? data.telefone,
        email: existing.email ?? data.email,
        emergencyContactName: existing.emergency_contact_name ?? data.emergencyContactName,
        emergencyContactPhone: existing.emergency_contact_phone ?? data.emergencyContactPhone,
      });
      toast.success("Dados encontrados e preenchidos automaticamente");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.cpf]);

  const inputCls = "mt-1.5 h-12 rounded-xl bg-card border-0 card-shadow focus-visible:ring-2 focus-visible:ring-primary";

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="nome">Nome completo</Label>
        <Input id="nome" value={data.nome} onChange={(e) => handleChange("nome", e.target.value)} placeholder="Seu nome completo" className={inputCls} />
        {errors.nome && <p className="text-destructive text-xs mt-1">{errors.nome}</p>}
      </div>
      <div>
        <Label htmlFor="dataNascimento">Data de nascimento</Label>
        <Input id="dataNascimento" type="date" value={data.dataNascimento} onChange={(e) => handleChange("dataNascimento", e.target.value)} className={inputCls} />
        {errors.dataNascimento && <p className="text-destructive text-xs mt-1">{errors.dataNascimento}</p>}
      </div>
      <div>
        <Label htmlFor="cpf">CPF</Label>
        <Input id="cpf" value={data.cpf} onChange={(e) => handleChange("cpf", e.target.value)} placeholder="000.000.000-00" className={`${inputCls} font-mono tabular-nums`} />
        {errors.cpf && <p className="text-destructive text-xs mt-1">{errors.cpf}</p>}
      </div>
      <div>
        <Label htmlFor="telefone">Telefone</Label>
        <Input id="telefone" value={data.telefone} onChange={(e) => handleChange("telefone", e.target.value)} placeholder="(00) 00000-0000" className={`${inputCls} font-mono tabular-nums`} />
        {errors.telefone && <p className="text-destructive text-xs mt-1">{errors.telefone}</p>}
      </div>
      <div>
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" type="email" value={data.email} onChange={(e) => handleChange("email", e.target.value)} placeholder="seu@email.com" className={inputCls} />
        {errors.email && <p className="text-destructive text-xs mt-1">{errors.email}</p>}
      </div>
      <div className="pt-2 border-t border-border">
        <h3 className="text-sm font-semibold mb-3">Contato para Emergência</h3>
        <div className="space-y-4">
          <div>
            <Label htmlFor="emergencyContactName">Nome</Label>
            <Input id="emergencyContactName" value={data.emergencyContactName} onChange={(e) => handleChange("emergencyContactName", e.target.value)} placeholder="Nome do contato" className={inputCls} />
            {errors.emergencyContactName && <p className="text-destructive text-xs mt-1">{errors.emergencyContactName}</p>}
          </div>
          <div>
            <Label htmlFor="emergencyContactPhone">Telefone</Label>
            <Input id="emergencyContactPhone" value={data.emergencyContactPhone} onChange={(e) => handleChange("emergencyContactPhone", e.target.value)} placeholder="(00) 00000-0000" className={`${inputCls} font-mono tabular-nums`} />
            {errors.emergencyContactPhone && <p className="text-destructive text-xs mt-1">{errors.emergencyContactPhone}</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDataForm;
