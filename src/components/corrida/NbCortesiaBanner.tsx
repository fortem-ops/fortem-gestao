import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Rota = "aluno" | "somente_corrida" | "prospect" | "somente_provas";
type Tier = "start" | "start_plus" | "power" | "pro" | "max";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const maskCpf = (v: string) =>
  v
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");

const BENEFICIOS = [
  "Inscrição da prova",
  "Briefing pré-prova",
  "Grupo no WhatsApp",
  "Retiramos seu kit da prova",
  "Acesso à estrutura da Fortem no dia da prova",
];

/**
 * Abertura da página /corrida: campanha NB 42k 2027 com preços de prospect,
 * benefícios e identificação por CPF embutida.
 */
const NbCortesiaBanner = ({
  onSelect,
}: {
  onSelect: (rota: Rota, tier?: Tier | null, nome?: string | null) => void;
}) => {
  const [cpf, setCpf] = useState("");
  const [verificando, setVerificando] = useState(false);
  const [erroCpf, setErroCpf] = useState<string | null>(null);
  const [naoEncontrado, setNaoEncontrado] = useState(false);

  const { data: planos = [] } = useQuery({
    queryKey: ["corrida-planos-prospect"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("planos_catalogo")
        .select("nome, periodo_meses, valor")
        .eq("atividade", "corrida")
        .eq("nome", "Corrida - Prospect");
      if (error) throw error;
      return (data ?? []) as { nome: string; periodo_meses: number; valor: number }[];
    },
  });

  const anual = planos.find((p) => p.periodo_meses === 12);
  const mensal = planos.find((p) => p.periodo_meses === 1);

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

  return (
    <section className="relative w-full overflow-hidden bg-accent py-20 md:py-28">
      {/* Watermark tipo número de peito */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center select-none">
        <span className="font-display font-bold leading-none text-accent-foreground/10 text-[9rem] sm:text-[14rem] md:text-[20rem] tracking-tighter">
          42K
        </span>
      </div>

      <div className="relative z-10 container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <div className="flex items-center justify-center gap-3 md:gap-5 mb-6 flex-wrap">
            <span className="font-display font-bold uppercase tracking-[0.25em] text-accent-foreground text-xl md:text-3xl">
              Porto Alegre
            </span>
            <span className="font-display font-bold text-primary text-xl md:text-3xl">2027</span>
          </div>

          <h1 className="font-display text-3xl md:text-5xl lg:text-6xl font-bold text-accent-foreground leading-tight max-w-4xl mx-auto">
            Matricule-se agora e ganhe sua inscrição na{" "}
            <span className="text-primary">NB 42k 2027</span>.
          </h1>

          <p className="mt-6 text-lg md:text-2xl text-accent-foreground/80 font-light">
            Garanta sua vaga até 20/08.
          </p>
        </motion.div>

        <div className="mt-12 grid gap-8 lg:grid-cols-2 max-w-5xl mx-auto items-start">
          {/* Preços + benefícios */}
          <div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-primary/40 bg-primary/10 p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold">Anual</p>
                <p className="mt-2 font-display text-3xl font-bold text-accent-foreground">
                  {anual ? `a partir de ${brl(Number(anual.valor) / 12)}` : "—"}
                  <span className="text-base font-normal text-accent-foreground/70">/mês</span>
                </p>
                <p className="mt-1 text-sm text-accent-foreground/70">parcelável em até 10x</p>
              </div>
              <div className="rounded-2xl border border-accent-foreground/20 p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-accent-foreground/60 font-semibold">
                  Mensal
                </p>
                <p className="mt-2 font-display text-3xl font-bold text-accent-foreground">
                  {mensal ? brl(Number(mensal.valor)) : "—"}
                  <span className="text-base font-normal text-accent-foreground/70">/mês</span>
                </p>
              </div>
            </div>

            <ul className="mt-6 grid sm:grid-cols-2 gap-x-6 gap-y-3">
              {BENEFICIOS.map((b) => (
                <li key={b} className="flex items-start gap-2 text-accent-foreground/90">
                  <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Identificação por CPF */}
          <div className="rounded-2xl bg-background text-foreground p-6 shadow-card">
            <label className="block text-sm font-semibold mb-2" htmlFor="cpf-corrida">
              Já é aluno? Insira seu CPF
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
                  Continuar como visitante →
                </button>
              </div>
            )}

            <div className="mt-6 flex flex-col gap-2 text-sm">
              <button
                onClick={() => onSelect("prospect")}
                className="text-left font-semibold text-primary hover:opacity-80"
              >
                Não sou aluno, quero ver meu preço →
              </button>
              <button
                onClick={() => onSelect("somente_provas")}
                className="text-left font-semibold text-primary hover:opacity-80"
              >
                Quero só me inscrever numa prova →
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default NbCortesiaBanner;
