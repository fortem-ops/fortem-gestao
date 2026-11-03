import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Image as ImageIcon, Loader2, Monitor, RotateCcw, Smartphone, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { FOTOS_SITE } from "@/site/fotos";
import { AJUSTES_QUERY_KEY, ENQ_PADRAO, normalizarEnquadramento, useAjustesFotosSite, type ChaveFoto, type Enquadramento } from "@/site/fotosAjuste";

const NOMES: Record<ChaveFoto, string> = {
  "home-hero": "Home · topo", "experimental-hero": "Experimental · topo",
  "equipe-nicolas": "Equipe · Nicolas", "equipe-gustavo": "Equipe · Gustavo", "equipe-thais": "Equipe · Thaís",
  "equipe-cristiano": "Equipe · Cristiano", "equipe-bruno": "Equipe · Bruno",
  "estrutura-area-treino": "Estrutura · área de treino", "estrutura-equipamentos": "Estrutura · equipamentos",
  "estrutura-reabilitacao": "Estrutura · reabilitação (e topo Reabilitação)", "estrutura-nutricao": "Estrutura · nutrição (e topo Nutrição)",
  "estrutura-vestiarios-1": "Estrutura · vestiários", "estrutura-recepcao": "Estrutura · recepção",
  "treinamento-orientacao": "Treinamento · topo", "avaliacao-dinamometro": "Avaliação · topo",
};

/** Formato aproximado da moldura no site, por tamanho de tela. */
function formato(chave: ChaveFoto, tela: "desk" | "mob"): string {
  if (chave.startsWith("equipe-")) return "3 / 4";
  if (chave.endsWith("-hero")) return tela === "desk" ? "16 / 9" : "4 / 5";
  if (chave.startsWith("estrutura-")) return "4 / 3";
  return tela === "desk" ? "16 / 9" : "4 / 3";
}

async function reduzirImagem(arquivo: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bmp = await createImageBitmap(arquivo);
  const escala = Math.min(1, 1920 / Math.max(bmp.width, bmp.height));
  const width = Math.round(bmp.width * escala), height = Math.round(bmp.height * escala);
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, width, height);
  const blob = await new Promise<Blob>((ok, falha) => canvas.toBlob((b) => (b ? ok(b) : falha(new Error("Falha ao converter"))), "image/webp", 0.85));
  return { blob, width, height };
}

