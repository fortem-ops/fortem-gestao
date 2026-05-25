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
  /** Se true, jornada não exige intervalo: pula direto para encerramento. */
  pularIntervalo?: boolean;
}

const ACAO_ICON: Record<NonNullable<ProximaAcao>, typeof Play> = {
  entrada: Play,
  intervalo_inicio: Coffee,
  intervalo_fim: Utensils,
  saida: Square,
};

/** Botão único contextual: dispara a próxima ação válida do estado atual. */
export function BotaoInteligente({ proximaAcao, pularIntervalo }: Props) {
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Em jornadas curtas (≤4h), o intervalo é opcional: substituímos por encerramento.
  const acaoEfetiva: ProximaAcao =
    pularIntervalo && proximaAcao === "intervalo_inicio" ? "saida" : proximaAcao;

  const mut = useMutation({
    mutationFn: async () => {
      if (!acaoEfetiva) throw new Error("Sem próxima ação disponível");
      const { lat, lng } = await tryGeo();
      const { data, error } = await supabase.rpc("fn_ponto_registrar", {
        _tipo: acaoEfetiva,
        _lat: lat,
        _lng: lng,
        _dispositivo: shortDevice(),
      });
      if (error) throw error;
      return { data, semGps: lat == null || lng == null };
    },
    onSuccess: ({ data, semGps }) => {
      const res = data as any;
      if (semGps) {
        toast({
          title: "Registrado sem localização",
          description: "Sua batida foi aceita, mas sem GPS — o coordenador será notificado.",
          variant: "destructive",
        });
      } else if (res?.fora_do_raio) {
        const dist = res?.distancia_m != null ? `${Math.round(Number(res.distancia_m))}m` : "fora";
        const nome = res?.local_nome ? ` de ${res.local_nome}` : "";
        toast({
          title: "Registrado fora do local",
          description: `Você está a ${dist}${nome}. O coordenador será notificado.`,
        });
      } else {
        toast({ title: "Registrado!", description: ACAO_LABEL[acaoEfetiva!] });
      }
      qc.invalidateQueries({ queryKey: ["ponto-estado"] });
      qc.invalidateQueries({ queryKey: ["ponto-historico"] });
      qc.invalidateQueries({ queryKey: ["ponto-widget"] });
      qc.invalidateQueries({ queryKey: ["ponto-eventos-dia"] });
    },
    onError: (err: any) => {
      toast({ title: "Não foi possível registrar", description: err.message, variant: "destructive" });
    },
  });

  if (!acaoEfetiva) {
    return (
      <Button disabled size="lg" className="w-full h-14 text-base">
        Jornada encerrada
      </Button>
    );
  }

  const Icon = ACAO_ICON[acaoEfetiva];
  const label = ACAO_LABEL[acaoEfetiva];
  const isDestructive = acaoEfetiva === "saida";

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
