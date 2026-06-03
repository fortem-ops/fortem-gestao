## Adicionar endereço e CPF à importação CSV de alunos

Estender o importador CSV (`src/lib/studentImport.ts` e `src/components/student/ImportStudentsCSVDialog.tsx`) para incluir novos campos cadastrais já existentes na tabela `alunos`: `cpf`, `cep`, `logradouro`, `numero`, `complemento`, `bairro`.

### Ordem final dos cabeçalhos do CSV

1. **Dados cadastrais básicos:** `nome`, `email`, `telefone`, `data_nascimento`, `sexo`, `frequencia_semanal`, `observacoes`
2. **Documento e endereço (novos):** `cpf`, `cep`, `logradouro`, `numero`, `complemento`, `bairro`
3. **Professor:** `professor_nome`
4. **Plano:** `plano_tipo`, `plano_valor`, `plano_data_inicio`, `plano_consultas`
5. **Origem:** `origem_lead`

### Mudanças

- **`src/lib/studentImport.ts`**
  - Adicionar os 6 campos em `CSV_HEADERS` (na ordem acima).
  - Estender `rowSchema` (zod):
    - `cpf`: string opcional, normalizada para apenas dígitos, com validação de 11 dígitos quando preenchida (sem checar dígito verificador — apenas formato).
    - `cep`: string opcional, normalizada para 8 dígitos quando preenchida.
    - `logradouro` (máx 200), `numero` (máx 20), `complemento` (máx 100), `bairro` (máx 100): strings opcionais.
  - Atualizar `buildTemplateCSV()` com valores de exemplo (`123.456.789-09`, `01310-100`, `Av. Paulista`, `1000`, `Apto 101`, `Bela Vista`).
  - No `importStudents`, incluir os 6 campos no `insert` em `alunos` (gravando `cpf`/`cep` apenas com dígitos; demais como texto ou `null`).
  - Duplicidade: manter regra atual (e-mail/telefone geram apenas aviso). **Não** adicionar checagem de CPF duplicado — o usuário pediu para permitir duplicidade.

- **`src/components/student/ImportStudentsCSVDialog.tsx`**
  - Atualizar o bloco de instruções "Como preencher a planilha" listando os novos campos no item de Dados cadastrais, mencionando formatos aceitos (CPF com ou sem pontuação; CEP com ou sem traço).

### Fora de escopo
- Sem migração de banco (colunas já existem em `alunos`).
- Sem alterar `StudentList.tsx` / `Prospects.tsx`.
- Sem chamada ao ViaCEP durante import (mantém simples; usuário pediu apenas adicionar os campos).
