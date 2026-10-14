import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { executarEnvio } from "./envio.ts";
import { decidirEnvio, contratoTexto } from "./texto.ts";

Deno.test("evento inicial repetido reserva/envia só uma vez", async () => {
  let reservado = false; let enviados = 0;
  const deps = {
    reservar: async () => { if (reservado) return null; reservado=true; return { envio_id:"id",dados:{},idempotency_key:"fixa" }; },
    enviar: async () => { enviados++; return {ok:true}; }, resultado: async () => {},
  };
  await Promise.all([executarEnvio(deps),executarEnvio(deps)]);
  await executarEnvio(deps);
  assertEquals(enviados,1);
});
Deno.test("falha do provedor registra resultado sem desfazer ativação e preserva chave no retry", async () => {
  const keys:string[]=[]; const resultados:boolean[]=[];
  const deps = { reservar:async()=>({envio_id:"id",dados:{},idempotency_key:"fixa"}),
    enviar:async(r:{idempotency_key:string})=>{keys.push(r.idempotency_key);return {ok:keys.length>1,status:503};},
    resultado:async(_id:string,ok:boolean)=>{resultados.push(ok);}, };
  await executarEnvio(deps); await executarEnvio(deps);
  assertEquals(keys,["fixa","fixa"]); assertEquals(resultados,[false,true]);
});
Deno.test("teste_2027 também bloqueia destinatário real", () => {
  assertEquals(decidirEnvio({email:"comprador@example.org",teste_2027:true},true,["nicolas_ja@hotmail.com"]),"teste_rascunho");
  assertEquals(decidirEnvio({email:"nicolas_ja@hotmail.com",teste_admin:true},true,["nicolas_ja@hotmail.com"]),"enviar");
  assertEquals(decidirEnvio({email:"comprador@example.org"},true,["nicolas_ja@hotmail.com"]),"enviar");
  assertEquals(decidirEnvio({email:"nicolas_ja@hotmail.com",teste_admin:true},false,["nicolas_ja@hotmail.com"]),"desligado");
});
Deno.test("cláusulas preservam texto e entidades, sem scripts ativos",()=>{
  assertEquals(contratoTexto('<p>Cláusula 1: A &amp; B.</p><script>alert(1)</script>').includes('Cláusula 1: A & B.'),true);
  assertEquals(contratoTexto('<p>Contrato</p><script>alert(1)</script>').includes('alert'),false);
});