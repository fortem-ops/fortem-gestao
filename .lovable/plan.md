# Lembrete de Ponto no Dashboard

## Resumo
Adicionar um banner/pop-up proeminente no topo da página Dashboard que lembre o usuário a bater o ponto, com base no estado atual da jornada dele. O banner será clicável, redirecionando para a tela `/ponto`.

## Componente: `src/components/ponto/LembretePontoBanner.tsx`
- Consulta `fn_ponto_estado_atual` via RPC (mesma query do `PontoWidget`).
- Consulta também o horário previsto do dia em `ponto_horarios_professor` para enriquecer a mensagem.
- Estados tratados:
  - `nao_iniciado` → banner amarelo/laranja: "Você ainda não bateu o ponto hoje". Se houver horário previsto, mostra "Jornada prevista: HH:mm – HH:mm". Botão "Bater ponto agora".
  - `em_intervalo` → banner azul: "Você está em intervalo. Lembre-se de voltar!". Botão "Encerrar intervalo".
  - `em_jornada` / `encerrada` / `nao_iniciou` → banner oculto.
- O banner terá um botão de dismiss (X) para fechar, guardando preferência em `localStorage` por 24h.
- Layout: banner horizontal com ícone de relógio, mensagem, horário previsto (se houver) e botão CTA. Cor de fundo e ícone variam conforme o estado.
- Usar tokens de cor do design system (`warning`, `info`, etc.).

## Integração
- Inserir `<LembretePontoBanner />` no topo do `src/pages/Dashboard.tsx`, logo abaixo do header e antes do conteúdo principal (`StatsCards`).
- O componente já filtra internamente: só renderiza algo quando o status justifica.

## Detalhes técnicos
- Reutilizar a query `fn_ponto_estado_atual` existente.
- Horário previsto: buscar `ponto_horarios_professor` com `dia_semana = new Date().getDay()` e `ativo = true`.
- Navegação via `useNavigate` do `react-router-dom`.
- Dismiss: chave no `localStorage` com timestamp; só reaparece após 24h ou se o estado mudar.
- Animação de entrada: `animate-fade-in` (classe Tailwind já existente no projeto).