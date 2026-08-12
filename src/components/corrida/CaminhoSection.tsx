import { useState } from "react";
import { Loader2, UserPlus, IdCard, Flag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Rota = "aluno" | "somente_corrida" | "prospect" | "somente_provas";
type Tier = "start" | "start_plus" | "power" | "pro" | "max";

const maskCpf = (v: string) =>
  v
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");

/**
 * Etapa 1 do wizard /corrida: escolha de caminho com micro-tela inline de CPF.
 */
const CaminhoSection = ({
  onSelect,
}: {
  onSelect: (rota: Rota, tier?: Tier | null, nome?: string | null) => void;
}) => {
  const [abrirCpf, setAbrirCpf] = useState(false);
  const [cpf, setCpf] = useState("");
  const [verificando, setVerificando] = useState(false);
  const [erroCpf, setErroCpf] = useState<string | null>(null);
  const [naoEncontrado, setNaoEncontrado] = useState(false);

  const verificarCpf = async () => {
    setErroCpf(null);
    setNaoEncontrado(false);
    const digits = cpf.replace(/\D/g, "");
    if (digits.length !== 11) {
      setErroCpf("Informe um CPF válido com 11 dígitos.");
      return;
    }
    setVerificando(true);
    try {
      const { data, error } = await supabase.functions.invoke("corrida-lookup-cpf", {
        body: { cpf: digits },
      });
      if (error) throw error;
      if (data?.found) {
        onSelect(
          data.rota === "aluno" ? "aluno" : "somente_corrida",
          data.tier ?? null,
          data.primeiro_nome ?? null,
        );
      } else {
        setNaoEncontrado(true);
      }
    } catch {
      setErroCpf("Não conseguimos verificar seu CPF agora. Tente novamente em alguns minutos.");
    } finally {
      setVerificando(false);
    }
  };

  const Opcao = ({
    icon,
    title,
    subtitle,
    onClick,
    active,
  }: {
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    onClick: () => void;
    active?: boolean;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-2xl border p-6 bg-card shadow-card transition-all hover:border-primary hover:-translate-y-0.5 ${
        active ? "border-primary ring-2 ring-primary/30" : "border-border"
      }`}
    >
      <span className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
        {icon}
      </span>
      <span className="block font-display text-lg font-bold">{title}</span>
      <span className="block text-sm text-muted-foreground mt-1">{subtitle}</span>
    </button>
  );

  return (
    <div>
      <div className="text-center mb-8">
        <p className="text-primary font-display font-semibold tracking-[0.25em] uppercase text-xs mb-3">
          Comece por aqui
        </p>
        <h2 className="font-display text-3xl md:text-4xl font-bold">Escolha o seu caminho</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Opcao
          icon={<UserPlus className="w-5 h-5" />}
          title="Matricule-se"
          subtitle="Quero entrar para a assessoria de corrida da Fortem."
          onClick={() => onSelect("prospect")}
        />
        <Opcao
          icon={<IdCard className="w-5 h-5" />}
          title="Já sou aluno"
          subtitle="Identifique-se com o CPF para ver o seu preço."
          onClick={() => setAbrirCpf((v) => !v)}
          active={abrirCpf}
        />
        <Opcao
          icon={<Flag className="w-5 h-5" />}
          title="Inscrição avulsa em provas"
          subtitle="Quero só me inscrever numa prova."
          onClick={() => onSelect("somente_provas")}
        />
      </div>

      {abrirCpf && (
        <div className="mt-4 rounded-2xl border border-primary/40 bg-card p-6 shadow-card">
          <label className="block text-sm font-semibold mb-2" htmlFor="cpf-corrida">
            Insira seu CPF
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              id="cpf-corrida"
              inputMode="numeric"
              value={cpf}
              onChange={(e) => setCpf(maskCpf(e.target.value))}
              placeholder="000.000.000-00"
              className="flex-1 rounded-xl border border-border bg-background px-4 py-3 outline-none focus:border-primary"
            />
            <button
              onClick={verificarCpf}
              disabled={verificando}
              className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-display font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {verificando && <Loader2 className="w-4 h-4 animate-spin" />}
              Verificar CPF
            </button>
          </div>

          {erroCpf && <p className="mt-3 text-sm text-primary">{erroCpf}</p>}

          {naoEncontrado && (
            <div className="mt-4 rounded-xl bg-muted p-4">
              <p className="text-sm mb-3">CPF não encontrado na nossa base.</p>
              <button
                onClick={() => onSelect("prospect")}
                className="text-sm font-semibold text-primary underline underline-offset-4"
              >
                Continuar em "Matricule-se" →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CaminhoSection;
