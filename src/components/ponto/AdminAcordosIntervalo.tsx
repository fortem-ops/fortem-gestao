import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { FileSignature, Plus, Upload, FileCheck2, FileX2, Download, Trash2, Coffee } from "lucide-react";

type TipoAcordo = "estendido_2h" | "reduzido_30min";

const TIPO_LABEL: Record<TipoAcordo, string> = {
  estendido_2h: "Intervalo estendido (>2h)",
  reduzido_30min: "Intervalo reduzido (30min)",
};

const TIPO_BADGE: Record<TipoAcordo, string> = {
  estendido_2h: "bg-info/15 text-info border-info/30",
  reduzido_30min: "bg-warning/15 text-warning border-warning/30",
};

interface Acordo {
  id: string;
  usuario_id: string;
  tipo: TipoAcordo;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  documento_url: string | null;
  documento_path: string | null;
  aceite_digital_em: string | null;
  aceite_ip: string | null;
  observacoes: string | null;
  ativo: boolean;
  created_at: string;
}

export function AdminAcordosIntervalo() {
  const qc = useQueryClient();
  const [novoOpen, setNovoOpen] = useState(false);

  const { data: colaboradores } = useQuery({
    queryKey: ["acordos-colaboradores"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .order("full_name");
      return data ?? [];
    },
  });

  const { data: acordos, isLoading } = useQuery({
    queryKey: ["ponto-acordos-intervalo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ponto_acordos_intervalo")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Acordo[];
    },
  });

  const nomeMap = useMemo(() => {
    const m = new Map<string, string>();
    (colaboradores ?? []).forEach((c) => m.set(c.id, c.full_name ?? "—"));
    return m;
  }, [colaboradores]);

  const delMut = useMutation({
    mutationFn: async (acordo: Acordo) => {
      if (acordo.documento_path) {
        await supabase.storage.from("acordos-intervalo").remove([acordo.documento_path]);
      }
      const { error } = await supabase.from("ponto_acordos_intervalo").delete().eq("id", acordo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast("Acordo removido");
      qc.invalidateQueries({ queryKey: ["ponto-acordos-intervalo"] });
    },
    onError: (e: any) => toast.error("Erro", { description: e.message }),
  });

  const baixarPdf = async (path: string) => {
    const { data, error } = await supabase.storage.from("acordos-intervalo").createSignedUrl(path, 60);
    if (error || !data) {
      toast.error("Erro", { description: error?.message ?? "Falha ao baixar" });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <Card className="p-6 space-y-4">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-heading font-semibold text-lg flex items-center gap-2">
            <FileSignature className="w-5 h-5 text-primary" /> Acordos de intervalo
          </h2>
          <p className="text-sm text-muted-foreground">
            Registre acordos individuais para intervalo estendido (&gt;2h) ou reduzido (30min) com PDF e aceite digital.
          </p>
        </div>
        <Button onClick={() => setNovoOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Novo acordo
        </Button>
      </header>

      {isLoading ? (
        <Skeleton className="h-48" />
      ) : (acordos ?? []).length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <Coffee className="w-10 h-10 mx-auto mb-2 opacity-50" />
          Nenhum acordo cadastrado.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Vigência</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Aceite digital</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(acordos ?? []).map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{nomeMap.get(a.usuario_id) ?? a.usuario_id.slice(0, 8)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={TIPO_BADGE[a.tipo]}>
                      {TIPO_LABEL[a.tipo]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(a.vigencia_inicio).toLocaleDateString("pt-BR")}
                    {a.vigencia_fim ? ` → ${new Date(a.vigencia_fim).toLocaleDateString("pt-BR")}` : " → indeterminada"}
                  </TableCell>
                  <TableCell>
                    {a.documento_path ? (
                      <Button size="sm" variant="ghost" className="gap-1 h-7" onClick={() => baixarPdf(a.documento_path!)}>
                        <Download className="w-3.5 h-3.5" /> PDF
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {a.aceite_digital_em ? (
                      <Badge variant="outline" className="bg-success/15 text-success border-success/30 gap-1">
                        <FileCheck2 className="w-3 h-3" />
                        {new Date(a.aceite_digital_em).toLocaleDateString("pt-BR")}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-warning/15 text-warning border-warning/30 gap-1">
                        <FileX2 className="w-3 h-3" /> Pendente
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm("Remover este acordo?")) delMut.mutate(a);
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <NovoAcordoDialog
        open={novoOpen}
        onOpenChange={setNovoOpen}
        colaboradores={colaboradores ?? []}
      />
    </Card>
  );
}

interface NovoProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  colaboradores: { id: string; full_name: string | null }[];
}

function NovoAcordoDialog({ open, onOpenChange, colaboradores }: NovoProps) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [usuarioId, setUsuarioId] = useState("");
  const [tipo, setTipo] = useState<TipoAcordo>("estendido_2h");
  const [vigenciaInicio, setVigenciaInicio] = useState(new Date().toISOString().slice(0, 10));
  const [vigenciaFim, setVigenciaFim] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [pdf, setPdf] = useState<File | null>(null);
  const [aceiteAgora, setAceiteAgora] = useState(false);

  const reset = () => {
    setUsuarioId(""); setTipo("estendido_2h");
    setVigenciaInicio(new Date().toISOString().slice(0, 10));
    setVigenciaFim(""); setObservacoes(""); setPdf(null); setAceiteAgora(false);
  };

  const salvar = useMutation({
    mutationFn: async () => {
      if (!usuarioId) throw new Error("Selecione o colaborador");
      if (!vigenciaInicio) throw new Error("Informe a vigência inicial");

      let documento_path: string | null = null;
      let documento_url: string | null = null;

      if (pdf) {
        if (pdf.type !== "application/pdf") throw new Error("Apenas arquivos PDF são aceitos");
        if (pdf.size > 10 * 1024 * 1024) throw new Error("PDF deve ter no máximo 10MB");
        const filename = `${Date.now()}_${pdf.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const path = `${usuarioId}/${filename}`;
        const { error: upErr } = await supabase.storage
          .from("acordos-intervalo")
          .upload(path, pdf, { contentType: "application/pdf" });
        if (upErr) throw upErr;
        documento_path = path;
        documento_url = path;
      }

      let aceite_digital_em: string | null = null;
      let aceite_ip: string | null = null;
      if (aceiteAgora) {
        aceite_digital_em = new Date().toISOString();
        try {
          const r = await fetch("https://api.ipify.org?format=json");
          const j = await r.json();
          aceite_ip = j.ip ?? null;
        } catch { /* opcional */ }
      }

      const { error } = await supabase.from("ponto_acordos_intervalo").insert({
        usuario_id: usuarioId,
        tipo,
        vigencia_inicio: vigenciaInicio,
        vigencia_fim: vigenciaFim || null,
        documento_path,
        documento_url,
        observacoes: observacoes || null,
        aceite_digital_em,
        aceite_ip,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast("Acordo registrado");
      qc.invalidateQueries({ queryKey: ["ponto-acordos-intervalo"] });
      reset();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error("Erro", { description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="w-5 h-5 text-primary" /> Novo acordo de intervalo
          </DialogTitle>
          <DialogDescription>
            Registre o tipo de acordo, vigência e anexe o PDF assinado. O aceite digital pode ser feito agora ou depois pelo colaborador.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Colaborador</Label>
            <Select value={usuarioId} onValueChange={setUsuarioId}>
              <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
              <SelectContent>
                {colaboradores.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.full_name ?? c.id.slice(0, 8)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Tipo de acordo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoAcordo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="estendido_2h">Intervalo estendido (&gt;2h)</SelectItem>
                <SelectItem value="reduzido_30min">Intervalo reduzido (30min)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {tipo === "estendido_2h"
                ? "Permite intervalo superior a 2h entre jornadas, mediante acordo individual."
                : "Reduz o intervalo intrajornada para 30min, mediante acordo individual."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Vigência início</Label>
              <Input type="date" value={vigenciaInicio} onChange={(e) => setVigenciaInicio(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Vigência fim <span className="text-muted-foreground">(opcional)</span></Label>
              <Input type="date" value={vigenciaFim} onChange={(e) => setVigenciaFim(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-2"><Upload className="w-4 h-4" /> PDF do acordo</Label>
            <Input
              type="file"
              accept="application/pdf"
              onChange={(e) => setPdf(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">PDF assinado, máx. 10MB.</p>
          </div>

          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </div>

          <label className="flex items-center gap-2 rounded-md border border-border/60 p-3 bg-secondary/30 cursor-pointer">
            <Checkbox checked={aceiteAgora} onCheckedChange={(v) => setAceiteAgora(!!v)} />
            <span className="text-sm">
              Registrar aceite digital agora (data, hora e IP). Caso contrário, o colaborador poderá aceitar depois.
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending} className="gap-2">
            <FileCheck2 className="w-4 h-4" /> Salvar acordo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
