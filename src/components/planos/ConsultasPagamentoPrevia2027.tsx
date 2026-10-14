import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { PACOTES_PUBLICOS } from '@/config/planosPublicoTextos';
import { consultasPrevia, podeSimular, type ConsultaPrevia } from '@/lib/consultasPrevia2027';
import { validarCartao, mascararNumeroCartao, mascararValidade } from '@/lib/cartaoPlanos2027';
import { dividirCentavos, type SessaoCheckout } from '@/lib/checkoutSite2027';
import type { RevisaoCheckout } from './PagamentoReservado2027';

const brl = (v: number) => (v / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const controle = 'h-auto min-h-12 rounded-none whitespace-normal py-3 font-bold uppercase';
export function ResumoConsultasSeparadas({ revisao: r }: { revisao: RevisaoCheckout }) {
  const mensal = dividirCentavos(r.plano_centavos, r.parcelas_plano)[0] ?? 0;
  return <div className="space-y-5 text-sm leading-relaxed">
    <div className="border-y border-border py-4"><h2 className="font-display font-bold uppercase">Plano</h2><p className="mt-2 font-bold">{brl(mensal)} por mês · 1ª mensalidade hoje</p><p>{r.familia === 'start_2027' ? 'Start · renovação mensal, sem fidelidade' : `${r.familia === 'power_2027' ? 'Power' : 'Pro'} · 12 mensalidades`}</p></div>
    <div className="border-b border-border pb-4"><h2 className="font-display font-bold uppercase">Consultas</h2><ul className="mt-2 space-y-2">{r.servicos.map(s => <li key={s.codigo}>{PACOTES_PUBLICOS[s.codigo]?.area} · {PACOTES_PUBLICOS[s.codigo]?.titulo ?? s.nome} · {brl(s.valor_centavos)}</li>)}</ul><p className="mt-3 font-bold">Total das consultas: {brl(r.servicos_centavos)}</p><p>Cartão de 1 a 6x ou Pix à vista, sem desconto.</p><p className="mt-2 text-muted-foreground">Créditos liberados após o pagamento das consultas, válidos por 12 meses desde a venda e independentes do cancelamento do plano.</p></div>
    <p className="font-semibold">Plano primeiro, consultas depois. Duas transações separadas; consultas não entram na primeira mensalidade.</p>
  </div>;
}
export function ConsultasPagamentoPrevia2027({ sessao, revisao, onAlterar }: { sessao: SessaoCheckout; revisao: RevisaoCheckout; onAlterar?: () => void }) {
  const [e, setE] = useState<ConsultaPrevia | null>(null);
  const [erro, setErro] = useState(''); const [ocupado, setOcupado] = useState(true);
  const [forma, setForma] = useState<'cartao_parcelado' | 'pix_vista'>('cartao_parcelado');
  const [parcelas, setParcelas] = useState(6); const [termo, setTermo] = useState<ConsultaPrevia | null>(null);
  const [marcado, setMarcado] = useState(false); const [editando, setEditando] = useState(false);
  const trava = useRef(false);
  async function chamar(acao: string, extra: Record<string, unknown> = {}) {
    if (trava.current) return;
    trava.current = true; setOcupado(true); setErro('');
    try {
      const r = await consultasPrevia(sessao, acao, extra);
      if (acao === 'termo') { setTermo(r); setMarcado(false); }
      else { setE(r); setForma(r.forma); setParcelas(r.parcelas); setTermo(null); setEditando(false); setMarcado(false); }
    } catch (err) { setErro(err instanceof Error ? err.message : 'Simulação indisponível'); }
    finally { trava.current = false; setOcupado(false); }
  }
  useEffect(() => { void chamar('estado'); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [sessao.proposta_id]);
  const aceito = !!e?.obrigacao_id && !e.novo_aceite_exigido && !editando;
  const desconhecido = e?.plano === 'desconhecido' || e?.consultas === 'desconhecido';
  const completo = e?.plano === 'aprovado' && e?.consultas === 'aprovado';
  const valores = dividirCentavos(e?.valor_centavos ?? revisao.servicos_centavos, forma === 'pix_vista' ? 1 : parcelas);
  return <section className="max-w-5xl">
    <p className="text-xs font-bold uppercase text-primary">Passo 5 · Pagamento · prévia admin</p>
    <h1 className="mt-3 font-display text-2xl font-extrabold uppercase sm:text-3xl">Plano e consultas</h1>
    <p role="note" className="mt-4 border-l-2 border-primary pl-3 text-sm">SIMULAÇÃO — sem cobrança, ativação, créditos ou e-mail reais.</p>
    {onAlterar && !desconhecido && !completo && <Button variant="outline" className="mt-4 rounded-none font-bold uppercase" disabled={ocupado} onClick={onAlterar}>Alterar escolha</Button>}
    <div className="mt-7 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        {erro && <p role="alert" className="mb-5 text-sm text-destructive">{erro}</p>}
        {!e && <p role="status">{ocupado ? 'Conferindo a prévia…' : 'A prévia está bloqueada. Entre como admin com modo simulação.'}</p>}
        {e && <>
          <div role="status" className="border-y border-border py-4 font-bold">{desconhecido ? 'Resultado desconhecido — nova cobrança bloqueada' : completo ? 'Plano ativo — consultas pagas (simulação)' : e.plano === 'aprovado' ? 'Plano ativo — pagamento das consultas pendente' : e.plano === 'recusado' ? 'Plano recusado — nada ativado' : 'Aguardando o pagamento do plano'}</div>
          <h2 className="mt-6 font-display text-lg font-bold uppercase">Consultas · aceite específico</h2>
          {!aceito && !desconhecido && !completo ? <div className="mt-4 space-y-4">
            {e.novo_aceite_exigido && <p className="text-sm">Prazo encerrado ou plano cancelado: leia e aceite novamente as condições das consultas.</p>}
            <div role="group" aria-label="Pagamento das consultas" className="grid gap-3 sm:grid-cols-2">
              <Button variant="outline" className={controle} aria-pressed={forma === 'cartao_parcelado'} disabled={ocupado} onClick={() => { setForma('cartao_parcelado'); setTermo(null); }}>Cartão · 1 a 6x</Button>
              <Button variant="outline" className={controle} aria-pressed={forma === 'pix_vista'} disabled={ocupado} onClick={() => { setForma('pix_vista'); setTermo(null); }}>Pix à vista · sem desconto</Button>
            </div>
            {forma === 'cartao_parcelado' && <label className="block text-sm">Parcelas das consultas<select className="campo mt-2" value={parcelas} disabled={ocupado} onChange={ev => { setParcelas(Number(ev.target.value)); setTermo(null); }}>{[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}x</option>)}</select></label>}
            <p className="text-sm font-bold">{forma === 'pix_vista' ? `Pix: ${brl(valores[0] ?? 0)}` : `${parcelas}x de ${brl(valores[0] ?? 0)}${valores.some(v => v !== valores[0]) ? ` · última ${brl(valores[valores.length - 1])}` : ''}`}</p>
            <Button variant="outline" className={`${controle} w-full`} disabled={ocupado} onClick={() => chamar('termo', { forma, parcelas: forma === 'pix_vista' ? 1 : parcelas })}>Ler condições das consultas</Button>
            {termo && <><div role="document" aria-label="Termo das consultas" className="max-h-80 overflow-y-auto whitespace-pre-wrap break-words border border-border p-4 text-sm leading-relaxed">{termo.termo_texto}</div><label className="flex items-start gap-3 text-sm"><Checkbox checked={marcado} onCheckedChange={v => setMarcado(v === true)} /><span>Li e aceito o pagamento independente, a forma e as parcelas das consultas e suas condições de liberação e cancelamento.</span></label><Button className={`${controle} w-full`} disabled={!marcado || ocupado} onClick={() => chamar('aceitar', { forma, parcelas: forma === 'pix_vista' ? 1 : parcelas, termo_hash: termo.termo_hash })}>Aceitar condições das consultas</Button></>}
          </div> : aceito && <div className="mt-3 text-sm"><p>Aceite registrado · {e.forma === 'pix_vista' ? 'Pix à vista, sem desconto' : `Cartão em ${e.parcelas}x`}</p>{e.retomar_ate && <p className="mt-2">Retomada das consultas até {new Date(e.retomar_ate).toLocaleString('pt-BR')} · preço congelado por 7 dias.</p>}{!desconhecido && !completo && <Button variant="link" className="mt-2 h-auto p-0" onClick={() => setEditando(true)}>Alterar forma e fazer novo aceite das consultas</Button>}</div>}
          <h2 className="mt-7 font-display text-lg font-bold uppercase">1. Plano · primeira mensalidade</h2>
          <p className="mt-2 text-sm">Somente {brl(dividirCentavos(revisao.plano_centavos, revisao.parcelas_plano)[0] ?? 0)} hoje. Consultas não estão incluídas.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">{(['aprovado','recusado','desconhecido'] as const).map(resultado => <Button key={resultado} variant={resultado === 'aprovado' ? 'default' : 'outline'} className={controle} disabled={ocupado || !aceito || !podeSimular(e, 'plano')} onClick={() => chamar('simular', { parte: 'plano', resultado })}>Plano · simular {resultado}</Button>)}</div>
          <h2 className="mt-7 font-display text-lg font-bold uppercase">2. Consultas · pagamento separado</h2>
          <p className="mt-2 text-sm">{e.forma === 'pix_vista' ? 'Pix próprio, disponível após o plano aprovado. Nenhum código real é gerado nesta prévia.' : 'Nova captura e autorização de cartão, podendo ser o mesmo cartão digitado novamente ou outro.'}</p>
          {e.consultas === 'recusado' && <p role="alert" className="mt-3 text-sm">Consultas recusadas. Retome somente este pagamento; o plano não será cobrado novamente.</p>}
          {e.forma === 'pix_vista' ? <div className="mt-4 grid gap-3 sm:grid-cols-3">{(['aprovado','recusado','desconhecido'] as const).map(resultado => <Button key={resultado} variant={resultado === 'aprovado' ? 'default' : 'outline'} className={controle} disabled={ocupado || !aceito || !podeSimular(e, 'consultas')} onClick={() => chamar('simular', { parte: 'consultas', resultado })}>Consultas · simular {resultado}</Button>)}</div> : <CartaoConsultas desabilitado={ocupado || !aceito || !podeSimular(e, 'consultas')} parcelas={e.parcelas} valor={e.valor_centavos} onPagar={(cartao, cenario) => chamar('cartao', { cartao, cenario })} />}
          {e.consultas === 'desconhecido' && e.forma !== 'pix_vista' && <div className="mt-4 grid gap-3 sm:grid-cols-2">{(['aprovado','recusado'] as const).map(c => <Button key={c} variant="outline" className={controle} disabled={ocupado} onClick={() => chamar('conciliar', { cenario: c })}>Conciliar · Rede responde {c}</Button>)}</div>}
          {completo && <p className="mt-5 text-sm">Simulação concluída: na compra real, a venda das consultas liberará os créditos por 12 meses. Nenhum crédito foi criado nesta prévia.</p>}
        </>}
      </div>
      <aside className="min-w-0 border-t border-border pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0"><h2 className="mb-4 font-display text-lg font-bold uppercase">Resumo dos dois pagamentos</h2><ResumoConsultasSeparadas revisao={revisao} /></aside>
    </div>
  </section>;
}
function CartaoConsultas({ desabilitado, parcelas, valor, onPagar }: { desabilitado: boolean; parcelas: number; valor: number; onPagar: (c: { numero: string; nome: string; mes: string; ano: string; cvv: string }, cenario: 'aprovado' | 'recusado' | 'desconhecido') => void }) {
  const [c, setC] = useState({ numero: '', nome: '', validade: '', cvv: '' });
  const [cenario, setCenario] = useState<'aprovado' | 'recusado' | 'desconhecido'>('aprovado');
  const [erro, setErro] = useState('');
  const v = dividirCentavos(valor, parcelas);
  function enviar() {
    const r = validarCartao(c);
    if (r.ok === false) { setErro(r.erro); return; }
    setErro(''); setC({ numero: '', nome: '', validade: '', cvv: '' });
    onPagar(r.cartao, cenario);
  }
  return <div className="mt-4 space-y-3">
    <p className="text-sm font-bold">{parcelas}x de {brl(v[0] ?? 0)} para {brl(valor)} · sem desconto</p>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-sm sm:col-span-2">Número do cartão<input className="campo mt-2" inputMode="numeric" autoComplete="off" value={c.numero} disabled={desabilitado} onChange={ev => setC({ ...c, numero: mascararNumeroCartao(ev.target.value) })} /></label>
      <label className="block text-sm sm:col-span-2">Nome impresso<input className="campo mt-2" autoComplete="off" value={c.nome} disabled={desabilitado} onChange={ev => setC({ ...c, nome: ev.target.value.toUpperCase() })} /></label>
      <label className="block text-sm">Validade (MM/AA)<input className="campo mt-2" inputMode="numeric" autoComplete="off" value={c.validade} disabled={desabilitado} onChange={ev => setC({ ...c, validade: mascararValidade(ev.target.value) })} /></label>
      <label className="block text-sm">CVV<input className="campo mt-2" inputMode="numeric" autoComplete="off" maxLength={4} value={c.cvv} disabled={desabilitado} onChange={ev => setC({ ...c, cvv: ev.target.value.replace(/\D/g, '') })} /></label>
      <label className="block text-sm sm:col-span-2">Resposta simulada da Rede<select className="campo mt-2" value={cenario} disabled={desabilitado} onChange={ev => setCenario(ev.target.value as typeof cenario)}><option value="aprovado">Aprovado</option><option value="recusado">Recusado</option><option value="desconhecido">Sem resposta (desconhecido)</option></select></label>
    </div>
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    <Button className={`${controle} w-full`} disabled={desabilitado} onClick={enviar}>Pagar consultas no cartão (simulação)</Button>
  </div>;
}
