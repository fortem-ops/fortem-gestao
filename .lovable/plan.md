## Problema

A `service_role` key do Consent & Care não é acessível por fora — projetos Lovable Cloud ficam na organização do Lovable, não aparecem no dashboard pessoal do Supabase, e o painel Cloud do Lovable não mostra essa chave. A edge function `migrate-from-consent-care` no Fortem nunca vai conseguir autenticar.

## Solução: inverter a direção

Em vez de o Fortem **puxar** dados do Consent & Care com service_role, o **Consent & Care expõe** uma edge function de export que o Fortem **consome** com um token compartilhado simples.

```text
ANTES (bloqueado):
  Fortem  ──[service_role do C&C]──►  Banco do Consent & Care
                  ❌ chave inacessível

DEPOIS (funciona):
  Consent & Care expõe edge function "export-for-fortem"
       │ (usa SUPABASE_SERVICE_ROLE_KEY local — auto-injetada)
       ▼
  Fortem chama essa função com MIGRATION_TOKEN no header
```

## O que fazer no Consent & Care (você abre o outro projeto Lovable)

1. Criar edge function `export-for-fortem` que:
   - Lê header `x-migration-token` e compara com secret `MIGRATION_TOKEN`
   - Retorna 401 se não bater
   - Aceita query params `?type=alunos|anexos|avaliacoes` e `?since=ISO_DATE` (paginação opcional)
   - Usa o cliente Supabase com `SUPABASE_SERVICE_ROLE_KEY` (auto-disponível) para ler as tabelas
   - Retorna JSON `{ data: [...], nextCursor: "..." }`
2. Adicionar secret `MIGRATION_TOKEN` no Consent & Care (qualquer string aleatória longa, ex: gerar com `openssl rand -hex 32`)

## O que fazer no Fortem (este projeto)

1. Reescrever `supabase/functions/migrate-from-consent-care/index.ts`:
   - Remover dependência de `CONSENT_CARE_SERVICE_ROLE_KEY`
   - Adicionar secret `CONSENT_CARE_MIGRATION_TOKEN` (mesmo valor do `MIGRATION_TOKEN` do C&C)
   - Chamar `https://jmdgxyzqaujxnclmvxlh.supabase.co/functions/v1/export-for-fortem` com header `x-migration-token`
   - Receber JSON e gravar nas tabelas locais via service_role do próprio Fortem (já disponível)
2. Apagar o secret antigo `CONSENT_CARE_SERVICE_ROLE_KEY` (não é mais necessário)

## Vantagens

- Não depende de chave que você não tem como obter
- Token compartilhado é simples de gerar e rotacionar
- Pode ser revogado a qualquer momento (basta apagar o secret no C&C)
- O Consent & Care controla exatamente quais tabelas/colunas expõe (mais seguro que dar service_role)

## O que preciso de você antes de implementar

- Confirmação de que **você tem acesso de edição** ao projeto Consent & Care no Lovable (precisa criar edge function lá)
- Lista das tabelas/dados do Consent & Care que devem ser migrados (alunos? anexos jurídicos? avaliações? tudo?)
- Se já existem alunos no Fortem, como tratar duplicatas (ignorar / sobrescrever / mesclar por CPF)
