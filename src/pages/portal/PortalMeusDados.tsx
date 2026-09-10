import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useStudentPortal } from "@/contexts/StudentPortalContext";
import { isValidCpf, formatCpfMask } from "@/lib/clube";

export default function PortalMeusDados() {
  const { student, refetch } = useStudentPortal();
  const [busy, setBusy] = useState(false);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");

  useEffect(() => {
    if (!student) return;
    setNome(student.nome ?? "");
    setTelefone((student as any).telefone ?? "");
    setEmail((student as any).email ?? "");
  }, [student]);

  if (!student) return null;

  const ultimos3 = ((student as any).cpf_ultimos3 as string | null) ?? null;
  const cpfMascarado = ultimos3 ? `***.***.**${ultimos3.slice(-2)}` : "Não cadastrado";

  async function salvar() {
    if (!nome.trim()) return toast.error("Informe seu nome");
    if (!email.includes("@")) return toast.error("Informe um e-mail válido");
    const cpfDigits = cpf.replace(/\D/g, "");
    if (cpfDigits && !isValidCpf(cpfDigits)) return toast.error("CPF inválido");

    setBusy(true);
    try {
      const { error } = await supabase
        .from("alunos")
        .update({
          nome: nome.trim(),
          telefone: telefone.trim() || null,
          email: email.trim() || null,
        })
        .eq("id", student!.id);
      if (error) throw error;

      if (cpfDigits) {
        const { data, error: fnErr } = await supabase.functions.invoke("portal-atualizar-cpf", {
          body: { aluno_id: student!.id, cpf: cpfDigits },
        });
        if (fnErr) throw fnErr;
        if (!data?.ok) {
          const msgs: Record<string, string> = {
            cpf_invalido: "CPF inválido.",
            cpf_duplicado: "Este CPF já está cadastrado em outra conta.",
            nao_autorizado: "Sessão expirada. Entre novamente.",
          };
          toast.error(msgs[data?.error] ?? "Não foi possível salvar o CPF.");
          setBusy(false);
          return;
        }
        setCpf("");
      }

      toast.success("Dados atualizados");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível salvar seus dados");
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary";

  return (
    <div className="space-y-5 pb-32 animate-fade-in">
      <Link to="/portal/perfil" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="w-4 h-4" /> Meu Perfil
      </Link>

      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <h1 className="font-black text-lg text-foreground" style={{ fontFamily: "Archivo,sans-serif" }}>
          Meus Dados
        </h1>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Nome</label>
          <input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Telefone</label>
          <input className={inputCls} value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(51) 99999-0000" />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">E-mail</label>
          <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">CPF</label>
          <p className="text-xs text-muted-foreground">Atual: {cpfMascarado}</p>
          <input
            className={inputCls}
            value={cpf}
            inputMode="numeric"
            onChange={(e) => setCpf(formatCpfMask(e.target.value))}
            placeholder="Digite para cadastrar ou alterar"
          />
        </div>

        <button
          onClick={salvar}
          disabled={busy}
          className="w-full bg-primary text-primary-foreground rounded-xl py-3 text-sm font-bold disabled:opacity-60"
        >
          {busy ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>
    </div>
  );
}
