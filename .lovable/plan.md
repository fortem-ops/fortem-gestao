# Aviso "Salvando… / Rascunho salvo" fixo em todos os métodos

## O que acontece
O aviso de salvamento aparece e some no topo do editor. Quando ele some, os botões do topo mudam de lugar e a página sobe e desce.

Métodos com o problema: 5-3-1, M102, Planilha 5RM, Foolproof, PTTP, PTTP 2, Mile Deep 1RM, Mile Deep 5RM, X-Fab e Easy Strength.
O Plan Strong 50 já foi corrigido antes. O Personalizado será conferido e ajustado se tiver o mesmo problema.

## O que será feito
- O aviso passa a ter sempre um espaço reservado no topo. Ele só fica visível ou invisível, sem empurrar nada.
- A largura do aviso fica fixa, então "Salvando…" e "Rascunho salvo" não mudam o tamanho do topo.
- Salvamento, publicação e conteúdo dos treinos continuam iguais.

## Detalhes técnicos
- Aplicar o mesmo padrão do `PrescricaoPlanStrongEditor.tsx` nos 10 editores: `<span>` sempre renderizado, com `opacity-0/100`, `aria-hidden`, `min-w-[130px] justify-end whitespace-nowrap`, e texto padrão quando vazio.
- `PersonalizadoEditor.tsx` (~linha 754): conferir se o status é condicional e aplicar o mesmo padrão se for.
- Só mudanças visuais. Conferência: build e teste visual adicionando um exercício no 5-3-1.
