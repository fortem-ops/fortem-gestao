import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { arquivoAceito } from "@/lib/fotosEventos";
import { BUCKET_FOTOS, fotosAdmin } from "./api";
import { prepararFoto, type FotoPreparada } from "./imagem";

type Destino = { nome: string | null; foto_id?: string; error?: string; original?: { path: string; token: string }; previa?: { path: string; token: string } };
const LOTE = 20, PARALELO = 3;

export default function UploadLote({ eventoId }: { eventoId: string }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [rodando, setRodando] = useState(false);
  const [feito, setFeito] = useState(0);
  const [total, setTotal] = useState(0);
  const [falhas, setFalhas] = useState<string[]>([]);

  async function enviar(lista: File[]) {
    const validos = lista.filter(arquivoAceito);
    const recusados = lista.filter((f) => !arquivoAceito(f)).map((f) => `${f.name}: formato ou tamanho não aceito`);
    setFalhas(recusados); setFeito(0); setTotal(validos.length); setRodando(true);
    try {
      for (let i = 0; i < validos.length; i += LOTE) {
        const parte = validos.slice(i, i + LOTE);
        const preparadas: (FotoPreparada | null)[] = [];
        for (const f of parte) {
          try { preparadas.push(await prepararFoto(f)); } catch { preparadas.push(null); setFalhas((x) => [...x, `${f.name}: não foi possível ler a imagem`]); }
        }
        const ok = parte.map((f, k) => ({ f, p: preparadas[k] })).filter((x): x is { f: File; p: FotoPreparada } => !!x.p);
        if (!ok.length) { setFeito((n) => n + parte.length); continue; }
        const { arquivos } = await fotosAdmin<{ arquivos: Destino[] }>("upload_urls", {
          evento_id: eventoId,
          arquivos: ok.map(({ f, p }) => ({ nome: f.name, tipo: p.tipo, tamanho: p.original.size, largura: p.largura, altura: p.altura })),
        });
        const concluidas: string[] = [];
        const fila = arquivos.map((d, k) => ({ d, item: ok[k] }));
        const trabalhar = async () => {
          for (let x = fila.shift(); x; x = fila.shift()) {
            const { d, item } = x;
            if (!d.foto_id || !d.original || !d.previa) { setFalhas((l) => [...l, `${item.f.name}: ${d.error ?? "recusado"}`]); setFeito((n) => n + 1); continue; }
            const st = supabase.storage.from(BUCKET_FOTOS);
            const [a, b] = await Promise.all([
              st.uploadToSignedUrl(d.original.path, d.original.token, item.p.original, { contentType: item.p.tipo }),
              st.uploadToSignedUrl(d.previa.path, d.previa.token, item.p.previa, { contentType: "image/jpeg" }),
            ]);
            if (a.error || b.error) setFalhas((l) => [...l, `${item.f.name}: falha no envio`]); else concluidas.push(d.foto_id);
            setFeito((n) => n + 1);
          }
        };
        await Promise.all(Array.from({ length: PARALELO }, trabalhar));
        setFeito((n) => n + (parte.length - ok.length));
        if (concluidas.length) await fotosAdmin("concluir_upload", { foto_ids: concluidas });
      }
      toast.success("Envio concluído. As fotos foram indexadas automaticamente; confira o painel.");
    } catch (e) {
      toast.error(`Envio interrompido: ${e instanceof Error ? e.message : "erro"}`);
    } finally {
      setRodando(false);
      qc.invalidateQueries({ queryKey: ["fotos-evento", eventoId] });
    }
  }

  return (
    <Card className="p-5 space-y-4">
      <div>
        <h3 className="font-semibold">Enviar fotos do fotógrafo</h3>
        <p className="text-sm text-muted-foreground">JPEG, PNG ou HEIC até 15 MB cada. Fotos do iPhone (HEIC) são convertidas para JPEG. Entram já aprovadas.</p>
      </div>
      <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif" className="hidden"
        onChange={(e) => { const l = Array.from(e.target.files ?? []); e.target.value = ""; if (l.length) void enviar(l); }} />
      <Button onClick={() => input.current?.click()} disabled={rodando}><Upload className="h-4 w-4 mr-2" />Escolher fotos</Button>
      {total > 0 && (
        <div className="space-y-1">
          <Progress value={(feito / total) * 100} />
          <p className="text-sm text-muted-foreground">{feito} de {total}{rodando ? " — não feche esta aba até terminar" : ""}</p>
        </div>
      )}
      {falhas.length > 0 && (
        <div className="text-sm text-destructive space-y-0.5 max-h-40 overflow-auto">{falhas.map((f, i) => <p key={i}>{f}</p>)}</div>
      )}
    </Card>
  );
}
