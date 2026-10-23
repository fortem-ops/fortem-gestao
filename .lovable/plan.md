# Consultoria Online nos Planos 2027 (venda interna)

Somente plano. Nada de migração, código, dado ou publicação até o dono aprovar cada etapa.

## O que já existe (conferido no banco e no código)
- Catálogo 2027: famílias `start_2027` (só recorrência mensal, sem taxa, sem fidelidade), `power_2027` e `pro_2027` (anual em 12x/Pix ou recorrência mensal com taxa R$ 24,90 e fidelidade de 12 meses), com frequências 1x/2x/3x/Livre.
- Já existe um item **legado** "Consultoria Online - 6 meses" (R$ 774,00, sem versão, sem família). Ele continua como está, para o histórico; o novo plano é separado.
- O cálculo de valores 2027 (`calcularVenda2027`) só conhece "anual (até 12x)" e "mensal recorrente". Prazos de 4 e 6 meses ainda não existem.
- No app do aluno, a Agenda aparece no menu (`PortalLayout`), tem página própria (`/portal/agenda`) e a tela inicial mostra "Agendar treino"/"Remarcar" e o próximo agendamento.

## 1. Catálogo e tela de venda
- Nova família `consultoria_2027`, "Consultoria Online", atividade própria `consultoria_online` (não `treinamento_funcional`), para não entrar em contas de agenda, vagas e créditos de treino.
- 3 itens no catálogo (versão 2027), inicialmente **desligados** (`ativo=false`), visíveis só para aluno de teste:
  - Mensal: R$ 189,00/mês
  - 4 meses: total R$ 676,00 (R$ 169,00/mês), duração 4 meses
  - 6 meses: total R$ 894,00 (R$ 149,00/mês), duração 6 meses
- Coluna nova no catálogo: `duracao_meses` (nula = comportamento atual de 12 meses); Start/Power/Pro ficam nulos e não mudam.
- Seletor de Frequência: some quando o plano é Consultoria Online (fica gravado como "online", sem créditos). No lugar aparece o seletor **Duração: Mensal / 4 meses / 6 meses**.
- Resumo: mostra duração, valor mensal de referência, total e parcelas (ex.: "4x de R$ 169,00"), sem créditos, sem fixar horário, sem bota, sem reposição.

## 2. Pagamento (reaproveitando o que já existe)
- **4 e 6 meses**: cartão parcelado em até 4x / 6x ou Pix à vista. Usa a mesma divisão em centavos (sobra na última parcela), a mesma baixa manual e as mesmas cobranças de hoje. Sem taxa de recorrência.
- **Mensal**: duas opções para o dono escolher (pergunta 2):
  - (a) recorrência no cartão como o Start (renova mês a mês até cancelar, mesma rotina diária, retentativas D0/D+1/D+3), ou
  - (b) recorrência com fidelidade, como Power/Pro.
- Taxa de R$ 24,90: **não assumida**; decisão do dono (pergunta 3).
- Multa 2% + juros 1% a.m. e suspensão: iguais aos demais planos 2027, pelo mesmo cálculo.
- Multa de cancelamento antecipado nos pacotes de 4/6 meses: decisão do dono (pergunta 4).
- Desconto da equipe: funciona igual (`fn_venda_2027_criar`).
- Pix Automático: **fora**. A Consultoria não entra na lista `planos_pix_automatico_planos` e nada nas etapas P1–P8 muda.

## 3. Contrato
- Modelo novo em `contrato_templates` com `plano_tipo = consultoria_2027`, nas duas formas que já existem (`cartao_recorrencia` para Mensal e `cartao_parcelado` para 4/6 meses e Pix).
- Texto base: o do Start/Power adaptado, retirando agenda, créditos, frequência, reposição, licença e uso do espaço físico. Precisa incluir: entrega 100% online (treino no app), canal e prazo de resposta do professor, ajustes de treino, ausência de aula presencial, duração e renovação, cancelamento e multa, encargos por atraso, LGPD e saúde/aptidão (PAR-Q ou atestado).
- **Revisão do advogado obrigatória** antes de ativar: texto inteiro, cláusula de cancelamento, renovação automática do Mensal e responsabilidade por treino sem supervisão presencial.
- Até a aprovação do advogado, o modelo fica inativo e a venda não pode ser concluída (só simulação com aluno de teste).

## 4. App do aluno: sem agenda, com Treinos
- Identificação: o aluno é "somente consultoria" quando seu plano vigente (pelo `catalogo_id` do plano/contrato) é da família `consultoria_2027` e ele não tem outro plano presencial ativo. A regra fica no servidor (função nova `fn_aluno_somente_online`) e é usada pelo app.
- Esconder de verdade:
  - menu: some "Agenda";
  - `/portal/agenda` digitado direto: redireciona para Treinos com aviso curto;
  - tela inicial: some o bloco "Agendar treino"/"Remarcar"/próximo agendamento e entra um destaque para Treinos;
  - servidor: `fn_agendar_treino` e `fn_agendar_servico` recusam o agendamento por esse aluno (mensagem em PT), para não depender só da tela.
