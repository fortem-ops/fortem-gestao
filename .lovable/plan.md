## Objetivo

Automatizar o fluxo de comissionamento do Treino Experimental: a tarefa do professor é gerada no agendamento, é concluída automaticamente quando ele salva o relatório/avaliação, e o pagamento de R$30 é aprovado automaticamente quando ocorre conversão + relatório concluído. Adicionar colunas Professor e Aluno no Histórico.

## O que já existe (não muda)

- `trg_comissao_agenda_insert`: ao agendar `Treino Experimental` em `agenda_servicos`, já cria a pendência `avaliar_experimental` para o `profissional_id` da agenda. ✅
- `fn_tentar_comissao_experimental`: só gera a comissão quando existe uma venda paga (conversão). ✅

## Mudanças no banco (migração)

1. **Novo trigger em `avaliacoes`** (AFTER INSERT, quando `tipo = 'experimental'`):
   - Localiza a pendência `avaliar_experimental` em aberto do mesmo `aluno_id` (mais recente).
   - Marca `concluido = true`, `concluido_em = now()`, `responsavel_id = NEW.avaliador_id`.
   - Isso reaproveita o `trg_comissao_pendencia_concluida` existente, que dispara `fn_tentar_comissao_experimental` (gera comissão se já houve conversão).

2. **Ajustar `fn_tentar_comissao_experimental`**: após gerar a comissão via `fn_gerar_comissao`, atualizar imediatamente seu status para `'aprovado'` (aprovação automática — não precisa passar por "pendente").

3. **Idempotência**: se o relatório for salvo antes da conversão, a pendência fica concluída e a comissão não é criada (não existe venda paga). Quando a venda paga acontecer, `trg_comissao_venda_paga` precisa também tentar gerar a comissão do experimental — verificar se já faz; se não, complementar para que a conversão posterior dispare `fn_tentar_comissao_experimental` quando já houver avaliação experimental concluída do aluno.

## Mudanças no frontend

**`src/pages/Comissionamentos.tsx`**

1. **Aba Pendências**: filtrar `avaliar_experimental` da lista (a conclusão agora é automática, então não deve aparecer mais).

2. **Histórico — `ComissoesTable`**: adicionar colunas **Professor** e **Aluno**.
   - Carregar mapas `profMap` e `alunoMap` (já existem no `AdminListagem`) para reuso na aba Histórico.
   - Renderizar `profMap[c.profissional_id]` e `alunoMap[c.aluno_id]` como novas colunas após Data.

## Fora de escopo

- Não mexe na UI de criação de agenda (já dispara o trigger).
- Não muda a UI da Avaliação Experimental (já insere em `avaliacoes` com `tipo='experimental'`).
- Sem mudanças em RLS — políticas atuais cobrem os fluxos.
