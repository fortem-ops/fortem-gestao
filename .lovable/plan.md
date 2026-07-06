
# Migração para `funcional_v2` (Avaliações Premium)

## Contexto

Hoje o comissionamento de avaliação funcional depende de dois tipos separados (`funcional` + `forca`, opcionalmente com anexo em `avaliacao_anexos` quando o protocolo tem `permite_upload=true`). O novo fluxo Avaliações Premium grava **um único registro** em `avaliacoes` com `tipo='funcional_v2'`, contendo `dados.metricas` (mobilidade/flexibilidade) e opcionalmente `dados.forca.exercicios` (Kinology importado ou preenchimento manual). A comissão deve ser gerada apenas quando **as duas partes** estiverem presentes na mesma linha.

Registros legados (`funcional`, `forca`) permanecem intocados — só o comportamento de novos inserts/updates muda.

---

## (a) Ordem de execução recomendada

1. **Migration SQL** — atualizar `trg_comissao_avaliacao_insert` + adicionar variante para UPDATE, reconhecendo `funcional_v2` com regra de completude.
2. **Front — `useAlunoAvaliacoesConsolidadas.ts`** — incluir `funcional_v2` no filtro `funcRows`.
3. **QA manual** com o checklist da seção (e).
4. *(Opcional, item separado)* Trava de duplicidade por ciclo — ver seção "Item opcional".

A migration vem primeiro porque o gatilho é o ponto mais frágil (silenciosamente deixa de gerar comissões); com ela pronta, a mudança de front apenas passa a exibir dados que já são gravados corretamente.

---

## (b) Arquivos tocados

- **Nova migration** `supabase/migrations/<timestamp>_funcional_v2_comissao.sql` — redefine a função `trg_comissao_avaliacao_insert()` e cria a função/trigger de UPDATE.
- **`src/components/avaliacoes-premium/useAlunoAvaliacoesConsolidadas.ts`** — 1 linha no filtro `funcRows`.

Não tocar:
- `trg_comissao_agenda_insert` — o texto "Avaliação Funcional" da agenda continua abrindo a mesma pendência `concluir_avaliacao_funcional`, e o novo trigger continua fechando essa mesma pendência.
- `trg_comissao_anexo_insert` — mantido para registros legados com protocolo `permite_upload=true`. Como o novo fluxo não usa `avaliacao_anexos`, ele nunca vai disparar para `funcional_v2`.
- `trg_aval_reavaliacao_4m` — já usa `LIKE '%funcional%'`, cobre `funcional_v2` automaticamente.
- `comissionamento_config` — o enum `avaliacao_funcional` já é o correto; nada muda ali.
- Formulário `FuncionalV2Assessment.tsx` — hoje faz sempre um único INSERT com tudo. Mantém como está (mas o trigger novo já cobre o cenário de UPDATE futuro, caso passe a existir edição).

---

## (c) Migration SQL proposta

