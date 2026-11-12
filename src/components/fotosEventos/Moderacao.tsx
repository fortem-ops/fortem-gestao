import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight, Download, Maximize2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { acaoDaTecla, agruparQuaseIdenticas, ordenarFila } from "@/lib/fotosEventos";
import { fotosAdmin } from "./api";
import { hashDaImagem } from "./imagem";

type Rotulo = { nome: string; pai: string; confianca: number };
type Pendente = {
  id: string; enviado_por: string | null; alerta_moderacao: boolean; criado_em: string; rotulos_moderacao: unknown;
  leads_fotos: { nome: string } | null; hash?: string | null;
};
const rotulos = (v: unknown): Rotulo[] => (Array.isArray(v) ? (v as Rotulo[]).filter((r) => r && typeof r.nome === "string") : []);

export default function Moderacao({ eventoId, podeGerir }: { eventoId: string; podeGerir: boolean }) {
  const qc = useQueryClient();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [hashes, setHashes] = useState<Record<string, string | null>>({});
  const [aberta, setAberta] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const { data: pendentes = [] } = useQuery({
    queryKey: ["fotos-evento", eventoId, "pendentes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fotos_evento")
        .select("id, enviado_por, alerta_moderacao, criado_em, rotulos_moderacao, leads_fotos(nome)")
        .eq("evento_id", eventoId).eq("origem", "convidado").eq("status_moderacao", "pendente").eq("upload_concluido", true)
        .order("criado_em").limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as Pendente[];
    },
  });
  const ids = useMemo(() => pendentes.map((p) => p.id), [pendentes]);
  const { data: previas = {} } = useQuery({
    queryKey: ["fotos-evento", eventoId, "previas", ids.join(",")],
    enabled: ids.length > 0,
    staleTime: 8 * 60_000,
    queryFn: async () => (await fotosAdmin<{ previas: Record<string, string | null> }>("previas", { foto_ids: ids })).previas,
  });

  const fila = useMemo(() => ordenarFila(pendentes.map((p) => ({ ...p, hash: hashes[p.id] ?? null }))), [pendentes, hashes]);
  const grupos = useMemo(() => agruparQuaseIdenticas(fila), [fila]);
  const plana = useMemo(() => grupos.flat(), [grupos]);

  const moderar = useCallback(async (lista: string[], decisao: "aprovar" | "rejeitar") => {
    if (!lista.length) return;
    setOcupado(true);
    try {
      const { moderadas } = await fotosAdmin<{ moderadas: number }>("moderar", { foto_ids: lista, decisao });
      toast.success(`${moderadas} foto(s) ${decisao === "aprovar" ? "aprovada(s)" : "rejeitada(s)"}.`);
      setSel((s) => { const n = new Set(s); lista.forEach((i) => n.delete(i)); return n; });
      await qc.invalidateQueries({ queryKey: ["fotos-evento", eventoId] });
    } catch (e) { toast.error(`Não foi possível moderar: ${e instanceof Error ? e.message : "erro"}`); }
    finally { setOcupado(false); }
  }, [eventoId, qc]);

  const atual = aberta !== null ? plana[aberta] : undefined;
  useEffect(() => {
    if (aberta === null) return;
    const h = (e: KeyboardEvent) => {
      const a = acaoDaTecla(e.key);
      if (!a || !atual || ocupado) return;
      e.preventDefault();
      if (a === "anterior") setAberta((i) => Math.max(0, (i ?? 0) - 1));
      else if (a === "proxima") setAberta((i) => Math.min(plana.length - 1, (i ?? 0) + 1));
      else void moderar([atual.id], a);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [aberta, atual, ocupado, plana.length, moderar]);
  useEffect(() => { if (aberta !== null && aberta >= plana.length) setAberta(plana.length ? plana.length - 1 : null); }, [aberta, plana.length]);

  async function original(id: string) {
    try { const { url } = await fotosAdmin<{ url: string | null }>("url_original", { foto_id: id }); if (url) window.open(url, "_blank"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "erro"); }
  }

  const alternar = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const selecionados = [...sel];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">{pendentes.length} foto(s) aguardando · {selecionados.length} marcada(s)</span>
        <Button size="sm" variant="outline" onClick={() => setSel(new Set(ids))} disabled={!ids.length}>Marcar todas</Button>
        <Button size="sm" variant="ghost" onClick={() => setSel(new Set())} disabled={!selecionados.length}>Limpar</Button>
        <Button size="sm" onClick={() => void moderar(selecionados, "aprovar")} disabled={!selecionados.length || ocupado}><Check className="h-4 w-4 mr-1" />Aprovar marcadas</Button>
        <Button size="sm" variant="destructive" onClick={() => void moderar(selecionados, "rejeitar")} disabled={!selecionados.length || ocupado}><X className="h-4 w-4 mr-1" />Rejeitar marcadas</Button>
        <Button size="sm" variant="outline" onClick={() => setAberta(0)} disabled={!plana.length}><Maximize2 className="h-4 w-4 mr-1" />Tela cheia</Button>
      </div>
      <p className="text-xs text-muted-foreground">Fotos com alerta aparecem primeiro, com borda vermelha. O alerta é só um aviso automático: a decisão é sempre da equipe. Rejeitadas são apagadas.</p>

      {!pendentes.length && <Card className="p-8 text-center text-muted-foreground">Nenhuma foto aguardando moderação.</Card>}

      <div className="space-y-4">
        {grupos.map((g) => (
          <div key={g[0].id} className={g.length > 1 ? "rounded-md border border-border p-2 space-y-2" : ""}>
            {g.length > 1 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{g.length} fotos quase iguais de {g[0].leads_fotos?.nome ?? "convidado"}</span>
                <Button size="sm" variant="ghost" onClick={() => setSel((s) => new Set([...s, ...g.map((x) => x.id)]))}>Marcar grupo</Button>
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {g.map((p) => {
                const rs = rotulos(p.rotulos_moderacao);
                return (
                  <div key={p.id} className={`relative rounded-md overflow-hidden border-2 ${p.alerta_moderacao ? "border-destructive" : "border-transparent"} ${sel.has(p.id) ? "ring-2 ring-primary" : ""}`}>
                    <button type="button" className="block w-full aspect-square bg-muted" onClick={() => setAberta(plana.findIndex((x) => x.id === p.id))}>
                      {previas[p.id] && (
                        <img src={previas[p.id]!} alt="" crossOrigin="anonymous" loading="lazy" className="w-full h-full object-cover"
                          onLoad={(e) => { const img = e.currentTarget; if (!(p.id in hashes)) setHashes((h) => ({ ...h, [p.id]: hashDaImagem(img) })); }} />
                      )}
                    </button>
                    <div className="absolute top-1 left-1"><Checkbox checked={sel.has(p.id)} onCheckedChange={() => alternar(p.id)} className="bg-background" aria-label="Marcar foto" /></div>
                    <div className="p-1.5 text-xs space-y-1">
                      <p className="truncate text-muted-foreground">{p.leads_fotos?.nome ?? "Convidado"}</p>
                      {rs.length > 0 && <div className="flex flex-wrap gap-1">{rs.map((r) => <Badge key={r.nome} variant="destructive" className="text-[10px]">{r.nome} {r.confianca ? `${Math.round(r.confianca)}%` : ""}</Badge>)}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={aberta !== null && !!atual} onOpenChange={(o) => { if (!o) setAberta(null); }}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[92vh] flex flex-col">
          <DialogTitle className="text-sm font-normal text-muted-foreground">
            {(aberta ?? 0) + 1} de {plana.length} · {atual?.leads_fotos?.nome ?? "Convidado"} · A = aprovar, R = rejeitar, ← → = navegar
          </DialogTitle>
          {atual && (
            <>
              {rotulos(atual.rotulos_moderacao).length > 0 && (
                <div className="flex flex-wrap gap-1">{rotulos(atual.rotulos_moderacao).map((r) => <Badge key={r.nome} variant="destructive">{r.pai ? `${r.pai} · ` : ""}{r.nome} {r.confianca ? `${Math.round(r.confianca)}%` : ""}</Badge>)}</div>
              )}
              <div className={`flex-1 min-h-0 flex items-center justify-center bg-muted rounded-md border-2 ${atual.alerta_moderacao ? "border-destructive" : "border-transparent"}`}>
                {previas[atual.id] && <img src={previas[atual.id]!} alt="" className="max-h-full max-w-full object-contain" />}
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setAberta((i) => Math.max(0, (i ?? 0) - 1))} disabled={!aberta}><ChevronLeft className="h-4 w-4" /></Button>
                  <Button variant="outline" onClick={() => setAberta((i) => Math.min(plana.length - 1, (i ?? 0) + 1))} disabled={aberta === plana.length - 1}><ChevronRight className="h-4 w-4" /></Button>
                  {podeGerir && <Button variant="ghost" onClick={() => void original(atual.id)}><Download className="h-4 w-4 mr-2" />Original</Button>}
                </div>
                <div className="flex gap-2">
                  <Button variant="destructive" onClick={() => void moderar([atual.id], "rejeitar")} disabled={ocupado}><X className="h-4 w-4 mr-1" />Rejeitar (R)</Button>
                  <Button onClick={() => void moderar([atual.id], "aprovar")} disabled={ocupado}><Check className="h-4 w-4 mr-1" />Aprovar (A)</Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
