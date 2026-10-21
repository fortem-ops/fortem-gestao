import { it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import RelatoriosTecnicos from '@/pages/relatorios/Tecnicos';
const s=vi.hoisted(()=>({queries:[] as Array<{queryKey:string[];queryFn:()=>Promise<unknown>}>,eq:vi.fn()}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'staff'}})}));
vi.mock('@tanstack/react-query',()=>({useQuery:(q:{queryKey:string[];queryFn:()=>Promise<unknown>})=>{s.queries.push(q);return {data:q.queryKey[0]==='relatorios-tecnicos-access'?true:undefined,isLoading:false};}}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{from:(table:string)=>{
 let filtered=false;
 const builder:any={select:()=>builder,eq:(key:string,value:unknown)=>{s.eq(table,key,value);if(table==='alunos'&&key==='is_equipe'&&value===false)filtered=true;return builder;},order:()=>builder,then:(resolve:(r:unknown)=>unknown)=>Promise.resolve(resolve({data:table==='alunos'?(filtered?[{id:'aluno',nome:'Aluno'}]:[{id:'aluno',nome:'Aluno'},{id:'equipe',nome:'Equipe'}]):[],error:null}))};return builder;
}}}));
it('a fonte dos totais dos Técnicos exclui equipe ativa',async()=>{
 render(<RelatoriosTecnicos/>);
 const q=s.queries.find(q=>q.queryKey[0]==='relatorios-tecnicos-dados');
 if(!q)throw Error('Consulta ausente');
 const result=await q.queryFn() as {alunos:Array<{id:string}>};
 expect(s.eq).toHaveBeenCalledWith('alunos','is_equipe',false);
 expect(result.alunos.map(a=>a.id)).toEqual(['aluno']);
});
