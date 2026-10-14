import { describe, expect, it } from 'vitest';
import { consultasSeparadas, podeSimular } from '@/lib/consultasPrevia2027';
import { autorizarPrevia, avancar, inicial } from '../../supabase/functions/planos-consultas-previa/estado';
describe('consultas F2: isolamento e estados', () => {
  it.each(['start_2027','power_2027','pro_2027'])('separa recorrência %s com consultas', familia => {
    expect(consultasSeparadas({ familia, forma_plano:'recorrencia', servicos_centavos:60000 })).toBe(true);
  });
  it('12x combinado, Pix e sem consultas não entram na prévia nova', () => {
    for (const forma_plano of ['cartao_parcelado','pix_vista']) expect(consultasSeparadas({ familia:'power_2027',forma_plano,servicos_centavos:60000 })).toBe(false);
    expect(consultasSeparadas({ familia:'start_2027',forma_plano:'recorrencia',servicos_centavos:0 })).toBe(false);
  });
  it('somente admin + prévia + teste + simulação autorizam', () => {
    expect(autorizarPrevia(true,true,true,true)).toBe(true);
    for (let i=0;i<4;i++) { const args=[true,true,true,true]; args[i]=false; expect(autorizarPrevia(args[0],args[1],args[2],args[3])).toBe(false); }
  });
  it('não paga consultas antes de aprovar plano', () => {
    expect(() => avancar(inicial(),'consultas','aprovado',true,false)).toThrow('Aprove o plano primeiro');
  });
  it('recusa do plano mantém consultas pendentes', () => {
    expect(avancar(inicial(),'plano','recusado',true,false)).toEqual({ plano:'recusado',consultas:'pendente',obrigacao_id:null });
  });
  it('retoma apenas consultas sem alterar plano aprovado', () => {
    const pago = avancar(inicial(),'plano','aprovado',true,false);
    const recusado = avancar(pago,'consultas','recusado',true,false);
    expect(avancar(recusado,'consultas','aprovado',true,false).plano).toBe('aprovado');
  });
  it.each(['plano','consultas'] as const)('desconhecido bloqueia nova cobrança de %s', parte => {
    const e = { ...inicial(), plano:'aprovado' as const, [parte]:'desconhecido' as const, obrigacao_id:'o' };
    expect(() => avancar(e,parte,'aprovado',true,false)).toThrow('Resultado desconhecido');
    expect(podeSimular({ ...e,novo_aceite_exigido:false },parte)).toBe(false);
  });
  it('novo aceite exigido após prazo/cancelamento impede pagamento', () => {
    expect(() => avancar(inicial(),'plano','aprovado',true,true)).toThrow('condições atuais');
    expect(podeSimular({ ...inicial(),obrigacao_id:'o',novo_aceite_exigido:true },'plano')).toBe(false);
  });
  it('aprovação repetida é idempotente', () => {
    const e = avancar(inicial(),'plano','aprovado',true,false);
    expect(avancar(e,'plano','aprovado',true,false)).toBe(e);
  });
});