- Treinos: Meus Treinos, cargas e progresso continuam iguais (não dependem de agenda); conferido no teste.
- O que depende da agenda e precisa conferir: check-in facial (só confirma sessão agendada; sem agendamento não faz nada, então segue inofensivo), presenças, lembretes de agenda e notificações (sem agendamento, nada é enviado), calendário pessoal do aluno (o link some junto com a Agenda), Clube (pontos por presença: o aluno simplesmente não ganha esses pontos).
- Créditos e vagas: o plano nasce **sem créditos** (`quantidade_creditos=0`) e com atividade própria, então não ocupa vaga, não conta na capacidade do horário nem na carteira do professor presencial.
- Equipe ainda pode agendar uma avaliação para ele pelo painel? Pergunta 6.

## 5. Impactos em outras partes
- **/planos (site)**: fora. `fn_planos_publico_2027` e `fn_proposta_plano_2027_criar` passam a ignorar a família nova explicitamente (sem mudar o resto).
- **Rotina diária de recorrência 2027** e `fn_mensalidade_2027_validar`: só entram se o dono escolher Mensal recorrente; nesse caso a família nova é acrescentada às listas aceitas, sem mexer nas regras do cartão. Se o Mensal for como Start, o mesmo caminho de renovação (`fn_renovar_start_2027`) é estendido para a família nova.
- **Relatórios e previsibilidade**: aparecem como "Consultoria Online"; previsibilidade usa as parcelas/cobranças reais (4x, 6x ou mensais).
- **Comissões**: hoje dependem de avaliação presencial (mobilidade + força Kinology); Consultoria não gera comissão automática até o dono decidir (pergunta 7).
- **Agregadoras (Wellhub/TotalPass)**: sem relação; nada muda.
- **Clube**: nível padrão Bronze ou nenhum (pergunta 8).

## 6. Etapas (cada uma com aprovação separada)
1. **E1 – Banco (aditivo)**: coluna `duracao_meses`, família/atividade novas aceitas, 3 itens no catálogo desligados, `fn_aluno_somente_online`. Ensaio com ROLLBACK.
2. **E2 – Cálculo**: `calcularVenda2027` aceita pacote de N meses (até N parcelas); testes: 4x de 169,00 = 676,00; 6x de 149,00 = 894,00; 7x recusado; Start/Power/Pro com resultados idênticos aos atuais.
3. **E3 – Tela de venda**: opção "Consultoria Online", seletor de Duração, resumo; venda registrada só para NICOLAS TESTE, sem cobrar.
4. **E4 – Contrato**: modelo novo inativo, liberado só após o advogado.
5. **E5 – App do aluno**: menu, rota, tela inicial e bloqueio no servidor; teste no navegador com aluno de teste.
6. **E6 – Mensal recorrente** (só se aprovado): ligação com a rotina diária.
7. **E7 – Go-live**: ligar os 3 itens (`ativo=true`).

## Como testar sem pagamento real
- Só NICOLAS TESTE; vendas com baixa manual simulada ou ensaios com ROLLBACK; nenhum cartão/Pix real; nenhum e-mail ou WhatsApp real.
- App: entrar como aluno de teste, conferir menu, URL direta e Treinos.

## Como reverter
- Cada etapa com script de volta: desligar itens (`ativo=false`), restaurar versões anteriores das funções alteradas, esconder a opção na tela. As colunas novas ficam (sem uso) para não quebrar nada.

## O que NÃO será tocado
Start/Power/Pro e seus preços, item legado "Consultoria Online - 6 meses", funções de cartão, Pix Automático (P1–P8) e suas liberações, flags, crons de negócio (exceto E6 se aprovada), checkout /planos, dados reais.

## Riscos
- Aluno com Consultoria e outro plano presencial ao mesmo tempo: a regra só esconde a agenda se **não** houver plano presencial ativo.
- Prazo de 4/6 meses é novo no cálculo: coberto por testes que garantem os valores atuais de Start/Power/Pro.
- Contrato sem revisão: bloqueado até o advogado.

## Perguntas para o dono (com recomendação)
1. O plano aparece no site /planos? **Recomendo: não, só venda interna por enquanto.**
2. Mensal: renova mês a mês até cancelar (como Start) ou tem fidelidade? **Recomendo: como Start, sem fidelidade.**
3. Taxa de R$ 24,90 no Mensal? **Decisão sua; recomendo não cobrar (como Start).**
4. Cancelar antes do fim do pacote de 4/6 meses: multa? Qual %? **Recomendo: igual à regra de cancelamento dos anuais, proporcional ao restante.**
5. 4 e 6 meses: aceitar Pix à vista além do cartão? Renovam sozinhos ao final? **Recomendo: Pix à vista sim; sem renovação automática (equipe oferece renovar).**
6. A equipe pode agendar avaliação presencial para esse aluno pelo painel? **Recomendo: sim, só pela equipe, cobrada como serviço avulso.**
7. Gera comissão para o professor responsável? Qual regra? **Recomendo: não nesta fase; definir depois.**
8. Entra no Clube FORTEM? Em qual nível? **Recomendo: Bronze, sem pontos de presença.**
9. O app esconde também Clube/Loja/Carteirinha ou só a Agenda? **Recomendo: só a Agenda.**
10. Os 3 itens começam desligados até o contrato ser revisado? **Recomendo: sim.**
