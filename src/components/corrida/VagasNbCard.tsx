import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Ticket, Loader2 } from "lucide-react";

type VagasRow = {
  id: string;
  vagas_totais: number | null;
  vagas_utilizadas: number | null;
  valido_ate: string | null;
};

/** Painel interno de controle das vagas da promoção NB 42k 2027. */
export default function VagasNbCard({ podeEditar }: { podeEditar: boolean }) {
  const qc = useQueryClient();
  const [total, setTotal] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["corrida-vagas-nb"],
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("corrida_campanha_itens")
        .select("id, vagas_totais, vagas_utilizadas, valido_ate")
        .eq("tipo", "cortesia_nb")
        .maybeSingle();
      if (error) throw error;
      return data as VagasRow | null;
    },
  });

  useEffect(() => {
    if (data?.vagas_totais != null) setTotal(String(data.vagas_totais));
  }, [data?.vagas_totais]);

  const salvar = useMutation({
    mutationFn: async (novoTotal: number) => {
      if (!data?.id) throw new Error("Item da campanha não encontrado.");
      const { error } = await supabase
        .from("corrida_campanha_itens")
        .update({ vagas_totais: novoTotal })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Total de vagas atualizado.");
      qc.invalidateQueries({ queryKey: ["corrida-vagas-nb"] });
      qc.invalidateQueries({ queryKey: ["corrida-campanha-itens"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const utilizadas = Number(data?.vagas_utilizadas ?? 0);
  const totais = data?.vagas_totais ?? 0;
  const restantes = Math.max(0, totais - utilizadas);

  const onSalvar = () => {
    const n = Number(total);
    if (!Number.isInteger(n) || n < 0) {
      toast.error("Informe um número inteiro de vagas.");
      return;
    }
    if (n < utilizadas) {
      toast.error(`O total não pode ser menor que as ${utilizadas} vagas já utilizadas.`);
      return;
    }
    salvar.mutate(n);
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Ticket className="w-5 h-5 text-primary" />
        <h2 className="font-semibold">Vagas NB 42k 2027 (inscrição 50% OFF)</h2>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">Promoção não encontrada.</p>
      ) : (
        <>
          <p className="text-sm">
            <span className="font-bold text-lg">{utilizadas}</span> de{" "}
            <span className="font-bold text-lg">{totais}</span> utilizadas ·{" "}
            <span className="text-muted-foreground">{restantes} restantes</span>
            {data.valido_ate && (
              <span className="text-muted-foreground">
                {" "}· válido até {data.valido_ate.split("-").reverse().join("/")}
              </span>
            )}
          </p>

          {podeEditar && (
            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground" htmlFor="vagas-totais">
                  Total de vagas
                </label>
                <Input
                  id="vagas-totais"
                  type="number"
                  min={utilizadas}
                  value={total}
                  onChange={(e) => setTotal(e.target.value)}
                  className="w-32"
                />
              </div>
              <Button onClick={onSalvar} disabled={salvar.isPending}>
                {salvar.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
