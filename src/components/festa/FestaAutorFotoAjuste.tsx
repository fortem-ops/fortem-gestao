import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { festaHistoriaAbertura } from "@/config/festaHistoria";
import { AJUSTE_PADRAO, CHAVE_AJUSTE_AUTOR, normalizarAjuste, type AjusteFoto } from "@/lib/festaFotos";
import FotoAutor from "@/components/festa/FotoAutor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";

export default function FestaAutorFotoAjuste() {
  const qc = useQueryClient();
  const autor = festaHistoriaAbertura.autor;
  const { data } = useQuery({ queryKey: ["festa-autor-ajuste"], queryFn: async () => {
    const { data, error } = await supabase.from("sistema_config").select("valor").eq("chave", CHAVE_AJUSTE_AUTOR).maybeSingle();
    if (error) throw error; return normalizarAjuste(data?.valor);
  } });
  const [aj, setAj] = useState<AjusteFoto>(AJUSTE_PADRAO);
  useEffect(() => { if (data) setAj(data); }, [data]);
  const salvar = useMutation({
    mutationFn: async (v: AjusteFoto) => {
      const { error } = await supabase.from("sistema_config").upsert({ chave: CHAVE_AJUSTE_AUTOR, valor: v, descricao: "Enquadramento da foto de Quem conta (/10anos)", updated_at: new Date().toISOString() }, { onConflict: "chave" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Enquadramento salvo"); qc.invalidateQueries({ queryKey: ["festa-autor-ajuste"] }); },
    onError: () => toast.error("Não foi possível salvar o enquadramento"),
  });
  if (!autor.foto) return null;
  const linha = (rotulo: string, k: keyof AjusteFoto, min: number, max: number, step: number, fmt: (v: number) => string) => (
    <div className="space-y-2">
      <div className="flex justify-between text-xs"><span>{rotulo}</span><span className="text-muted-foreground">{fmt(aj[k])}</span></div>
      <Slider aria-label={rotulo} min={min} max={max} step={step} value={[aj[k]]} onValueChange={([v]) => setAj((a) => ({ ...a, [k]: v }))} />
    </div>
  );
  return (
    <Card className="p-4">
      <h3 className="font-semibold">Foto de "Quem conta"</h3>
      <div className="mt-3 grid gap-6 sm:grid-cols-[12rem_1fr]">
        <div className="border border-border"><FotoAutor src={autor.foto} alt={autor.nome} ajuste={aj} /></div>
        <div className="space-y-5">
          {linha("Horizontal", "x", 0, 100, 1, (v) => `${Math.round(v)}%`)}
          {linha("Vertical", "y", 0, 100, 1, (v) => `${Math.round(v)}%`)}
          {linha("Zoom", "zoom", 1, 1.5, 0.01, (v) => `${Math.round(v * 100)}%`)}
          <div className="flex gap-2">
            <Button onClick={() => salvar.mutate(aj)} disabled={salvar.isPending}>Salvar</Button>
            <Button variant="outline" onClick={() => setAj(AJUSTE_PADRAO)}>Voltar ao centro</Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
