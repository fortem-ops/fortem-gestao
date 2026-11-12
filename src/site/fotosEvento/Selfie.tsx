import { useEffect, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { dimensoesSelfie } from "@/lib/fotosPublico";
import { ehHeic } from "@/lib/fotosEventos";

/** Desenha a imagem reduzida e devolve JPEG em base64. Nada é gravado: fica só na memória. */
function paraBase64(fonte: CanvasImageSource, w: number, h: number, espelhar: boolean): string {
  const d = dimensoesSelfie(w, h);
  const c = document.createElement("canvas"); c.width = d.w; c.height = d.h;
  const ctx = c.getContext("2d")!;
  if (espelhar) { ctx.translate(d.w, 0); ctx.scale(-1, 1); }
  ctx.drawImage(fonte, 0, 0, d.w, d.h);
  const url = c.toDataURL("image/jpeg", 0.9);
  c.width = 0; c.height = 0;
  return url;
}

export default function Selfie({ onVoltar, onSelfie }: { onVoltar: () => void; onSelfie: (b64: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const arquivo = useRef<HTMLInputElement>(null);
  const [semCamera, setSemCamera] = useState(false);
  useEffect(() => {
    let stream: MediaStream | null = null; let vivo = true;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 } }, audio: false })
      .then((s) => { if (!vivo) { s.getTracks().forEach((t) => t.stop()); return; } stream = s; if (video.current) { video.current.srcObject = s; void video.current.play(); } })
      .catch(() => setSemCamera(true));
    if (!navigator.mediaDevices) setSemCamera(true);
    return () => { vivo = false; stream?.getTracks().forEach((t) => t.stop()); };
  }, []);

  function capturar() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    onSelfie(paraBase64(v, v.videoWidth, v.videoHeight, true));
  }
  async function daGaleria(f: File | undefined) {
    if (!f) return;
    let blob: Blob = f;
    if (ehHeic(f)) { const { default: heic2any } = await import("heic2any"); const r = await heic2any({ blob: f, toType: "image/jpeg", quality: 0.9 }); blob = Array.isArray(r) ? r[0] : r; }
    const bmp = await createImageBitmap(blob, { imageOrientation: "from-image" });
    const b64 = paraBase64(bmp, bmp.width, bmp.height, false); bmp.close();
    onSelfie(b64);
  }

  return (
    <div className="fe-selfie">
      <div className="fe-selfie-topo"><button onClick={onVoltar} aria-label="Voltar"><ChevronLeft className="h-5 w-5" /></button><span>SUA SELFIE</span><span className="w-5" /></div>
      <div className="fe-selfie-camera">
        {semCamera
          ? <p className="fe-selfie-aviso">Não conseguimos abrir a câmera. Use "Enviar da galeria" ou libere a câmera nas configurações do navegador.</p>
          : <video ref={video} playsInline muted className="fe-video" />}
        <div className="fe-oval" aria-hidden />
        <span className="fe-cant fe-cant-sd" aria-hidden /><span className="fe-cant fe-cant-ie" aria-hidden />
        <p className="fe-selfie-legenda">Encaixe o rosto no contorno<span>De frente e com luz. Sem óculos escuros, boné ou máscara.</span></p>
      </div>
      <div className="fe-selfie-base">
        <div className="fe-selfie-acoes">
          <button className="fe-link" onClick={() => arquivo.current?.click()}>Enviar da galeria</button>
          <button className="fe-captura" onClick={capturar} disabled={semCamera} aria-label="Tirar selfie" />
          <span className="w-24" />
        </div>
        <input ref={arquivo} type="file" accept="image/jpeg,image/png,image/heic,image/heif" hidden onChange={(e) => { void daGaleria(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
    </div>
  );
}
