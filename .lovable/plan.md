
## Objetivo
Adicionar botão **"Importar CSV"** nas três listagens (Alunos Ativos, Inativos e Prospects), permitindo cadastro em massa a partir de uma planilha. O status inicial é determinado pela tela de origem.

## Fluxo de uso
1. Botão **"Importar CSV"** ao lado de "Novo Aluno" em cada listagem.
2. Dialog com:
   - Link **"Baixar modelo CSV"** (template com cabeçalhos + linha de exemplo).
   - Upload do arquivo `.csv`.
   - Preview das primeiras 5 linhas + lista de avisos/erros por linha.
   - Botão **"Importar X alunos"**.
3. Processamento linha a linha:
   - Cria aluno em `alunos`.
   - Se houver dados de plano → cria registro em `planos`.
   - Se houver origem → grava em `pipeline_metadata`.
4. Relatório final: X importados com sucesso, Y com erro (com motivo da linha).

## Ordem e formato das colunas do CSV

Separador: **vírgula** (`,`). Encoding **UTF-8**. Primeira linha = cabeçalho (nomes exatos).

### Dados Cadastrais (obrigatório `nome`)
| # | Coluna | Obrig. | Formato |
|---|--------|--------|---------|
| 1 | `nome` | ✅ | Texto, 2–100 chars |
| 2 | `email` | — | Email válido |
| 3 | `telefone` | — | Dígitos ou formatado |
| 4 | `data_nascimento` | — | `AAAA-MM-DD` |
| 5 | `sexo` | — | `masculino` / `feminino` / `outro` / `nao_informar` |
| 6 | `frequencia_semanal` | — | `0` (livre), `1`, `2`, `3` |
| 7 | `observacoes` | — | Até 1000 chars |

### Professor Responsável
| # | Coluna | Obrig. | Formato |
|---|--------|--------|---------|
| 8 | `professor_email` | — | Email do professor cadastrado (resolvido para `responsavel_id`) |

### Plano (opcional)
| # | Coluna | Valores |
|---|--------|---------|
| 9 | `plano_tipo` | `Start`, `Start+`, `Power`, `Pro`, `Max`, `Gympass/Wellhub`, `Total Pass` |
| 10 | `plano_valor` | Número (ex.: `299.90`) |
| 11 | `plano_data_inicio` | `AAAA-MM-DD` (default hoje se `plano_tipo` preenchido) |
| 12 | `plano_consultas` | `nutricao`, `reabilitacao`, `misto` (misto só Pro) — exigido em Power/Pro |

### Origem do Lead
| # | Coluna | Valores |
|---|--------|---------|
| 13 | `origem_lead` | `Indicação`, `Instagram`, `Google`, `WhatsApp`, `Passou em frente`, `Outro`, `Gympass/Wellhub`, `Total Pass`, `Parceiros`, `Ex-aluno`, `Fachada` |

### Status (definido pela tela de origem)
- **Alunos Ativos** → `status = ativo`
- **Inativos** → `status = encerrado`
- **Prospects** → `status = lead` (sem plano, **não** entra no pipeline automaticamente — o usuário move manualmente quando quiser)

> Coluna `status` no CSV é ignorada.

## Validações
- `nome` obrigatório.
- Formato de datas validado.
- Valores enumerados validados (plano, sexo, origem, consultas).
- **Duplicidade permitida**: e-mails/telefones repetidos NÃO são bloqueados. O sistema apenas exibe um **aviso** ("Já existe aluno com este e-mail/telefone") na linha do preview, mas a importação prossegue. Limpeza/mesclagem é feita manualmente depois pelo usuário.
- Linhas com erro de formato (não duplicidade) são puladas e listadas no relatório final.

## Detalhes técnicos
- Novo componente: `src/components/student/ImportStudentsCSVDialog.tsx` (parser próprio simples, sem dependência extra — trata aspas e vírgulas escapadas).
- Helper: `src/lib/studentImport.ts` (parse, schema zod, função `importStudents(rows, contextStatus, userId)`).
- Botão adicionado em:
  - `src/pages/StudentList.tsx` (Ativos e Inativos)
  - `src/pages/Prospects.tsx`
- Reaproveita lógica de `AddStudentDialog` (inserção em `alunos`, `planos`, `pipeline_metadata`).
- Para Prospects: **não** chama `fn_move_pipeline` — apenas cria o aluno com `status = lead`.
- Template CSV gerado client-side (Blob + download).

## Entregáveis
1. `ImportStudentsCSVDialog` (UI + parsing + preview + execução + avisos de duplicidade).
2. `studentImport.ts` com schema zod e função de importação em lote.
3. Integração nas 3 listagens com o status correspondente.
4. Download do modelo CSV direto pelo dialog.
