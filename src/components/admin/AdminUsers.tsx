import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Search, Shield, Trash2, Plus } from "lucide-react";
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

export function AdminUsers() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [addRoleOpen, setAddRoleOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ userId: string; name: string } | null>(null);
  const [newRole, setNewRole] = useState<string>("");

  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").order("full_name");
      return data || [];
    },
  });

  const { data: allRoles = [] } = useQuery({
    queryKey: ["admin-user-roles"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("*");
      return data || [];
    },
  });

  const addRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { error } = await supabase.from("user_roles").insert({
        user_id: userId,
        role: role as any,
      });
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

  const getRolesForUser = (userId: string) => allRoles.filter((r) => r.user_id === userId);

  const filtered = profiles.filter((p) =>
    p.full_name.toLowerCase().includes(search.toLowerCase())
  );

  const existingRolesForSelected = selectedUser
    ? getRolesForUser(selectedUser.userId).map((r) => r.role)
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar usuário..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Especialidade</TableHead>
              <TableHead>Permissões</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((profile) => {
              const roles = getRolesForUser(profile.user_id);
              return (
                <TableRow key={profile.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground">{profile.full_name}</p>
                      <p className="text-xs text-muted-foreground">{profile.phone || "—"}</p>
                    </div>
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
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

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
            <Button variant="outline" onClick={() => setAddRoleOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!newRole || addRoleMutation.isPending}
              onClick={() => {
                if (selectedUser && newRole) {
                  addRoleMutation.mutate({ userId: selectedUser.userId, role: newRole });
                }
              }}
            >
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
