import { supabase } from "@/integrations/supabase/client";
import type { InteressePromo10, RespostaOfertasPromo10 } from "@/lib/promo10Texto";

async function chamar<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>("promo10-publico", { body });
  if (error || !data) {
    throw new Error("indisponivel");
  }
  return data;
}

export type ConfigTurnstilePromo10 = {
  encerrada?: boolean;
  ativo?: boolean;
  site_key?: string | null;
};

export type RespostaTurnstilePromo10 = { ok: boolean; passe?: string | null; encerrada?: boolean };

export type RespostaEnviarPromo10 = {
  enviado: boolean;
  encerrada?: boolean;
  motivo?: string;
  verificacao_id?: string;
  email_mascarado?: string | null;
};

export type RespostaReenviarPromo10 = {
  ok: boolean;
  encerrada?: boolean;
  motivo?: string;
  aguardar_segundos?: number;
  verificacao_id?: string;
  email_mascarado?: string | null;
};

export type RespostaValidarPromo10 = {
  ok: boolean;
  encerrada?: boolean;
  motivo?: string;
  restantes?: number;
  sessao?: string;
  primeiro_nome?: string;
  ofertas?: RespostaOfertasPromo10;
  interesses?: InteressePromo10[];
};

export type RespostaInteressePromo10 = {
  ok: boolean;
  encerrada?: boolean;
  motivo?: string;
  codigo_pedido?: string;
  interesses?: InteressePromo10[];
};

export const promo10Api = {
  turnstileConfig: () => chamar<ConfigTurnstilePromo10>({ acao: "turnstile_config" }),
  turnstile: (token: string) => chamar<RespostaTurnstilePromo10>({ acao: "turnstile", token }),
  enviar: (cpf: string, turnstile_passe: string | null) =>
    chamar<RespostaEnviarPromo10>({ acao: "enviar", cpf, turnstile_passe }),
  reenviar: (verificacao_id: string) =>
    chamar<RespostaReenviarPromo10>({ acao: "reenviar", verificacao_id }),
  validar: (verificacao_id: string, codigo: string) =>
    chamar<RespostaValidarPromo10>({ acao: "validar", verificacao_id, codigo }),
  ofertas: (sessao: string) =>
    chamar<RespostaValidarPromo10>({ acao: "ofertas", sessao }),
  interesse: (sessao: string, tipo: "principal" | "corrida", chave: string) =>
    chamar<RespostaInteressePromo10>({ acao: "interesse", sessao, tipo, chave }),
};