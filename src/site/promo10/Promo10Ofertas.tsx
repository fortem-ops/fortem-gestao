import { useState } from "react";
import { TEXTOS_PLANOS } from "@/config/planosPublicoTextos";
import { PROMO10_DESCONTO_EX_ALUNO, type FrequenciaPromo10 } from "@/lib/promo10";
import {
  diaDoCiclo,
  formatarDataBr,
  formatarMoedaBr,
  rotuloFrequencia,
  textoQuebraUpgrade,
  type OfertaAgregadoraPromo10,
  type OfertaCorridaPromo10,
  type OfertaExAlunoPromo10,
  type OfertaUpgradePromo10,
  type RespostaOfertasPromo10,
} from "@/lib/promo10Texto";

const VANTAGENS_START_SEMESTRAL = [
  "3 treinos presenciais por semana",
  "Horários fixos garantidos",
  "Sem multa de cancelamento",
];
const VANTAGENS_PRO_SEMESTRAL = [
  "3 treinos presenciais por semana",
  "Reposição de treinos e vantagens do plano Pro",
  "Clube FORTEM com acúmulo turbinado",
  "Sem multa de cancelamento",
];
const VANTAGENS_POWER = TEXTOS_PLANOS.vantagens.power;
const VANTAGENS_PRO = TEXTOS_PLANOS.vantagens.pro;
const VANTAGEM_REPOSICAO = TEXTOS_PLANOS.vantagens.reposicao;

