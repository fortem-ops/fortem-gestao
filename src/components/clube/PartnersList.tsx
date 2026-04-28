import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Heart, MapPin, Search, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Database } from "@/integrations/supabase/types";
import { NIVEL_LABEL, distanceKm, type NivelMembro } from "@/lib/clube";

const TODOS_NIVEIS = 6;

type Parceiro = Database["public"]["Tables"]["parceiros"]["Row"];
type Beneficio = Database["public"]["Tables"]["beneficios"]["Row"];

interface PartnersListProps {
  nivelAluno?: NivelMembro;
}

const FAV_KEY = "clube-fortem:favorite-partners";

export function PartnersList({ nivelAluno }: PartnersListProps) {
  const [search, setSearch] = useState("");
  const [categoria, setCategoria] = useState<string>("todas");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    try {
      setFavorites(JSON.parse(localStorage.getItem(FAV_KEY) || "[]"));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      () => setCoords(null),
      { enableHighAccuracy: false, timeout: 5000 },
    );
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["clube-parceiros-beneficios"],
    queryFn: async () => {
      const [{ data: parceiros }, { data: beneficios }] = await Promise.all([
        supabase.from("parceiros").select("*").eq("ativo", true).order("nome"),
        supabase.from("beneficios").select("*").eq("ativo", true),
      ]);
      return {
        parceiros: (parceiros || []) as Parceiro[],
        beneficios: (beneficios || []) as Beneficio[],
      };
    },
  });

  const categorias = useMemo(() => {
    const set = new Set<string>();
    data?.parceiros.forEach((p) => p.categoria && set.add(p.categoria));
    return Array.from(set).sort();
  }, [data]);

  const list = useMemo(() => {
    if (!data) return [];
    const term = search.toLowerCase().trim();
    return data.parceiros
      .filter((p) => (categoria === "todas" ? true : p.categoria === categoria))
      .filter((p) => (term ? p.nome.toLowerCase().includes(term) : true))
      .map((p) => {
        const benefs = data.beneficios.filter((b) => b.parceiro_id === p.id);
        const elegiveis = nivelAluno
          ? benefs.filter((b) => (b.niveis_permitidos || []).includes(nivelAluno))
          : benefs;
        const distance =
          coords && p.latitude && p.longitude
            ? distanceKm(coords, { latitude: Number(p.latitude), longitude: Number(p.longitude) })
            : null;
        return { ...p, beneficios: elegiveis, distance };
      })
      .sort((a, b) => {
        const af = favorites.includes(a.id) ? 0 : 1;
        const bf = favorites.includes(b.id) ? 0 : 1;
        if (af !== bf) return af - bf;
        if (a.distance != null && b.distance != null) return a.distance - b.distance;
        return a.nome.localeCompare(b.nome);
      });
  }, [data, search, categoria, favorites, coords, nivelAluno]);

  function toggleFav(id: string) {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      localStorage.setItem(FAV_KEY, JSON.stringify(next));
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar parceiro..." className="pl-9" />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          <Button
            size="sm"
            variant={categoria === "todas" ? "default" : "outline"}
            onClick={() => setCategoria("todas")}
          >
            Todas
          </Button>
          {categorias.map((c) => (
            <Button
              key={c}
              size="sm"
              variant={categoria === c ? "default" : "outline"}
              onClick={() => setCategoria(c)}
            >
              {c}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-50" />
          Nenhum parceiro encontrado.
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((p) => (
            <Card key={p.id} className="p-4 hover:border-primary/50 transition-colors">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  {p.logo_url ? (
                    <img src={p.logo_url} alt={p.nome} className="w-10 h-10 rounded object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground shrink-0">
                      {p.nome.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h4 className="font-semibold text-sm truncate">{p.nome}</h4>
                    <p className="text-xs text-muted-foreground truncate">{p.categoria}</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleFav(p.id)}
                  className={favorites.includes(p.id) ? "text-rose-500" : "text-muted-foreground"}
                  aria-label="Favoritar"
                >
                  <Heart className="w-4 h-4" fill={favorites.includes(p.id) ? "currentColor" : "none"} />
                </button>
              </div>

              {p.descricao && <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{p.descricao}</p>}

              <div className="space-y-1.5">
                {p.beneficios.length === 0 ? (
                  <p className="text-xs italic text-muted-foreground">Sem benefícios disponíveis para seu nível.</p>
                ) : (
                  p.beneficios.slice(0, 3).map((b) => {
                    const niveis = b.niveis_permitidos || [];
                    const todos = niveis.length === TODOS_NIVEIS;
                    return (
                      <div key={b.id} className="flex items-start justify-between gap-2 text-xs">
                        <span className="font-medium leading-tight">{b.titulo}</span>
                        {!todos && niveis.length > 0 && (
                          <div className="flex flex-wrap gap-0.5 shrink-0 justify-end max-w-[55%]">
                            {niveis.slice(0, 2).map((n) => (
                              <Badge key={n} variant="outline" className="text-[9px]">{NIVEL_LABEL[n as NivelMembro]}</Badge>
                            ))}
                            {niveis.length > 2 && (
                              <Badge variant="outline" className="text-[9px]">+{niveis.length - 2}</Badge>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {p.distance != null && (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-3">
                  <MapPin className="w-3 h-3" />
                  {p.distance.toFixed(1)} km
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