function EditorFoto({ chave }: { chave: ChaveFoto }) {
  const base = FOTOS_SITE[chave];
  const { data: ajustes } = useAjustesFotosSite();
  const salvo = ajustes?.[chave];
  const qc = useQueryClient();
  const [tela, setTela] = useState<"desk" | "mob">("desk");
  const [enq, setEnq] = useState<{ desk: Enquadramento; mob: Enquadramento }>({ desk: ENQ_PADRAO, mob: ENQ_PADRAO });
  const [salvando, setSalvando] = useState(false);
  const moldura = useRef<HTMLDivElement>(null);
  const arraste = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => { setEnq({ desk: salvo?.desk ?? ENQ_PADRAO, mob: salvo?.mob ?? ENQ_PADRAO }); }, [salvo]);

  const atual = enq[tela];
  const mudar = (p: Partial<Enquadramento>) => setEnq((e) => ({ ...e, [tela]: normalizarEnquadramento({ ...e[tela], ...p }) }));
  const src = salvo?.src ?? base.src;

  const gravar = async (extra: Record<string, unknown> = {}) => {
    setSalvando(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("site_fotos_ajuste").upsert({
      chave, desk_x: enq.desk.x, desk_y: enq.desk.y, desk_zoom: enq.desk.zoom,
      mob_x: enq.mob.x, mob_y: enq.mob.y, mob_zoom: enq.mob.zoom,
      arquivo_path: salvo?.arquivoPath ?? null, arquivo_width: salvo?.width ?? null, arquivo_height: salvo?.height ?? null,
      updated_by: u.user?.id ?? null, updated_at: new Date().toISOString(), ...extra,
    });
    setSalvando(false);
    if (error) { toast.error("Não foi possível salvar: " + error.message); return false; }
    await qc.invalidateQueries({ queryKey: AJUSTES_QUERY_KEY });
    toast.success("Foto salva. Já aparece no site.");
    return true;
  };

  const trocar = async (arquivo?: File) => {
    if (!arquivo) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(arquivo.type)) { toast.error("Use JPG, PNG ou WebP."); return; }
    if (arquivo.size > 5 * 1024 * 1024) { toast.error("A foto deve ter até 5 MB."); return; }
    setSalvando(true);
    try {
      const { blob, width, height } = await reduzirImagem(arquivo);
      const caminho = `${chave}/${Date.now()}.webp`;
      const { error } = await supabase.storage.from("site-fotos").upload(caminho, blob, { contentType: "image/webp" });
      if (error) throw error;
      const antigo = salvo?.arquivoPath;
      if (await gravar({ arquivo_path: caminho, arquivo_width: width, arquivo_height: height }) && antigo) {
        await supabase.storage.from("site-fotos").remove([antigo]);
      }
    } catch (e) {
      toast.error("Falha ao enviar a foto: " + (e as Error).message);
    } finally { setSalvando(false); }
  };

  const restaurarFoto = async () => {
    const antigo = salvo?.arquivoPath;
    if (await gravar({ arquivo_path: null, arquivo_width: null, arquivo_height: null }) && antigo) {
      await supabase.storage.from("site-fotos").remove([antigo]);
    }
  };

  const onDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    arraste.current = { px: e.clientX, py: e.clientY, x: atual.x, y: atual.y };
  };
  const onMove = (e: React.PointerEvent) => {
    const a = arraste.current, r = moldura.current?.getBoundingClientRect();
    if (!a || !r) return;
    mudar({ x: a.x - ((e.clientX - a.px) / r.width) * 100 / atual.zoom, y: a.y - ((e.clientY - a.py) / r.height) * 100 / atual.zoom });
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">{NOMES[chave]}</p>
          <div className="flex gap-1">
            <Button size="sm" variant={tela === "desk" ? "default" : "outline"} onClick={() => setTela("desk")} aria-label="Computador"><Monitor className="h-4 w-4" /></Button>
            <Button size="sm" variant={tela === "mob" ? "default" : "outline"} onClick={() => setTela("mob")} aria-label="Celular"><Smartphone className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className={tela === "mob" ? "mx-auto w-1/2" : "w-full"}>
          <div ref={moldura} className="relative w-full cursor-grab touch-none select-none overflow-hidden rounded-sm bg-muted active:cursor-grabbing"
            style={{ aspectRatio: formato(chave, tela) }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={() => (arraste.current = null)}>
            <img src={src} alt={base.descricao} draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              style={{ objectPosition: `${atual.x}% ${atual.y}%`, transformOrigin: `${atual.x}% ${atual.y}%`, transform: `scale(${atual.zoom})` }} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Arraste a foto para enquadrar ({tela === "desk" ? "computador" : "celular"}).</p>
        <div className="flex items-center gap-3">
          <span className="w-16 text-xs text-muted-foreground">Zoom {Math.round(atual.zoom * 100)}%</span>
          <Slider min={1} max={2} step={0.01} value={[atual.zoom]} onValueChange={([z]) => mudar({ zoom: z })} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => gravar()} disabled={salvando}>{salvando && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Salvar</Button>
          <Button size="sm" variant="outline" onClick={() => mudar(ENQ_PADRAO)}><RotateCcw className="mr-1 h-4 w-4" />Enquadramento original</Button>
          <Button size="sm" variant="outline" onClick={() => entrada.current?.click()} disabled={salvando}><Upload className="mr-1 h-4 w-4" />Trocar foto</Button>
          {salvo?.arquivoPath && <Button size="sm" variant="ghost" onClick={restaurarFoto} disabled={salvando}>Voltar à foto original</Button>}
          <input ref={entrada} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
            onChange={(e) => { trocar(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
      </CardContent>
    </Card>
  );
}

export default function SiteFotosAdmin() {
  const { data: roles, isLoading } = useUserRoles();
  if (isLoading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!roles?.isAdmin) return <Navigate to="/equipe" replace />;
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <ImageIcon className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold">Fotos do site</h1>
      </div>
      <p className="text-sm text-muted-foreground">Ajuste enquadramento e zoom separadamente para computador e celular, ou troque a foto. Ao salvar, a mudança vale para quem abrir o site.</p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(Object.keys(FOTOS_SITE) as ChaveFoto[]).map((c) => <EditorFoto key={c} chave={c} />)}
      </div>
    </div>
  );
}
