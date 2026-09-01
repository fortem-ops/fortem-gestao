# Corrigir aba Frequência que não abre

## Causa confirmada

No perfil do aluno, a aba ativa é controlada pelo parâmetro `?tab=` da URL e validada contra uma lista fixa de abas permitidas. Essa lista não inclui `frequencia`. Ao clicar em "Frequência", a URL muda, a validação rejeita o valor e a tela volta imediatamente para "Resumo" — por isso a aba parece não abrir.

O conteúdo da aba (componente de frequência) já está corretamente montado; o problema é só a validação.

## Correção

Incluir `frequencia` na lista de abas válidas em `src/pages/StudentProfile.tsx`, na posição logo após `treinos`, mantendo a ordem igual à exibida na barra de abas.

Nenhuma outra mudança: sem alteração de lógica de negócio, banco ou do componente de frequência.

## Verificação

- Abrir o perfil de uma aluna com histórico (ex.: Bruna Meyer), clicar em "Frequência" e confirmar que a tabela carrega e a URL permanece em `?tab=frequencia`.
- Recarregar a página com `?tab=frequencia` e confirmar que a aba continua selecionada.