```sql
-- Redefine trigger de INSERT: reconhece funcional_v2 e só comissiona se completo
CREATE OR REPLACE FUNCTION public.trg_comissao_avaliacao_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _permite_upload boolean := false;
  _aluno_nome text;
  _agenda_id uuid;
  _profissional uuid;
  _is_v2 boolean := (NEW.tipo = 'funcional_v2');
  _tem_metricas boolean := false;
  _tem_forca boolean := false;
BEGIN
  IF NEW.tipo NOT IN ('funcional','forca','funcional_v2') THEN
    RETURN NEW;
  END IF;

  SELECT nome INTO _aluno_nome FROM public.alunos WHERE id = NEW.aluno_id;

  IF _is_v2 THEN
    _tem_metricas := jsonb_typeof(NEW.dados->'metricas') = 'array'
                     AND jsonb_array_length(NEW.dados->'metricas') > 0;
    _tem_forca    := jsonb_typeof(NEW.dados->'forca'->'exercicios') = 'array'
                     AND jsonb_array_length(NEW.dados->'forca'->'exercicios') > 0;
  ELSE
    IF NEW.protocolo_id IS NOT NULL THEN
      SELECT permite_upload INTO _permite_upload
      FROM public.avaliacao_protocolos WHERE id = NEW.protocolo_id;
    END IF;
  END IF;

  -- Fecha a pendência aberta assim que qualquer parte da avaliação chega
  UPDATE public.comissionamento_pendencias
  SET concluido = true, concluido_em = now(),
      responsavel_id = NEW.avaliador_id, avaliacao_id = NEW.id
  WHERE id = (
    SELECT id FROM public.comissionamento_pendencias
    WHERE aluno_id = NEW.aluno_id
      AND tipo_pendencia = 'concluir_avaliacao_funcional'
      AND concluido = false
    ORDER BY created_at DESC LIMIT 1
  )
  RETURNING agenda_id, profissional_id INTO _agenda_id, _profissional;

  IF _profissional IS NULL OR public.has_role(_profissional, 'admin') THEN
    _profissional := public.fn_resolver_prof_avaliacao(NEW.aluno_id, NEW.data, NEW.avaliador_id);
  END IF;

  IF _profissional IS NULL THEN
    INSERT INTO public.comissionamento_pendencias
      (profissional_id, aluno_id, tipo_pendencia, descricao, avaliacao_id, agenda_id)
    VALUES (COALESCE(NEW.avaliador_id, NEW.aluno_id), NEW.aluno_id,
      'concluir_avaliacao_funcional',
      'Sem profissional vinculado — revisar atribuição', NEW.id, _agenda_id)
    ON CONFLICT DO NOTHING;
    RETURN NEW;
  END IF;

  IF _is_v2 THEN
    -- Só comissiona quando mobilidade + força estão no mesmo registro
    IF _tem_metricas AND _tem_forca THEN
      PERFORM public.fn_gerar_comissao(
        'avaliacao_funcional', _profissional, NEW.aluno_id,
        'avaliacoes', NEW.id, 'Avaliação funcional v2 concluída'
      );
    END IF;
    -- Se faltar alguma parte, NADA é feito além de fechar a pendência da agenda;
    -- a comissão será gerada pelo trigger de UPDATE quando a parte que falta chegar.
  ELSIF COALESCE(_permite_upload, false) THEN
    INSERT INTO public.comissionamento_pendencias
      (profissional_id, aluno_id, tipo_pendencia, descricao, avaliacao_id, agenda_id)
    VALUES (_profissional, NEW.aluno_id, 'upload_arquivo_forca',
      'Upload de arquivo da avaliação de ' || COALESCE(_aluno_nome,''), NEW.id, _agenda_id)
    ON CONFLICT DO NOTHING;
  ELSE
    PERFORM public.fn_gerar_comissao(
      'avaliacao_funcional', _profissional, NEW.aluno_id,
      'avaliacoes', NEW.id, 'Avaliação funcional concluída'
    );
  END IF;

  RETURN NEW;
END $function$;

-- Novo trigger de UPDATE: gera comissão quando funcional_v2 fica completo
CREATE OR REPLACE FUNCTION public.trg_comissao_avaliacao_v2_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _old_completo boolean;
  _new_completo boolean;
  _profissional uuid;
  _ja_existe boolean;
BEGIN
  IF NEW.tipo <> 'funcional_v2' THEN RETURN NEW; END IF;

  _old_completo :=
       jsonb_typeof(OLD.dados->'metricas') = 'array'
       AND jsonb_array_length(OLD.dados->'metricas') > 0
       AND jsonb_typeof(OLD.dados->'forca'->'exercicios') = 'array'
       AND jsonb_array_length(OLD.dados->'forca'->'exercicios') > 0;

  _new_completo :=
       jsonb_typeof(NEW.dados->'metricas') = 'array'
       AND jsonb_array_length(NEW.dados->'metricas') > 0
       AND jsonb_typeof(NEW.dados->'forca'->'exercicios') = 'array'
       AND jsonb_array_length(NEW.dados->'forca'->'exercicios') > 0;

  IF _old_completo OR NOT _new_completo THEN
    RETURN NEW; -- nada a fazer (já completo antes, ou ainda incompleto)
  END IF;

  -- Idempotência: se já existe comissão dessa avaliação, não duplica
  SELECT EXISTS (
    SELECT 1 FROM public.comissionamentos
    WHERE origem_tabela = 'avaliacoes' AND origem_id = NEW.id
      AND tipo = 'avaliacao_funcional'
  ) INTO _ja_existe;
  IF _ja_existe THEN RETURN NEW; END IF;

  _profissional := public.fn_resolver_prof_avaliacao(NEW.aluno_id, NEW.data, NEW.avaliador_id);
  IF _profissional IS NULL THEN RETURN NEW; END IF;

  PERFORM public.fn_gerar_comissao(
    'avaliacao_funcional', _profissional, NEW.aluno_id,
    'avaliacoes', NEW.id, 'Avaliação funcional v2 completada em update'
  );
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_comissao_avaliacao_v2_update ON public.avaliacoes;
CREATE TRIGGER trg_comissao_avaliacao_v2_update
AFTER UPDATE OF dados ON public.avaliacoes
FOR EACH ROW EXECUTE FUNCTION public.trg_comissao_avaliacao_v2_update();
```

**Alteração no front (bloco único):**

```ts
const funcRows = rows.filter(
  (r) => r.tipo === "funcional" || r.tipo === "kinology" || r.tipo === "funcional_v2",
);
```

---

## (d) Riscos

