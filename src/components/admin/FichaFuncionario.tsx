import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { StudentFacial } from "@/components/student/StudentFacial";
import { toast } from "sonner";
import { ChevronDown, Plus, Trash2, UserRound } from "lucide-react";

export const ROLE_DESCRICOES: Record<string, string> = {
  admin: "Tudo, inclusive financeiro, usuários e permissões.",
  coordenador: "Gestão do dia a dia, equipe, relatórios e reativação de contratos.",
  professor: "Treinos, agenda e alunos da carteira.",
  nutricionista: "Avaliações e plano alimentar.",
  fisioterapeuta: "Avaliações e reabilitação.",
};

export type FichaProfile = {
  user_id: string;
  full_name: string;
  phone: string | null;
  specialty: string | null;
  cpf_ultimos3: string | null;
  pis_pasep: string | null;
  ativo?: boolean | null;
};

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  profile: FichaProfile | null;
  email: string;
  lastSignIn: string | null;
  roles: { id: string; role: string; user_id: string }[];
  roleLabels: Record<string, string>;
  roleColors: Record<string, string>;
  isSelf: boolean;
  onRemoveRole: (r: { id: string; role: string; user_id: string }) => void;
  onAddRole: () => void;
  onToggleAtivo: () => void;
  onDelete: () => void;
  deleting: boolean;
  onSaved: () => void;
};

const onlyDigits = (v: string) => v.replace(/\D/g, "");
const maskCPF = (v: string) =>
  onlyDigits(v).slice(0, 11)
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
const maskPIS = (v: string) =>
  onlyDigits(v).slice(0, 11)
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{5})(\d)/, "$1.$2.$3")
    .replace(/^(\d{3})\.(\d{5})\.(\d{2})(\d)/, "$1.$2.$3-$4");
/** Mostra só o que já está guardado: 3 últimos dígitos → "•••.•••.••X-XX". */
export const cpfMascarado = (ult3: string) => `•••.•••.••${ult3.slice(0, 1)}-${ult3.slice(1)}`;
const errMsg = (e: unknown) => (e as { message?: string })?.message || "Erro inesperado";
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "Nunca");

async function invoke(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("admin-users", { body });
  if (error) throw error;
  if (data?.error) throw new Error(typeof data.error === "string" ? data.error : "Erro");
  return data;
}

