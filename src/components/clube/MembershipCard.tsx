import { useState } from "react";
import { MembershipQR } from "./MembershipQR";
import { NIVEL_BADGE, NIVEL_THEME, STATUS_DOT, STATUS_LABEL } from "@/lib/clube";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { RotateCw } from "lucide-react";

type Membro = Database["public"]["Tables"]["clube_fortem_membros"]["Row"];

interface MembershipCardProps {
  membro: Membro;
  alunoNome: string;
  alunoEmail?: string | null;
  categoria?: string | null;
  contato?: string | null;
}

/**
 * Carteirinha digital wallet-style com flip frente/verso.
 * Cores aplicadas conforme paleta por nível (start/start+/power/pro/max).
 */
export function MembershipCard({ membro, alunoNome, alunoEmail, categoria, contato }: MembershipCardProps) {
  const [flipped, setFlipped] = useState(false);
  const theme = NIVEL_THEME[membro.nivel_membro];
  const isMax = membro.nivel_membro === "platina";
  const qrFg = theme.text === "#FFFFFF" ? "#FFFFFF" : "#000000";
  const qrBg = theme.text === "#FFFFFF" ? "#111111" : "#FFFFFF";

  const dataInicioFmt = new Date(membro.aluno_desde).toLocaleDateString("pt-BR", { year: "numeric", month: "long" });
  const validadeFmt = membro.data_fim
    ? new Date(membro.data_fim).toLocaleDateString("pt-BR")
    : "Enquanto matrícula ativa";

  return (
    <div className="w-full max-w-md mx-auto perspective" style={{ perspective: "1500px" }}>
      <div
        className="relative w-full transition-transform duration-700 ease-out"
        style={{
          transformStyle: "preserve-3d",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          minHeight: 540,
        }}
      >
        {/* FRENTE */}
        <div
          className="absolute inset-0 rounded-3xl shadow-2xl overflow-hidden"
          style={{
            backgroundColor: theme.bg,
            color: theme.text,
            backfaceVisibility: "hidden",
            border: `1px solid ${theme.muted}`,
          }}
        >
          {/* Barra superior accent */}
          <div className="h-1.5 w-full" style={{ backgroundColor: theme.accent }} />

          <div className="p-6 flex flex-col items-center text-center gap-5">
            <div className="w-full flex items-center justify-between">
              <span className="text-[11px] tracking-[0.3em] font-semibold opacity-80">CLUBE</span>
              <span
                className="text-base font-bold tracking-tight"
                style={{ color: theme.accent }}
              >
                FORTEM
              </span>
              <span className="text-[11px] tracking-[0.3em] font-semibold opacity-80">MEMBER</span>
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl font-bold uppercase tracking-wide leading-tight">{alunoNome}</h2>
              <p className="text-[11px] tracking-[0.25em] font-semibold" style={{ color: theme.accent }}>
                {NIVEL_BADGE[membro.nivel_membro]}
              </p>
              {isMax && theme.metallic && (
                <div
                  className="h-px w-32 mx-auto mt-2"
                  style={{ background: `linear-gradient(90deg, transparent, ${theme.metallic}, transparent)` }}
                />
              )}
            </div>

            <div className="flex items-center gap-2 text-[11px] tracking-widest font-semibold">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: STATUS_DOT[membro.status_membro] }}
              />
              {STATUS_LABEL[membro.status_membro]}
            </div>

            <MembershipQR alunoId={membro.aluno_id} fgColor={qrFg} bgColor={qrBg} size={200} />

            <div className="w-full flex items-center justify-between text-[10px] tracking-[0.2em] opacity-80 mt-2">
              <span>{membro.fortem_id}</span>
              <button
                onClick={() => setFlipped(true)}
                className="inline-flex items-center gap-1 hover:opacity-100 opacity-70"
                style={{ color: theme.text }}
              >
                <RotateCw className="w-3 h-3" /> VERSO
              </button>
            </div>
          </div>
        </div>

        {/* VERSO */}
        <div
          className="absolute inset-0 rounded-3xl shadow-2xl overflow-hidden"
          style={{
            backgroundColor: theme.bg,
            color: theme.text,
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            border: `1px solid ${theme.muted}`,
          }}
        >
          <div className="h-1.5 w-full" style={{ backgroundColor: theme.accent }} />
          <div className="p-6 flex flex-col gap-4 h-full">
            <div className="flex items-center justify-between">
              <span className="text-[11px] tracking-[0.3em] font-semibold opacity-80">DETALHES</span>
              <button
                onClick={() => setFlipped(false)}
                className="text-[10px] tracking-[0.2em] inline-flex items-center gap-1 opacity-70 hover:opacity-100"
              >
                <RotateCw className="w-3 h-3" /> FRENTE
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <Field label="Aluno desde" value={dataInicioFmt} accent={theme.accent} />
              <Field label="Validade" value={validadeFmt} accent={theme.accent} />
              <Field label="Status" value={STATUS_LABEL[membro.status_membro]} accent={theme.accent} />
              <Field label="Categoria" value={categoria || "—"} accent={theme.accent} />
            </div>

            <div className="border-t opacity-30 my-1" style={{ borderColor: theme.text }} />

            <div className="space-y-2 text-xs">
              <Field label="Contato FORTEM" value={contato || "@sou.fortem"} accent={theme.accent} />
              {alunoEmail && <Field label="E-mail" value={alunoEmail} accent={theme.accent} />}
            </div>

            <div className="mt-auto space-y-3">
              <Button
                size="sm"
                className="w-full"
                style={{ backgroundColor: theme.accent, color: "#FFFFFF" }}
                onClick={() => document.getElementById("clube-tab-parceiros")?.click()}
              >
                Ver parceiros próximos
              </Button>
              <p className="text-[10px] leading-relaxed opacity-60 text-center">
                Benefícios válidos apenas para alunos ativos. Uso pessoal e intransferível.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-[0.2em] opacity-60" style={{ color: accent }}>
        {label}
      </p>
      <p className="text-sm font-medium leading-tight">{value}</p>
    </div>
  );
}
