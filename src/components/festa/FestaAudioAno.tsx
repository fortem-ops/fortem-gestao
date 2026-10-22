import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Mic, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { enviarFestaAudio, removerFestaAudio, type FestaAudio } from "@/lib/festaAudios";

export default function FestaAudioAno({ ano, audio }: { ano: string; audio?: FestaAudio | null }) {
  const qc = useQueryClient();
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const atualizar = () => qc.invalidateQueries({ queryKey: ["festa-audios"] });

  const enviar = async (file?: File) => {
    if (!file) return;
    setOcupado(true);
    try { await enviarFestaAudio(ano, file, audio); toast.success(`Áudio de ${ano} salvo.`); atualizar(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível enviar o áudio."); }
    finally { setOcupado(false); }
  };
  const remover = async () => {
    if (!audio) return; setOcupado(true);
    try { await removerFestaAudio(audio); toast.success(`Áudio de ${ano} removido.`); atualizar(); }
    catch { toast.error("Não foi possível remover o áudio."); }
    finally { setOcupado(false); setConfirmar(false); }
  };

  const botaoArquivo = (rotulo: string) => (
    <Button variant="outline" size="sm" asChild disabled={ocupado}>
      <label className="cursor-pointer">
        <Upload className="mr-2 h-4 w-4" />{ocupado ? "Enviando…" : rotulo}
        <input type="file" accept=".mp3,.m4a,.wav,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav" className="sr-only" disabled={ocupado} onChange={(e) => { enviar(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
    </Button>
  );

  return (
    <div className="mt-4 rounded-md border border-border p-3">
      <p className="mb-2 flex items-center gap-2 text-sm font-medium"><Mic className="h-4 w-4" />Áudio do capítulo</p>
      {audio ? (
        <div className="flex flex-wrap items-center gap-2">
          <audio controls preload="none" src={audio.url_audio} className="h-10 max-w-full" aria-label={`Áudio de ${ano}`} />
          {botaoArquivo("Substituir")}
          <Button variant="outline" size="sm" disabled={ocupado} onClick={() => setConfirmar(true)}><Trash2 className="mr-2 h-4 w-4" />Remover</Button>
          {audio.duracao_segundos ? <span className="text-xs text-muted-foreground">{Math.floor(audio.duracao_segundos / 60)}:{String(audio.duracao_segundos % 60).padStart(2, "0")}</span> : null}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">{botaoArquivo("Enviar áudio")}<span className="text-xs text-muted-foreground">mp3, m4a ou wav, até 25 MB</span></div>
      )}
      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Remover o áudio de {ano}?</AlertDialogTitle><AlertDialogDescription>O capítulo fica sem narração na página da festa.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={remover}>Remover</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
