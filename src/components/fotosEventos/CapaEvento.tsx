import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fotosAdmin, type EventoFotos } from "./api";

/** Capa da página pública: a equipe escolhe entre as fotos aprovadas. Sem capa, a página mostra só o fundo preto. */
export default function CapaEvento({ evento }: { evento: EventoFotos }) {
  const qc = useQueryClient();
  const { data: previas = {} } = useQuery({
    queryKey: ["fotos-evento", evento.id, "capa-opcoes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fotos_evento").select("id").eq("evento_id", evento.id)
        .eq("status_moderacao", "aprovada").eq("upload_concluido", true).order("criado_em").limit(60);
      if (error) throw error;
      const ids = (data ?? []).map((f) => f.id);
      if (evento.capa_foto_id && !ids.includes(evento.capa_foto_id)) ids.unshift(evento.capa_foto_id);
      if (!ids.length) return {};
      return (await fotosAdmin<{ previas: Record<string, string | null> }>("previas", { foto_ids: ids })).previas;
    },
  });
  async function definir(fotoId: string | null) {
    try {
      await fotosAdmin("definir_capa", { evento_id: evento.id, foto_id: fotoId });
      toast.success(fotoId ? "Capa definida." : "Capa removida.");
      qc.invalidateQueries({ queryKey: ["eventos-fotos"] });
      qc.invalidateQueries({ queryKey: ["fotos-evento", evento.id] });
    } catch (e) { toast.error(`Não foi possível salvar a capa: ${e instanceof Error ? e.message : "erro"}`); }
  }
  const ids = Object.keys(previas);
  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Capa da página pública</h3>
        {evento.capa_foto_id && <Button variant="ghost" size="sm" onClick={() => void definir(null)}>Remover capa</Button>}
      </div>
      <p className="text-xs text-muted-foreground">Clique numa foto aprovada para usá-la no topo da página (aparece em preto e branco). Sem capa, a página mostra só o fundo preto com as cantoneiras.</p>
      {ids.length ? (
        <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
          {ids.map((id) => (
            <button key={id} onClick={() => void definir(id)} className={`aspect-square overflow-hidden border-2 ${evento.capa_foto_id === id ? "border-primary" : "border-transparent"}`} aria-label="Usar como capa">
              {previas[id] && <img src={previas[id]!} alt="" className="h-full w-full object-cover" loading="lazy" />}
            </button>
          ))}
        </div>
      ) : <p className="text-sm text-muted-foreground">Nenhuma foto aprovada ainda.</p>}
    </Card>
  );
}
