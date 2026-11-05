import { useCallback, useSyncExternalStore } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { dispensarEventoFeed, eventoFeedDispensado } from "@/components/portal/ComunidadeFeed";

// Estado único da pergunta "Compartilhar treino?" para todas as telas de treino.
let aberto: string | null = null;
const jaPerguntados = new Set<string>();
const ouvintes = new Set<() => void>();
const definir = (id: string | null) => { aberto = id; ouvintes.forEach((o) => o()); };
const assinar = (o: () => void) => { ouvintes.add(o); return () => { ouvintes.delete(o); }; };

/** Pergunta só se o agendamento já está 'realizado', não foi dispensado nem compartilhado, e uma vez por agendamento. */
export async function perguntarCompartilharTreino(agendamentoId: string | null | undefined) {
  if (!agendamentoId || jaPerguntados.has(agendamentoId) || eventoFeedDispensado(agendamentoId)) return;
  try {
    const { data: ag } = await supabase.from("treino_agendamentos").select("status").eq("id", agendamentoId).maybeSingle();
    if (ag?.status !== "realizado") return;
    const { data: comp, error } = await supabase.rpc("fn_comunidade_compartilhaveis" as any);
    // Se o treino de hoje não aparece mais como compartilhável, já foi publicado.
    if (!error && (comp as any)?.treino?.id !== agendamentoId) return;
    jaPerguntados.add(agendamentoId);
    definir(agendamentoId);
  } catch {
    // Silencioso: a pergunta é opcional e não deve afetar a conclusão do treino.
  }
}

export function usePerguntaCompartilharTreino(agendamentoId?: string | null) {
  return useCallback((id?: string | null) => perguntarCompartilharTreino(id ?? agendamentoId), [agendamentoId]);
}

export function PerguntaCompartilharTreino() {
  const id = useSyncExternalStore(assinar, () => aberto, () => null);
  const navigate = useNavigate();
  if (!id) return null;
  const dispensar = () => { dispensarEventoFeed(id); definir(null); };
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/70" onClick={dispensar}>
      <div role="dialog" aria-label="Compartilhar treino?" onClick={(e) => e.stopPropagation()}
        className="w-full space-y-4 border-t border-[#4A4B4B] bg-card p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        style={{ fontFamily: "Archivo, sans-serif" }}>
        <p className="text-lg font-black uppercase text-foreground">Compartilhar treino?</p>
        <p className="text-sm text-muted-foreground">Você escolhe quem vê e pode anexar uma foto.</p>
        <button className="min-h-[44px] w-full bg-[#C8282A] px-4 text-[13px] font-bold uppercase tracking-[0.08em] text-white"
          onClick={() => { definir(null); navigate(`/portal/comunidade?aba=feed&compartilhar_treino=${id}`); }}>Sim</button>
        <button className="min-h-[44px] w-full border border-[#4A4B4B] px-4 text-[13px] font-bold uppercase tracking-[0.08em] text-foreground"
          onClick={dispensar}>Agora não</button>
      </div>
    </div>
  );
}
