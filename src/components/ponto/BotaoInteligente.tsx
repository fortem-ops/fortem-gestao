import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ACAO_LABEL,
  type ProximaAcao,
  shortDevice,
  tryGeo,
  localMaisProximo,
  minutesSince,
  formatMinutes,
  formatHora,
} from "@/lib/ponto";
import { Play, Coffee, Utensils, Square, Loader2 } from "lucide-react";
import { toast } from "sonner";
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
  entrada?: string | null;
}

const ACAO_ICON: Record<NonNullable<ProximaAcao>, typeof Play> = {
  entrada: Play,
  intervalo_inicio: Coffee,
  intervalo_fim: Utensils,
  saida: Square,
};

const RAIO_M = 300;

/** Botão único contextual: dispara a próxima ação válida do estado atual. */
export function BotaoInteligente({ proximaAcao, pularIntervalo, entrada }: Props) {
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [checandoGeo, setChecandoGeo] = useState(false);
  const [geoCoords, setGeoCoords] = useState<{ lat: number | null; lng: number | null } | null>(null);
  const [obsEncerramento, setObsEncerramento] = useState("");
  const [, setTick] = useState(0);
  const [geoAlerta, setGeoAlerta] = useState<{
    distM: number;
    localNome: string;
    onConfirm: () => void;
  } | null>(null);

  // Re-render a cada 60s enquanto o diálogo de encerramento está aberto, para
  // atualizar o "Tempo trabalhado" exibido.
  useEffect(() => {
    if (!confirmOpen) return;
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, [confirmOpen]);

  // Em jornadas curtas (≤4h), o intervalo é opcional: substituímos por encerramento.
  const acaoEfetiva: ProximaAcao =
    pularIntervalo && proximaAcao === "intervalo_inicio" ? "saida" : proximaAcao;

  const mut = useMutation({
    mutationFn: async () => {
      if (!acaoEfetiva) throw new Error("Sem próxima ação disponível");
      const coords = geoCoords ?? (await tryGeo());
      const { lat, lng } = coords;
      const args: Record<string, unknown> = {
        _tipo: acaoEfetiva,
        _lat: lat,
        _lng: lng,
        _dispositivo: shortDevice(),
      };
      if (acaoEfetiva === "saida" && obsEncerramento.trim()) {
        args._observacao = obsEncerramento.trim();
      }
      const { data, error } = await supabase.rpc("fn_ponto_registrar", args as any);
      if (error) throw error;
      return { data, semGps: lat == null || lng == null };
    },
    onSuccess: ({ data, semGps }) => {
      const res = data as any;
      if (semGps) {
        toast.error("Registrado sem localização", { description: "Sua batida foi aceita, mas sem GPS — o coordenador será notificado." });
      } else if (res?.fora_do_raio) {
        const dist = res?.distancia_m != null ? `${Math.round(Number(res.distancia_m))}m` : "fora";
        const nome = res?.local_nome ? ` de ${res.local_nome}` : "";
        toast.success("Registrado fora do local", { description: `Você está a ${dist}${nome}. O coordenador será notificado.` });
      } else {
        toast.success("Registrado!", { description: ACAO_LABEL[acaoEfetiva!] });
      }
      qc.invalidateQueries({ queryKey: ["ponto-estado"] });
      qc.invalidateQueries({ queryKey: ["ponto-historico"] });
      qc.invalidateQueries({ queryKey: ["ponto-widget"] });
      qc.invalidateQueries({ queryKey: ["ponto-eventos-dia"] });
      setGeoCoords(null);
      setObsEncerramento("");
    },
    onError: (err: any) => {
      toast.error("Não foi possível registrar", { description: err.message });
      setGeoCoords(null);
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

  const handleClick = async () => {
    setChecandoGeo(true);
    try {
      const coords = await tryGeo();
      setGeoCoords(coords);
      if (coords.lat != null && coords.lng != null) {
        const { nome, distM } = localMaisProximo(coords.lat, coords.lng);
        if (distM > RAIO_M) {
          setGeoAlerta({
            distM: Math.round(distM),
            localNome: nome,
            onConfirm: () => {
              if (isDestructive) setConfirmOpen(true);
              else mut.mutate();
            },
          });
          return;
        }
      }
      if (isDestructive) setConfirmOpen(true);
      else mut.mutate();
    } finally {
      setChecandoGeo(false);
    }
  };

  const busy = mut.isPending || checandoGeo;

  return (
    <>
      <Button
        size="lg"
        onClick={handleClick}
        disabled={busy}
        variant={isDestructive ? "destructive" : "default"}
        className="w-full h-14 text-base font-semibold gap-2 shadow-md"
      >
        {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Icon className="w-5 h-5" />}
        {label}
      </Button>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(o) => {
          setConfirmOpen(o);
          if (!o) setObsEncerramento("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar jornada?</AlertDialogTitle>
            <AlertDialogDescription className="sr-only">
              Confirme o encerramento da jornada de trabalho.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 text-sm">
            {entrada ? (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Entrada</span>
                <span className="font-medium">{formatHora(entrada)}</span>
              </div>
            ) : null}
            {entrada ? (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tempo trabalhado</span>
                <span className="font-medium">{formatMinutes(minutesSince(entrada))}</span>
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground pt-1">
              Após encerrada, novas batidas só serão possíveis amanhã.
            </p>
            <div className="pt-2">
              <label className="text-xs font-medium text-muted-foreground">
                Observação (opcional)
              </label>
              <Textarea
                value={obsEncerramento}
                onChange={(e) => setObsEncerramento(e.target.value)}
                placeholder="Ex.: saí para atendimento externo…"
                rows={2}
                className="mt-2 text-sm"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setObsEncerramento("")}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => mut.mutate()}>Encerrar agora</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      <AlertDialog open={!!geoAlerta} onOpenChange={(o) => !o && setGeoAlerta(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você está fora da Fortem</AlertDialogTitle>
            <AlertDialogDescription>
              {geoAlerta
                ? `Seu dispositivo está a aproximadamente ${geoAlerta.distM}m do local mais próximo (${geoAlerta.localNome}). Deseja registrar o ponto assim mesmo? Seu coordenador será notificado.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                geoAlerta?.onConfirm();
                setGeoAlerta(null);
              }}
            >
              Registrar assim mesmo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
