import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { chamar, type FotoPublica } from "@/site/fotosEvento/api";

type Pagina = { fotos: FotoPublica[]; total: number; pagina: number; por_pagina: number };
const controle = "inline-flex min-h-11 items-center justify-center border border-border bg-background px-4 text-sm font-bold uppercase text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40";

export default function FestaGaleria() {
  const [aberta, setAberta] = useState<number | null>(null);
  const galeria = useInfiniteQuery({
    queryKey: ["fotos-evento-publico", "galeria-aniversario", 24],
    initialPageParam: 0,
    staleTime: 20 * 60 * 60 * 1000,
    retry: 1,
    queryFn: ({ pageParam }) => chamar<Pagina>("fotos-evento-publico", { acao: "galeria", pagina: pageParam, por_pagina: 24 }),
    getNextPageParam: (p) => (p.pagina + 1) * p.por_pagina < p.total ? p.pagina + 1 : undefined,
  });
  const fotos = galeria.data?.pages.flatMap((p) => p.fotos) ?? [];
  const foto = aberta === null ? undefined : fotos[aberta];
  if (!fotos.length || galeria.isError) return null;

  return (
    <div className="mt-10">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {fotos.map((f, i) => (
          <button key={f.id} type="button" aria-label={`Abrir foto ${i + 1}`} onClick={() => setAberta(i)} className="aspect-square overflow-hidden border border-border bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <img src={f.url_miniatura ?? f.url_previa ?? undefined} width={400} height={400} loading="lazy" decoding="async" alt="Registro da festa de 10 anos da FORTEM" className="h-full w-full object-cover"
              onError={(e) => { if (f.url_previa && e.currentTarget.src !== f.url_previa) e.currentTarget.src = f.url_previa; }} />
          </button>
        ))}
      </div>
      {galeria.hasNextPage && <button type="button" className={`${controle} mt-6`} disabled={galeria.isFetchingNextPage} onClick={() => void galeria.fetchNextPage()}>{galeria.isFetchingNextPage ? "Carregando fotos…" : "Ver mais fotos"}</button>}
      <Dialog.Root open={foto !== undefined} onOpenChange={(open) => { if (!open) setAberta(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay data-festa="10anos" className="fixed inset-0 z-50 bg-background/95" />
          <Dialog.Content data-festa="10anos" className="fixed inset-4 z-50 flex flex-col items-center justify-center gap-3 bg-background p-3 text-foreground sm:inset-8">
            <Dialog.Title className="sr-only">Fotos da festa de 10 anos</Dialog.Title>
            <Dialog.Description className="sr-only">Registro de 14 de novembro de 2026</Dialog.Description>
            <Dialog.Close aria-label="Fechar foto" className={`${controle} absolute right-2 top-2 h-11 w-11 p-0`}><X /></Dialog.Close>
            {foto && <img src={foto.url_previa ?? foto.url_original ?? undefined} alt="Registro da festa de 10 anos da FORTEM" width={foto.largura ?? undefined} height={foto.altura ?? undefined} className="min-h-0 max-h-[80%] w-full flex-1 object-contain" />}
            <div className="flex items-center gap-4">
              <button type="button" aria-label="Foto anterior" className={`${controle} h-11 w-11 p-0`} disabled={aberta === null || aberta === 0} onClick={() => setAberta((i) => i === null ? null : Math.max(0, i - 1))}><ChevronLeft /></button>
              <span className="text-sm tabular-nums">{aberta === null ? 0 : aberta + 1} / {fotos.length}</span>
              <button type="button" aria-label="Próxima foto" className={`${controle} h-11 w-11 p-0`} disabled={aberta === null || aberta >= fotos.length - 1} onClick={() => setAberta((i) => i === null ? null : Math.min(fotos.length - 1, i + 1))}><ChevronRight /></button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}