export function FichaFuncionario(p: Props) {
  const qc = useQueryClient();
  const prof = p.profile;
  const uid = prof?.user_id;
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", specialty: "", cpf: "", pis_pasep: "" });
  const [nasc, setNasc] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmNome, setConfirmNome] = useState("");

  const { data: cadastros, refetch: refetchCad } = useQuery({
    queryKey: ["ficha-equipe-aluno", uid],
    enabled: !!uid && p.open,
    queryFn: async () => {
      const { data, error } = await supabase.from("alunos").select("*").eq("user_id", uid!);
      if (error) throw error;
      return (data ?? []) as Tables<"alunos">[];
    },
  });
  const cadastro = cadastros?.length === 1 ? cadastros[0] : null;
  const duplicado = (cadastros?.length ?? 0) > 1;

  useEffect(() => {
    if (!prof || !p.open) return;
    setForm({
      full_name: prof.full_name, email: p.email, phone: prof.phone || "", specialty: prof.specialty || "",
      cpf: "", pis_pasep: prof.pis_pasep ? maskPIS(prof.pis_pasep) : "",
    });
    setSenha(""); setConfirmNome("");
  }, [prof, p.open, p.email]);
  useEffect(() => { setNasc(cadastro?.data_nascimento ?? ""); }, [cadastro?.data_nascimento]);

  const salvarNasc = async () => {
    if (!nasc) throw new Error("Informe a data de nascimento");
    const { error } = await supabase.rpc("fn_equipe_definir_nascimento", { p_user_id: uid!, p_data: nasc });
    if (error) throw error;
    await refetchCad();
    qc.invalidateQueries({ queryKey: ["facial"] });
  };

  const salvar = useMutation({
    mutationFn: async () => {
      const cpf = onlyDigits(form.cpf), pis = onlyDigits(form.pis_pasep);
      if (cpf && cpf.length !== 11) throw new Error("CPF deve conter 11 dígitos");
      if (pis && pis.length !== 11) throw new Error("PIS/PASEP deve conter 11 dígitos");
      await invoke({
        action: "update", user_id: uid, email: form.email.trim() || null, full_name: form.full_name.trim(),
        phone: form.phone.trim() || null, specialty: form.specialty.trim() || null,
        cpf: cpf || undefined, pis_pasep: pis || null,
      });
      if (nasc && nasc !== (cadastro?.data_nascimento ?? "")) await salvarNasc();
    },
    onSuccess: () => { toast.success("Ficha salva"); p.onSaved(); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const nascMut = useMutation({
    mutationFn: salvarNasc,
    onSuccess: () => toast.success("Data de nascimento salva"),
    onError: (e) => toast.error(errMsg(e)),
  });

  const criarCad = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("fn_equipe_garantir_cadastro", { p_user_id: uid! });
      if (error) throw error;
      await refetchCad();
    },
    onSuccess: () => toast.success("Cadastro de equipe criado"),
    onError: (e) => toast.error(errMsg(e)),
  });

  const reset = useMutation({
    mutationFn: () => invoke({ action: "send-reset", user_id: uid, redirect_to: `${window.location.origin}/redefinir-senha` }),
    onSuccess: () => toast.success("Link enviado para o e-mail da pessoa"),
    onError: (e) => toast.error(errMsg(e)),
  });

  const senhaMut = useMutation({
    mutationFn: () => invoke({ action: "update", user_id: uid, password: senha }),
    onSuccess: () => { toast.success("Senha alterada"); setSenha(""); },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (!prof) return null;
  const ativo = prof.ativo !== false;

  const BotaoReset = (
    <Button variant="outline" onClick={() => reset.mutate()} disabled={reset.isPending || !p.email}>
      {reset.isPending ? "Enviando..." : "Enviar link para a pessoa criar uma nova senha"}
    </Button>
  );
  const SenhaManual = (
    <Collapsible>
      <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground min-h-9">
        <ChevronDown className="w-4 h-4" /> Definir senha manualmente (avançado)
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2 flex gap-2 items-end">
        <div className="flex-1">
          <Label>Nova senha (mín. 6)</Label>
          <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} />
        </div>
        <Button disabled={senha.length < 6 || senhaMut.isPending} onClick={() => senhaMut.mutate()}>Definir</Button>
      </CollapsibleContent>
    </Collapsible>
  );

  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <UserRound className="w-5 h-5 text-primary" />
            {prof.full_name}
            {!ativo && <Badge variant="destructive">Desativado</Badge>}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="dados">
          <TabsList className="w-full flex flex-wrap h-auto">
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="permissoes">Permissões</TabsTrigger>
            <TabsTrigger value="facial">Facial</TabsTrigger>
            <TabsTrigger value="seguranca">Segurança</TabsTrigger>
          </TabsList>

          <TabsContent value="dados" className="space-y-3 mt-4">
            <div><Label>Nome completo</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Telefone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Especialidade</Label><Input value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label>CPF (deixe vazio para não alterar)</Label>
                <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: maskCPF(e.target.value) })}
                  placeholder={prof.cpf_ultimos3 ? `${cpfMascarado(prof.cpf_ultimos3)} (cadastrado)` : "000.000.000-00"} inputMode="numeric" />
              </div>
              <div>
                <Label>PIS/PASEP</Label>
                <Input value={form.pis_pasep} onChange={(e) => setForm({ ...form, pis_pasep: maskPIS(e.target.value) })} placeholder="000.00000.00-0" inputMode="numeric" />
              </div>
              <div>
                <Label>Data de nascimento</Label>
                <Input type="date" value={nasc} onChange={(e) => setNasc(e.target.value)} disabled={duplicado} />
              </div>
            </div>
            {duplicado && <p className="text-xs text-destructive">Este usuário está ligado a mais de um cadastro; a data de nascimento não pode ser salva até resolver.</p>}
            <div className="flex justify-end">
              <Button disabled={salvar.isPending || !form.full_name.trim()} onClick={() => salvar.mutate()}>
                {salvar.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="permissoes" className="space-y-3 mt-4">
            {p.roles.length === 0 && <p className="text-sm text-muted-foreground">Sem permissão.</p>}
            {p.roles.map((r) => (
              <div key={r.id} className="flex items-start justify-between gap-3 border border-border rounded-md p-3">
                <div>
                  <Badge variant="secondary" className={`text-xs ${p.roleColors[r.role] || ""}`}>{p.roleLabels[r.role] || r.role}</Badge>
                  <p className="text-xs text-muted-foreground mt-1">{ROLE_DESCRICOES[r.role] ?? ""}</p>
                </div>
                <Button size="sm" variant="ghost" aria-label="Remover permissão" onClick={() => p.onRemoveRole(r)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
            <Button variant="outline" onClick={p.onAddRole}><Plus className="w-4 h-4 mr-1" /> Permissão</Button>
          </TabsContent>

          <TabsContent value="facial" className="mt-4 space-y-4">
            {duplicado ? (
              <p className="text-sm text-destructive">Este usuário está ligado a mais de um cadastro. Resolva a duplicidade antes de usar a facial.</p>
            ) : !cadastro ? (
              <div className="border border-border rounded-md p-4 space-y-3">
                <p className="text-sm">Esta pessoa ainda não tem cadastro de equipe para a porta.</p>
                <Button onClick={() => criarCad.mutate()} disabled={criarCad.isPending}>
                  {criarCad.isPending ? "Criando..." : "Criar cadastro de equipe"}
                </Button>
              </div>
            ) : (
              <>
                {!cadastro.data_nascimento && (
                  <div className="border border-border rounded-md p-4 space-y-2">
                    <p className="text-sm">Preencha a data de nascimento para liberar o cadastro do rosto.</p>
                    <div className="flex gap-2 items-end">
                      <Input type="date" value={nasc} onChange={(e) => setNasc(e.target.value)} className="max-w-[200px]" />
                      <Button onClick={() => nascMut.mutate()} disabled={!nasc || nascMut.isPending}>Salvar data</Button>
                    </div>
                  </div>
                )}
                <StudentFacial key={cadastro.id + (cadastro.data_nascimento ?? "")} student={cadastro} contexto="equipe" />
              </>
            )}
          </TabsContent>

          <TabsContent value="seguranca" className="mt-4 space-y-4">
            <p className="text-sm"><span className="text-muted-foreground">Último acesso:</span> {fmt(p.lastSignIn)}</p>
            <div className="space-y-2">
              {BotaoReset}
              {SenhaManual}
            </div>
            <div className="border border-border rounded-md p-4 space-y-2">
              <p className="text-sm font-medium">{ativo ? "Desativar acesso" : "Usuário desativado"}</p>
              <p className="text-xs text-muted-foreground">Desativar bloqueia o login e corta o acesso na hora. O histórico (ponto, comissões, treinos) é mantido.</p>
              <Button variant={ativo ? "outline" : "default"} disabled={p.isSelf} onClick={p.onToggleAtivo}>
                {ativo ? "Desativar" : "Reativar"}
              </Button>
            </div>
            <div className="border border-destructive/50 rounded-md p-4 space-y-2">
              <p className="text-sm font-medium text-destructive">Zona de perigo · Excluir definitivamente</p>
              <p className="text-xs text-muted-foreground">Prefira Desativar: excluir apaga o acesso de forma permanente.</p>
              <Label>Digite o nome da pessoa para confirmar</Label>
              <Input value={confirmNome} onChange={(e) => setConfirmNome(e.target.value)} placeholder={prof.full_name} />
              <Button variant="destructive" disabled={p.isSelf || p.deleting || confirmNome.trim() !== prof.full_name.trim()} onClick={p.onDelete}>
                {p.deleting ? "Excluindo..." : "Excluir definitivamente"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
