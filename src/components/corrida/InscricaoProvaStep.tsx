import { Check } from "lucide-react";
import {
  PROVA_NOME_2026,
  PROVA_NOME_ATUAL,
  type InscricaoForm,
  type ProvaPedido,
} from "./inscricaoForm";

const RITMOS = [
  "Entre 3:31 e 4:10 min/km",
  "Entre 4:11 e 4:55 min/km",
  "Entre 4:56 e 5:40 min/km",
  "Entre 5:41 e 6:20 min/km",
  "Entre 6:21 e 7:00 min/km",
  "Acima de 7:00 min/km",
];

const MARCAS = [
  "Olympikus",
  "Nike",
  "Adidas",
  "Asics",
  "New Balance",
  "Brooks",
  "Saucony",
  "Mizuno",
  "Under Armour",
  "Hoka One One",
  "Reebok",
  "Outros",
];

const COMO_SOUBE = [
  "Redes Oficiais da prova",
  "Influencers/Embaixadores",
  "Assessoria Esportiva",
  "Amigos/Familiares",
  "Academia",
  "Busca na Internet",
  "Rádio",
  "TV",
];

const TAMANHOS = ["Babylook (tamanho único)", "P", "M", "G", "GG"];

const Pill = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
      active
        ? "bg-primary text-primary-foreground border-primary"
        : "border-border text-foreground hover:border-primary/50"
    }`}
  >
    {children}
  </button>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="block text-sm font-semibold mb-1.5">{label}</span>
    {children}
  </label>
);

const inputCls =
  "w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:border-primary";

const Secao = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
  <div className="pt-5 first:pt-0">
    <h4 className="font-display font-bold text-sm uppercase tracking-wider text-muted-foreground mb-3">
      {titulo}
    </h4>
    <div className="space-y-4">{children}</div>
  </div>
);

const CheckRow = ({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onChange}
    className={`w-full text-left flex items-start gap-3 rounded-xl border p-4 transition-all ${
      checked ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
    }`}
  >
    <span
      className={`shrink-0 mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center ${
        checked ? "bg-primary border-primary text-primary-foreground" : "border-border"
      }`}
    >
      {checked && <Check className="w-3.5 h-3.5" />}
    </span>
    <span className="text-sm">{children}</span>
  </button>
);

const InscricaoProvaStep = ({
  form,
  setForm,
  provas,
  exigeTermo,
}: {
  form: InscricaoForm;
  setForm: React.Dispatch<React.SetStateAction<InscricaoForm>>;
  provas: ProvaPedido[];
  exigeTermo: boolean;
}) => {
  const set = <K extends keyof InscricaoForm>(k: K, v: InscricaoForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const nomesProvas = provas.map((p) => PROVA_NOME_ATUAL[p.prova]).join(" e ");

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-card">
      <h3 className="font-display text-xl font-bold mb-1">Inscrição na Prova</h3>
      <p className="text-sm text-muted-foreground mb-2">
        Últimos detalhes para fazer a sua inscrição{nomesProvas ? ` em ${nomesProvas}` : ""}.
      </p>

      <div className="divide-y divide-border">
        <Secao titulo="Informações para inscrição">
          <Field label="Ritmo de corrida*">
            <select
              className={inputCls}
              value={form.ritmo_corrida}
              onChange={(e) => set("ritmo_corrida", e.target.value)}
            >
              <option value="">Selecione</option>
              {RITMOS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>

          <div>
            <span className="block text-sm font-semibold mb-1.5">Local de nascimento*</span>
            <div className="flex gap-2">
              {(["RS", "Outros"] as const).map((o) => (
                <Pill key={o} active={form.local_nascimento === o} onClick={() => set("local_nascimento", o)}>
                  {o}
                </Pill>
              ))}
            </div>
          </div>

          {provas.map((p) => {
            const campo = p.prova === "NB" ? "participou_nb_2026" : "participou_mipoa_2026";
            const valor = form[campo];
            return (
              <div key={p.prova}>
                <span className="block text-sm font-semibold mb-1.5">
                  Participou da {PROVA_NOME_2026[p.prova]}?*
                </span>
                <div className="flex gap-2">
                  <Pill active={valor === true} onClick={() => set(campo, true)}>
                    Sim
                  </Pill>
                  <Pill active={valor === false} onClick={() => set(campo, false)}>
                    Não
                  </Pill>
                </div>
              </div>
            );
          })}
        </Secao>

        <Secao titulo="Informações complementares">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Marca de tênis*">
              <select
                className={inputCls}
                value={form.marca_tenis}
                onChange={(e) => set("marca_tenis", e.target.value)}
              >
                <option value="">Selecione</option>
                {MARCAS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Como ficou sabendo*">
              <select
                className={inputCls}
                value={form.como_soube}
                onChange={(e) => set("como_soube", e.target.value)}
              >
                <option value="">Selecione</option>
                {COMO_SOUBE.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Secao>

        <Secao titulo="Camiseta oficial">
          <div className="grid gap-4 sm:grid-cols-2">
            {provas.map((p) => {
              const campo = p.prova === "NB" ? "camiseta_nb" : "camiseta_mipoa";
              return (
                <Field key={p.prova} label={`Camiseta ${PROVA_NOME_ATUAL[p.prova]}*`}>
                  <select
                    className={inputCls}
                    value={form[campo]}
                    onChange={(e) => set(campo, e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {TAMANHOS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </Field>
              );
            })}
          </div>
        </Secao>

        <Secao titulo="Confirmação">
          <CheckRow
            checked={form.aceite_inscricao}
            onChange={() => set("aceite_inscricao", !form.aceite_inscricao)}
          >
            Declaro que as informações preenchidas são verdadeiras e autorizo a Fortem a utilizá-las
            exclusivamente para a realização da minha inscrição na {nomesProvas}.
          </CheckRow>
          {exigeTermo && (
            <CheckRow
              checked={form.aceite_termo_aptidao}
              onChange={() => set("aceite_termo_aptidao", !form.aceite_termo_aptidao)}
            >
              Li e aceito o{" "}
              <a
                href="/termos/aptidao-fisica-uso-imagem"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-4"
                onClick={(e) => e.stopPropagation()}
              >
                Termo de Aptidão Física e Uso de Imagem
              </a>{" "}
              da Fortem.
            </CheckRow>
          )}
        </Secao>
      </div>
    </div>
  );
};

export default InscricaoProvaStep;
