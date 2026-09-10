import { Ruler } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useStoreTheme, storePalette, type StorePalette } from "@/hooks/useStoreTheme";
import { useStoreScope } from "@/components/store/StoreScope";

const tamanhos = ["P", "M", "G", "GG", "XG", "XGG", "XXG"];

const modeloUnissex = {
  nome: "Modelo Tradicional Unissex",
  linhas: [
    { label: "A - Comprimento", valores: [68, 71, 74, 77, 80, 83, 86] },
    { label: "B - Largura", valores: [49, 52, 55, 58, 61, 64, 67] },
  ],
};

const modeloBabylook = {
  nome: "Modelo Babylook",
  linhas: [
    { label: "A - Comprimento", valores: [57, 60, 63, 66, 69, 72, 75] },
    { label: "B - Largura", valores: [40, 43, 46, 49, 52, 55, 58] },
  ],
};

interface TabelaProps {
  titulo: string;
  modelo: { nome: string; linhas: { label: string; valores: number[] }[] };
  palette: StorePalette;
}

const TabelaMedidas = ({ titulo, modelo, palette }: TabelaProps) => (
  <div>
    <h4 className="mb-2 text-sm font-bold uppercase tracking-wide">{titulo}</h4>
    <div className={`overflow-x-auto rounded-lg border ${palette.border}`}>
      <table className="w-full min-w-[320px] text-center text-sm">
        <thead>
          <tr className={palette.surface}>
            <th
              className={`px-2 py-2 text-left text-xs font-semibold ${palette.muted}`}
            >
              Medida / Tamanho
            </th>
            {tamanhos.map((t) => (
              <th
                key={t}
                className={`px-2 py-2 text-xs font-semibold ${palette.muted}`}
              >
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {modelo.linhas.map((linha) => (
            <tr key={linha.label} className={`border-t ${palette.border}`}>
              <td className="px-2 py-2 text-left text-xs font-medium">
                {linha.label}
              </td>
              {linha.valores.map((v, i) => (
                <td key={i} className="px-2 py-2 text-xs tabular-nums">
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

interface SizeGuideDialogProps {
  className?: string;
}

export const SizeGuideDialog = ({ className }: SizeGuideDialogProps) => {
  const { palette } = useStoreTheme();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 text-xs font-medium text-primary underline-offset-4 hover:underline",
            className
          )}
        >
          <Ruler className="h-3.5 w-3.5" />
          Ver tabela de medidas
        </button>
      </DialogTrigger>
      <DialogContent
        className={`max-h-[90vh] max-w-2xl overflow-y-auto ${palette.bg} ${palette.text} ${palette.border}`}
      >
        <DialogHeader>
          <DialogTitle className="text-left font-display text-xl font-black uppercase">
            Tabela de medidas
          </DialogTitle>
          <DialogDescription className={`text-left ${palette.muted}`}>
            Comprimento (A) medido do ombro até a barra. Largura (B) medida de
            axila a axila. Valores em centímetros.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-6">
          <TabelaMedidas
            titulo={modeloUnissex.nome}
            modelo={modeloUnissex}
            palette={palette}
          />
          <TabelaMedidas
            titulo={modeloBabylook.nome}
            modelo={modeloBabylook}
            palette={palette}
          />
        </div>

        <p className={`mt-2 text-[11px] leading-relaxed ${palette.muted}`}>
          Medidas reais sem encolhimento, podendo apresentar variação de 5% para
          mais ou para menos no comprimento, segundo normas da ABNT.
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default SizeGuideDialog;
