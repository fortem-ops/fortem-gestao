import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { RecipientGroup } from "@/lib/notificar";

interface Props {
  value: RecipientGroup[];
  onChange: (v: RecipientGroup[]) => void;
}

export function RecipientPicker({ value, onChange }: Props) {
  const [search, setSearch] = useState("");

  const { data: profiles = [] } = useQuery({
    queryKey: ["notif-recipients-profiles"],
    queryFn: async () => {
      const { data: profs } = await supabase.from("profiles").select("user_id,full_name,specialty");
      const { data: roles } = await (supabase.from("user_roles") as any).select("user_id,role");
      const roleMap = new Map<string, string[]>();
      (roles ?? []).forEach((r: any) => {
        const arr = roleMap.get(r.user_id) ?? [];
        arr.push(r.role);
        roleMap.set(r.user_id, arr);
      });
      return (profs ?? [])
        .map((p) => ({ ...p, roles: roleMap.get(p.user_id) ?? [] }))
        .filter((p) => p.roles.length > 0); // só profissionais
    },
  });

  const groups = [
    { key: "all_profissionais", label: "Todos os profissionais" },
    { key: "all_admins", label: "Todos os administradores" },
    { key: "all_coordenadores", label: "Todos os coordenadores" },
    { key: "all_professores", label: "Todos os professores" },
  ] as const;

  const isGroupSelected = (k: string) => value.some((v) => v.type === k);
  const toggleGroup = (k: any) => {
    if (isGroupSelected(k)) onChange(value.filter((v) => v.type !== k));
    else onChange([...value, { type: k }]);
  };

  const isUserSelected = (id: string) => value.some((v) => v.type === "user" && v.userId === id);
  const toggleUser = (id: string) => {
    if (isUserSelected(id)) onChange(value.filter((v) => !(v.type === "user" && v.userId === id)));
    else onChange([...value, { type: "user", userId: id }]);
  };

  const filtered = profiles.filter((p) =>
    !search || p.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-2">
      <Label>Destinatários</Label>
      <div className="rounded-md border p-3 space-y-2">
        {groups.map((g) => (
          <div key={g.key} className="flex items-center gap-2">
            <Checkbox checked={isGroupSelected(g.key)} onCheckedChange={() => toggleGroup(g.key)} />
            <span className="text-sm">{g.label}</span>
          </div>
        ))}
        <Separator className="my-2" />
        <Input placeholder="Buscar profissional..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <ScrollArea className="h-40">
          <div className="space-y-1">
            {filtered.map((p) => (
              <div key={p.user_id} className="flex items-center gap-2">
                <Checkbox checked={isUserSelected(p.user_id)} onCheckedChange={() => toggleUser(p.user_id)} />
                <span className="text-sm">{p.full_name}</span>
                {p.specialty && <span className="text-xs text-muted-foreground">· {p.specialty}</span>}
              </div>
            ))}
            {filtered.length === 0 && <p className="text-xs text-muted-foreground py-2">Nenhum profissional encontrado.</p>}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
