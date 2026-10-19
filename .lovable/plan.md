# /corrida: Mensal de R$ 200 para quem treina só corrida

## O que muda
- Quem treina só corrida (sem plano na Fortem) passa a ver a opção **Mensal**, ao lado de Semestral e Anual. O valor de R$ 200/mês vem do cadastro ("Corrida - Sem Plano", 1 mês), sem valor fixo no código.
- O pagamento é no **cartão recorrente**, mês a mês, igual ao Mensal que quem não é aluno já tem hoje. O primeiro mês é cobrado na hora.
- **Pix Automático fica de fora por enquanto.** Entra depois, junto com o Plano 2, que continua pendente.
- O desconto da NB 42k segue só no Anual, como hoje.
- Alunos com plano (Start, Pro etc.) continuam sem Mensal.

## Detalhes técnicos
- `src/lib/corridaPreco.ts`: `periodoEfetivo` mantém o Mensal também para `somente_corrida` (as demais rotas continuam caindo para o Anual).
- `CorridaConfigurator.tsx`: mostrar o botão Mensal para `prospect` e `somente_corrida`.
- `supabase/functions/corrida-criar-pedido/index.ts`: aceitar `mensal` também para `somente_corrida`, com `cartao_recorrencia` e 1 parcela, seguindo o mesmo caminho do Mensal de quem não é aluno. Publicar só essa função.
- Antes de publicar, conferir na leitura do código que a cobrança mensal recorrente, o contrato (template de recorrência) e a renovação usados para quem não é aluno também servem para "Corrida - Sem Plano". Se algum faltar, parar e avisar antes de seguir.
- Testes: `periodoEfetivo("somente_corrida","mensal")` = mensal; `aluno` continua anual; o resumo do só corrida mensal soma R$ 200 hoje e R$ 200 recorrente.
- Nenhuma cobrança real; sem mexer em flags, Planos 1/2 nem contratos existentes.
