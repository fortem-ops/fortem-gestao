import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageDown, Square } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BUCKET_FOTOS, fotosAdmin } from "./api";
import { gerarMiniatura } from "./imagem";

type Item = { foto_id: string; url_previa: string; miniatura: { path: string; token: string } };
type Lote = { faltando: number; fotos: Item[] };

/** Pede ao navegador o formato que ele consegue gerar (WebP ou JPEG), para o servidor montar o caminho certo. */
async function formatoMiniatura(): Promise<"webp" | "jpg"> {
  const c = document.createElement("canvas"); c.width = c.height = 2;
  const b = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/webp", 0.75));
  return b?.type === "image/webp" ? "webp" : "jpg";
}

/** Backfill: gera, a partir da prévia de 1200px, as miniaturas das fotos que ainda não têm. */
export default function MiniaturasFaltando({ eventoId }: { eventoId: string }) {
  const qc = useQueryClient();
  const parar = useRef(false);
  const [rodando, setRodando] = useState(false);
  const [feitas, setFeitas] = useState(0);
  const { data: faltando = 0, refetch } = useQuery({
    queryKey: ["fotos-evento", eventoId, "miniaturas-faltando"],
    queryFn: async () => (await fotosAdmin<Lote>("miniaturas_faltando", { evento_id: eventoId, apenas_contar: true })).faltando,
  });

  async function gerar() {
    setRodando(true); setFeitas(0); parar.current = false;
    let erros = 0;
    try {
      const fmt = await formatoMiniatura();
      for (let rodada = 0; rodada < 100 && !parar.current; rodada++) {
        const lote = await fotosAdmin<Lote>("miniaturas_faltando", { evento_id: eventoId, miniatura: fmt });
        if (!lote.fotos.length) break;
        const prontas: { foto_id: string; path: string }[] = [];
        for (const it of lote.fotos) {
          try {
            const r = await fetch(it.url_previa, { mode: "cors" });
            if (!r.ok) throw new Error("previa");
            const bmp = await createImageBitmap(await r.blob());
            const m = await gerarMiniatura(bmp, bmp.width, bmp.height); bmp.close();
            const up = await supabase.storage.from(BUCKET_FOTOS).uploadToSignedUrl(it.miniatura.path, it.miniatura.token, m.blob, { contentType: m.tipo, upsert: true });
            if (up.error) throw up.error;
            prontas.push({ foto_id: it.foto_id, path: it.miniatura.path });
          } catch { erros++; }
        }
        const { concluidas } = await fotosAdmin<{ concluidas: number }>("concluir_miniaturas", { itens: prontas });
        setFeitas((n) => n + concluidas);
        if (!concluidas) break;
      }
      if (erros) toast.error(`${erros} miniatura(s) não puderam ser geradas. Tente de novo.`); else toast.success("Miniaturas geradas.");
    } catch (e) { toast.error(`Não foi possível gerar: ${e instanceof Error ? e.message : "erro"}`); }
    finally { setRodando(false); await refetch(); qc.invalidateQueries({ queryKey: ["fotos-evento", eventoId] }); }
  }

  return (
    <Card className="p-5 space-y-3">
      <h3 className="font-semibold">Miniaturas da grade</h3>
      <p className="text-sm text-muted-foreground">
        A página pública carrega uma miniatura leve de cada foto. {faltando ? <><b>{faltando}</b> foto(s) ainda sem miniatura (a grade usa a prévia, mais pesada).</> : "Todas as fotos têm miniatura."}
      </p>
      <div className="flex gap-2 items-center">
        {rodando
          ? <Button variant="outline" onClick={() => { parar.current = true; }}><Square className="h-4 w-4 mr-2" />Parar</Button>
          : <Button onClick={() => void gerar()} disabled={!faltando}><ImageDown className="h-4 w-4 mr-2" />Gerar miniaturas que faltam</Button>}
        {(rodando || feitas > 0) && <span className="text-sm text-muted-foreground">{feitas} gerada(s)</span>}
      </div>
    </Card>
  );
}
