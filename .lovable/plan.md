## Objetivo

Permitir importar alunos via planilha **Excel (.xlsx)** usando o layout do arquivo `CADASTROS PARA NOVO SISTEMA.xlsx`, além do CSV já existente. O mesmo botão "Importar" passa a aceitar `.xlsx` e `.csv`.

## Mapeamento das colunas do anexo

| Coluna Excel | Destino | Observação |
|---|---|---|
| Cliente | `alunos.nome` | obrigatório |
| E-mail | `alunos.email` | |
| Telefone | `alunos.telefone` | |
| Data de Nascimento | `alunos.data_nascimento` | aceita `DD/MM/AAAA` ou serial Excel |
| Sexo | `alunos.sexo` | Masculino→masculino, Feminino→feminino |
| Frequencia Semanal | `alunos.frequencia_semanal` | 0–3 |
| Professor | `responsavel_id` (lookup em profiles por nome) | sem match → usuário atual + aviso |
| Plano | `planos.tipo` | START→Start, START+→Start+, POWER→Power, PRO→Pro, MAX→Max, GYMPASS→Gympass/Wellhub, TOTALPASS→Total Pass |
| Plano Valor | `planos.valor` | |
| Plano data de início | `planos.data_inicio` | serial/data |
| Plano Consultas | `planos.servicos` | Nutrição→nutricao, Reabilitação→reabilitacao, Nutrição/Reabilitação→misto (só Pro) |
| Status Cliente | `alunos.status` (**prevalece** sobre status da tela) | Ativo→ativo, Inativo/Encerrado→encerrado, Lead/Prospect→lead. Vazio → usa status da tela. |
| CPF | `alunos.cpf` (só dígitos) | |
| RG | `alunos.rg` | |
| CEP | `alunos.cep` (só dígitos) | |
| Logradouro / Número / Complemento / Bairro / Cidade / UF | campos homônimos em `alunos` | |
| Origem / Indicação | `pipeline_metadata.origem_lead` | normaliza p/ opções existentes |

**Ignoradas com aviso** (sem coluna no banco): Plano data final, Tipo Endereço, Vencimento exame médico, Contato/Telefone/Celular de Emergência, Código Controle Interno, Modalidade, Objetivo, Avaliação DISC, Estado Civil, Profissão, Responsável, CPF/Telefone/Profissão do Responsável.

Valores `-`, vazio ou `NULL` → tratados como nulos.

## Mudanças de código (frontend apenas)

1. **`src/lib/studentImport.ts`**
   - `bun add xlsx` (SheetJS).
   - Nova função `parseXLSX(file: File): Promise<Record<string,string>[]>` — lê a 1ª aba com `cellDates:true` e `sheet_to_json({ raw:false, dateNF:"yyyy-mm-dd", defval:"" })`.
   - Mapa `EXCEL_HEADER_ALIASES` (case-insensitive, sem acento) traduzindo os cabeçalhos PT-BR do anexo para as chaves internas (`nome`, `email`, `telefone`, `data_nascimento`, `sexo`, `frequencia_semanal`, `professor_nome`, `plano_tipo`, `plano_valor`, `plano_data_inicio`, `plano_consultas`, `origem_lead`, `status_cliente`, `cpf`, `rg`, `cep`, `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `uf`). Demais cabeçalhos → ignorados com aviso único agregado.
   - Normalizadores: `normalizePlano`, `normalizeConsultas`, `normalizeSexo`, `normalizeStatus`, `normalizeOrigem` (fuzzy contra `ORIGEM_LEAD_OPTIONS`), `normalizeDate` (aceita `DD/MM/AAAA`, `AAAA-MM-DD` ou `Date`).
   - Estender `rowSchema` com `rg`, `cidade`, `uf`, `status_cliente` (todos opcionais). Demais regras permanecem.
   - Em `importStudents`:
     - gravar `rg`, `cidade`, `uf` em `alunos`;
     - usar `status_cliente` quando presente (sobrepõe o da tela);
     - **não** concatenar campos extras em `observacoes` (apenas o `observacoes` próprio, se houver).
   - Duplicidade continua só como aviso.

2. **`src/components/student/ImportStudentsCSVDialog.tsx`**
   - Título/label: "Importar CSV ou Excel".
   - `accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"`.
   - Detectar por extensão: `.xlsx` → `parseXLSX`; senão `parseCSV`.
   - Instruções: adicionar parágrafo "Também aceitamos planilhas Excel (.xlsx) com os cabeçalhos em português usados no modelo da Fortem: Cliente, E-mail, Telefone, Data de Nascimento, Sexo, Frequencia Semanal, Professor, Plano, Plano Valor, Plano data de início, Plano Consultas, Origem, Status Cliente, CPF, RG, CEP, Logradouro, Número, Complemento, Bairro, Cidade, UF. Colunas fora dessa lista (Objetivo, Modalidade, Estado Civil, Responsável, contatos de emergência, etc.) são ignoradas com aviso."
   - Botão extra **"Baixar modelo XLSX"** (gera com `XLSX.utils.book_new` usando exatamente esses cabeçalhos + 1 linha de exemplo).

3. **Sem alterações** em `StudentList.tsx` / `Prospects.tsx`.

## Sem alterações de banco

Nenhuma migration. Campos sem coluna no banco são ignorados (com aviso).
