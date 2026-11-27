# Configurações do App no portal do aluno

## O que muda para o aluno
- No menu lateral do portal, entre "Conquistas" e "Sair", entra o item **Configurações do App**.
- Ele abre uma tela simples (`/portal/configuracoes`) com a opção **Aparência**: dois botões lado a lado, **Escuro** (padrão atual) e **Claro**. A troca é imediata, sem recarregar.
- A escolha fica lembrada no aparelho; quem nunca mexer continua vendo o portal escuro como hoje.
- Só o portal do aluno muda. Painel da equipe, site público e /planos ficam iguais.

## Visual da versão clara
Mantém a identidade do portal (Archivo, cantos retos, filetes de 1px, sem sombras, rótulos em caixa alta), trocando apenas as cores:
- Fundo #F5F5F5, cartões #FFFFFF, filetes #D4D5D5, texto principal #141414, rótulos #5C5E5E.
- Vermelho do botão primário (#C8282A) e da cantoneira (#E73C3E) iguais.
- Em dia e atenção escurecidos para leitura no fundo claro (#1F8A57 e #A87A12).

## Detalhes técnicos
- `src/index.css`: novo bloco `[data-portal="true"][data-portal-tema="claro"]` sobrescrevendo as variáveis (background, card, border, muted etc.) e `color-scheme: light`.
- O portal usa ~400 cores fixas em classes (`text-[#B1B3B3]`, `border-[#4A4B4B]`, `bg-[#1A1A1A]`, `bg-[#2C2C2C]`, `bg-[#0E0E0E]`, `text-[#F0F0F0]`, `hover:bg-[#1a1a1a]`, `text-[#E3B341]`, `text-[#4CC38A]`). Em vez de reescrever dezenas de arquivos, o bloco claro remapeia essas classes por seletor de atributo dentro do escopo do portal. Nada muda no tema escuro.
- Novo hook `usePortalTema` (localStorage `fortem_portal_tema`, valores `escuro|claro`, sincroniza entre abas) aplicado em `PortalLayout` no elemento raiz do portal e no menu (Sheet), que é renderizado fora da árvore.
- Nova página `src/pages/portal/PortalConfiguracoes.tsx` e rota dentro do layout do portal; item no menu com ícone `Settings`.
- Teste: hook lê/grava o valor, valor inválido cai em `escuro`.
- Conferência no celular (390px) com Playwright nas telas Início, Agenda e menu, nos dois temas; vitest + eslint dos arquivos alterados.
- Requer Publish para chegar aos alunos.
