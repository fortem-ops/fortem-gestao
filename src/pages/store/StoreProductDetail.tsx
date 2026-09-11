import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ImageOff, Minus, Plus, ShoppingBag } from "lucide-react";
import StoreHeader from "@/components/store/StoreHeader";
import SizeGuideDialog from "@/components/store/SizeGuideDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useProdutoLoja } from "@/hooks/useProdutosLoja";
import { useCartLoja } from "@/hooks/useCartLoja";
import { useStoreTheme, storePalette } from "@/hooks/useStoreTheme";
import { useStoreScope } from "@/components/store/StoreScope";
import {
  formatBRL,
  imagensDoProduto,
  precoDaVariante,
  type ProdutoVariante,
} from "@/integrations/store/types";

const StoreProductDetail = () => {
  const { produtoId } = useParams<{ produtoId: string }>();
  const { data: produto, isLoading, isError } = useProdutoLoja(produtoId);
  const { addItem, totalItems } = useCartLoja();
  const { theme } = useStoreTheme();
  const { basePath, hideHeader, forcedTheme } = useStoreScope();
  const activeTheme = forcedTheme ?? theme;
  const palette = storePalette(activeTheme);
  const barBg = activeTheme === "dark" ? "bg-neutral-950/95" : "bg-white/95";
  const separatorBg = activeTheme === "dark" ? "bg-neutral-800" : "bg-neutral-200";

  const [tamanho, setTamanho] = useState<string | null>(null);
  const [cor, setCor] = useState<string | null>(null);
  const [quantidade, setQuantidade] = useState(1);
  const [imagemAtiva, setImagemAtiva] = useState<string | null>(null);

  const variantes = produto?.variantes ?? [];
  const tamanhos = useMemo(
    () => Array.from(new Set(variantes.map((v) => v.tamanho).filter(Boolean))) as string[],
    [variantes]
  );
  const cores = useMemo(
    () => Array.from(new Set(variantes.map((v) => v.cor).filter(Boolean))) as string[],
    [variantes]
  );

  const imagens = useMemo(() => {
    if (!produto) return [];
    const galeria = imagensDoProduto(produto, cor);
    if (galeria.length) return galeria;
    const varianteUrl = cor
      ? variantes.find((v) => v.cor === cor && v.imagem_url)?.imagem_url
      : null;
    const fallback = varianteUrl ?? produto.imagem_url;
    return fallback
      ? [{ id: fallback, imagem_url: fallback, legenda: null, principal: true }]
      : [];
  }, [cor, variantes, produto]);
  const imagemPrincipal = imagemAtiva && imagens.some((imagem) => imagem.imagem_url === imagemAtiva)
    ? imagemAtiva
    : imagens[0]?.imagem_url ?? null;

  const temEstoque = (v: ProdutoVariante) =>
    Number(v.estoque_atual ?? 0) > 0 || produto?.permite_encomenda === true;

  const tamanhoDisponivel = (t: string) =>
    variantes.some(
      (v) => v.tamanho === t && (!cor || v.cor === cor) && temEstoque(v)
    );
  const corDisponivel = (c: string) =>
    variantes.some(
      (v) => v.cor === c && (!tamanho || v.tamanho === tamanho) && temEstoque(v)
    );

  const varianteSelecionada = useMemo(() => {
    if (!variantes.length) return null;
    const candidatas = variantes.filter(
      (v) =>
        (tamanhos.length === 0 || v.tamanho === tamanho) &&
        (cores.length === 0 || v.cor === cor)
    );
    return candidatas[0] ?? null;
  }, [variantes, tamanho, cor, tamanhos.length, cores.length]);

  const precisaEscolher =
    (tamanhos.length > 0 && !tamanho) || (cores.length > 0 && !cor);

  const estoqueSelecionado = varianteSelecionada
    ? Number(varianteSelecionada.estoque_atual ?? 0)
    : variantes.length === 0
    ? 99
    : 0;
  const semEstoque = variantes.length > 0 && estoqueSelecionado === 0;
  const encomenda = semEstoque && produto?.permite_encomenda === true;
  const esgotado = semEstoque && !encomenda;
  const preco = produto ? precoDaVariante(produto, varianteSelecionada) : 0;
  const estoqueMax = encomenda ? 10 : estoqueSelecionado;

  const podeAdicionar =
    !!produto &&
    !esgotado &&
    !precisaEscolher &&
    (variantes.length === 0 || encomenda || estoqueSelecionado > 0);

  const handleAdd = () => {
    if (!produto || !podeAdicionar) return;
    addItem({
      produtoId: produto.id,
      varianteId: varianteSelecionada?.id ?? null,
      nome: produto.nome,
      tamanho: varianteSelecionada?.tamanho ?? null,
      cor: varianteSelecionada?.cor ?? null,
      preco,
      quantidade,
      imagemUrl: imagemPrincipal,
      estoqueMax: variantes.length ? estoqueMax : 99,
    });
    toast.success("Produto adicionado ao carrinho");
  };

  if (isLoading) {
    return (
      <div className={`min-h-screen ${palette.bg} ${palette.text}`}>
        {!hideHeader && <StoreHeader backTo={basePath} />}
        <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
          <Skeleton className={`aspect-[4/3] w-full rounded-2xl ${palette.surface}`} />
          <Skeleton className={`h-6 w-2/3 ${palette.surface}`} />
          <Skeleton className={`h-5 w-1/3 ${palette.surface}`} />
          <Skeleton className={`h-20 w-full ${palette.surface}`} />
        </main>
      </div>
    );
  }

  if (isError || !produto) {
    return (
      <div className={`min-h-screen ${palette.bg} ${palette.text}`}>
        {!hideHeader && <StoreHeader backTo={basePath} />}
        <main className="mx-auto max-w-5xl px-4 py-16 text-center">
          <p className={`text-sm ${palette.muted}`}>
            Produto não encontrado ou indisponível.
          </p>
          <Button asChild className="mt-4">
            <Link to={basePath}>Voltar para a loja</Link>
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className={`min-h-screen pb-28 sm:pb-8 ${palette.bg} ${palette.text}`}>
      {!hideHeader && <StoreHeader backTo={basePath} />}

      <main className="mx-auto max-w-5xl px-4 py-6">
        {hideHeader && (
          <div className="mb-4 flex justify-end">
            <Button
              asChild
              variant="outline"
              size="sm"
              className={`shrink-0 ${palette.card}`}
            >
              <Link to={`${basePath}/carrinho`}>
                <ShoppingBag className="mr-2 h-4 w-4" />
                Carrinho{totalItems > 0 ? ` (${totalItems})` : ""}
              </Link>
            </Button>
          </div>
        )}
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <div className={`relative aspect-[4/3] overflow-hidden rounded-2xl ${palette.surface}`}>
              {imagemPrincipal ? (
                <img
                  src={imagemPrincipal}
                  alt={produto.nome}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className={`flex h-full w-full items-center justify-center ${palette.muted}`}>
                  <ImageOff className="h-10 w-10" />
                </div>
              )}
              {encomenda && (
                <Badge className="absolute left-3 top-3 bg-primary text-primary-foreground">
                  Encomenda
                </Badge>
              )}
              {esgotado && (
                <Badge className="absolute left-3 top-3 bg-neutral-900 text-white">
                  Esgotado
                </Badge>
              )}
            </div>
            {imagens.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {imagens.map((imagem) => (
                  <Button
                    key={imagem.id}
                    type="button"
                    variant="outline"
                    className={`h-20 w-20 shrink-0 overflow-hidden p-1 ${imagem.imagem_url === imagemPrincipal ? "ring-2 ring-primary" : palette.card}`}
                    onClick={() => setImagemAtiva(imagem.imagem_url)}
                    aria-label={`Ver ${imagem.legenda || "imagem do produto"}`}
                  >
                    <img
                      src={imagem.imagem_url}
                      alt={imagem.legenda ? `${produto.nome} — ${imagem.legenda}` : produto.nome}
                      className="h-full w-full object-contain"
                    />
                  </Button>
                ))}
              </div>
            )}
          </div>

          <div>
            {produto.categoria && (
              <p className={`text-[11px] font-medium uppercase tracking-wide ${palette.muted}`}>
                {produto.categoria}
              </p>
            )}
            <h1 className="mt-1 font-display text-2xl font-black uppercase leading-tight tracking-tight">
              {produto.nome}
            </h1>
            <p className="mt-2 text-2xl font-bold text-primary">
              {formatBRL(preco)}
            </p>

            {produto.descricao && (
              <p className={`mt-4 whitespace-pre-line text-sm leading-relaxed ${palette.muted}`}>
                {produto.descricao}
              </p>
            )}

            <Separator className={`my-5 ${separatorBg}`} />

            {tamanhos.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-sm font-semibold">Tamanho</p>
                <div className="flex flex-wrap gap-2">
                  {tamanhos.map((t) => {
                    const disponivel = tamanhoDisponivel(t);
                    return (
                      <Button
                        key={t}
                        size="sm"
                        variant={tamanho === t ? "default" : "outline"}
                        disabled={!disponivel}
                        onClick={() => {
                          setTamanho(t);
                          setQuantidade(1);
                        }}
                        className={`min-w-12 rounded-full ${tamanho === t ? "" : palette.card}`}
                      >
                        {t}
                      </Button>
                    );
                  })}
                </div>
                <SizeGuideDialog className="mt-2" />
              </div>
            )}

            {cores.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-sm font-semibold">Cor</p>
                <div className="flex flex-wrap gap-2">
                  {cores.map((c) => {
                    const disponivel = corDisponivel(c);
                    const hex =
                      variantes.find((v) => v.cor === c)?.cor_hex || "#9CA3AF";
                    return (
                      <Button
                        key={c}
                        size="sm"
                        variant={cor === c ? "default" : "outline"}
                        disabled={!disponivel}
                        onClick={() => {
                          setCor(c);
                          setQuantidade(1);
                        }}
                        className={`gap-1.5 rounded-full ${cor === c ? "" : palette.card}`}
                      >
                        <span
                          className="h-3 w-3 rounded-full border border-current/30"
                          style={{ backgroundColor: hex }}
                          aria-hidden="true"
                        />
                        {c}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mb-2">
              <p className="mb-2 text-sm font-semibold">Quantidade</p>
              <div className={`flex w-fit items-center gap-1 rounded-full border ${palette.border} p-1`}>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-full"
                  aria-label="Diminuir"
                  onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
                  disabled={quantidade <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-8 text-center text-sm font-bold">{quantidade}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-full"
                  aria-label="Aumentar"
                  onClick={() =>
                    setQuantidade((q) =>
                      Math.min(q + 1, variantes.length ? Math.max(1, estoqueMax) : 99)
                    )
                  }
                  disabled={variantes.length > 0 && quantidade >= estoqueMax}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {varianteSelecionada && estoqueMax > 0 && estoqueMax <= 5 && (
                <p className={`mt-2 text-xs ${palette.muted}`}>
                  Últimas {estoqueMax} unidades desta opção.
                </p>
              )}
            </div>

            <div className="hidden sm:block">
              <Button
                size="lg"
                className="mt-4 w-full"
                onClick={handleAdd}
                disabled={!podeAdicionar}
              >
                <ShoppingBag className="mr-2 h-4 w-4" />
                {esgotado
                  ? "Esgotado"
                  : precisaEscolher
                  ? "Escolha as opções"
                  : encomenda
                  ? "Encomendar"
                  : "Adicionar ao carrinho"}
              </Button>
              {encomenda && (
                <p className={`mt-2 text-center text-xs ${palette.muted}`}>
                  Produto sob encomenda — o pagamento é feito agora e o item
                  chega em breve.
                </p>
              )}
            </div>
          </div>
        </div>
      </main>

      <div className={`fixed inset-x-0 ${hideHeader ? "bottom-20" : "bottom-0"} z-40 border-t ${palette.border} ${barBg} p-3 backdrop-blur sm:hidden`}>
        <Button
          size="lg"
          className="w-full"
          onClick={handleAdd}
          disabled={!podeAdicionar}
        >
          <ShoppingBag className="mr-2 h-4 w-4" />
          {esgotado
            ? "Esgotado"
            : precisaEscolher
            ? "Escolha as opções"
            : encomenda
            ? `Encomendar • ${formatBRL(preco * quantidade)}`
            : `Adicionar • ${formatBRL(preco * quantidade)}`}
        </Button>
        {encomenda && (
          <p className={`mt-2 text-center text-xs ${palette.muted}`}>
            Produto sob encomenda — o pagamento é feito agora e o item chega em
            breve.
          </p>
        )}
      </div>
    </div>
  );
};

export default StoreProductDetail;
