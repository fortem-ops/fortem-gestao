import { useNavigate } from "react-router-dom";
import { ArrowLeft, Moon, Sun } from "lucide-react";
import { usePortalTema, type PortalTema } from "@/hooks/usePortalTema";
import { cn } from "@/lib/utils";

const OPCOES_TEMA: { valor: PortalTema; titulo: string; descricao: string; icon: typeof Moon }[] = [
  { valor: "escuro", titulo: "Escuro", descricao: "Padrão do portal", icon: Moon },
  { valor: "claro", titulo: "Claro", descricao: "Fundo claro", icon: Sun },
];

export default function PortalConfiguracoes() {
  const navigate = useNavigate();
  const { tema, setTema } = usePortalTema();

  return (
    <div className="space-y-6 pb-8" style={{ fontFamily: "Archivo, sans-serif" }}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Voltar"
          className="-ml-2 flex h-11 w-11 items-center justify-center text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-black uppercase tracking-[0.04em] text-foreground">
          Configurações do App
        </h1>
      </div>

      <section className="border border-[#4A4B4B] bg-[#1A1A1A] p-5 space-y-4">
        <div className="space-y-1">
          <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#B1B3B3]">
            Aparência
          </p>
          <p className="text-sm text-foreground">
            Escolha como você prefere visualizar o portal neste aparelho.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3" role="group" aria-label="Aparência do portal">
          {OPCOES_TEMA.map((opcao) => {
            const ativo = tema === opcao.valor;
            const Icon = opcao.icon;
            return (
              <button
                key={opcao.valor}
                type="button"
                aria-pressed={ativo}
                onClick={() => setTema(opcao.valor)}
                className={cn(
                  "flex min-h-[72px] flex-col items-start justify-center gap-1 border px-4 py-3 text-left transition-colors",
                  ativo
                    ? "border-[#C8282A] bg-[#C8282A] text-white"
                    : "border-[#4A4B4B] bg-[#0E0E0E] text-foreground hover:bg-[#1a1a1a]",
                )}
              >
                <span className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.08em]">
                  <Icon className="h-4 w-4" />
                  {opcao.titulo}
                </span>
                <span
                  className={cn(
                    "text-xs",
                    ativo ? "text-white/90" : "text-[#B1B3B3]",
                  )}
                >
                  {opcao.descricao}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}