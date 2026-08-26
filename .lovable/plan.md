# Corrigir erro ao lançar "Consultoria Online - 6 meses"

## O que está acontecendo

O plano `Consultoria Online - 6 meses` foi criado hoje no catálogo (13:29 UTC, R$ 774,00, 6 meses, atividade "treinamento_funcional"). Porém a tabela de planos tem uma regra antiga que só aceita nomes de uma lista fixa:

Start, Start+, Power, Pro, Max, Gympass/Wellhub, Total Pass, VIP (e as variantes VIP Livre / VIP 1x a 7x/semana).

Como "Consultoria Online - 6 meses" não está nessa lista, o banco recusa o lançamento com o erro `planos_tipo_check`. Ou seja: qualquer plano novo cadastrado no catálogo hoje falha no momento da venda — não é um problema específico da Talitha.

## Correção proposta

Trocar a lista fixa por uma validação dinâmica: o nome do plano passa a ser aceito se existir no catálogo de planos (mesma atividade), incluindo variantes de frequência do VIP.

- Remover a regra fixa `planos_tipo_check`.
- Criar uma validação equivalente que consulta o catálogo, aceitando:
  - nome exatamente igual a um item do catálogo da mesma atividade (ativo ou inativo, para não invalidar histórico);
  - nomes derivados como "VIP 3x/semana" (prefixo de um item do catálogo);
  - os nomes legados da lista atual, para não bloquear planos antigos já registrados.

Resultado: continua havendo proteção contra digitação errada, e todo plano criado no catálogo funciona automaticamente, sem precisar de ajuste técnico a cada novo produto.

Depois disso, o lançamento do plano da Talitha pode ser repetido normalmente pela tela de venda.

## Detalhes técnicos

- Migração: `ALTER TABLE public.planos DROP CONSTRAINT planos_tipo_check;`
- Nova função `public.fn_planos_validar_tipo()` (SECURITY DEFINER, `search_path = public`) + trigger `BEFORE INSERT OR UPDATE OF tipo, atividade ON public.planos`:
  - passa se `EXISTS (SELECT 1 FROM planos_catalogo c WHERE c.atividade = NEW.atividade AND (NEW.tipo = c.nome OR NEW.tipo LIKE c.nome || ' %'))`;
  - passa também se `NEW.tipo` estiver na lista legada (Start, Start+, Power, Pro, Max, Gympass/Wellhub, Total Pass, VIP*);
  - caso contrário `RAISE EXCEPTION` com mensagem em PT-BR citando o valor recebido.
- `planos_atividade_check` permanece como está.
- Nenhuma alteração de frontend é necessária; nenhum dado existente é modificado.

## Verificação

- Rodar a suíte de testes (deve seguir passando).
- Conferir por consulta que nenhum registro atual de `planos` seria rejeitado pela nova regra antes de aplicar o trigger.
- Após a migração, lançar novamente o plano de consultoria para a Talitha e confirmar criação de plano, contrato e cobrança.
