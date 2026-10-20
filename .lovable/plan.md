# Jornada 3 Pix Automático — 3ª tentativa com o cadastro do dono

Cadastro escolhido pelo dono: Nicolas Squeff Janovik, aluno 590f4e74-8955-4104-a25c-3558100a98fe (o único ativo). Os outros três cadastros não serão usados nem alterados.

## Passos
1. Conferir somente leitura que o aluno 590f4e74 está ativo, tem CPF preenchido (só presença, sem exibir) e não tem recorrência Pix nem cobrança Pix aberta.
2. Registrar em system_logs a aprovação da 3ª tentativa, com o aluno novo, valor R$ 1,00, sem apagar os logs anteriores.
3. Ajustar o modo temporário só no aluno permitido: trocar NICOLAS TESTE por 590f4e74. Valor fixo R$ 1,00, uma tentativa, acesso só por chamada interna. A lógica do teste não muda. Publicar a função de novo.
4. Disparar uma única vez, com espera de até 60 segundos: cobrança imediata de R$ 1,00, depois a recorrência ligada a ela.
5. Devolver o copia e cola da jornada 3 para o dono pagar, o status da recorrência e o da cobrança, e o resumo do system_logs (CPF mascarado).
6. Se o Inter recusar alguma etapa, parar e informar o erro exato. Não haverá outra tentativa.

## Depois do teste
- A recorrência de R$ 1,00 (de 20/11/2026 a 20/12/2026) continua ativa até ser cancelada. Ela pode ser cancelada pela mesma via interna, sem cobrança, com aprovação.
- Nenhuma rotina automática cobra esse aluno: a recorrência 2027 só cobra as mensalidades dos planos, e a rotina antiga continua desligada.
- A conferência depois do pagamento só roda quando o dono avisar.
- Depois disso, recomendo remover o modo temporário, com aprovação.

## Fora do escopo
Telas, chaves de liga e desliga, checkout, cobrança no cartão, Planos 1 E4–E6, Plano 2 e dados de outros alunos. Não há mudança no banco.
