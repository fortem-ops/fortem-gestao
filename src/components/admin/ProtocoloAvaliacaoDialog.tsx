import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { upsertProtocolo, type AvaliacaoProtocolo, type AvaliacaoTipo } from "@/lib/avaliacaoProtocolos";
import { DynamicSchemaEditor } from "@/components/student/assessment/DynamicSchemaEditor";
import type { ExperimentalSchema } from "@/components/student/assessment/experimentalTemplate";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tipo: AvaliacaoTipo;
  protocolo: AvaliacaoProtocolo | null;
}

const EMPTY_SCHEMA: ExperimentalSchema = { sections: [] };

export function ProtocoloAvaliacaoDialog({ open, onOpenChange, tipo, protocolo }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [ativo, setAtivo] = useState(true);
  const [permiteUpload, setPermiteUpload] = useState(false);
  const [schema, setSchema] = useState<ExperimentalSchema>(EMPTY_SCHEMA);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNome(protocolo?.nome ?? "");
    setDescricao(protocolo?.descricao ?? "");
    setIsDefault(protocolo?.is_default ?? false);
    setAtivo(protocolo?.ativo ?? true);
    setPermiteUpload(protocolo?.permite_upload ?? false);
    const s = protocolo?.schema as ExperimentalSchema | undefined;
    setSchema(s?.sections ? JSON.parse(JSON.stringify(s)) : { sections: [] });
  }, [open, protocolo]);

  const handleSave = async () => {
    if (!nome.trim()) { toast.error("Informe um nome"); return; }
    try {
      setSaving(true);
      await upsertProtocolo({
        id: protocolo?.id,
        tipo_id: tipo.id,
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        is_default: isDefault,
        ativo,
        permite_upload: permiteUpload,
        schema: tipo.engine === "dinamico" ? (schema as unknown as Record<string, unknown>) : (protocolo?.schema as Record<string, unknown> ?? {}),
        updated_by: user?.id,
      } as never);
      toast.success(protocolo ? "Protocolo atualizado" : "Protocolo criado");
      qc.invalidateQueries({ queryKey: ["avaliacao-protocolos"] });
      qc.invalidateQueries({ queryKey: ["avaliacao-template", "experimental"] });
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{protocolo ? "Editar protocolo" : "Novo protocolo"} — {tipo.nome}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Pollock 7 Dobras" />
            </div>
            <div className="flex items-end gap-6 flex-wrap">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={isDefault} onCheckedChange={setIsDefault} />
                Padrão
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={ativo} onCheckedChange={setAtivo} />
                Ativo
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={permiteUpload} onCheckedChange={setPermiteUpload} />
                Permite upload de arquivos
              </label>
            </div>
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição opcional" />
          </div>

          {tipo.engine === "dinamico" ? (
            <div className="space-y-2">
              <Label className="text-sm">Estrutura do formulário</Label>
              <DynamicSchemaEditor value={schema} onChange={setSchema} />
            </div>
          ) : (
            <div className="glass-card rounded-lg p-4 text-sm text-muted-foreground">
              Este tipo usa motor fixo ({tipo.engine === "funcional_fixo" ? "Funcional com mapa corporal e classificações automáticas" : "Composição corporal — Pollock 7 dobras"}).
              O protocolo serve como variante nomeada selecionável durante a avaliação.
            </div>
          )}
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
