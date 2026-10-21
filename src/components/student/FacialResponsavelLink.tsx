import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
const parentescos:Record<string,string>={mae:'Mãe',pai:'Pai',responsavel_legal:'Responsável legal',outro:'Outro'};
const dia=(s?:string|null)=>s?new Date(s).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'}):'—';
type Estado={estado:string;expira_em?:string;usado_em?:string;responsavel_nome?:string;parentesco?:string};
export function FacialResponsavelLink({alunoId,nome,autorizacao}:{alunoId:string;nome:string;autorizacao?:{responsavel_nome:string|null;aceito_em:string}|null}){
 const qc=useQueryClient();const key=['facial-link',alunoId];
 const [link,setLink]=useState('');const [telefone,setTelefone]=useState('');const [busy,setBusy]=useState(false);
 const {data,error}=useQuery({queryKey:key,queryFn:async()=>{const r=await supabase.rpc('fn_facial_link_status',{p_aluno_id:alunoId});if(r.error)throw r.error;return r.data as Estado;},refetchInterval:q=>(q.state.data as Estado|undefined)?.estado==='aberto'?10000:false});
 const refresh=()=>{qc.invalidateQueries({queryKey:key});qc.invalidateQueries({queryKey:['facial',alunoId]});};
 const gerar=async()=>{setBusy(true);try{const r=await supabase.rpc('fn_facial_link_criar',{p_aluno_id:alunoId});if(r.error)throw r.error;const d=r.data as {token?:string};if(!d.token)throw Error();setLink(`https://soufortem.com.br/facial/responsavel/${d.token}`);setTelefone('');refresh();}catch{toast.error('Não foi possível gerar o link.');}finally{setBusy(false);}};
 const cancelar=async()=>{setBusy(true);const r=await supabase.rpc('fn_facial_link_cancelar',{p_aluno_id:alunoId});setBusy(false);if(r.error)toast.error('Não foi possível cancelar o link.');else refresh();};
 const status=autorizacao?`Autorizado por ${autorizacao.responsavel_nome??'responsável'} em ${dia(autorizacao.aceito_em)}`:data?.estado==='aberto'?`Link enviado, vence em ${dia(data.expira_em)}`:data?.estado==='usado'?`Autorizado por ${data.responsavel_nome??'responsável'} (${parentescos[data.parentesco??'']??'Responsável'}) em ${dia(data.usado_em)}`:data?.estado==='expirado'?'Link vencido':data?.estado==='revogado'?'Link cancelado':'Sem autorização';
 const whatsapp=()=>{const num=telefone.replace(/\D/g,'');const destino=num?`55${num.replace(/^55(?=\d{10,11}$)/,'')}`:'';const mensagem=`Olá! A FORTEM precisa da sua autorização para cadastrar o rosto de ${nome.trim().split(/\s+/)[0]} na porta do estúdio. Leia e autorize por este link (vale por 7 dias): ${link}`;window.open(`https://wa.me/${destino}?text=${encodeURIComponent(mensagem)}`,'_blank','noopener,noreferrer');};
 return <section className="border border-border bg-card p-5 space-y-3"><h3 className="text-sm font-bold uppercase">Autorização do responsável</h3><p className="text-sm">{error?'Não foi possível consultar a autorização.':status}</p><div className="flex flex-wrap gap-2"><Button onClick={gerar} disabled={busy}>Gerar link para o responsável</Button><Button variant="outline" onClick={cancelar} disabled={busy||data?.estado!=='aberto'}>Cancelar link</Button></div><Dialog open={!!link} onOpenChange={v=>{if(!v)setLink('');}}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Link para o responsável</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">O link só aparece agora; se fechar, gere outro.</p><Input aria-label="Link de autorização" value={link} readOnly className="min-w-0"/><Button variant="outline" onClick={async()=>{try{await navigator.clipboard.writeText(link);toast.success('Link copiado.');}catch{toast.error('Selecione o endereço para copiar.');}}}>Copiar link</Button><label className="text-sm">WhatsApp do responsável (opcional)<Input value={telefone} onChange={e=>setTelefone(e.target.value)} inputMode="tel" maxLength={18}/></label><Button onClick={whatsapp}>Abrir WhatsApp</Button></DialogContent></Dialog></section>;
}
