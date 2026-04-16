import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface StudentPickerProps {
  value: string;
  onChange: (id: string) => void;
  label?: string;
  placeholder?: string;
}

export function StudentPicker({ value, onChange, label = "Aluno", placeholder = "Selecione o aluno..." }: StudentPickerProps) {
  const { data: alunos = [], isLoading } = useQuery({
    queryKey: ["alunos-picker"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alunos")
        .select("id, nome, status")
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={isLoading}>
        <SelectTrigger className="w-full md:w-96">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {alunos.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.nome} {a.status !== "ativo" && <span className="text-xs text-muted-foreground">({a.status})</span>}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
