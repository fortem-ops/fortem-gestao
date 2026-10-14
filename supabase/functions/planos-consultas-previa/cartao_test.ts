import { assertEquals } from 'jsr:@std/assert@1';
import { cobrarConsultas, conciliarConsultas, interpretar, redeSimulada, validarCartao, type Db, type Rede } from './cartao.ts';

const cartao = validarCartao({ numero: '4111 1111 1111 1111', nome: 'NICOLAS TESTE', mes: '12', ano: '2030', cvv: '123' })!;
const o = { id: 'o1', valor_centavos: 162000, parcelas: 6, forma: 'cartao_parcelado', status: 'pendente' };
function fakeDb() {
  const st = { t: null as null | { id: string; status: string; ref: string }, liquidou: 0, reservas: 0, ultimo: null as any };
  const db: Db = {
    reservar: async () => { st.reservas++; if (!st.t || st.t.status === 'recusado') st.t = { id: 't' + st.reservas, status: 'pendente', ref: 'consultas:x' + st.reservas }; return { tentativa_id: st.t.id, reutilizada: false }; },
    tentativa: async () => st.t,
    resultado: async (_i, s) => { st.t!.status = s; },
    liquidar: async (_i, a) => { st.liquidou++; st.ultimo = a; st.t!.status = 'aprovado'; },
  };
  return { st, db };
}
function redeContada(base: Rede) { const c = { cobrancas: 0, subscription: [] as boolean[] }; return { c, rede: { ...base, cobrar: async (i: any) => { c.cobrancas++; c.subscription.push(i.subscription); return base.cobrar(i); } } as Rede }; }

Deno.test('aprovado: 1 captura avulsa (subscription=false), valor congelado 6x, espelha uma vez', async () => {
  const { st, db } = fakeDb(); const { c, rede } = redeContada(redeSimulada('aprovado'));
  assertEquals((await cobrarConsultas(o, true, cartao, rede, db)).resultado, 'aprovado');
  assertEquals([c.cobrancas, c.subscription[0], st.liquidou, st.ultimo.centavos, st.ultimo.parcelas], [1, false, 1, 162000, 6]);
});
Deno.test('plano não ativo: bloqueia sem chamar a Rede', async () => {
  const { db } = fakeDb(); const { c, rede } = redeContada(redeSimulada('aprovado'));
  assertEquals((await cobrarConsultas(o, false, cartao, rede, db)).resultado, 'bloqueado'); assertEquals(c.cobrancas, 0);
});
Deno.test('desconhecido: bloqueia nova cobrança; conciliação só consulta', async () => {
  const { st, db } = fakeDb(); const { c, rede } = redeContada(redeSimulada('desconhecido'));
  assertEquals((await cobrarConsultas(o, true, cartao, rede, db)).resultado, 'desconhecido');
  assertEquals((await cobrarConsultas({ ...o, status: 'desconhecido' }, true, cartao, rede, db)).resultado, 'bloqueado');
  await conciliarConsultas(o, st.t!.id, st.t!.ref, redeSimulada('aprovado'), db);
  assertEquals([c.cobrancas, st.liquidou, st.t!.status], [1, 1, 'aprovado']);
});
Deno.test('recusado permite nova tentativa com nova referência', async () => {
  const { st, db } = fakeDb();
  assertEquals((await cobrarConsultas(o, true, cartao, redeSimulada('recusado'), db)).resultado, 'recusado');
  const ref1 = st.t!.ref;
  assertEquals((await cobrarConsultas({ ...o, status: 'recusado' }, true, cartao, redeSimulada('aprovado'), db)).resultado, 'aprovado');
  assertEquals(st.t!.ref === ref1, false);
});
Deno.test('tentativa em processamento não é cobrada de novo (clique duplo)', async () => {
  const { st, db } = fakeDb(); st.t = { id: 't0', status: 'processando', ref: 'r' };
  const { c, rede } = redeContada(redeSimulada('aprovado'));
  assertEquals((await cobrarConsultas(o, true, cartao, rede, db)).resultado, 'bloqueado'); assertEquals(c.cobrancas, 0);
});
Deno.test('já pago: não cobra', async () => {
  const { db } = fakeDb(); const { c, rede } = redeContada(redeSimulada('aprovado'));
  assertEquals((await cobrarConsultas({ ...o, status: 'pago' }, true, cartao, rede, db)).resultado, 'aprovado'); assertEquals(c.cobrancas, 0);
});
Deno.test('Pix ou mais de 6x não passam pelo cartão', async () => {
  const { db } = fakeDb();
  assertEquals((await cobrarConsultas({ ...o, parcelas: 7 }, true, cartao, redeSimulada('aprovado'), db)).resultado, 'bloqueado');
  assertEquals((await cobrarConsultas({ ...o, forma: 'pix_vista' }, true, cartao, redeSimulada('aprovado'), db)).resultado, 'bloqueado');
});
Deno.test('interpretação: só 00 aprova; 5xx/sem retorno = desconhecido', () => {
  assertEquals(interpretar({ httpStatus: 200, erroRede: false, parsed: { returnCode: '00' } }).resultado, 'aprovado');
  assertEquals(interpretar({ httpStatus: 200, erroRede: false, parsed: { returnCode: '107' } }).resultado, 'recusado');
  assertEquals(interpretar({ httpStatus: 503, erroRede: false, parsed: null }).resultado, 'desconhecido');
});
Deno.test('cartão inválido é recusado antes da Rede', () => {
  assertEquals(validarCartao({ numero: '4111111111111112', nome: 'AB C', mes: '12', ano: '2030', cvv: '123' }), null);
});
