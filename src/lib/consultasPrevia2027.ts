import { supabase } from '@/integrations/supabase/client';
import type { SessaoCheckout } from './checkoutSite2027';
export type StatusPrevia = 'pendente' | 'aprovado' | 'recusado' | 'desconhecido';
export type ConsultaPrevia = {
  habilitada: boolean; plano: StatusPrevia; consultas: StatusPrevia; obrigacao_id: string | null;
  retomar_ate: string | null; novo_aceite_exigido: boolean;
  forma: 'cartao_parcelado' | 'pix_vista'; parcelas: number;
  termo_texto?: string; termo_hash?: string;
  itens: { codigo: string; nome: string; valor_centavos: number; composicao?: { atividade: string; quantidade: number }[] }[];
  valor_centavos: number;
};
export function consultasSeparadas(r: { forma_plano: string; familia: string; servicos_centavos: number }) {
  return r.forma_plano === 'recorrencia' && ['start_2027', 'power_2027', 'pro_2027'].includes(r.familia) && r.servicos_centavos > 0;
}
export function podeSimular(e: Pick<ConsultaPrevia, 'plano' | 'consultas' | 'obrigacao_id' | 'novo_aceite_exigido'>, parte: 'plano' | 'consultas') {
  return !!e.obrigacao_id && !e.novo_aceite_exigido && !['aprovado', 'desconhecido'].includes(e[parte]) && (parte === 'plano' || e.plano === 'aprovado');
}
export async function consultasPrevia(sessao: SessaoCheckout, acao = 'estado', extra: Record<string, unknown> = {}): Promise<ConsultaPrevia> {
  const { data: auth } = await supabase.auth.getSession();
  const token = auth.session?.access_token;
  if (!token) throw new Error('Prévia disponível somente para administrador autenticado');
  const { data, error } = await supabase.functions.invoke('planos-consultas-previa', {
    body: { ...sessao, ...extra, acao }, headers: { Authorization: `Bearer ${token}` },
  });
  if (error || data?.erro) throw new Error(data?.erro || 'Não foi possível abrir a simulação agora');
  return data as ConsultaPrevia;
}