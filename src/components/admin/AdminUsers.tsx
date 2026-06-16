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
};

type CreateForm = {
  full_name: string;
  email: string;
  password: string;
  phone: string;
  specialty: string;
  role: string;
};

type EditForm = {
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  specialty: string;
  changePassword: boolean;
  password: string;
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
    full_name: "", email: "", password: "", phone: "", specialty: "", role: "",
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditForm | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{ user_id: string; name: string } | null>(null);

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
      return (data?.emails || []) as { user_id: string; email: string | null }[];
    },
    enabled: !!isAdmin,
  });

  const emailByUserId = new Map(emails.map((e) => [e.user_id, e.email]));

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
      setCreateForm({ full_name: "", email: "", password: "", phone: "", specialty: "", role: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (f: EditForm) => {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: {
          action: "update",
          user_id: f.user_id,
          email: f.email.trim() || null,
          password: f.changePassword && f.password ? f.password : null,
          full_name: f.full_name.trim(),
          phone: f.phone.trim() || null,
          specialty: f.specialty.trim() || null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(typeof data.error === "string" ? data.error : "Erro ao atualizar");
    },
    onSuccess: () => {
      invalidateAll();
      toast.success("Usuário atualizado");
      setEditOpen(false);
      setEditForm(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

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
      setDeleteTarget(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const getRolesForUser = (userId: string) => allRoles.filter((r) => r.user_id === userId);

  const filtered = profiles.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.full_name.toLowerCase().includes(q) ||
      (emailByUserId.get(p.user_id) || "").toLowerCase().includes(q)
    );
  });

  const existingRolesForSelected = selectedUser
    ? getRolesForUser(selectedUser.userId).map((r) => r.role)
    : [];

  const openEdit = (p: ProfileRow) => {
    setEditForm({
      user_id: p.user_id,
      full_name: p.full_name,
      email: emailByUserId.get(p.user_id) || "",
      phone: p.phone || "",
      specialty: p.specialty || "",
      changePassword: false,
      password: "",
    });
    setEditOpen(true);
  };

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
                      <p className="font-medium text-foreground">{profile.full_name}</p>
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
                          className={`text-xs ${ROLE_COLORS[r.role] || ""} cursor-pointer group`}
                          onClick={() => {
                            if (r.user_id === user?.id && r.role === "admin") {
                              toast.error("Você não pode remover sua própria permissão de admin");
                              return;
                            }
                            removeRoleMutation.mutate(r.id);
                          }}
                        >
                          {ROLE_LABELS[r.role] || r.role}
                          <Trash2 className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
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
                          <Button size="sm" variant="ghost" onClick={() => openEdit(profile)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={isSelf}
                            onClick={() => setDeleteTarget({ user_id: profile.user_id, name: profile.full_name })}
                            title={isSelf ? "Não é possível excluir o próprio usuário" : "Excluir usuário"}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
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

      {/* Edit User */}
      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) setEditForm(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary" />
              Editar Usuário
            </DialogTitle>
          </DialogHeader>
          {editForm && (
            <div className="space-y-3">
              <div>
                <Label>Nome completo</Label>
                <Input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Telefone</Label>
                  <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                </div>
                <div>
                  <Label>Especialidade</Label>
                  <Input value={editForm.specialty} onChange={(e) => setEditForm({ ...editForm, specialty: e.target.value })} />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input
                  id="chgpw"
                  type="checkbox"
                  checked={editForm.changePassword}
                  onChange={(e) => setEditForm({ ...editForm, changePassword: e.target.checked, password: "" })}
                />
                <Label htmlFor="chgpw" className="cursor-pointer">Alterar senha</Label>
              </div>
              {editForm.changePassword && (
                <div>
                  <Label>Nova senha (mín. 6)</Label>
                  <Input
                    type="password"
                    value={editForm.password}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button
              disabled={
                !editForm ||
                updateMutation.isPending ||
                !editForm.full_name.trim() ||
                (editForm.changePassword && editForm.password.length < 6)
              }
              onClick={() => editForm && updateMutation.mutate(editForm)}
            >
              {updateMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>? Esta ação é permanente
              e remove o acesso ao sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.user_id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
