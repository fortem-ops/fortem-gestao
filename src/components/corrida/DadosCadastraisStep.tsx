import { useState } from "react";
import { Loader2 } from "lucide-react";

import { fetchCep, formatCep } from "@/lib/viacep";
import { maskCpf, type InscricaoForm } from "./inscricaoForm";

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="block text-sm font-semibold mb-1.5">{label}</span>
    {children}
  </label>
);

const inputCls =
  "w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:border-primary";

const DadosCadastraisStep = ({
  form,
  setForm,
}: {
  form: InscricaoForm;
  setForm: React.Dispatch<React.SetStateAction<InscricaoForm>>;
}) => {
  const set = <K extends keyof InscricaoForm>(k: K, v: InscricaoForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const [buscandoCep, setBuscandoCep] = useState(false);
  const [erroCep, setErroCep] = useState<string | null>(null);

  const onCepChange = async (raw: string) => {
    const masked = formatCep(raw);
    setForm((f) => ({ ...f, cep: masked }));
    setErroCep(null);
    if (masked.replace(/\D/g, "").length !== 8) return;
    setBuscandoCep(true);
    const res = await fetchCep(masked);
    setBuscandoCep(false);
    if (!res) {
      setErroCep("CEP não encontrado — preencha o endereço manualmente.");
      return;
    }
    setForm((f) => ({
      ...f,
      logradouro: res.logradouro || f.logradouro,
      bairro: res.bairro || f.bairro,
      cidade: res.localidade || f.cidade,
      uf: res.uf || f.uf,
    }));
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-card">
      <h3 className="font-display text-xl font-bold mb-1">Dados cadastrais</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Precisamos destes dados para gerar o seu cadastro e o seu pedido.
      </p>

      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome*">
            <input className={inputCls} value={form.nome} onChange={(e) => set("nome", e.target.value)} />
          </Field>
          <Field label="Sobrenome*">
            <input
              className={inputCls}
              value={form.sobrenome}
              onChange={(e) => set("sobrenome", e.target.value)}
            />
          </Field>
          <Field label="E-mail*">
            <input
              type="email"
              className={inputCls}
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </Field>
          <Field label="CPF*">
            <input
              inputMode="numeric"
              placeholder="000.000.000-00"
              className={inputCls}
              value={form.cpf}
              onChange={(e) => set("cpf", maskCpf(e.target.value))}
            />
          </Field>
          <Field label="Data de nascimento*">
            <input
              type="date"
              className={inputCls}
              value={form.data_nascimento}
              onChange={(e) => set("data_nascimento", e.target.value)}
            />
          </Field>
          <Field label="Telefone / WhatsApp*">
            <input
              inputMode="tel"
              className={inputCls}
              value={form.telefone}
              onChange={(e) => set("telefone", e.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="CEP*">
            <div className="relative">
              <input
                inputMode="numeric"
                placeholder="00000-000"
                className={inputCls}
                value={form.cep}
                onChange={(e) => onCepChange(e.target.value)}
              />
              {buscandoCep && (
                <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              )}
            </div>
            {erroCep && <span className="text-xs text-destructive">{erroCep}</span>}
          </Field>
          <Field label="Número*">
            <input className={inputCls} value={form.numero} onChange={(e) => set("numero", e.target.value)} />
          </Field>
          <Field label="Logradouro*">
            <input
              className={inputCls}
              value={form.logradouro}
              onChange={(e) => set("logradouro", e.target.value)}
            />
          </Field>
          <Field label="Complemento">
            <input
              className={inputCls}
              value={form.complemento}
              onChange={(e) => set("complemento", e.target.value)}
            />
          </Field>
          <Field label="Bairro*">
            <input className={inputCls} value={form.bairro} onChange={(e) => set("bairro", e.target.value)} />
          </Field>
          <Field label="Cidade*">
            <input className={inputCls} value={form.cidade} onChange={(e) => set("cidade", e.target.value)} />
          </Field>
          <Field label="UF*">
            <input
              maxLength={2}
              className={inputCls}
              value={form.uf}
              onChange={(e) => set("uf", e.target.value.toUpperCase().slice(0, 2))}
            />
          </Field>
        </div>
      </div>
    </div>
  );
};

export default DadosCadastraisStep;
