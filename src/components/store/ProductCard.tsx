import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ImageOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  estoqueTotal,
  formatBRL,
  menorPreco,
  type ProdutoComVariantes,
} from "@/integrations/store/types";

const ProductCard = ({ produto }: { produto: ProdutoComVariantes }) => {
  const estoqueZerado = estoqueTotal(produto.variantes) === 0;
  const encomenda = estoqueZerado && produto.permite_encomenda === true;
  const esgotado = estoqueZerado && !encomenda;
  const preco = menorPreco(produto);

  const coresDistintas = useMemo(() => {
    const map = new Map<string, string>();
    produto.variantes.forEach((v) => {
      if (v.cor) map.set(v.cor, v.cor_hex || "");
    });
    return Array.from(map.entries());
  }, [produto.variantes]);

  return (
    <Link
      to={`/store/${produto.id}`}
      className="group focus-visible:outline-none"
      aria-label={produto.nome}
    >
      <Card className="h-full overflow-hidden rounded-2xl border-neutral-200 bg-white transition-shadow group-hover:shadow-lg">
        <div className="relative aspect-[4/3] overflow-hidden bg-neutral-100">
          {produto.imagem_url ? (
            <img
              src={produto.imagem_url}
              alt={produto.nome}
              loading="lazy"
              className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-neutral-500">
              <ImageOff className="h-8 w-8" />
            </div>
          )}
          {encomenda && (
            <Badge className="absolute left-3 top-3 bg-primary text-primary-foreground">
              Encomenda
            </Badge>
          )}
          {esgotado && (
            <Badge
              variant="secondary"
              className="absolute left-3 top-3 bg-neutral-900 text-white"
            >
              Esgotado
            </Badge>
          )}
        </div>

        <div className="space-y-1 p-3 sm:p-4">
          {produto.categoria && (
            <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
              {produto.categoria}
            </p>
          )}
          <h3 className="line-clamp-2 font-display text-sm font-bold leading-tight sm:text-base">
            {produto.nome}
          </h3>
          <p className="pt-1 text-base font-bold text-primary sm:text-lg">
            {formatBRL(preco)}
          </p>
          {coresDistintas.length > 1 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {coresDistintas.map(([nome, hex]) => (
                <span
                  key={nome}
                  className="h-3 w-3 rounded-full border border-neutral-200/50"
                  style={{ backgroundColor: hex || "#9CA3AF" }}
                  title={nome}
                  aria-label={`Cor ${nome}`}
                />
              ))}
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
};

export default ProductCard;
