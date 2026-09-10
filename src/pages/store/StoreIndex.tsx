import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import StoreHeader from "@/components/store/StoreHeader";
import ProductCard from "@/components/store/ProductCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProdutosLoja } from "@/hooks/useProdutosLoja";

const StoreIndex = () => {
  const { data: produtos, isLoading, isError } = useProdutosLoja();
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState<string | null>(null);

  const categorias = useMemo(() => {
    const set = new Set<string>();
    (produtos ?? []).forEach((p) => p.categoria && set.add(p.categoria));
    return Array.from(set).sort();
  }, [produtos]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (produtos ?? []).filter((p) => {
      const okCat = !categoria || p.categoria === categoria;
      const okBusca = !termo || p.nome.toLowerCase().includes(termo);
      return okCat && okBusca;
    });
  }, [produtos, busca, categoria]);

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <StoreHeader backTo="/" />

      <main className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="font-display text-2xl font-black uppercase tracking-tight sm:text-3xl">
          Loja Fortem
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Produtos oficiais para treinar com a nossa marca.
        </p>

        <div className="relative mt-5">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar produto"
            className="border-neutral-200 pl-9"
            aria-label="Buscar produto"
          />
        </div>

        {categorias.length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            <Button
              size="sm"
              variant={categoria === null ? "default" : "outline"}
              className="shrink-0 rounded-full bg-white"
              onClick={() => setCategoria(null)}
            >
              Todos
            </Button>
            {categorias.map((c) => (
              <Button
                key={c}
                size="sm"
                variant={categoria === c ? "default" : "outline"}
                className="shrink-0 rounded-full bg-white"
                onClick={() => setCategoria(c)}
              >
                {c}
              </Button>
            ))}
          </div>
        )}

        {isLoading && (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-[4/3] w-full rounded-2xl bg-neutral-100" />
                <Skeleton className="h-4 w-3/4 bg-neutral-100" />
                <Skeleton className="h-4 w-1/3 bg-neutral-100" />
              </div>
            ))}
          </div>
        )}

        {isError && (
          <p className="mt-10 text-center text-sm text-neutral-500">
            Não foi possível carregar os produtos agora. Tente novamente em instantes.
          </p>
        )}

        {!isLoading && !isError && filtrados.length === 0 && (
          <p className="mt-10 text-center text-sm text-neutral-500">
            Nenhum produto disponível no momento.
          </p>
        )}

        {filtrados.length > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {filtrados.map((p) => (
              <ProductCard key={p.id} produto={p} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default StoreIndex;
