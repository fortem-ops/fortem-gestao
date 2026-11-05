// Card "COMO GANHAR CONQUISTAS" + folha com critérios e bônus vindos do banco (fn_clube_regras_portal).
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { useRegrasClube, bonusAgregador, fmtDataBr, EXPLICACAO_BADGE } from "@/lib/clubePlano";

export function ComoGanharConquistas() {
  const [aberto, setAberto] = useState(false);
  const { data: regras } = useRegrasClube();
  const mult = regras?.mult_agregador ?? 0.5;
  const desde = regras?.conquistas_bonus_desde ? fmtDataBr(new Date(regras.conquistas_bonus_desde).toISOString()) : null;
  return (
    <>
      <button type="button" onClick={() => setAberto(true)}
        className="flex min-h-[56px] w-full items-center justify-between border border-[#4A4B4B] bg-card px-4 text-left"
        style={{ fontFamily: "Archivo, sans-serif" }}>
        <span className="text-[13px] font-bold uppercase tracking-[0.08em] text-foreground">Como ganhar conquistas</span>
        <ChevronRight className="h-4 w-4 text-[#B1B3B3]" />
      </button>
      {aberto && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70" onClick={() => setAberto(false)}>
          <div role="dialog" aria-label="Como ganhar conquistas"
            className="max-h-[85vh] w-full space-y-4 overflow-y-auto border-t border-[#4A4B4B] bg-card p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
            style={{ fontFamily: "Archivo, sans-serif" }} onClick={(e) => e.stopPropagation()}>
            <p className="text-xl font-black uppercase text-foreground">Como ganhar conquistas</p>
            <p className="text-sm text-[#B1B3B3]">
              Algumas conquistas dão pontos de bônus. O bônus vale só para conquistas ganhas a partir de agora{desde ? ` (${desde})` : ""}, não recebe o multiplicador do plano nem o do clima, e alunos de Wellhub ou Total Pass recebem {String(mult).replace(".", ",")}x do bônus.
            </p>
            <ul className="divide-y divide-[#4A4B4B] border border-[#4A4B4B]">
              {(regras?.conquistas ?? []).map((c) => (
                <li key={c.id} className="flex items-start gap-3 px-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground">{c.nome}</p>
                    <p className="text-xs text-[#B1B3B3]">{EXPLICACAO_BADGE[c.nome] ?? c.descricao ?? ""}</p>
                  </div>
                  <span className="shrink-0 text-right text-sm font-black text-foreground">
                    {c.pontos_bonus > 0 ? `+${c.pontos_bonus}` : "—"}
                    {c.pontos_bonus > 0 && <span className="block text-[10px] font-normal text-[#B1B3B3]">agregador +{bonusAgregador(c.pontos_bonus, mult)}</span>}
                  </span>
                </li>
              ))}
            </ul>
            <button onClick={() => setAberto(false)} className="min-h-[44px] w-full border border-[#4A4B4B] text-[13px] font-bold uppercase tracking-[0.08em] text-foreground">Fechar</button>
          </div>
        </div>
      )}
    </>
  );
}
