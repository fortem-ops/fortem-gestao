import { useRef, useState, useEffect, useCallback } from "react";
import { Eraser, Type, PenTool } from "lucide-react";
import { cn } from "@/lib/utils";

interface SignaturePadProps {
  onSignatureChange: (data: string | null) => void;
  signerName: string;
}

type Mode = "draw" | "type";

const SignaturePad = ({ onSignatureChange, signerName }: SignaturePadProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [mode, setMode] = useState<Mode>("draw");
  const [typedName, setTypedName] = useState("");
  const [hasDrawn, setHasDrawn] = useState(false);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onSignatureChange(null);
  }, [onSignatureChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(2, 2);
      ctx.strokeStyle = "hsl(220 20% 15%)";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }
    const preventScroll = (e: TouchEvent) => { if (mode === "draw") e.preventDefault(); };
    canvas.addEventListener("touchstart", preventScroll, { passive: false });
    canvas.addEventListener("touchmove", preventScroll, { passive: false });
    return () => {
      canvas.removeEventListener("touchstart", preventScroll);
      canvas.removeEventListener("touchmove", preventScroll);
    };
  }, [mode]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (mode !== "draw") return;
    e.preventDefault();
    setIsDrawing(true);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || mode !== "draw") return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const endDraw = () => {
    setIsDrawing(false);
    if (hasDrawn && canvasRef.current) onSignatureChange(canvasRef.current.toDataURL());
  };

  useEffect(() => {
    if (mode === "type" && typedName.trim()) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width / 2, canvas.height / 2);
      ctx.font = "italic 28px Georgia, serif";
      ctx.fillStyle = "hsl(220 20% 15%)";
      ctx.textAlign = "center";
      ctx.fillText(typedName, canvas.width / 4, canvas.height / 4 + 10);
      onSignatureChange(canvas.toDataURL());
    } else if (mode === "type") {
      clearCanvas();
    }
  }, [typedName, mode, clearCanvas, onSignatureChange]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="section-title text-base">Assinatura Digital</h3>
        <div className="flex gap-1 bg-secondary rounded-lg p-0.5">
          {(["draw", "type"] as const).map((m) => {
            const Icon = m === "draw" ? PenTool : Type;
            return (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); clearCanvas(); setTypedName(""); }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                  mode === m ? "bg-card text-foreground card-shadow" : "text-muted-foreground"
                )}
              >
                <Icon className="w-3 h-3" /> {m === "draw" ? "Desenhar" : "Digitar"}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
          className={cn(
            "w-full h-40 rounded-xl border-2 border-dashed transition-colors bg-secondary/50",
            mode === "draw" ? "cursor-crosshair border-muted-foreground/20" : "border-transparent"
          )}
        />
        {mode === "draw" && !hasDrawn && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground/50 pointer-events-none">Assine aqui</p>
        )}
        {(hasDrawn || typedName) && (
          <button
            type="button"
            onClick={() => { clearCanvas(); setTypedName(""); }}
            className="absolute top-2 right-2 p-1.5 rounded-lg bg-card card-shadow text-muted-foreground hover:text-foreground transition-colors"
          >
            <Eraser className="w-4 h-4" />
          </button>
        )}
      </div>

      {mode === "type" && (
        <input
          type="text"
          value={typedName}
          onChange={(e) => setTypedName(e.target.value)}
          placeholder={signerName || "Digite seu nome completo"}
          className="w-full h-12 px-4 rounded-xl bg-card card-shadow border-0 text-center text-lg italic font-serif text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary"
        />
      )}
    </div>
  );
};

export default SignaturePad;
