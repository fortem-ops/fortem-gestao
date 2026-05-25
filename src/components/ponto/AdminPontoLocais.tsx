import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MapPin, Plus, Trash2, Crosshair, Pencil } from "lucide-react";
import { toast } from "sonner";
import { tryGeo } from "@/lib/ponto";

interface Local {
  id: string;
  nome: string;
  latitude: number;
  longitude: number;
  raio_m: number;
  ativo: boolean;
}

function MapPreview({ lat, lng, raio }: { lat: number; lng: number; raio: number }) {
  // Raio em graus aproximado (1 grau lat ≈ 111km). Bbox cobre ~3x o raio.
  const span = Math.max(0.003, (raio * 3) / 111000);
  const bbox = `${lng - span},${lat - span / 2},${lng + span},${lat + span / 2}`;
  const embed = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
  const link = `https://www.google.com/maps?q=${lat},${lng}`;
  return (
    <a href={link} target="_blank" rel="noopener noreferrer" className="block rounded-md overflow-hidden border border-border/60 hover:border-primary/60 transition-colors">
      <iframe src={embed} className="w-full h-40 pointer-events-none" loading="lazy" title="Mapa" />
    </a>
  );
}

function LocalDialog({
  open, onOpenChange, initial, onSubmit, isPending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Partial<Local>;
  onSubmit: (data: Omit<Local, "id">) => void;
  isPending: boolean;
}) {
  const [nome, setNome] = useState(initial?.nome ?? "");
  const [lat, setLat] = useState<string>(initial?.latitude?.toString() ?? "");
  const [lng, setLng] = useState<string>(initial?.longitude?.toString() ?? "");
  const [raio, setRaio] = useState<number>(initial?.raio_m ?? 200);
  const [ativo, setAtivo] = useState<boolean>(initial?.ativo ?? true);
  const [gettingGeo, setGettingGeo] = useState(false);

  const usarMinhaPos = async () => {
    setGettingGeo(true);
    const { lat: la, lng: lo } = await tryGeo();
    setGettingGeo(false);
    if (la == null || lo == null) {
      toast.error("Não foi possível obter sua localização atual.");
      return;
    }
    setLat(la.toString());
    setLng(lo.toString());
    toast.success("Localização capturada.");
  };

  const handleSubmit = () => {
    const la = Number(lat), lo = Number(lng);
    if (!nome.trim()) return toast.error("Informe o nome do local.");
    if (!isFinite(la) || !isFinite(lo)) return toast.error("Latitude/longitude inválidas.");
    onSubmit({ nome: nome.trim(), latitude: la, longitude: lo, raio_m: raio, ativo });
  };

  const la = Number(lat), lo = Number(lng);
  const canPreview = isFinite(la) && isFinite(lo);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Editar local" : "Novo local de trabalho"}</DialogTitle>
          <DialogDescription>Defina o raio (m) que será considerado dentro do local.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Unidade Centro" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Latitude</Label>
              <Input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="-30.029346" />
            </div>
            <div className="space-y-1.5">
              <Label>Longitude</Label>
              <Input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="-51.217840" />
            </div>
          </div>

          <Button type="button" variant="outline" size="sm" onClick={usarMinhaPos} disabled={gettingGeo} className="gap-2">
            <Crosshair className="w-4 h-4" /> {gettingGeo ? "Capturando…" : "Usar minha localização atual"}
          </Button>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Raio de tolerância</Label>
              <span className="text-sm font-medium tabular-nums">{raio} m</span>
            </div>
            <Slider min={50} max={1000} step={10} value={[raio]} onValueChange={(v) => setRaio(v[0])} />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="ativo-loc">Ativo</Label>
            <Switch id="ativo-loc" checked={ativo} onCheckedChange={setAtivo} />
          </div>

          {canPreview && <MapPreview lat={la} lng={lo} raio={raio} />}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isPending}>{isPending ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AdminPontoLocais() {
  const qc = useQueryClient();
  const [novoOpen, setNovoOpen] = useState(false);
  const [editando, setEditando] = useState<Local | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["ponto-locais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ponto_locais_trabalho")
        .select("id, nome, latitude, longitude, raio_m, ativo")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Local[];
    },
  });

  const createMut = useMutation({
    mutationFn: async (payload: Omit<Local, "id">) => {
      const { error } = await supabase.from("ponto_locais_trabalho").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Local cadastrado.");
      setNovoOpen(false);
      qc.invalidateQueries({ queryKey: ["ponto-locais"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: async (payload: Local) => {
      const { id, ...rest } = payload;
      const { error } = await supabase.from("ponto_locais_trabalho").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Local atualizado.");
      setEditando(null);
      qc.invalidateQueries({ queryKey: ["ponto-locais"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ponto_locais_trabalho").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Local removido.");
      qc.invalidateQueries({ queryKey: ["ponto-locais"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-4">
      <Card className="p-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" /> Locais de trabalho</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Registros fora do raio definido são aceitos, mas marcados como "fora do local" e geram alerta para o coordenador.
          </p>
        </div>
        <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="w-4 h-4" /> Novo local</Button>
          </DialogTrigger>
          <LocalDialog
            open={novoOpen}
            onOpenChange={setNovoOpen}
            onSubmit={(d) => createMut.mutate(d)}
            isPending={createMut.isPending}
          />
        </Dialog>
      </Card>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {(data ?? []).map((l) => (
          <Card key={l.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{l.nome}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {Number(l.latitude).toFixed(6)}, {Number(l.longitude).toFixed(6)}
                </p>
              </div>
              <Badge variant={l.ativo ? "default" : "outline"}>{l.ativo ? "Ativo" : "Inativo"}</Badge>
            </div>
            <MapPreview lat={Number(l.latitude)} lng={Number(l.longitude)} raio={l.raio_m} />
            <p className="text-xs text-muted-foreground">Raio: <span className="text-foreground font-medium">{l.raio_m} m</span></p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="gap-1.5 flex-1" onClick={() => setEditando(l)}>
                <Pencil className="w-3.5 h-3.5" /> Editar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  if (confirm(`Remover "${l.nome}"?`)) deleteMut.mutate(l.id);
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </Card>
        ))}
        {(data ?? []).length === 0 && (
          <Card className="p-10 text-center text-muted-foreground col-span-full">Nenhum local cadastrado.</Card>
        )}
      </div>

      {editando && (
        <LocalDialog
          open={!!editando}
          onOpenChange={(v) => !v && setEditando(null)}
          initial={editando}
          onSubmit={(d) => updateMut.mutate({ ...d, id: editando.id })}
          isPending={updateMut.isPending}
        />
      )}
    </div>
  );
}
