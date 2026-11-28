import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, QrCode, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useParceirosPortal } from "@/hooks/useParceirosPortal";
import { filtrarParceiros } from "@/lib/portalReorganizacao";
import { cn } from "@/lib/utils";

const ROTULO = "text-[13px] font-bold uppercase tracking-[0.08em] text-[#B1B3B3]";

export default function PortalParceiros() {
  const { data: parceiros = [], isLoading } = useParceirosPortal(true);
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("todas");

  const categorias = useMemo(() => {
    const set = new Set<string>();
    for (const p of parceiros) {
      if (p.categoria) set.add(p.categoria);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [parceiros]);

  const filtrados = useMemo(
    () => filtrarParceiros(parceiros, busca, categoria),
    [parceiros, busca, categoria],
  );

  return (
    <div className="space-y-5 pb-10 animate-fade-in" style={{ fontFamily: "Archivo, sans-serif" }}>
      <header className="space-y-2 pt-1">
        <Link
          to="/portal/comunidade?aba=clube"
          className="inline-flex min-h-[44px] items-center gap-1 text-[13px] font-bold uppercase tracking-[0.08em] text-[#B1B3B3] hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Clube FORTEM
        </Link>
        <h1 className="text-2xl font-black uppercase leading-none text-foreground">Parceiros FORTEM</h1>
      </header>

      {/* Card Carteirinha */}
      <div className="flex items-center justify-between gap-3 border border-[#4A4B4B] bg-card p-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[#4A4B4B] bg-[#2C2C2C]">
            <QrCode className="h-5 w-5 text-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">Use a sua carteirinha</p>
            <p className="text-xs text-[#B1B3B3]">
              O parceiro lê o QR Code e o benefício é validado na hora.
            </p>
          </div>
        </div>
        <Link
          to="/portal/carteirinha"
          className="flex min-h-[44px] shrink-0 items-center justify-center bg-[#C8282A] px-4 text-[13px] font-bold uppercase tracking-[0.08em] text-white"
        >
          Abrir
        </Link>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#B1B3B3]" />
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou categoria"
          aria-label="Buscar parceiros por nome ou categoria"
          className="min-h-[44px] w-full border border-[#4A4B4B] bg-card pl-10 pr-3 text-sm text-foreground placeholder:text-[#B1B3B3] focus:border-foreground focus:outline-none"
        />
      </div>

      {/* Filtros por categoria */}
      {categorias.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por categoria">
          <button
            type="button"
            onClick={() => setCategoria("todas")}
            className={cn(
              "min-h-[36px] border px-3 text-[11px] font-bold uppercase tracking-[0.08em]",
              categoria === "todas"
                ? "border-[#C8282A] bg-[#C8282A] text-white"
                : "border-[#4A4B4B] bg-card text-[#B1B3B3]",
            )}
          >
            Todas
          </button>
          {categorias.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoria(cat)}
              className={cn(
                "min-h-[36px] border px-3 text-[11px] font-bold uppercase tracking-[0.08em]",
                categoria === cat
                  ? "border-[#C8282A] bg-[#C8282A] text-white"
                  : "border-[#4A4B4B] bg-card text-[#B1B3B3]",
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Lista de parceiros */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="border border-[#4A4B4B] bg-card p-5 text-sm text-[#B1B3B3]">
          Nenhum parceiro encontrado com esse filtro.
        </div>
      ) : (
        <ul className="space-y-3">
          {filtrados.map((p) => (
            <li key={p.id} className="border border-[#4A4B4B] bg-card p-4 space-y-3">
              <div className="flex items-center gap-3">
                {p.logo_url ? (
                  <img
                    src={p.logo_url}
                    alt={p.nome}
                    className="h-12 w-12 shrink-0 border border-[#4A4B4B] bg-white object-contain p-1"
                  />
                ) : (
                  <div
                    aria-hidden
                    className="flex h-12 w-12 shrink-0 items-center justify-center border border-[#4A4B4B] bg-[#2C2C2C] text-base font-black uppercase text-[#B1B3B3]"
                  >
                    {p.nome.charAt(0)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className={ROTULO}>{p.categoria}</p>
                  <p className="truncate text-base font-black text-foreground">{p.nome}</p>
                </div>
              </div>
              <div className="divide-y divide-[#4A4B4B] border-t border-[#4A4B4B]">
                {p.beneficios.map((b) => (
                  <div key={b.id} className="pt-2.5 pb-1 first:pt-2.5">
                    <p className="text-sm font-bold text-foreground">{b.titulo}</p>
                    {b.regra_uso && <p className="mt-0.5 text-xs text-[#B1B3B3]">{b.regra_uso}</p>}
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="border-t border-[#4A4B4B] pt-4 text-xs leading-relaxed text-[#B1B3B3]">
        Os benefícios valem para alunos com plano FORTEM ativo. Cada parceiro define limites de uso, informados na hora da validação.
      </p>
    </div>
  );
}