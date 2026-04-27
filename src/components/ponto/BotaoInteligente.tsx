import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ACAO_LABEL, type ProximaAcao, shortDevice, tryGeo } from "@/lib/ponto";
import { Play, Coffee, Utensils, Square, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
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

interface Props {
  proximaAcao: ProximaAcao;
}

const ACAO_ICON: Record<NonNullable<ProximaAcao>, typeof Play> = {
  entrada: Play,
  intervalo_inicio: Coffee,
  intervalo_fim: Utensils,
  saida: Square,
};

/** Botão único contextual: dispara a próxima ação válida do estado atual. */
export function BotaoInteligente({ proximaAcao }: Props) {
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const mut = useMutation({
    mutationFn: async () => {
      if (!proximaAcao) throw new Error("Sem próxima ação disponível");
      const { lat, lng } = await tryGeo();
      const { data, error } = await supabase.rpc("fn_ponto_registrar", {
        _tipo: proximaAcao,
        _lat: lat,
        _lng: lng,
        _dispositivo: shortDevice(),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Registrado!", description: ACAO_LABEL[proximaAcao!] });
      qc.invalidateQueries({ queryKey: ["ponto-estado"] });
      qc.invalidateQueries({ queryKey: ["ponto-historico"] });
      qc.invalidateQueries({ queryKey: ["ponto-widget"] });
    },
    onError: (err: any) => {
      toast({ title: "Não foi possível registrar", description: err.message, variant: "destructive" });
    },
  });

  if (!proximaAcao) {
    return (
      <Button disabled size="lg" className="w-full h-14 text-base">
        Jornada encerrada
      </Button>
    );
  }

  const Icon = ACAO_ICON[proximaAcao];
  const label = ACAO_LABEL[proximaAcao];
  const isDestructive = proximaAcao === "saida";

  const handleClick = () => {
    if (isDestructive) setConfirmOpen(true);
    else mut.mutate();
  };

  return (
    <>
      <Button
        size="lg"
        onClick={handleClick}
        disabled={mut.isPending}
        variant={isDestructive ? "destructive" : "default"}
        className="w-full h-14 text-base font-semibold gap-2 shadow-md"
      >
        {mut.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Icon className="w-5 h-5" />}
        {label}
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar jornada?</AlertDialogTitle>
            <AlertDialogDescription>
              Após encerrada, novas batidas só serão possíveis amanhã. Tem certeza?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => mut.mutate()}>Encerrar agora</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
