# Exibir anotações da Evolução na visualização

## Diagnóstico confirmado

O relatório selecionado possui duas sessões salvas no campo próprio `dados.sessoes`, ambas com texto e finalização registrados. Ao abrir o relatório, a janela usa o visualizador genérico, que lê apenas `dados.answers`; por isso mostra as perguntas antigas “SESSÃO 1–4” vazias. Ao clicar em **Editar**, entra o editor específico de Evolução, que lê `dados.sessoes`, e as anotações aparecem.

## Alteração proposta

- Criar uma visualização somente leitura específica para o protocolo **Reabilitação — EVOLUÇÃO**.
- Exibir cada sessão salva em ordem numérica, incluindo:
  - número da sessão;
  - data do atendimento, quando registrada;
  - texto completo da evolução, preservando quebras de linha;
  - data de registro e autor, quando disponíveis.
- Manter compatibilidade com registros antigos que ainda tenham sessões armazenadas nas perguntas do protocolo.
- Fazer a janela usar essa visualização específica quando não estiver em edição, mantendo o editor atual ao clicar em **Editar**.
- Não alterar os dados já salvos, o fluxo de edição, os anexos nem os demais tipos de relatório.

## Validação

- Conferir o relatório selecionado e confirmar que suas duas anotações aparecem sem clicar em **Editar**.
- Confirmar que **Editar**, anexos, fechamento e demais relatórios continuam funcionando.
- Executar as verificações de tipos e do aplicativo.

## Detalhes técnicos

A correção ficará restrita aos componentes de Reabilitação/Evolução e à decisão de renderização da janela de visualização. Nenhuma mudança no banco de dados é necessária.
