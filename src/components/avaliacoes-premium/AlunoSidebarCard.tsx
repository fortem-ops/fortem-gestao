import type { Tables } from "@/integrations/supabase/types";
import { User, MapPin, Calendar, ShieldCheck, Activity, Phone } from "lucide-react";
import { differenceInYears, parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  aluno: Tables<"alunos">;
  avaliadorNome: string | null;
  ultimaAvaliacaoData: string | null;
}

function calcIdade(dn: string | null): number | null {
  if (!dn) return null;
  try {
    return differenceInYears(new Date(), parseISO(dn));
  } catch {
    return null;
  }
}

export function AlunoSidebarCard({ aluno, avaliadorNome, ultimaAvaliacaoData }: Props) {
  const idade = calcIdade(aluno.data_nascimento);
  const initials = (aluno.nome || "?")
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <aside className="bio-card p-5 space-y-4 w-full lg:w-[320px] shrink-0">
      <div className="flex flex-col items-center text-center">
        <div className="relative">
          <div className="w-28 h-28 rounded-2xl overflow-hidden border border-[hsl(var(--bio-line))] shadow-lg">
            {aluno.foto_url ? (
              <img src={aluno.foto_url} alt={aluno.nome} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-[hsl(var(--bio-surface-2))] text-2xl bio-heading text-[hsl(var(--bio-ink-muted))]">
                {initials}
              </div>
            )}
          </div>
          <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
            <Activity className="w-2.5 h-2.5" />
            {aluno.status.toUpperCase()}
          </span>
        </div>
        <h2 className="mt-4 bio-heading text-lg">{aluno.nome}</h2>
        <p className="text-xs text-[hsl(var(--bio-ink-muted))] mt-0.5">
          {idade !== null ? `${idade} anos` : "—"} ·{" "}
          {aluno.sexo === "M" ? "Masculino" : aluno.sexo === "F" ? "Feminino" : "—"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <DataChip label="Freq. semanal" value={aluno.frequencia_semanal === 5 ? "Livre" : `${aluno.frequencia_semanal ?? 0}x`} />
        <DataChip label="ID" value={aluno.id.slice(0, 8)} />
      </div>

      <div className="space-y-2 pt-3 border-t border-[hsl(var(--bio-line))]">
        {aluno.cidade && (
          <Row icon={MapPin} label="Localidade" value={`${aluno.cidade}${aluno.uf ? ` / ${aluno.uf}` : ""}`} />
        )}
        {aluno.telefone && <Row icon={Phone} label="Telefone" value={aluno.telefone} />}
        {ultimaAvaliacaoData && (
          <Row
            icon={Calendar}
            label="Última avaliação"
            value={format(parseISO(ultimaAvaliacaoData), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
          />
        )}
        {avaliadorNome && <Row icon={ShieldCheck} label="Avaliador" value={avaliadorNome} />}
      </div>

      {aluno.observacoes && (
        <div className="pt-3 border-t border-[hsl(var(--bio-line))]">
          <p className="bio-label mb-1.5">Observações</p>
          <p className="text-[11px] text-[hsl(var(--bio-ink-muted))] leading-relaxed line-clamp-4">
            {aluno.observacoes}
          </p>
        </div>
      )}
    </aside>
  );
}

function DataChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[hsl(var(--bio-surface-2))] border border-[hsl(var(--bio-line))] px-3 py-2">
      <p className="bio-label">{label}</p>
      <p className="text-sm text-[hsl(var(--bio-ink))] font-medium mt-0.5 truncate">{value}</p>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 p-1.5 rounded-md bg-[hsl(var(--bio-surface-2))]">
        <Icon className="w-3 h-3 text-[hsl(var(--bio-ink-muted))]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="bio-label">{label}</p>
        <p className="text-[12px] text-[hsl(var(--bio-ink))] mt-0.5 truncate">{value}</p>
      </div>
    </div>
  );
}
