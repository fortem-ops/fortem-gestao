# Card "Inadimplentes" clicável com detalhes dos alunos

## Objetivo
Na página Financeiro > Contratos, permitir clicar no card de KPI "Inadimplentes" para ver quais alunos estão inadimplentes e as informações de pagamento (vencimento, valor, dias de atraso).

## O que será feito

### 1. Card clicável
- O card "Inadimplentes" (KPI com tom de alerta) passa a ser clicável (cursor de ponteiro, destaque ao passar o mouse).
- Os demais cards (Contratos ativos, Receita prevista, Renovações) permanecem como estão.

### 2. Janela de detalhes (dialog)
Ao clicar, abre uma janela listando cada inadimplência em aberto, usando os dados já carregados pela página (`useInadimplenciasAbertas` — mesma fonte do widget do Início, que já ignora cobranças pagas/canceladas/isentas):

Para cada item:
- Nome do aluno (link para o perfil, aba Contrato)
- Plano e forma de pagamento (selos)
- Data de vencimento da parcela
- Valor em aberto
- Dias de atraso

No topo da janela: total em aberto (soma dos valores), quantidade de parcelas e quantidade de alunos afetados.

Se não houver inadimplentes, a janela mostra "Nenhuma inadimplência em aberto".

## Detalhes técnicos
- Arquivo alterado: `src/pages/financeiro/Contratos.tsx` apenas.
- Nenhuma consulta nova ao banco: reutiliza `inadimplenciasAbertas` já carregado para o KPI.
- Componente `Kpi` ganha props opcionais `onClick`/`clickable`; quando presentes, o Card recebe `cursor-pointer` e `hover`.
- Novo `Dialog` "Inadimplentes" com a lista (mesmo padrão visual do widget do Início: selos de plano/forma, valor em vermelho, badge de dias de atraso).
- Sem mudanças em banco, RLS ou outras telas.

## Verificação
- Checar build sem erros.
- Conferir na tela: clicar no card abre a lista com os 3 inadimplentes atuais e seus valores/vencimentos.
