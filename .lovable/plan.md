# Créditos: renovação automática + acerto dos casos

## O que a investigação mostrou (importante antes de aprovar)

A rotina das 03:00 escolhe o pacote **pelo preço**. Quando o aluno tem preço negociado, ela cai na primeira variante mensal daquele plano — no Start, a de 2x/8 sessões.

Ao cruzar cada aluno com o pacote realmente vendido, o resultado muda a conclusão anterior:

- **11 dos 14** ("a menor" do Start) foram vendidos como **Start 2x = 8 sessões** desde a primeira venda, inclusive nas vendas feitas manualmente pela equipe (Andreza, Rafaela, Victoria, Jéssica). Pela regra que você confirmou — o pacote vendido é a verdade — **os 8 créditos estão certos** e quem está errado é a frequência 3x do cadastro (é ela que infla o "previsto" do contrato para 12).
- **2 casos são erro real da renovação**: Henrique (vendido VIP 3x = 12, renovado como VIP 1x = 4) e Lisane (vendido VIP livre/ilimitado, renovado como VIP 1x = 4).
- **1 caso precisa da sua decisão comercial**: Haroldo paga R$ 169 negociado, cadastro 5x, pacote vendido Start 2x/8. Não existe variante 5x no catálogo (Start vai até 3x/12 ou Livre).

Ou seja: creditar 12 para os 11 alunos do Start seria **dar sessões que não foram vendidas**. Por isso a lista abaixo separa o que é correção de erro do que é decisão comercial.

## 1. Correção da rotina de renovação (sem depender de preço)

Em `supabase/functions/renovar-planos-mensais/index.ts`, trocar a escolha da variante por, nesta ordem:

1. **Mesmo `catalogo_id` da última venda de plano do aluno** (identidade do pacote) — desde que a variante ainda esteja ativa e seja mensal.
2. Se não houver, variante do mesmo nome de plano com a **frequência** correspondente à do aluno.
3. Se não houver, registrar o plano na lista de erros do retorno **sem gerar venda** — melhor não renovar do que renovar com pacote errado.

O preço deixa de participar da escolha; o valor cobrado continua vindo do plano do aluno (preço negociado preservado).

## 2. "Créditos previstos" do contrato

Passar a exibir os créditos do **pacote vendido** (`planos_catalogo.quantidade_creditos` da venda vinculada), em vez de frequência do cadastro × 4. Onde não houver venda vinculada, manter o cálculo atual como reserva.

A sincronização da frequência do cadastro a partir do pacote vendido **não entra agora** — fica para sua decisão, como você pediu.

## 3. Ajustes de crédito propostos

Correções de erro comprovado da renovação (aplicar):

| Aluno | Crédito atual | Correto (pacote vendido) | Ajuste |
|---|---|---|---|
| Henrique Estivalet Schommer | 4 | 12 (VIP 3x) | +8 |
| Lisane Squeff Janovik | 4 | Ilimitado (VIP Livre) | virar ilimitado |

Sem ajuste de crédito (pacote vendido = 8; o que está errado é a frequência 3x do cadastro/contrato):
Andreza, Camila, Filipe, Gabriel, Jéssica, Priscila, Rafaela, Sara, Ubirajara, Victoria.

Aguardando sua decisão:
Haroldo (paga R$ 169, cadastro 5x, pacote Start 2x/8) — manter 8, subir para Start 3x/12, ou Start Livre?

Cada ajuste aprovado entra como movimento de crédito com observação de correção manual, sem apagar histórico.

## 4. Depois

Rodar `fn_auditoria_fiscal_creditos` e informar a contagem final por subtipo. Frederico e Paula ficam de fora, como combinado.
