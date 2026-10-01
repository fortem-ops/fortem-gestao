# Corrigir o falso erro no "Lançar todos" e limpar os salários duplicados

## O que aconteceu
O lançamento funcionava, mas a tela mostrava o resultado ao contrário: quando um salário era gravado com sucesso, ela mostrava "Formulário não carregado". Como cada linha parecia ter dado erro, você clicou de novo, e os salários foram gravados várias vezes.

Situação hoje em Despesas, ago/2026, gravada entre 19:50 e 19:52:
- Bruno Silva Funari: 5 vezes
- Cristiano, Gustavo, Jonas, Thaís e Vanessa: 3 vezes cada
- Nicolas e Yasmim: nenhuma vez. A tela bloqueou porque Horas Normais estava vazio (Pró-labore e Bolsa Auxílio).

## O que vou fazer
1. **Corrigir o falso erro.** Um lançamento que deu certo passa a aparecer como "Lançado", e o resumo final volta a contar certo.
2. **Bloquear duplicados.** Antes de gravar, o sistema confere se aquele funcionário já tem salário daquela competência. Se tiver, a linha mostra "Já lançado para ago/2026" e não grava de novo. Isso vale tanto para "Lançar todos" quanto para o lançamento individual e o recibo único.
3. **Limpar as duplicatas.** Fica 1 salário por funcionário (o primeiro gravado) e as 12 cópias extras são apagadas: 4 do Bruno e 2 de cada um dos outros cinco. Só apago despesas de "Salário" de ago/2026 criadas hoje.
4. **Pró-labore e Bolsa Auxílio entram em Horas Normais.** Na importação do PDF, essas linhas passam a preencher Horas Normais, não mais Outros Vencimentos. Assim Nicolas e Yasmim podem ser lançados direto, e a trava de duplicados também vale para eles.

## Como vou conferir
- Contar no banco 1 salário por funcionário em ago/2026.
- Abrir a tela com um extrato de teste, sem gravar nada de verdade, e confirmar que uma linha já lançada aparece como "Já lançado".

## Detalhes técnicos
- `ExtratoLista.lancarUma`: hoje `(await refs.current[i]?.lancar()) ?? "Formulário não carregado."` transforma o `null` de sucesso em erro. Vai passar a tratar a falta da ref separadamente da resposta de sucesso.
- Edge function `ler-holerite`, `mapear()`: "PRO-LABORE", "PRO LABORE" e "BOLSA AUXILIO" passam a ser mapeados para `horas`. Depois disso, redeploy da função.
- `FolhaForm.lancar`: antes do insert, consulta `despesas` pelo `fornecedor_id` e `categoria_id` (subcategoria pessoal), com `data_competencia` igual ao dia 05 do mês seguinte e `descricao ilike 'Salário%'`. Se encontrar, retorna o erro "Já lançado".
- Limpeza: `DELETE` dos ids duplicados, escolhidos por `row_number()` ordenado por `created_at` e agrupado por `fornecedor_id`, restrito a `created_at` de hoje e `data_competencia` 2026-09-05.
