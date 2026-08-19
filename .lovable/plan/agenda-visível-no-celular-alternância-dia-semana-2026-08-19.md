# Agenda visível no celular: alternância Dia / Semana

Hoje as duas grades semanais têm largura mínima fixa (900px na Agenda de Serviços, 820px na Agenda de Treinos) dentro de um container que não rola bem na horizontal no celular — por isso quinta e sexta ficam inacessíveis.

## Como vai ficar

- Um seletor **Dia | Semana** no topo das duas agendas.
- No celular, a agenda abre em **Dia** por padrão; no desktop continua em **Semana** por padrão. O usuário pode trocar a qualquer momento e a escolha vale para a sessão.
- **Modo Dia**: uma coluna só, com o dia selecionado no cabeçalho, setas ‹ › para avançar/voltar dia e botão "Hoje". Cada linha é um horário com os cards daquele dia, ocupando a largura toda da tela — nada cortado.
- **Modo Semana**: continua a grade de 7 colunas, agora com rolagem horizontal funcionando de verdade (arrastar com o dedo), então dá para chegar em quinta e sexta.
- Filtros, cliques para criar/editar, badges e cores permanecem exatamente iguais nos dois modos.

## Detalhes técnicos

`src/pages/Agenda.tsx`
- Novo estado `viewMode: "dia" | "semana"`, inicializado por `useIsMobile()` (dia no mobile).
- Extrair o corpo da grade para render que recebe a lista de dias: `["semana"] -> weekDates`, `["dia"] -> [weekDates[selectedDayIdx]]`.
- Colunas dinâmicas: `grid-cols-[70px_repeat(N,1fr)]`; `min-w-[900px]` só quando `N === 7`.
- Navegação de dia reaproveita `weekStart` (avançar além de domingo/segunda ajusta a semana).
- Trocar o wrapper por `ScrollArea` com `<ScrollBar orientation="horizontal" />` (shadcn) para o arraste lateral funcionar no modo semana.

`src/pages/AgendaTreinos.tsx`
- Mesmo padrão no componente `WeeklyGrid`: prop `days` (7 ou 1) e `min-w-[820px]` condicional; seletor Dia|Semana e setas de dia no cabeçalho da página.

Sem alterações de banco, de queries ou de regras de negócio — só apresentação.
