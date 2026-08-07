# Fim do "pula-pula" ao salvar automaticamente (Plan Strong 50)

## O problema
No editor Plan Strong 50, o indicador de salvamento ("Salvando…" / "Rascunho salvo") aparece e some no cabeçalho a cada alteração. Como o cabeçalho é uma linha que quebra automaticamente quando falta espaço, entrar e sair esse texto muda a altura do cabeçalho: todo o conteúdo abaixo desce e depois sobe — exatamente o "roll" percebido.

## O que será feito
1. O indicador de salvamento passa a ocupar sempre o mesmo espaço fixo no cabeçalho, mesmo quando não há nada a mostrar. Ele apenas aparece/desaparece visualmente (fade), sem empurrar nada.
2. O texto usa largura reservada, para que "Salvando…" e "Rascunho salvo" não mudem a largura do bloco.
3. O cabeçalho deixa de reorganizar seus botões por causa desse texto — os botões ficam na posição fixa.

Resultado: a página fica parada durante o salvamento automático; nada de scroll subindo/descendo.

## Detalhes técnicos
Arquivo: `src/components/student/workout/PrescricaoPlanStrongEditor.tsx`

- Renderizar o `<span>` do `savingLabel` sempre (sem `{savingLabel && ...}`), controlando visibilidade com `opacity-0/100` + `transition-opacity` e `aria-hidden` quando vazio.
- Aplicar `min-w-[130px] justify-end whitespace-nowrap` ao indicador para largura estável.
- Manter o container do cabeçalho sem quebra provocada pelo indicador (indicador dentro do grupo de ações, com espaço reservado).
- Nenhuma mudança na lógica de autosave, nas queries ou no conteúdo salvo.

Verificação: typecheck e conferência visual editando um campo e observando que o scroll não se move durante "Salvando… → Rascunho salvo".
