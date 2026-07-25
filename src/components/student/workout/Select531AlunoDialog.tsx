import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";

interface AlunoRow {
  id: string;
  nome: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (aluno: AlunoRow) => void;
  title?: string;
}

export function Select531AlunoDialog({ open, onOpenChange, onSelect, title = "Escolha o aluno" }: Props) {
  const [q, setQ] = useState("");
  const debounced = useDebounce(q, 250);

  const { data, isLoading } = useQuery({
    queryKey: ["select-531-alunos", debounced],
    enabled: open,
    queryFn: async () => {
      let query = supabase
        .from("alunos")
        .select("id, nome")
        .order("nome", { ascending: true })
        .limit(30);
      if (debounced.trim()) {
        query = query.ilike("nome", `%${debounced.trim()}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as AlunoRow[];
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Buscar por nome"
            className="pl-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="max-h-80 overflow-y-auto -mx-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          ) : !data || data.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum aluno encontrado.
            </p>
          ) : (
            <ul className="space-y-1 px-2">
              {data.map((a) => (
                <li key={a.id}>
                  <Button
                    variant="ghost"
                    className="w-full justify-start h-auto py-2"
                    onClick={() => {
                      onSelect(a);
                      onOpenChange(false);
                    }}
                  >
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{a.nome}</span>
                    </div>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
