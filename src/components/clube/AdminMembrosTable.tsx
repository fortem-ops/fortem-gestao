import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { NIVEL_LABEL, STATUS_LABEL, type NivelMembro, type StatusMembro } from "@/lib/clube";
import type { Database } from "@/integrations/supabase/types";

const STATUS_OPTS: StatusMembro[] = ["ativo", "bloqueado", "inadimplente", "cancelado"];
const NIVEL_OPTS: NivelMembro[] = ["bronze", "prata", "ouro", "diamante", "platina"];

type Row = Database["public"]["Tables"]["clube_fortem_membros"]["Row"] & { aluno_nome?: string };

export function AdminMembrosTable() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["clube-membros-admin"],
    queryFn: async () => {
      const { data: membros, error } = await supabase
        .from("clube_fortem_membros")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = (membros || []).map((m) => m.aluno_id);
      const { data: alunos } = ids.length
        ? await supabase.from("alunos").select("id, nome").in("id", ids)
        : { data: [] as any[] };
      const map = new Map((alunos || []).map((a: any) => [a.id, a.nome]));
      return (membros || []).map((m) => ({ ...m, aluno_nome: map.get(m.aluno_id) })) as Row[];
    },
  });

  async function updateMembro(id: string, patch: Partial<Database["public"]["Tables"]["clube_fortem_membros"]["Update"]>) {
    const { error } = await supabase.from("clube_fortem_membros").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Membro atualizado");
      qc.invalidateQueries({ queryKey: ["clube-membros-admin"] });
    }
  }

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>FORTEM ID</TableHead>
          <TableHead>Aluno</TableHead>
          <TableHead>Nível</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Desde</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data?.map((m) => (
          <TableRow key={m.id}>
            <TableCell className="font-mono text-xs">{m.fortem_id}</TableCell>
            <TableCell>{m.aluno_nome || "—"}</TableCell>
            <TableCell>
              <Select value={m.nivel_membro} onValueChange={(v) => updateMembro(m.id, { nivel_membro: v as NivelMembro })}>
                <SelectTrigger className="w-32 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NIVEL_OPTS.map((n) => (
                    <SelectItem key={n} value={n}>{NIVEL_LABEL[n]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell>
              <Select value={m.status_membro} onValueChange={(v) => updateMembro(m.id, { status_membro: v as StatusMembro })}>
                <SelectTrigger className="w-36 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTS.map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {new Date(m.aluno_desde).toLocaleDateString("pt-BR")}
            </TableCell>
          </TableRow>
        ))}
        {!data?.length && (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
              Nenhum membro cadastrado.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
