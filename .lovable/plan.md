# Cadastro de cartão: toast "•••• undefined" e lista que não atualiza

## Diagnóstico (confirmado)

**1. Onde o toast é montado**

`src/components/pagamentos/CadastrarCartaoDialog.tsx`, dentro de `CartaoForm.submit()`:

```ts
if (!data?.success) throw new Error(data?.error ?? "Falha ao salvar cartão");
toast.success(`Cartão •••• ${data.last4} salvo com sucesso`);
onSuccess?.();
```

**2. O que `rede-salvar-cartao` retorna hoje**

No fluxo atual (tokenização de bandeira, assíncrono), a resposta de sucesso é (linha 263):

```json
{ "success": true, "status": "pending", "message": "Cartão em validação, você será notificado em instantes." }
```

Não há mais `last4` nem `brand` — daí o `undefined`. O retorno com `last4`/`brand` (linha 451) pertence ao fluxo antigo Zero Dollar, marcado no próprio arquivo como "inalcançável".

**3. Refresh da lista**

Existe: `src/components/student/financeiro/CartoesSection.tsx` linha 442 invalida `["cartoes-salvos-aluno", student.id]` no `onSuccess`. O problema é de tempo, não de código: no momento do `onSuccess` a linha em `cartoes_salvos` ainda não existe — ela só é criada pelo webhook `rede-tokenizacao-webhook` quando a Rede responde `tokenizationStatus = "Active"`. Na última tokenização real, o intervalo entre solicitação e criação do cartão foi de ~8 segundos (`rede_tokenizacoes`: created_at 14:27:06 → updated_at 14:27:14). A invalidação dispara em ~1s, encontra a lista vazia, e nada mais reconsulta — por isso só aparece após reload manual.

## Correção proposta

**A. Toast honesto ao estado assíncrono** (`CadastrarCartaoDialog.tsx`)
- Se `data.status === "pending"`: `toast.success("Cartão enviado para validação — aparecerá na lista em instantes.")`, sem `last4`.
- Se vier `last4` (fluxo legado), manter a mensagem atual.

**B. Lista que converge sozinha** (`CartoesSection.tsx`)
- Após o cadastro, entrar em modo "aguardando confirmação": exibir uma linha placeholder ("Validando cartão…") e habilitar `refetchInterval` de ~3s na query `cartoes-salvos-aluno` por até ~60s.
- Encerrar o polling quando a contagem de cartões aumentar (ou ao esgotar o tempo, com aviso de que a confirmação pode demorar).

Alternativa opcional (não incluída por padrão): realtime na tabela `cartoes_salvos` em vez de polling — mais elegante, porém exige publicação/replica identity configurada.

## Escopo

Apenas os dois arquivos acima. Sem mudanças na Edge Function nem no webhook.
