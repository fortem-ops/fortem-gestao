# Renovação antecipada da Gabrielle (Corrida) — corrigir dados e tela

## O que encontrei no banco
- Plano atual: **Corrida - Sem Plano**, contrato ativo 05/12/2025 → 05/12/2026 (R$ 1.080, 6x) — correto.
- Renovação feita hoje (13:50): a **venda existe** (R$ 2.430, 10x crédito na máquina, pago, data da venda 21/08/2026) e gerou um registro de plano ativo, mas **nenhum contrato e nenhuma cobrança** foram criados. Por isso nada aparece em Cobranças/Contratos e o "Plano e Créditos" fica inconsistente.
- Há ainda **2 registros de plano soltos** (13:37 e 13:50, desativados) de tentativas anteriores, sem venda.
- O novo plano ficou com início em **21/08/2026** (data da venda), e não em 05/12/2026.

Causa provável (a confirmar no 1º passo): a criação do contrato falhou depois de a venda já ter sido gravada, e a tela não desfaz a venda quando isso acontece. Além disso, na Corrida a tela sempre trata a venda como "adicional, começa hoje" — não existe a opção de renovação com início no fim do plano atual.

## O que vou fazer
1. **Confirmar a falha**: repetir a criação do contrato com os dados dessa venda numa transação de teste (sem gravar) e registrar a mensagem de erro exata.
2. **Corrigir a venda da Gabrielle** (com sua confirmação dos valores):
   - criar o contrato novo de **05/12/2026 a 05/12/2027**, R$ 2.430 em 10x, já pago (máquina crédito), sem apagar o contrato atual;
   - o plano novo começa em 05/12/2026 e fica **em espera** até lá; os créditos/benefícios só valem a partir dessa data;
   - remover os 2 registros de plano soltos.
3. **Renovação antecipada na Corrida**: quando o aluno já tem Corrida vigente, a Nova Venda oferece "Renovação" com início sugerido no fim do plano atual (05/12), mantendo a data da venda retroativa separada da data de início.
4. **Venda sem sobras**: se o contrato não puder ser criado, a venda e o plano gerados são desfeitos e a mensagem de erro aparece na tela (vale para Corrida normal e retroativa).
5. **Exibição do contrato futuro**:
   - **Plano e Créditos**: mostra o plano atual até 05/12 e um aviso "Próximo plano: Corrida, a partir de 05/12/2026".
   - **Contratos** e **Cobranças**: o contrato novo aparece com selo **Aguarda início (05/12/2026)**, e suas cobranças pagas listadas normalmente.
6. Testes de regressão: renovação de Corrida começa no fim do plano vigente; falha no contrato não deixa venda/plano soltos; contrato futuro aparece como "aguarda início" e não substitui o plano atual. Rodar `bunx vitest run` e eslint nos arquivos alterados. Não publicar.

## Detalhes técnicos
- Dados: venda `6e54d3b3`, plano `861f0f1a`; soltos `0c1f7072`, `21d3f747`. Contrato vigente `e72d372e` intacto.
- Status de contrato futuro continua `ativo` com `data_inicio > hoje` (padrão já usado em 2 contratos); o selo é derivado da data. O plano principal continua resolvido por `fn_plano_principal_ativo` (validar com Gabrielle, caso de exceção "só Corrida").
- Desfazer venda: no `VendaDialog`, em erro do RPC, apagar a venda (o `fn_cleanup_on_venda_delete` limpa o plano criado pelo gatilho).
