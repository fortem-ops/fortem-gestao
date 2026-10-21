import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Search, Shield, Trash2, Plus, Pencil, UserPlus } from "lucide-react";
import { Constants } from "@/integrations/supabase/types";
import { Switch } from "@/components/ui/switch";
import { FichaFuncionario } from "./FichaFuncionario";

const ROLES = Constants.public.Enums.app_role;
const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  coordenador: "Coordenador",
  professor: "Professor",
  nutricionista: "Nutricionista",
  fisioterapeuta: "Fisioterapeuta",
};
const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-500/20 text-red-400",
  coordenador: "bg-yellow-500/20 text-yellow-400",
  professor: "bg-primary/20 text-primary",
  nutricionista: "bg-blue-500/20 text-blue-400",
  fisioterapeuta: "bg-purple-500/20 text-purple-400",
};

type ProfileRow = {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  specialty: string | null;
  cpf_ultimos3: string | null;
  pis_pasep: string | null;
  ativo?: boolean | null;
};

type CreateForm = {
  full_name: string;
  email: string;
  password: string;
  phone: string;
  specialty: string;
  cpf: string;
  pis_pasep: string;
  role: string;
};


const onlyDigits = (v: string) => v.replace(/\D/g, "");
const maskCPF = (v: string) => {
  const d = onlyDigits(v).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
};
const maskPIS = (v: string) => {
  const d = onlyDigits(v).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{5})(\d)/, "$1.$2.$3")
    .replace(/^(\d{3})\.(\d{5})\.(\d{2})(\d)/, "$1.$2.$3-$4");
};

