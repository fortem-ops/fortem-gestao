## Importar 699 cadastros como Alunos Inativos

### O que será feito

1. **Parse do TSV** (699 linhas + header) com todas as colunas: nome, nascimento, sexo, email, telefone, CPF, RG, CEP, logradouro, número, complemento, bairro, cidade, UF.
2. **Normalizações**:
   - `data_nascimento`: `dd/mm/yyyy` → `date`
   - `sexo`: `Masculino` → `masculino`, `Feminino` → `feminino`
   - `cpf`: apenas dígitos
   - `telefone`: mantido como veio
   - Campos com `-` ou vazios → `NULL`
3. **Dedupe (pular duplicados)**:
   - Se já existe `alunos` com mesmo CPF (apenas dígitos) → pular
   - Se CPF vazio: dedup por nome exato + telefone normalizado → pular
4. **Insert em `alunos`** para cada novo registro:
   - `status='inativo'`
   - `current_pipeline_stage_id` = id da etapa `Aluno inativo`
   - todos os campos pessoais e endereço preenchidos
   - `responsavel_id = NULL`
5. **Insert em `pipeline_metadata`**: `origem_lead='Migração'` para cada aluno inserido.
6. **Insert em `pipeline_movements`**: registrar entrada na etapa `Aluno inativo` (source `manual`, notes `Importação sistema antigo`).
7. **Relatório final**: total no arquivo, inseridos, pulados (e motivo: CPF/nome+tel já existe).

### Execução

- Python no sandbox lê o TSV, normaliza, gera SQL em lotes de 250.
- Cada lote via tool de dados (`INSERT ... ON CONFLICT DO NOTHING` adicional como segurança).
- Verificação final: `count(*)` de alunos na etapa `Aluno inativo` com `origem_lead='Migração'`.

### Observações

- Nenhuma alteração de schema nem de frontend.
- A etapa `Aluno inativo` já existe (funil `inativo`) — eles aparecerão tanto em listagens de alunos quanto no kanban do Pipeline na coluna correta.
- A origem `Migração` já existe (criada na importação anterior dos 820 leads) — será reutilizada.
