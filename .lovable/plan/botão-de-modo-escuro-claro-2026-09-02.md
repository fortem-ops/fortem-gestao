# Botão de modo escuro/claro

Adicionar um alternador de tema (claro / escuro / sistema) no cabeçalho do sistema interno.

## O que será feito

1. **Tokens do tema escuro**: hoje o `index.css` só define a paleta clara em `:root` (o Tailwind já está configurado com `darkMode: ["class"]`). Será criado um bloco `.dark` com a versão escura dos mesmos tokens (background, card, popover, muted, border, input, sidebar, etc.), mantendo o vermelho primário da marca e as cores de status.

2. **Provider de tema**: a dependência `next-themes` já está instalada. Envolver o app com o provider (atributo `class`, padrão "system", persistência automática no navegador).

3. **Botão no cabeçalho**: novo componente `ThemeToggle` (ícone sol/lua) posicionado no `<header>` de `AppLayout.tsx`, ao lado da busca global, com menu de três opções: Claro, Escuro, Sistema.

## Escopo preservado

- O Portal do Aluno (`[data-portal="true"]`) e a landing `/planos` têm temas próprios escopados no CSS e continuam inalterados.
- O mapa corporal e as escalas de severidade mantêm suas variáveis atuais.

## Arquivos afetados

- `src/index.css` (bloco `.dark`)
- `src/App.tsx` (provider)
- `src/components/ThemeToggle.tsx` (novo)
- `src/components/AppLayout.tsx` (botão no header)