1. **Silencioso não gerar comissão** — se o profissional salvar `funcional_v2` só com mobilidade, a pendência da agenda **fecha** mas a comissão não é criada. Sem visibilidade, pode passar batido. *Mitigação:* documentar no checklist e considerar (em item futuro) uma flag/relatório de "avaliações v2 incompletas".
2. **UPDATE dependente de `AFTER UPDATE OF dados`** — se algum código futuro sobrescrever `dados` retirando a parte de força, o trigger corretamente não regenera (idempotência), mas também não "desfaz" a comissão já gerada. Comportamento aceito (mesma semântica do fluxo antigo).
3. **`fn_gerar_comissao` tem `ON CONFLICT DO NOTHING`**, mas o conflito depende da UNIQUE existente. Confirmar no momento da migration se há UNIQUE em `(origem_tabela, origem_id, tipo)` — o `EXISTS` explícito no trigger de UPDATE já protege independentemente disso.
4. **Registros legados** (`funcional` / `forca` isolados) continuam funcionando exatamente como hoje, inclusive o caminho de `upload_arquivo_forca` + `trg_comissao_anexo_insert`. Nenhum risco de regressão.
5. **Fluxo Kinology via IA** — grava tudo em um INSERT (mesmo caminho de `handleSave`), portanto passa direto pelo caminho de INSERT completo. O trigger de UPDATE é seguro adicional para o dia em que o formulário permitir edição.
6. **Trigger `AFTER UPDATE OF dados`** dispara em qualquer alteração no JSONB (ex: adição de campo cosmético). A guarda `_old_completo OR NOT _new_completo` evita reação; ainda assim recomendo revisar se algum job/back-office atualiza `dados` em massa.

---

## Item opcional — trava de duplicidade por ciclo

**Situação atual:** não há UNIQUE nem lógica em `fn_gerar_comissao` que impeça duas comissões `avaliacao_funcional` para o mesmo aluno/profissional dentro do mesmo `ciclo_credito`. Hoje isso é limitado *de facto* porque a pendência é aberta pela agenda e fechada ao inserir a avaliação — quem "burla" precisa ter duas ocorrências na agenda no mesmo ciclo.

**Risco real:** baixo hoje, porém cresce após esta migração, porque `funcional_v2` pode ser inserido sem depender da pendência da agenda (o INSERT gera comissão diretamente quando completo). Um profissional poderia registrar duas avaliações completas no mesmo mês.

**Sugestão (não decidir agora):** adicionar uma UNIQUE PARCIAL em `comissionamentos`:

```sql
-- (proposta, para discussão — NÃO incluir na migration principal)
CREATE UNIQUE INDEX comissionamentos_uniq_funcional_ciclo
ON public.comissionamentos (profissional_id, aluno_id, date_trunc('month', data_referencia))
WHERE tipo = 'avaliacao_funcional' AND status <> 'cancelado';
```

Alternativa mais forte: buscar o `ciclo_credito` vigente do aluno e chavear a UNIQUE por `ciclo_id`. Requer alterar `fn_gerar_comissao` para popular esse campo.

Decisão fica com o cliente — recomendo tratar em uma segunda migration depois de confirmarmos que ninguém depende de comissões duplicadas em recuperação de erro.

---

## (e) Checklist de teste manual

**Setup:** um aluno de teste com plano ativo e agenda de "Avaliação Funcional" já lançada, gerando pendência `concluir_avaliacao_funcional`.

1. **funcional_v2 completo (INSERT)** — abrir a tela Premium, preencher mobilidade + salvar com força (manual ou via importação Kinology). Esperado:
   - pendência da agenda fecha;
   - 1 comissão `avaliacao_funcional` em `comissionamentos` com `origem_id = avaliacao.id`;
   - tela Premium mostra a avaliação (filtro atualizado).
2. **funcional_v2 só com mobilidade (INSERT)** — salvar sem força. Esperado:
   - pendência da agenda fecha;
   - **nenhuma** comissão criada;
   - registro aparece em Avaliações Premium.
3. **funcional_v2 completado depois (UPDATE)** — pegar o registro do teste 2 e, via SQL/backoffice, dar UPDATE em `dados` adicionando `forca.exercicios`. Esperado:
   - comissão passa a existir; sem duplicação em nova execução do mesmo UPDATE.
4. **Legado `funcional` + protocolo `permite_upload=false`** — INSERT antigo. Esperado: comportamento inalterado (comissão direta).
5. **Legado `funcional` + protocolo `permite_upload=true`** — INSERT antigo. Esperado: abre `upload_arquivo_forca`; ao inserir em `avaliacao_anexos`, comissão é gerada (fluxo intocado).
6. **Legado `forca`** — INSERT antigo. Esperado: fecha pendência e gera comissão (inalterado).
7. **Avaliação Física** — INSERT com tipo `fisica`. Esperado: nada acontece (trigger sai no primeiro IF).
8. **Registro sem profissional vinculado** — testar `funcional_v2` completo sem avaliador resolvível. Esperado: pendência órfã `concluir_avaliacao_funcional` com descrição "Sem profissional vinculado…".
9. **Idempotência do UPDATE** — repetir UPDATE do teste 3 uma segunda vez. Esperado: sem nova comissão.
10. **Regressão UI** — abrir Avaliações Premium para aluno com apenas registros `funcional` legados: continuar exibindo histórico normalmente.
