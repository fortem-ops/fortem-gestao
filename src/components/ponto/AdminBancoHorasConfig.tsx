import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock } from "lucide-react";
import { toast } from "sonner";

const SEM = "sem";

export function AdminBancoHorasConfig() {
  const qc = useQueryClient();
  const [valor, setValor] = useState<string>(SEM);

  const { data: cfg, isLoading } = useQuery({
    queryKey: ["ponto-config-global"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ponto_configuracoes")
        .select("id, banco_horas_validade_meses")
        .is("usuario_id", null)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; banco_horas_validade_meses: number | null } | null;
    },
  });

  useEffect(() => {
    if (cfg) {
      setValor(cfg.banco_horas_validade_meses ? String(cfg.banco_horas_validade_meses) : SEM);
    }
  }, [cfg]);

  const mut = useMutation({
    mutationFn: async () => {
      const meses = valor === SEM ? null : Number(valor);
      if (cfg?.id) {
        const { error } = await supabase
          .from("ponto_configuracoes")
          .update({ banco_horas_validade_meses: meses })
          .eq("id", cfg.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("ponto_configuracoes")
          .insert({ usuario_id: null, banco_horas_validade_meses: meses } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Política de expiração atualizada");
      qc.invalidateQueries({ queryKey: ["ponto-config-global"] });
    },
    onError: (e: any) => toast.error("Falha ao salvar", { description: e.message }),
  });

  if (isLoading) return <Skeleton className="h-40" />;

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Clock className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Política de expiração do banco de horas</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Saldo positivo acumulado antes do período de validade será zerado automaticamente no dia 1 de cada mês.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">Validade</Label>
          <Select value={valor} onValueChange={setValor}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={SEM}>Sem expiração</SelectItem>
              <SelectItem value="3">3 meses</SelectItem>
              <SelectItem value="6">6 meses</SelectItem>
              <SelectItem value="12">12 meses</SelectItem>
              <SelectItem value="24">24 meses</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
          {mut.isPending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </Card>
  );
}
