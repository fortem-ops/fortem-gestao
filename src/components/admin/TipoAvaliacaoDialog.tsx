import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { upsertTipo, type AvaliacaoTipo, type AvaliacaoEngine } from "@/lib/avaliacaoProtocolos";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tipo: AvaliacaoTipo | null;
}

export function TipoAvaliacaoDialog({ open, onOpenChange, tipo }: Props) {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const [engine, setEngine] = useState<AvaliacaoEngine>("dinamico");
  const [ordem, setOrdem] = useState(0);
  const [ativo, setAtivo] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNome(tipo?.nome ?? "");
    setSlug(tipo?.slug ?? "");
    setEngine(tipo?.engine ?? "dinamico");
    setOrdem(tipo?.ordem ?? 0);
    setAtivo(tipo?.ativo ?? true);
  }, [open, tipo]);

  const handleSave = async () => {
    if (!nome.trim()) { toast.error("Informe o nome"); return; }
    const finalSlug = (tipo?.slug ?? slug.trim() ?? toSlug(nome));
    if (!finalSlug) { toast.error("Slug inválido"); return; }
    try {
      setSaving(true);
      await upsertTipo({
        id: tipo?.id,
        nome: nome.trim(),
        slug: finalSlug,
        engine,
        ordem,
        ativo,
      });
      toast.success(tipo ? "Tipo atualizado" : "Tipo criado");
      qc.invalidateQueries({ queryKey: ["avaliacao-tipos"] });
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const lockSystem = !!tipo?.is_sistema;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tipo ? "Editar tipo" : "Novo tipo de avaliação"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Mobilidade Avançada" />
          </div>
          {!tipo && (
            <div>
              <Label>Identificador (slug)</Label>
              <Input value={slug} onChange={(e) => setSlug(toSlug(e.target.value))} placeholder="auto-gerado se vazio" />
              <p className="text-xs text-muted-foreground mt-1">Permanente após criação.</p>
            </div>
          )}
          <div>
            <Label>Motor de renderização</Label>
            <Select value={engine} onValueChange={(v) => setEngine(v as AvaliacaoEngine)} disabled={lockSystem}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dinamico">Dinâmico (seções/perguntas customizáveis)</SelectItem>
                <SelectItem value="funcional_fixo">Funcional (mapa corporal + ângulos)</SelectItem>
                <SelectItem value="composicao_pollock">Composição Pollock (7 dobras)</SelectItem>
              </SelectContent>
            </Select>
            {lockSystem && <p className="text-xs text-muted-foreground mt-1">Tipos do sistema mantêm seu motor original.</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Ordem</Label>
              <Input type="number" value={ordem} onChange={(e) => setOrdem(parseInt(e.target.value) || 0)} />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={ativo} onCheckedChange={setAtivo} /> Ativo
              </label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function toSlug(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}
