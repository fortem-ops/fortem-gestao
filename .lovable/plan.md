## Objetivo

Permitir, por **protocolo** em **Tipos de Avaliação**, configurar se a avaliação aceitará upload de arquivos (ex.: Força sim, Experimental não).

## Mudanças

### 1. Banco de dados
Adicionar coluna na tabela `avaliacao_protocolos`:
- `permite_upload boolean not null default false`

### 2. Cadastro do protocolo (`ProtocoloAvaliacaoDialog.tsx`)
Adicionar um `Switch` "Permite upload de arquivos" ao lado dos toggles **Padrão** / **Ativo**, persistindo o novo campo via `upsertProtocolo`. Atualizar a interface `AvaliacaoProtocolo` em `src/lib/avaliacaoProtocolos.ts`.

### 3. Tela de avaliação
No formulário da avaliação (`AssessmentForm.tsx` / `ExperimentalAssessment.tsx` / `DynamicAssessment.tsx`), quando o protocolo carregado tiver `permite_upload = true`, exibir uma seção **"Anexos da avaliação"** com:
- Input de upload múltiplo (imagens/PDF, mesmo padrão do `StudentUploads.tsx`, bucket `aluno-files`, pasta `avaliacoes/{avaliacao_id}/...`)
- Lista dos arquivos enviados com download/remover
- Os anexos ficam vinculados à avaliação (nova tabela `avaliacao_anexos` com `avaliacao_id`, `storage_path`, `nome_arquivo`, `tipo`, `uploaded_by`; RLS espelhando as policies de `avaliacoes`).

Quando `permite_upload = false`, a seção não é renderizada (comportamento atual do Experimental se mantém).

### 4. Visualização (`AssessmentViewerDialog.tsx`)
Quando a avaliação possuir anexos, mostrar lista com links assinados para download (sem condicional ao flag, pois a avaliação já foi gravada com os arquivos).

## Pontos fora de escopo
- Não altera engines, schemas dinâmicos, Pollock ou Funcional.
- Não mexe em Banco de Treinos.
- Protocolos existentes ficam com `permite_upload = false` por padrão; admin/coordenador pode habilitar manualmente em Força e demais tipos.
