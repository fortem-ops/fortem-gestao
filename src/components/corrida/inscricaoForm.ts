/* Tipos e helpers compartilhados do formulário de inscrição /corrida.
   Dados cadastrais (etapa "Dados Cadastrais") e campos de prova
   (etapa final "Inscrição nas Provas") vivem no mesmo objeto de estado. */

export type ProvaKey = "NB" | "MIPOA";
export type Distancia = "5K" | "10K" | "21K" | "42K";

export interface ProvaPedido {
  prova: ProvaKey;
  distancia: Distancia;
}

export interface InscricaoForm {
  // dados cadastrais
  nome: string;
  sobrenome: string;
  email: string;
  cpf: string;
  data_nascimento: string;
  telefone: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  // campos específicos de prova
  ritmo_corrida: string;
  local_nascimento: "" | "RS" | "Outros";
  participou_nb_2026: boolean | null;
  participou_mipoa_2026: boolean | null;
  marca_tenis: string;
  como_soube: string;
  camiseta_nb: string;
  camiseta_mipoa: string;
  aceite_inscricao: boolean;
  aceite_termo_aptidao: boolean;
}

export interface InscricaoPrefill {
  nome?: string | null;
  sobrenome?: string | null;
  email?: string | null;
  telefone?: string | null;
  cpf?: string | null;
  data_nascimento?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
}

export function maskCpf(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}

export function formatCepLocal(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export const inscricaoFormInicial = (prefill: InscricaoPrefill = {}): InscricaoForm => ({
  nome: prefill.nome ?? "",
  sobrenome: prefill.sobrenome ?? "",
  email: prefill.email ?? "",
  cpf: prefill.cpf ? maskCpf(prefill.cpf) : "",
  data_nascimento: prefill.data_nascimento ?? "",
  telefone: prefill.telefone ?? "",
  cep: prefill.cep ? formatCepLocal(prefill.cep) : "",
  logradouro: prefill.logradouro ?? "",
  numero: prefill.numero ?? "",
  complemento: prefill.complemento ?? "",
  bairro: prefill.bairro ?? "",
  cidade: prefill.cidade ?? "",
  uf: prefill.uf ?? "",
  ritmo_corrida: "",
  local_nascimento: "",
  participou_nb_2026: null,
  participou_mipoa_2026: null,
  marca_tenis: "",
  como_soube: "",
  camiseta_nb: "",
  camiseta_mipoa: "",
  aceite_inscricao: false,
  aceite_termo_aptidao: false,
});

/** Valida apenas os dados cadastrais (etapa "Dados Cadastrais"). */
export function dadosCadastraisValidos(form: InscricaoForm): boolean {
  const req = [
    form.nome,
    form.sobrenome,
    form.email,
    form.data_nascimento,
    form.telefone,
    form.cep,
    form.logradouro,
    form.numero,
    form.bairro,
    form.cidade,
    form.uf,
  ];
  if (req.some((v) => !String(v).trim())) return false;
  if (form.cpf.replace(/\D/g, "").length !== 11) return false;
  if (form.cep.replace(/\D/g, "").length !== 8) return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return false;
  return true;
}

/** Valida apenas os campos específicos de prova (etapa final). */
export function inscricaoProvaValida(
  form: InscricaoForm,
  provas: ProvaPedido[],
  exigeTermo: boolean,
): boolean {
  if (provas.length === 0) return false;
  if (!form.ritmo_corrida.trim()) return false;
  if (!form.local_nascimento) return false;
  if (!form.marca_tenis.trim()) return false;
  if (!form.como_soube.trim()) return false;
  for (const p of provas) {
    if (p.prova === "NB" && (form.participou_nb_2026 === null || !form.camiseta_nb)) return false;
    if (p.prova === "MIPOA" && (form.participou_mipoa_2026 === null || !form.camiseta_mipoa))
      return false;
  }
  if (!form.aceite_inscricao) return false;
  if (exigeTermo && !form.aceite_termo_aptidao) return false;
  return true;
}

export const PROVA_NOME_ATUAL: Record<ProvaKey, string> = {
  NB: "NB 42k 2027",
  MIPOA: "42ª Maratona Internacional de Porto Alegre 2027",
};

export const PROVA_NOME_2026: Record<ProvaKey, string> = {
  NB: "NB 42k 2026",
  MIPOA: "41ª Maratona Internacional de Porto Alegre",
};