export function Promo10Ofertas({
  primeiroNome,
  ofertas,
  enviando,
  erro,
  onInteresse,
}: {
  primeiroNome: string;
  ofertas: RespostaOfertasPromo10;
  enviando: string | null;
  erro: string | null;
  onInteresse: (tipo: "principal" | "corrida", chave: string) => void;
}) {
  const upgrades = ofertas.principal.filter((o): o is OfertaUpgradePromo10 => o.tipo === "upgrade");
  const agregadoras = ofertas.principal.filter((o): o is OfertaAgregadoraPromo10 => o.tipo === "semestral_agregadora");
  const exAlunoAnuais = ofertas.principal.filter(
    (o): o is OfertaExAlunoPromo10 => o.tipo === "ex_aluno" && o.modalidade_cobranca === "anual",
  );

  const [freqUpgrade, setFreqUpgrade] = useState<FrequenciaPromo10>(upgrades[0]?.frequencia_destino ?? "3x");
  const [freqExAluno, setFreqExAluno] = useState<FrequenciaPromo10>("2x");

  const upgradeSel = upgrades.find((u) => u.frequencia_destino === freqUpgrade) ?? upgrades[0] ?? null;
  const exAlunoFiltradas = exAlunoAnuais.filter((o) => o.frequencia === freqExAluno);

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#a3a3a3]">Condições de aniversário</p>
        <h1 className="mt-1 text-2xl font-black uppercase tracking-tight">Olá, {primeiroNome}</h1>
      </div>

      {erro && (
        <div role="alert" className="border border-[#c8282a] bg-[#1a1a1a] p-4 text-sm text-[#f5f5f5]">
          {erro}
        </div>
      )}

      {upgradeSel && (
        <div className="p10-card p-6 space-y-5">
          <div className="space-y-2">
            <span className="p10-badge">20% OFF</span>
            <h2 className="text-xl font-black uppercase">Upgrade de frequência</h2>
            <p className="text-sm text-[#d4d4d4]">
              20% de desconto na diferença para subir de frequência, até o fim do seu plano
            </p>
          </div>

          <p className="border-y border-[#4a4b4b] py-3 text-xs uppercase tracking-wider text-[#d4d4d4]">
            Plano atual: <strong className="text-white">{upgradeSel.plano_atual} ({rotuloFrequencia(upgradeSel.frequencia_atual)})</strong> · Dia do ciclo: <strong className="text-white">{diaDoCiclo(upgradeSel.data_inicio_ciclo)}</strong> · Até: <strong className="text-white">{formatarDataBr(upgradeSel.data_fim_plano)}</strong>
          </p>

          <div className="grid grid-cols-3 gap-2">
            {upgrades.map((u) => (
              <button
                key={u.frequencia_destino}
                type="button"
                className="p10-tab px-2 text-xs"
                data-ativo={u.frequencia_destino === upgradeSel.frequencia_destino}
                onClick={() => setFreqUpgrade(u.frequencia_destino)}
              >
                Para {rotuloFrequencia(u.frequencia_destino)}
              </button>
            ))}
          </div>

          <div className="space-y-1.5 text-sm text-[#d4d4d4]">
            {textoQuebraUpgrade(upgradeSel.calculo_promocional).map((linha) => (
              <p key={linha}>{linha}</p>
            ))}
          </div>

          <div className="space-y-1 border-t border-[#4a4b4b] pt-4">
            <p className="text-sm text-[#a3a3a3]">
              Sem desconto: <span className="line-through">{formatarMoedaBr(upgradeSel.valor_sem_desconto)}</span>
            </p>
            <p className="text-2xl font-black text-white">
              Com 20% OFF: {formatarMoedaBr(upgradeSel.valor_promocional)}
            </p>
            <p className="text-sm font-bold text-[#e5e5e5]">
              Você economiza (20%): {formatarMoedaBr(upgradeSel.economia)}
            </p>
          </div>

          <button
            type="button"
            disabled={enviando !== null}
            onClick={() => onInteresse("principal", upgradeSel.frequencia_destino)}
            className="p10-btn-primary w-full px-4 text-sm"
          >
            {enviando === `principal:${upgradeSel.frequencia_destino}` ? "Registrando..." : "Tenho interesse"}
          </button>
        </div>
      )}

      {agregadoras.length > 0 && (
        <div className="space-y-4">
          {agregadoras.map((o) => {
            const ehPro = o.nome.toLowerCase().includes("pro");
            const vantagens = ehPro ? VANTAGENS_PRO_SEMESTRAL : VANTAGENS_START_SEMESTRAL;
            return (
              <div key={o.codigo} className="p10-card p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-xl font-black uppercase">{o.nome}</h2>
                  {ehPro && <span className="p10-badge">Mais completo</span>}
                </div>
                {ehPro && <p className="text-sm font-bold text-[#e5e5e5]">Menos que o Start 3x e com mais vantagens</p>}
                <div className="space-y-1">
                  <p className="text-xs text-[#a3a3a3] line-through">Start 3x hoje R$ 599/mês</p>
                  <p className="text-3xl font-black text-white">
                    {formatarMoedaBr(o.valor_mensal)}
                    <span className="text-sm font-bold text-[#d4d4d4]">/mês</span>
                  </p>
                  {o.economia_mes !== null && o.economia_6_meses !== null && (
                    <p className="text-xs text-[#d4d4d4]">
                      Economia de {formatarMoedaBr(o.economia_mes)}/mês ({formatarMoedaBr(o.economia_6_meses)} em 6 meses)
                    </p>
                  )}
                </div>
                <ul className="space-y-1.5 border-t border-[#4a4b4b] pt-3 text-sm text-[#d4d4d4]">
                  {vantagens.map((v) => <li key={v}>· {v}</li>)}
                </ul>
                <button
                  type="button"
                  disabled={enviando !== null}
                  onClick={() => onInteresse("principal", o.codigo)}
                  className="p10-btn-primary w-full px-4 text-sm"
                >
                  {enviando === `principal:${o.codigo}` ? "Registrando..." : "Tenho interesse"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {exAlunoAnuais.length > 0 && (
        <div className="space-y-4">
          <div className="space-y-3">
            <h2 className="text-xl font-black uppercase">
              Volte para a FORTEM com R$ {PROMO10_DESCONTO_EX_ALUNO} de desconto
            </h2>
            <div className="grid grid-cols-4 gap-2">
              {(["1x", "2x", "3x", "livre"] as FrequenciaPromo10[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  className="p10-tab px-2 text-xs"
                  data-ativo={freqExAluno === f}
                  onClick={() => setFreqExAluno(f)}
                >
                  {f === "livre" ? "Livre" : f}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {exAlunoFiltradas.map((o) => {
              const ehPro = o.familia === "pro_2027";
              const vantagens = ehPro
                ? o.frequencia === "livre"
                  ? VANTAGENS_PRO
                  : [...VANTAGENS_PRO, VANTAGEM_REPOSICAO]
                : VANTAGENS_POWER;
              return (
                <div key={o.codigo} className="p10-card p-6 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-lg font-black uppercase">{ehPro ? "Pro Anual" : "Power Anual"}</h3>
                    <span className="text-xs font-bold uppercase text-[#d4d4d4]">{rotuloFrequencia(o.frequencia)}</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-[#a3a3a3]">
                      De <span className="line-through">{formatarMoedaBr(o.valor_sem_desconto)}</span>
                    </p>
                    <p className="text-2xl font-black text-white">Por {formatarMoedaBr(o.valor_promocional)}</p>
                    <p className="text-sm text-[#d4d4d4]">12x de {formatarMoedaBr(o.parcela_12x)}</p>
                  </div>
                  <ul className="space-y-1.5 border-t border-[#4a4b4b] pt-3 text-sm text-[#d4d4d4]">
                    {vantagens.map((v) => <li key={v}>· {v}</li>)}
                  </ul>
                  <button
                    type="button"
                    disabled={enviando !== null}
                    onClick={() => onInteresse("principal", o.codigo)}
                    className="p10-btn-primary w-full px-4 text-sm"
                  >
                    {enviando === `principal:${o.codigo}` ? "Registrando..." : "Tenho interesse"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {ofertas.corrida && (
        <CartaoCorrida corrida={ofertas.corrida} enviando={enviando} onInteresse={onInteresse} />
      )}
    </section>
  );
}

function CartaoCorrida({
  corrida,
  enviando,
  onInteresse,
}: {
  corrida: OfertaCorridaPromo10;
  enviando: string | null;
  onInteresse: (tipo: "principal" | "corrida", chave: string) => void;
}) {
  return (
    <div className="p10-card p-6 space-y-4">
      <span className="p10-badge">Combina com a oferta acima</span>
      <div className="space-y-1">
        <h2 className="text-xl font-black uppercase">Feche 6 meses, ganhe o 7º</h2>
        <p className="text-sm text-[#d4d4d4]">{corrida.nome_catalogo} · {corrida.meses_total} meses de acesso</p>
      </div>
      <div className="space-y-1">
        <p className="text-2xl font-black text-white">{formatarMoedaBr(corrida.valor_promocional)}</p>
        <p className="text-sm text-[#d4d4d4]">
          Equivalente a {formatarMoedaBr(corrida.valor_equivalente_mes)}/mês nos {corrida.meses_total} meses
        </p>
      </div>
      <button
        type="button"
        disabled={enviando !== null}
        onClick={() => onInteresse("corrida", "corrida_6_mais_1")}
        className="p10-btn-primary w-full px-4 text-sm"
      >
        {enviando === "corrida:corrida_6_mais_1" ? "Registrando..." : "Tenho interesse"}
      </button>
    </div>
  );
}