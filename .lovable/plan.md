## Importação de 853 leads do sistema antigo

### O que será feito

1. **Criar nova origem "Migração"** na tabela `lead_origens` (ativa, ordem = última).

2. **Importar os 853 cadastros** do arquivo anexo para a tabela `alunos`:
   - `nome` = Cliente (trim, uppercase preservado)
   - `telefone` = Contato (mantido como veio; vazio quando ausente)
   - `email` = Email (null quando vazio)
   - `status` = `lead`
   - `created_at` = data de cadastro do arquivo (formato `dd/mm/yyyy hh:mm` convertido para timestamp)
   - `responsavel_id` = null

3. **Registrar origem em `pipeline_metadata`** para cada lead importado: `origem_lead = 'Migração'`.

4. **Pular duplicados**: antes de inserir, ignorar linha cujo telefone normalizado (apenas dígitos) já exista em `alunos`, OU cujo nome exato já exista. Linhas sem telefone são checadas apenas por nome.

5. **Sem estágio no pipeline**: não chamar `fn_move_pipeline`. Os leads ficam apenas com `status='lead'` e aparecem na tela `/leads` sem entrar no kanban — exatamente como leads criados antes do pipeline.

### Como será executado

- Parse do TSV no sandbox (Python), normalização de telefones e datas.
- Geração de um único `INSERT ... SELECT` via tool de dados, em lote, com `ON CONFLICT DO NOTHING` na deduplicação por telefone/nome.
- Relatório final: total no arquivo, inseridos, pulados (com motivo).

### Observações

- Os 2 nomes já vetados anteriormente (JESSICA LORENZZI ELKFURY, NILCE APARECIDA DA SILVA FREITAS FEDATTO) — não constam neste arquivo, mas serão filtrados por segurança.
- Nenhuma alteração de schema fora da inserção da origem "Migração" (linha em tabela existente).
- Nenhum código de frontend muda.
