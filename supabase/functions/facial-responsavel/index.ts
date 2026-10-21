import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { VERSAO_RESPONSAVEL, TEXTO_RESPONSAVEL } from '../_shared/facial-responsavel-termo.ts';
const schema = z.discriminatedUnion('op', [
 z.object({ op: z.literal('consultar'), token: z.string().regex(/^[0-9a-f]{64}$/) }).strict(),
 z.object({ op: z.literal('aceitar'), token: z.string().regex(/^[0-9a-f]{64}$/), nome: z.string().min(5).max(200), cpf: z.string().max(18), parentesco: z.enum(['mae','pai','responsavel_legal','outro']), aceite: z.literal(true) }).strict(),
]);
const json = (body: unknown, status=200) => new Response(JSON.stringify(body), {status, headers:{...corsHeaders,'Content-Type':'application/json','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
const erro = 'Não foi possível registrar a autorização. Tente novamente.';
Deno.serve(async req => {
 if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
 if(req.method!=='POST') return json({ok:false,erro:'Método não permitido.'},405);
 try {
  const reader=req.body?.getReader(); if(!reader) return json({ok:false,erro:'Dados inválidos.'},400);
  let size=0; const chunks:Uint8Array[]=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();return json({ok:false,erro:'Dados acima do limite permitido.'},413);}chunks.push(value);}
  const buf=new Uint8Array(size);let offset=0;for(const x of chunks){buf.set(x,offset);offset+=x.length;}
  const parsed=schema.safeParse(JSON.parse(new TextDecoder().decode(buf)));
  if(!parsed.success) return json({ok:false,erro:'Confira os dados e o aceite do termo.'},400);
  const url=Deno.env.get('SUPABASE_URL'); const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!key)return json({ok:false,erro},503);
  const db=createClient(url,key,{auth:{persistSession:false}}); const b=parsed.data;
  if(b.op==='consultar'){
   const {data,error}=await db.rpc('fn_facial_link_consultar',{p_token:b.token});
   if(error)return json({ok:false,erro:'Não foi possível consultar este link.'},503);
   return json(data);
  }
  const {data,error}=await db.rpc('fn_facial_link_aceitar',{p_token:b.token,p_nome:b.nome,p_cpf:b.cpf,p_parentesco:b.parentesco,p_versao:VERSAO_RESPONSAVEL,p_texto:TEXTO_RESPONSAVEL,p_ip:(req.headers.get('x-forwarded-for')??'').split(',')[0].trim(),p_ua:req.headers.get('user-agent')??''});
  if(error)return json({ok:false,erro},503);
  return json(data?.ok?{ok:true}:{ok:false,erro: typeof data?.erro==='string'?data.erro:erro});
 } catch { return json({ok:false,erro:'Dados inválidos ou serviço indisponível.'},400); }
});
