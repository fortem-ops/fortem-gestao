# Promoções 10 anos — Fase 4 (publicação) + ajuste da página /10anos

## A) O que iria junto numa publicação hoje

Não consigo ler a data exata da última publicação. A última versão que você confirmou publicada foi a do **diagnóstico do app** (23/11, links no /login). Tudo o que veio depois iria junto:

| Data | Frente / tela | Situação |
|---|---|---|
| 23/11 | Site: fotos de Jonas, Vanessa e Júlia na equipe (início e Reabilitação) e nomes na tela de fotos | Pronto |
| 23/11 | Aluno > Plano: renovação antecipada para todos os planos, com cartão, Pix, pendente ou baixa manual (só admin) | Pronto. Não testei uma renovação real ponta a ponta |
| 23/11 | Push para a equipe, Fase 1: botão "Ativar notificações", tela de envios e teste, fila fora do expediente, proteção do push dos alunos | Pronto, mas **sem gatilhos** (Fases 2–4 aguardam aprovação dos textos) e sem teste de recebimento em aparelho. O botão já aparece para a equipe |
| 24/11 | Promoções 10 anos, Fases 1 e 2: cálculo no servidor e página /10anos/promocoes | Pronto, com a **chave do código por e-mail desligada** (só cadastros de teste recebem código; os demais não passam da tela do CPF) |
| 24/11 | Ajustes de texto da /10anos/promocoes (Power/Pro, Semestrais, "Corrida") | Pronto |
| 24/11 | Promoções 10 anos, Fase 3: Comercial > Promoções 10 anos (só admin) e aviso no Notificar | Pronto. Não abri a tela logado nem fiz um interesse real ponta a ponta |
| 24/11 | Link "Promoções de aniversário" na /10anos | Pronto (será refeito no item B) |

Observação: as mudanças no banco e nas funções do servidor (push, promoções) **já estão no ar**, porque o servidor é o mesmo para a prévia e o site publicado. A publicação só leva as telas.

O plano de correção da tela branca no atalho da equipe foi pulado e **não** está incluído.

## B) Nova /10anos (a festa já aconteceu)

Ordem das seções:

```text
Cabeçalho: FORTEM · 10 ANOS ........ [Promoções de aniversário] (vermelho)
1. Topo (no passado): "14.11.26 — obrigado por celebrar com a gente"
   áudio de introdução · [Promoções de aniversário] (vermelho) · [Nossa história]
2. Promoções de aniversário (destaque)
   título forte + 1 linha: alunos, ex-alunos e alunos Wellhub/TotalPass têm
   condições especiais até 31/12/2026 · [Ver minhas promoções] -> /10anos/promocoes
3. Nossa história (sem mudança; botões "Confirmar presença" internos viram
   "Ver minhas promoções")
4. Como foi a festa: galeria + [Encontre suas fotos] -> /10anos/fotos
5. Seção da festa (local/horário) — reescrita no passado, ou removida (ver pergunta)
6. Rodapé (sem o link duplicado das promoções)
```

Sai da página pública: botões "Confirmar presença", formulário de confirmação, contador de confirmados e "confirmações até 14 de novembro". **Nenhum dado apagado**: confirmações, vouchers, pagamentos e a tela da equipe continuam iguais.

Pergunta: na seção 5 (local, horário e programação da festa), prefere reescrever no passado ou tirar? Se você não responder, vou reescrever no passado com o título "Como foi" e juntar com a galeria.

### Fotos da festa: de onde vêm e quantas
- Fotos do evento "10anos" (14/11), as mesmas da busca por selfie em /10anos/fotos. Essa página já está pronta e funcionando.
- O servidor já tem uma lista pública de fotos que só mostra as **aprovadas pela equipe e já processadas**: hoje são **159 fotos** (151 com rostos e 8 sem rosto). Ficam de fora 59 que ainda não foram aprovadas ou terminaram de subir.
- A galeria mostra as primeiras 24 miniaturas, com "Ver mais fotos". As imagens carregam só quando aparecem na tela, e tocar abre a foto maior. 3 colunas no celular, 4–6 no computador.
- Aviso de privacidade: as 159 fotos aprovadas já podem ser vistas por quem acessa a galeria da /10anos/fotos. Mostrá-las na /10anos aumenta a exposição. Se preferir, a equipe pode escolher quais fotos vão para a vitrine, mas isso exige uma marcação nova na tela de fotos. Sem resposta, uso as aprovadas.

## C) Fase 4 das promoções (cada passo só com sua aprovação)
1. **Apagar os interesses de teste**: mostro antes a lista (código P10, primeiro nome, oferta e data, sem CPF) dos interesses dos cadastros de teste. Hoje existe 1 interesse no total. Apago só esses e as sessões e códigos de teste ligados a eles.
2. **Ligar o código por e-mail para todos** (`promo10_codigo_email_livre = true`). Confiro em seguida com um CPF de teste.
3. **Publicar** (depois do B pronto e revisado por você).

## Testes
- /10anos não mostra "Confirmar presença", o formulário nem o contador, e não chama a contagem de confirmados.
- O botão principal (cabeçalho e topo) e o da seção de destaque levam a /10anos/promocoes.
- Texto da seção de promoções sem valores em R$.
- Galeria: mostra as miniaturas que o servidor devolve, carregamento sob demanda ("lazy") e botão para /10anos/fotos; se a lista vier vazia ou com erro, a seção some sem quebrar a página.
- `bunx vitest run` completo e eslint dos arquivos alterados, sem `any` (inclusive tirando o `as any` atual da contagem, que deixa de existir).
- Conferência visual no celular e no computador com Playwright.

## Detalhes técnicos
- Arquivos: `src/pages/Festa10Anos.tsx`, `src/config/festa10anos.ts` (textos), novo `src/site/components/FestaGaleria.tsx` reaproveitando `fotos-evento-publico` `acao: "galeria"` (filtro: aprovada + upload concluído + indexada/sem_rosto) e as URLs de miniatura que ele já assina. Nenhuma mudança de servidor ou banco no B.
- `FestaConfirmacaoForm` e `fn_festa_total_confirmados` ficam no projeto, só sem uso na página.
- C1: `delete from promo10_interesses where aluno_id in (select ... promo10_codigo_email_teste_ids)` + sessões/verificações de teste, após listar. C2: update da chave de configuração.