export function AdminUsers() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [addRoleOpen, setAddRoleOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ userId: string; name: string } | null>(null);
  const [newRole, setNewRole] = useState<string>("");

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>({
    full_name: "", email: "", password: "", phone: "", specialty: "", cpf: "", pis_pasep: "", role: "",
  });

  const [fichaUserId, setFichaUserId] = useState<string | null>(null);
  const [mostrarDesativados, setMostrarDesativados] = useState(false);
  const [roleToRemove, setRoleToRemove] = useState<{ id: string; role: string; user_id: string } | null>(null);
  const [ativoTarget, setAtivoTarget] = useState<{ user_id: string; name: string; ativo: boolean } | null>(null);


  const { data: isAdmin } = useQuery({
    queryKey: ["admin-users-is-admin", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase.rpc("is_admin", { _user_id: user.id });
      return !!data;
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").order("full_name");
      return (data || []) as ProfileRow[];
    },
  });

  const { data: allRoles = [] } = useQuery({
    queryKey: ["admin-user-roles"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("*");
      return data || [];
    },
  });

  const { data: emails = [] } = useQuery({
    queryKey: ["admin-users-emails"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: { action: "list-emails" },
      });
      if (error) throw error;
      return (data?.emails || []) as { user_id: string; email: string | null; last_sign_in_at: string | null }[];
    },
    enabled: !!isAdmin,
  });

  const emailByUserId = new Map(emails.map((e) => [e.user_id, e.email]));
  const lastSignInByUserId = new Map(emails.map((e) => [e.user_id, e.last_sign_in_at]));

  const addRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: role as any });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-user-roles"] });
      toast.success("Permissão adicionada com sucesso");
      setAddRoleOpen(false);
      setNewRole("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeRoleMutation = useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await supabase.from("user_roles").delete().eq("id", roleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-user-roles"] });
      toast.success("Permissão removida");
      setRoleToRemove(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
    queryClient.invalidateQueries({ queryKey: ["admin-user-roles"] });
    queryClient.invalidateQueries({ queryKey: ["admin-users-emails"] });
  };

  const createMutation = useMutation({
    mutationFn: async (f: CreateForm) => {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: {
          action: "create",
          email: f.email.trim(),
          password: f.password,
          full_name: f.full_name.trim(),
          phone: f.phone.trim() || null,
          specialty: f.specialty.trim() || null,
          cpf: onlyDigits(f.cpf) || null,
          pis_pasep: onlyDigits(f.pis_pasep) || null,
          role: f.role || null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(typeof data.error === "string" ? data.error : "Erro ao criar usuário");
    },
    onSuccess: () => {
      invalidateAll();
      toast.success("Usuário criado");
      setCreateOpen(false);
      setCreateForm({ full_name: "", email: "", password: "", phone: "", specialty: "", cpf: "", pis_pasep: "", role: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const ativoMutation = useMutation({
    mutationFn: async (t: { user_id: string; ativo: boolean }) => {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: { action: t.ativo ? "deactivate" : "reactivate", user_id: t.user_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(typeof data.error === "string" ? data.error : "Erro");
    },
    onSuccess: (_d, t) => {
      invalidateAll();
      toast.success(t.ativo ? "Usuário desativado" : "Usuário reativado");
      setAtivoTarget(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const pedirRemocao = (r: { id: string; role: string; user_id: string }) => {
    if (r.user_id === user?.id && r.role === "admin") {
      toast.error("Você não pode remover sua própria permissão de admin");
      return;
    }
    setRoleToRemove(r);
  };

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: { action: "delete", user_id: userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(typeof data.error === "string" ? data.error : "Erro ao excluir");
    },
    onSuccess: () => {
      invalidateAll();
      toast.success("Usuário excluído");
      setFichaUserId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const getRolesForUser = (userId: string) => allRoles.filter((r) => r.user_id === userId);

  const filtered = profiles.filter((p) => {
    const email = emailByUserId.get(p.user_id) || "";
    if (/^teste\..*@fortem\.app$/i.test(email)) return false;
    if (!mostrarDesativados && p.ativo === false) return false;
    const q = search.toLowerCase();
    return (
      p.full_name.toLowerCase().includes(q) ||
      email.toLowerCase().includes(q)
    );
  });

  const existingRolesForSelected = selectedUser
    ? getRolesForUser(selectedUser.userId).map((r) => r.role)
    : [];

  const fichaProfile = profiles.find((p) => p.user_id === fichaUserId) ?? null;
  const nomeDe = (uid: string) => profiles.find((p) => p.user_id === uid)?.full_name ?? "";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {isAdmin && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap">
            <Switch checked={mostrarDesativados} onCheckedChange={setMostrarDesativados} />
            Mostrar desativados
          </label>
        )}
        {isAdmin && (
          <Button onClick={() => setCreateOpen(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Novo Usuário
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Especialidade</TableHead>
              <TableHead>Permissões</TableHead>
              <TableHead className="w-[220px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((profile) => {
              const roles = getRolesForUser(profile.user_id);
              const isSelf = profile.user_id === user?.id;
              return (
                <TableRow key={profile.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground flex items-center gap-2">
                        {profile.full_name}
                        {profile.ativo === false && <Badge variant="destructive" className="text-[10px]">Desativado</Badge>}
                      </p>
                      <p className="text-xs text-muted-foreground">{profile.phone || "—"}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {emailByUserId.get(profile.user_id) || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {profile.specialty || "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {roles.length === 0 && (
                        <span className="text-xs text-muted-foreground">Sem permissão</span>
                      )}
                      {roles.map((r) => (
                        <Badge
                          key={r.id}
                          variant="secondary"
                          className={`text-xs ${ROLE_COLORS[r.role] || ""} cursor-pointer`}
                          onClick={() => pedirRemocao(r)}
                          title="Remover permissão"
                        >
                          {ROLE_LABELS[r.role] || r.role}
                          <Trash2 className="w-3 h-3 ml-1" />
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedUser({ userId: profile.user_id, name: profile.full_name });
                          setAddRoleOpen(true);
                        }}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Permissão
                      </Button>
                      {isAdmin && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => setFichaUserId(profile.user_id)} title="Abrir ficha">
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={isSelf}
                            onClick={() => setAtivoTarget({ user_id: profile.user_id, name: profile.full_name, ativo: profile.ativo !== false })}
                            title={isSelf ? "Não é possível desativar o próprio usuário" : undefined}
                          >
                            {profile.ativo === false ? "Reativar" : "Desativar"}
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Add Role */}
      <Dialog open={addRoleOpen} onOpenChange={setAddRoleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Adicionar Permissão — {selectedUser?.name}
            </DialogTitle>
          </DialogHeader>
          <Select value={newRole} onValueChange={setNewRole}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma permissão" />
            </SelectTrigger>
            <SelectContent>
              {ROLES.filter((r) => !existingRolesForSelected.includes(r)).map((role) => (
                <SelectItem key={role} value={role}>
                  {ROLE_LABELS[role] || role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddRoleOpen(false)}>Cancelar</Button>
            <Button
              disabled={!newRole || addRoleMutation.isPending}
              onClick={() => {
                if (selectedUser && newRole) addRoleMutation.mutate({ userId: selectedUser.userId, role: newRole });
              }}
            >
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Novo Usuário
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome completo *</Label>
              <Input value={createForm.full_name} onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })} />
            </div>
            <div>
              <Label>E-mail *</Label>
              <Input type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} />
            </div>
            <div>
              <Label>Senha inicial * (mín. 6)</Label>
              <Input type="password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Telefone</Label>
                <Input value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} />
              </div>
              <div>
                <Label>Especialidade</Label>
                <Input value={createForm.specialty} onChange={(e) => setCreateForm({ ...createForm, specialty: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>CPF</Label>
                <Input
                  value={createForm.cpf}
                  onChange={(e) => setCreateForm({ ...createForm, cpf: maskCPF(e.target.value) })}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                />
              </div>
              <div>
                <Label>PIS/PASEP</Label>
                <Input
                  value={createForm.pis_pasep}
                  onChange={(e) => setCreateForm({ ...createForm, pis_pasep: maskPIS(e.target.value) })}
                  placeholder="000.00000.00-0"
                  inputMode="numeric"
                />
              </div>
            </div>
            <div>
              <Label>Permissão inicial</Label>
              <Select value={createForm.role} onValueChange={(v) => setCreateForm({ ...createForm, role: v })}>
                <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABELS[r] || r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button
              disabled={
                createMutation.isPending ||
                !createForm.full_name.trim() ||
                !createForm.email.trim() ||
                createForm.password.length < 6
              }
              onClick={() => createMutation.mutate(createForm)}
            >
              {createMutation.isPending ? "Criando..." : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FichaFuncionario
        open={!!fichaUserId}
        onOpenChange={(o) => !o && setFichaUserId(null)}
        profile={fichaProfile}
        email={fichaUserId ? emailByUserId.get(fichaUserId) || "" : ""}
        lastSignIn={fichaUserId ? lastSignInByUserId.get(fichaUserId) ?? null : null}
        roles={fichaUserId ? getRolesForUser(fichaUserId) : []}
        roleLabels={ROLE_LABELS}
        roleColors={ROLE_COLORS}
        isSelf={fichaUserId === user?.id}
        onRemoveRole={pedirRemocao}
        onAddRole={() => {
          if (!fichaProfile) return;
          setSelectedUser({ userId: fichaProfile.user_id, name: fichaProfile.full_name });
          setAddRoleOpen(true);
        }}
        onToggleAtivo={() => fichaProfile && setAtivoTarget({ user_id: fichaProfile.user_id, name: fichaProfile.full_name, ativo: fichaProfile.ativo !== false })}
        onDelete={() => fichaProfile && deleteMutation.mutate(fichaProfile.user_id)}
        deleting={deleteMutation.isPending}
        onSaved={invalidateAll}
      />

      <AlertDialog open={!!roleToRemove} onOpenChange={(o) => !o && setRoleToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remover a permissão {roleToRemove ? ROLE_LABELS[roleToRemove.role] || roleToRemove.role : ""} de {roleToRemove ? nomeDe(roleToRemove.user_id) : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>A pessoa perde na hora o acesso liberado por essa permissão.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => roleToRemove && removeRoleMutation.mutate(roleToRemove.id)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!ativoTarget} onOpenChange={(o) => !o && setAtivoTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{ativoTarget?.ativo ? "Desativar" : "Reativar"} {ativoTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {ativoTarget?.ativo
                ? "O login é bloqueado e o acesso ao sistema é cortado na hora. Nada do histórico é apagado (ponto, comissões, treinos)."
                : "O login volta a funcionar e as permissões atuais voltam a valer."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => ativoTarget && ativoMutation.mutate({ user_id: ativoTarget.user_id, ativo: ativoTarget.ativo })}>
              {ativoTarget?.ativo ? "Desativar" : "Reativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
