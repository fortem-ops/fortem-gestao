# /corrida: plano Anual em até 12x

## O que muda
Hoje o Anual é parcelável em até 12x só para quem não é aluno; para alunos (e "só corrida") o limite é 10x. Passa a ser **até 12x para todos no Anual**. O Semestral continua em até 6x e o Mensal continua como recorrência.

Os textos "em até Nx" do resumo e da etapa de pagamento passam a mostrar 12x automaticamente. Preços não mudam.

## Detalhes técnicos
- `src/lib/corridaPreco.ts` (`maxParcelasPeriodo`): anual retorna 12 em qualquer rota.
- `supabase/functions/corrida-criar-pedido/index.ts`: `maxParcelas` do servidor = 6 no semestral, 12 nos demais (a validação do pedido segue no servidor); publicar a função.
- Atualizar o teste em `corridaPreco.test.ts` que espera "10x" para "12x" e rodar os testes.
