import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

const TEMPLATE_MAP: Record<string, Record<string, string>> = {
  'start': {
    recorrencia: '5197281a-70fe-49ab-9879-acd4371b137f',
    tradicional: '5197281a-70fe-49ab-9879-acd4371b137f',
  },
  'start+': {
    recorrencia: 'a4519a80-18c0-4cba-ba66-c6f487844801',
    tradicional: 'ea954382-145f-4a7a-a529-f70d8623be95',
  },
  'power': {
    recorrencia: '2bc0fdfc-06e1-4513-bcf5-9ce36f35a79e',
    tradicional: 'dfb183d5-141f-467b-8c25-be6dffc7cea6',
  },
  'pro': {
    recorrencia: 'a8daa4f7-4880-421f-8a4f-853f33b08164',
    tradicional: 'ebafb20f-fbec-47dd-8f5d-2cb8c426e1b8',
  },
  'max': {
    recorrencia: 'e57db677-3d19-4aae-afdf-7ace82266a4c',
    tradicional: '412807df-2321-43f2-9512-779e16a548fb',
  },
  'gympass/wellhub': { recorrencia: '67e1fc10-fa3f-452f-ba1e-ce53f5820b28', tradicional: '67e1fc10-fa3f-452f-ba1e-ce53f5820b28' },
  'gympass': { recorrencia: '67e1fc10-fa3f-452f-ba1e-ce53f5820b28', tradicional: '67e1fc10-fa3f-452f-ba1e-ce53f5820b28' },
  'totalpass': { recorrencia: '84317e7f-01b8-44d4-be36-2125c4949f90', tradicional: '84317e7f-01b8-44d4-be36-2125c4949f90' },
  'wellhub': { recorrencia: '352c1104-0c6a-4542-98d8-2ee6ca6bcbf6', tradicional: '352c1104-0c6a-4542-98d8-2ee6ca6bcbf6' },
};

function resolverTemplateId(planoNome: string, tipoCobranca: string): string | null {
  const chave = planoNome.trim().toLowerCase();
  const tipo = tipoCobranca === 'recorrencia' ? 'recorrencia' : 'tradicional';
  return TEMPLATE_MAP[chave]?.[tipo] ?? null;
}

function preencherVariaveis(conteudo: string, vars: Record<string, string>): string {
  return conteudo
    .replace(/%NOME%/g, vars.NOME ?? '')
    .replace(/%DATA_NASCIMENTO%/g, vars.DATA_NASCIMENTO ?? '')
    .replace(/%CPF%/g, vars.CPF ?? '')
    .replace(/%RG%/g, vars.RG ?? '')
    .replace(/%ENDERECO%/g, vars.ENDERECO ?? '')
    .replace(/%BAIRRO%/g, vars.BAIRRO ?? '')
    .replace(/%CIDADE%/g, vars.CIDADE ?? '')
    .replace(/%UF%/g, vars.UF ?? '')
    .replace(/%CEP%/g, vars.CEP ?? '')
    .replace(/%EMAIL%/g, vars.EMAIL ?? '')
    .replace(/%NOME_CONTRATO%/g, vars.NOME_CONTRATO ?? '')
    .replace(/%VALOR_FINAL_CONTRATO%/g, vars.VALOR_FINAL_CONTRATO ?? '')
    .replace(/%DIA%/g, vars.DIA ?? '')
    .replace(/%MES%/g, vars.MES ?? '')
    .replace(/%ANO%/g, vars.ANO ?? '')
    .replace(/%ASSINATURA%/g, '')
    .replace(/%ACEITE%/g, '')
    .replace(/%DATA_ACEITE%/g, '')
    .replace(/%FORMATO_ACEITE%/g, '')
    .replace(/%IP_ACEITE%/g, '');
}

export async function gerarDocumentoContrato(params: {
  alunoId: string;
  contratoId: string;
  planoNome: string;
  tipoCobranca: string;
  valorFinal: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: aluno, error: alunoErr } = await (supabase as any)
      .from('alunos')
      .select('nome, email, cpf_hash, rg, data_nascimento, endereco, bairro, cidade, uf, cep')
      .eq('id', params.alunoId)
      .single();
    if (alunoErr || !aluno) return { success: false, error: 'Aluno não encontrado' };

    // Revela CPF completo via RPC (requer coord/admin autenticado). Se falhar
    // (ex.: chamada por edge function/cron sem sessão), segue com string vazia
    // pra não bloquear a geração do resto do documento.
    let cpfCompleto = '';
    try {
      const { data: cpfRpc, error: cpfErr } = await (supabase as any).rpc('fn_reveal_cpf', {
        p_aluno_id: params.alunoId,
      });
      if (cpfErr) throw cpfErr;
      cpfCompleto = typeof cpfRpc === 'string' ? cpfRpc : '';
    } catch (revealErr) {
      console.error('[contratosDocumentos] fn_reveal_cpf falhou:', revealErr);
    }

    const templateId = resolverTemplateId(params.planoNome, params.tipoCobranca);
    if (!templateId) return { success: true };

    const { data: template, error: tmplErr } = await (supabase as any)
      .from('contrato_templates')
      .select('id, conteudo, versao, nome')
      .eq('id', templateId)
      .single();
    if (tmplErr || !template) return { success: false, error: 'Template não encontrado' };

    const { data: existente } = await (supabase as any)
      .from('contratos_documentos')
      .select('id')
      .eq('contrato_id', params.contratoId)
      .maybeSingle();
    if (existente) return { success: true };

    const hoje = new Date();
    const formatarCPF = (cpf: string) => {
      const d = cpf?.replace(/\D/g, '') ?? '';
      return d.length === 11 ? `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}` : cpf ?? '';
    };
    const formatarCEP = (cep: string) => {
      const d = cep?.replace(/\D/g, '') ?? '';
      return d.length === 8 ? `${d.slice(0,5)}-${d.slice(5)}` : cep ?? '';
    };
    const formatarData = (data: string | null) => {
      if (!data) return '';
      try { return format(new Date(data + 'T00:00:00'), 'dd/MM/yyyy'); } catch { return data; }
    };
    const formatarValor = (v: number) =>
      `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const vars: Record<string, string> = {
      NOME: aluno.nome ?? '',
      DATA_NASCIMENTO: formatarData(aluno.data_nascimento),
      CPF: formatarCPF(aluno.cpf ?? ''),
      RG: aluno.rg ?? '',
      ENDERECO: aluno.endereco ?? '',
      BAIRRO: aluno.bairro ?? '',
      CIDADE: aluno.cidade ?? 'Porto Alegre',
      UF: aluno.uf ?? 'RS',
      CEP: formatarCEP(aluno.cep ?? ''),
      EMAIL: aluno.email ?? '',
      NOME_CONTRATO: template.nome,
      VALOR_FINAL_CONTRATO: formatarValor(params.valorFinal),
      DIA: format(hoje, 'dd'),
      MES: format(hoje, 'MM'),
      ANO: format(hoje, 'yyyy'),
    };

    const conteudoGerado = preencherVariaveis(template.conteudo, vars);

    const { error: insErr } = await (supabase as any)
      .from('contratos_documentos')
      .insert({
        aluno_id: params.alunoId,
        contrato_id: params.contratoId,
        template_id: templateId,
        template_versao: template.versao,
        conteudo_gerado: conteudoGerado,
        variaveis_utilizadas: vars,
        aceite: false,
      });

    if (insErr) return { success: false, error: insErr.message };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
