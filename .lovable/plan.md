# Consultoria Online nos Planos 2027 — plano revisado

Somente plano. Nada de migração, código, dado ou publicação. Cada etapa tem aprovação separada.

## Decisões do dono (registradas)
- Venda só interna (Perfil do aluno > Nova Venda > Planos 2027). Não aparece em /planos.
- Mensal R$ 189,00: recorrência no cartão igual ao Start (renova mês a mês até cancelar, sem fidelidade, sem taxa de R$ 24,90, retentativas D0/D+1/D+3).
- 4 meses R$ 676,00 (até 4x ou Pix à vista) e 6 meses R$ 894,00 (até 6x ou Pix à vista); sem recorrência, sem renovação automática.
- Desconto sobre o plano permitido nas três durações.
- Sem contrato por enquanto; sem multa de cancelamento; sem comissão.
- App: esconder só a Agenda; Treinos, Clube, Loja e Carteirinha continuam. Equipe pode agendar avaliação pelo painel.
- Itens nascem desligados (`ativo=false`) até o dono mandar ligar.
- Pix Automático fora; a família nova só poderá entrar em `planos_pix_automatico_planos` no futuro, sem mudança agora.

## O que foi conferido no sistema
- `fn_venda_2027_gravar` cria a venda, o plano do aluno, o registro financeiro em `contratos` (que guarda vigência e cobranças) e as cobranças. Ele **não** lê `contrato_templates` nem cria documento.
- O documento do contrato (PDF/aceite em `contratos_documentos`) é gerado **depois**, pela tela (`gerarDocumentoContrato`, a partir do `contrato_id` devolvido). Se não houver modelo, hoje a tela trata como "contrato não gerado" (`contratoOk=false`), sem desfazer a venda.
- `fn_mensalidade_2027_validar` confere o `contrato_id` da mensalidade (registro financeiro), não o documento.
- `fn_renovar_start_2027`, `fn_planos_publico_2027`, `fn_proposta_plano_2027_criar`, `fn_venda_2027_criar` e `fn_creditos_mensais_2027` escolhem comportamento pela família (`start_2027` etc.).
- Item legado "Consultoria Online - 6 meses" (R$ 774,00, sem versão, sem família) existe e segue a lógica antiga por nome.

## Como fica a venda "sem contrato" (caminho mais simples e seguro)
- O registro financeiro em `contratos` **continua sendo criado**, como em toda venda: ele não é um contrato jurídico, é o que liga plano, vigência, cobranças, mensalidades e estorno. Não é contrato falso; sem ele cobranças, recorrência e relatórios quebram.
- O que **não** acontece para a família nova: nenhum documento, PDF, link de assinatura, aceite ou e-mail de contrato. A tela pula `gerarDocumentoContrato` quando a família é `consultoria_2027` e mostra "Venda registrada (plano sem contrato)", em vez do aviso de falha.
- No perfil e no app, o contrato aparece como "Sem documento de contrato" (não como "pendente de assinatura"), para não gerar cobrança de assinatura pela equipe.
- Ativação do aluno: igual às outras vendas (pelo plano e pelas cobranças), sem depender de documento.
- Para quando houver contrato: criar modelos em `contrato_templates` com `plano_tipo = consultoria_2027` (recorrência e parcelado), retirar o desvio da tela e gerar o documento das vendas já feitas pelo botão de gerar contrato que a equipe já usa.

## 1. Catálogo e tela de venda
- Família nova `consultoria_2027`, atividade `consultoria_online`, nome "Consultoria Online", `versao=2027`, sem créditos, sem fixar horário, sem bota, sem reposição, sem licença.
- Coluna nova `duracao_meses` no catálogo (nula = comportamento atual). Itens:
  - Mensal: `recorrencia_mensal`, R$ 189,00, taxa 0, fidelidade 0.
  - 4 meses: `pacote`, R$ 676,00, `duracao_meses=4`, máx. 4 parcelas.
  - 6 meses: `pacote`, R$ 894,00, `duracao_meses=6`, máx. 6 parcelas.
- O nome do novo é sempre "Consultoria Online" com família; o legado não tem família nem versão, então o filtro dos 2027 (`versao` não nula) nunca o mostra e o filtro legado (`versao` nula) nunca mostra o novo.
- Tela: seletor Frequência some; entra Duração (Mensal / 4 meses / 6 meses). Resumo mostra total, parcelas e "sem contrato".

## 2. Cálculo (centavos, com e sem desconto)
- `calcularVenda2027` ganha o caso "pacote de N meses": total = valor − desconto, dividido em até N parcelas, sobra na última. Mensal da Consultoria usa o caminho do Start (1 cobrança por ciclo, sem taxa).
- Desconto: não pode ser negativo nem ≥ valor (já é assim hoje para Start/Power/Pro); validação repetida no servidor em `fn_venda_2027_criar`.
- Testes novos (exemplos):
  - 4 meses 4x sem desconto: 4 × 169,00 = 676,00.
  - 6 meses 6x sem desconto: 6 × 149,00 = 894,00.
  - 6 meses com desconto R$ 10,00 em 6x: 884,00 → 5 × 147,33 + 147,35.
  - 4 meses com desconto R$ 0,01 em 3x: 675,99 → 225,33 + 225,33 + 225,33.
  - 5x no pacote de 4 meses → recusado; 7x no de 6 → recusado.
  - Desconto = valor ou maior → recusado; negativo → recusado.
  - Mensal R$ 189,00 com desconto R$ 20,00 → 1ª cobrança 169,00.
  - Start/Power/Pro: resultados idênticos aos atuais (testes existentes seguem passando).
