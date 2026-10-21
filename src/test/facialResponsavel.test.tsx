import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PortalFacial from '@/pages/portal/PortalFacial';
const state=vi.hoisted(()=>({cons:false,status:null as string|null,rpc:vi.fn()}));
vi.mock('@/contexts/StudentPortalContext',()=>({useStudentPortal:()=>({student:{id:'menor',nome:'Menor Simulado',data_nascimento:'2015-01-01'}})}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{rpc:state.rpc}}));
vi.mock('@tanstack/react-query',()=>({useQueryClient:()=>({invalidateQueries:vi.fn()}),useQuery:({queryKey}:{queryKey:string[]})=>queryKey[0]==='facial-app-aluno-habilitado'?{data:true,isLoading:false}:{data:{cred:state.status?{status:state.status,created_at:'2026-10-21'}:null,temConsentimento:state.cons,responsavelValido:state.cons,ev:[],treinos:{},fotoUrl:null},isLoading:false}}));
beforeEach(()=>{cleanup();state.cons=false;state.status=null;state.rpc.mockClear();});
describe('regra de autorização facial para menor',()=>{
 it('menor sem autorização não pode iniciar envio nem gerar link',()=>{
  render(<MemoryRouter><PortalFacial/></MemoryRouter>);
  expect(screen.queryByRole('button',{name:'Cadastrar meu rosto'})).toBeNull();
  expect(screen.queryByRole('button',{name:/Gerar link/})).toBeNull();
  expect(state.rpc).not.toHaveBeenCalled();
 });
 it('menor autorizado inicia foto sem consentimento próprio',()=>{
  state.cons=true;render(<MemoryRouter><PortalFacial/></MemoryRouter>);
  fireEvent.click(screen.getByRole('button',{name:'Cadastrar meu rosto'}));
  expect(screen.getByRole('button',{name:'Da galeria'})).toBeDefined();
  expect(screen.queryByRole('checkbox')).toBeNull();
  expect(state.rpc).not.toHaveBeenCalled();
 });
 it('menor ativo pode remover mas não trocar foto',()=>{
  state.status='ativa';render(<MemoryRouter><PortalFacial/></MemoryRouter>);
  expect(screen.getByRole('button',{name:'Remover meu rosto'})).toBeDefined();
  expect(screen.queryByRole('button',{name:'Trocar minha foto'})).toBeNull();
 });
});
