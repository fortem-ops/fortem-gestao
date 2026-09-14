import { Gift, ImageOff } from "lucide-react";
import { formatBRL } from "@/integrations/store/types";
import { useStoreTheme, storePalette } from "@/hooks/useStoreTheme";
import { useStoreScope } from "@/components/store/StoreScope";
import { brindeVigente, formatarDataFim, usePromocaoBrinde } from "@/hooks/usePromocaoBrinde";

interface Props {
  /** Subtotal atual do carrinho; quando informado, mostra quanto falta. */
  subtotal?: number;
  className?: string;
}

const BrindeBanner = ({ subtotal, className = "" }: Props) => {
  const { data: config } = usePromocaoBrinde();
  const { theme } = useStoreTheme();
  const { forcedTheme } = useStoreScope();
  const palette = storePalette(forcedTheme ?? theme);

  if (!brindeVigente(config) || !config) return null;

  const minimo = Number(config.valor_minimo ?? 0);
  const falta = subtotal === undefined ? null : Math.max(0, minimo - subtotal);
  const brindes = [
    { nome: config.brinde_1_nome, imagem: config.brinde_1_imagem_url },
    { nome: config.brinde_2_nome, imagem: config.brinde_2_imagem_url },
  ];

  return (
    <div
      className={`rounded-2xl border ${palette.border} ${palette.card} px-4 py-3 ${className}`}
    >
      <p className="flex items-center gap-2 text-sm font-bold">
        <Gift className="h-4 w-4 shrink-0 text-primary" />
        Até {formatarDataFim(config.data_fim)}, compras acima de {formatBRL(minimo)} ganham um brinde!
      </p>

      {falta !== null && (
        <p className={`mt-1 text-xs ${falta > 0 ? palette.muted : "text-primary font-semibold"}`}>
          {falta > 0
            ? `Faltam ${formatBRL(falta)} para ganhar um brinde!`
            : "Você já garantiu seu brinde — escolha na hora de finalizar."}
        </p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3">
        {brindes.map((b) => (
          <div key={b.nome} className="flex items-center gap-2">
            <div className={`h-14 w-14 shrink-0 overflow-hidden rounded-xl p-1 ${palette.surface}`}>
              {b.imagem ? (
                <img src={b.imagem} alt={b.nome} className="h-full w-full object-contain" />
              ) : (
                <div className={`flex h-full w-full items-center justify-center ${palette.muted}`}>
                  <ImageOff className="h-4 w-4" />
                </div>
              )}
            </div>
            <span className="text-xs font-semibold leading-tight">{b.nome}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BrindeBanner;
