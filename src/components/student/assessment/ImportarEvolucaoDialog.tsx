import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { extrairTextoDocumento } from "@/lib/extrairTextoDocumento";
import { montarSessoesParaConferencia, type SessaoImportada } from "@/lib/fisioEvolucaoImport";

type Colisao = "substituir" | "renumerar";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Números de sessão já existentes no prontuário. */
  numerosExistentes: number[];
  onConfirmar: (sessoes: SessaoImportada[], modo: Colisao) => void;
}

export function ImportarEvolucaoDialog({ open, onOpenChange, numerosExistentes, onConfirmar }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [lendo, setLendo] = useState(false);
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [sessoes, setSessoes] = useState<SessaoImportada[]>([]);
  const [modo, setModo] = useState<Colisao>("renumerar");

  const colisoes = sessoes.map((s) => s.n).filter((n) => numerosExistentes.includes(n));

  const reset = () => {
    setSessoes([]);
    setNomeArquivo(null);
    setModo("renumerar");
    if (inputRef.current) inputRef.current.value = "";
  };

  const escolherArquivo = async (file: File) => {
    setLendo(true);
    try {
      const texto = await extrairTextoDocumento(file);
      const lista = montarSessoesParaConferencia(texto);
      if (lista.length === 0) {
        toast.error(
          "Nenhuma sessão foi identificada no arquivo. Confira se os atendimentos estão numerados (ex.: \"3º fisio 25/02/2026\").",
        );
        reset();
        return;
      }
      setSessoes(lista);
      setNomeArquivo(file.name);
      toast.success(`${lista.length} sessão(ões) identificada(s).`);
    } catch (e) {
      toast.error((e as Error)?.message || "Não foi possível ler o arquivo.");
      reset();
    } finally {
      setLendo(false);
    }
  };

  const atualizar = (i: number, campo: keyof SessaoImportada, valor: string) => {
    setSessoes((atual) =>
      atual.map((s, idx) =>
        idx === i
          ? {
              ...s,
              [campo]: campo === "n" ? parseInt(valor || "0", 10) || 0 : valor || (campo === "data" ? null : ""),
            }
          : s,
      ),
    );
  };

  const remover = (i: number) => setSessoes((atual) => atual.filter((_, idx) => idx !== i));

  const confirmar = () => {
    const validas = sessoes.filter((s) => s.texto.trim() && s.n > 0);
    if (validas.length === 0) {
      toast.error("Nenhuma sessão válida para importar.");
      return;
    }
    onConfirmar(validas, modo);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar histórico de evolução</DialogTitle>
          <DialogDescription>
            Envie o documento do paciente em PDF ou Word (.docx). Cada atendimento numerado vira uma sessão.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.docx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void escolherArquivo(f);
              }}
            />
            <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={lendo}>
              {lendo ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              {lendo ? "Lendo arquivo…" : "Escolher arquivo"}
            </Button>
            {nomeArquivo && <span className="text-xs text-muted-foreground">{nomeArquivo}</span>}
            {sessoes.length > 0 && (
              <Badge variant="outline" className="border-primary/40 text-primary">
                {sessoes.length} sessão(ões)
              </Badge>
            )}
          </div>

          {colisoes.length > 0 && (
            <div className="rounded-lg border border-warning/40 bg-warning/5 p-3 space-y-2">
              <p className="text-sm text-foreground flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" />
                Já existem sessões com os números {colisoes.join(", ")} neste prontuário.
              </p>
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant={modo === "renumerar" ? "default" : "outline"}
                  onClick={() => setModo("renumerar")}
                >
                  Numerar as importadas no final
                </Button>
                <Button
                  size="sm"
                  variant={modo === "substituir" ? "default" : "outline"}
                  onClick={() => setModo("substituir")}
                >
                  Substituir as sessões existentes
                </Button>
              </div>
            </div>
          )}

          {sessoes.map((s, i) => (
            <div key={i} className="glass-card rounded-lg p-4 space-y-3">
              <div className="flex items-end gap-3 flex-wrap">
                <div className="w-24">
                  <Label className="text-xs">Sessão</Label>
                  <Input
                    type="number"
                    min={1}
                    value={s.n}
                    onChange={(e) => atualizar(i, "n", e.target.value)}
                  />
                </div>
                <div className="w-44">
                  <Label className="text-xs">Data</Label>
                  <Input
                    type="date"
                    value={s.data ?? ""}
                    onChange={(e) => atualizar(i, "data", e.target.value)}
                  />
                </div>
                <Button size="sm" variant="ghost" className="ml-auto" onClick={() => remover(i)}>
                  <Trash2 className="w-4 h-4 mr-2" /> Remover
                </Button>
              </div>
              <Textarea rows={5} value={s.texto} onChange={(e) => atualizar(i, "texto", e.target.value)} />
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={sessoes.length === 0}>
            Importar {sessoes.length > 0 ? `${sessoes.length} sessão(ões)` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
