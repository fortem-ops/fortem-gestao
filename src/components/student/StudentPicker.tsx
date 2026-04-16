import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface StudentPickerProps {
  value: string;
  onChange: (id: string) => void;
  label?: string;
  placeholder?: string;
}

export function StudentPicker({ value, onChange, label = "Aluno", placeholder = "Buscar aluno pelo nome..." }: StudentPickerProps) {
  const [open, setOpen] = useState(false);

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

  const selected = alunos.find((a) => a.id === value);

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={isLoading}
            className="w-full md:w-96 justify-between font-normal"
          >
            <span className="flex items-center gap-2 truncate">
              <User className="w-4 h-4 text-muted-foreground shrink-0" />
              {selected ? (
                <span className="truncate">
                  {selected.nome}
                  {selected.status !== "ativo" && (
                    <span className="text-xs text-muted-foreground ml-1">({selected.status})</span>
                  )}
                </span>
              ) : (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command
            filter={(value, search) => {
              // value here is the CommandItem's `value` prop (we'll set it to the nome)
              if (value.toLowerCase().includes(search.toLowerCase())) return 1;
              return 0;
            }}
          >
            <CommandInput placeholder="Digite para buscar..." />
            <CommandList>
              <CommandEmpty>Nenhum aluno encontrado.</CommandEmpty>
              <CommandGroup>
                {alunos.map((a) => (
                  <CommandItem
                    key={a.id}
                    value={a.nome}
                    onSelect={() => {
                      onChange(a.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === a.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="flex-1">{a.nome}</span>
                    {a.status !== "ativo" && (
                      <span className="text-xs text-muted-foreground ml-2">({a.status})</span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