- Desconto nas renovações do Mensal: mesma pergunta do Start ("só no 1º mês" ou "todos os meses", `planos.desconto_recorrente`).

## 3. Servidor (mínimo, aditivo)
- `fn_venda_2027_gravar` / `fn_venda_2027_criar`: aceitar `consultoria_2027`; pacote cria vigência de N meses e N parcelas; Mensal cria um ciclo como o Start.
- `fn_renovar_start_2027`: incluir `consultoria_2027` na mesma regra de renovação mensal (sem mexer no Start).
- Rotina diária da recorrência e `fn_mensalidade_2027_validar`: aceitam a família nova com as regras do Start; nenhuma regra do cartão muda.
- `fn_creditos_mensais_2027`: família nova não recebe créditos (confirmar por teste).
- `fn_planos_publico_2027` e `fn_proposta_plano_2027_criar`: ignorar explicitamente `consultoria_2027` (o site nunca mostra nem aceita).
- Agendamento: `fn_agendar_treino` (e serviços pelo aluno) recusa quem é "somente online"; agendamento pela equipe continua permitido.
- Função nova `fn_aluno_somente_online(aluno)`: verdadeiro quando o plano principal ativo (`fn_plano_principal_ativo`) é `consultoria_2027` **e** não há outro plano presencial ativo.
- Comissão: família nova fora das regras automáticas.

## 4. App do aluno
- Menu: some "Agenda" quando `fn_aluno_somente_online` = verdadeiro.
- `/portal/agenda` por URL direta: volta para Treinos com aviso curto.
- Tela inicial: somem "Agendar treino", "Remarcar" e próximo agendamento; entra destaque para Treinos.
- Servidor recusa o agendamento pelo aluno (não depende só da tela).
- Treinos, Clube, Loja, Carteirinha: sem mudança. Check-in facial sem agendamento não faz nada; lembretes de agenda não disparam sem agendamento; sem créditos, não ocupa vaga nem capacidade.
- Aluno com Consultoria **e** plano presencial: Agenda continua visível e funcionando normalmente (a regra exige ausência de plano presencial); a Consultoria aparece como plano adicional.

## Etapas (cada uma com aprovação)
1. **E1 – Banco aditivo**: coluna `duracao_meses`, família/atividade aceitas, 3 itens desligados, `fn_aluno_somente_online`. Ensaio com ROLLBACK.
2. **E2 – Cálculo**: `calcularVenda2027` + testes acima.
3. **E3 – Venda no servidor**: `fn_venda_2027_gravar/criar`, renovação mensal, exclusão do site, sem créditos. Ensaio com ROLLBACK no NICOLAS TESTE (Mensal, 4x, 6x, Pix, com e sem desconto) conferindo parcelas e total ao centavo.
4. **E4 – Tela de venda**: opção, Duração, resumo, "sem contrato". Venda de teste só no NICOLAS TESTE com baixa simulada.
5. **E5 – App do aluno**: menu, rota, tela inicial, bloqueio no servidor. Teste no navegador com aluno de teste (só Consultoria, e Consultoria + presencial).
6. **E6 – Ligar os itens** (`ativo=true`), quando o dono mandar.

## Testes sem pagamento real
Só NICOLAS TESTE ou ensaios com ROLLBACK; nenhum cartão ou Pix real; nenhum e-mail/WhatsApp real; recorrência conferida com a rotina em modo simulação.

## Rollback
- E1/E3: scripts de volta restauram as versões anteriores das funções e desligam os itens; colunas novas ficam sem uso.
- E2/E4/E5: reverter o código; itens desligados escondem a opção.

## O que NÃO será tocado
Start/Power/Pro e preços, item legado "Consultoria Online - 6 meses", funções de cobrança do cartão, Pix Automático (P2–P8) e liberações, flags, checkout /planos, modelos de contrato existentes, crons de negócio além do caminho mensal já usado pelo Start, dados reais.

## Riscos
- Família nova num lugar que lista famílias fixas e não foi visto: mitigado pelo levantamento em E3 de todas as funções que citam `start_2027`.
- Venda sem documento contestada depois: fica registrada como "sem contrato" até o modelo existir.

## Perguntas que restam (com recomendação)
1. Quando o contrato existir, gerar documento para quem já comprou? **Recomendo: sim, pelo botão já existente, com aceite do aluno.**
2. No fim do pacote de 4/6 meses, o que acontece com o acesso ao app? **Recomendo: plano encerra na data final e a equipe recebe aviso 7 dias antes para oferecer renovação.**
3. Cancelamento do Mensal: vale a regra do Start (sem multa, encerra no fim do ciclo pago)? **Recomendo: sim.**
4. Aluno de Consultoria entra no Clube em qual nível? **Recomendo: Bronze, sem pontos de presença.**
