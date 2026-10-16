# 10 anos: separar 2023 e 2024 + curtir e comentar fotos

## O que muda para você
- **2023 e 2024 viram anos separados**, no site e na aba Fotos da história:
  - 2023: "Ampliação de serviços: avaliação funcional."
  - 2024: "Ampliação de serviços: venda de produtos."
  - Fotos que estiverem em "2023–2024" passam para 2023 (você pode mover depois).
- **Curtir e comentar no site**, como no Instagram:
  - Embaixo de cada foto: coração com o número de curtidas e o número de comentários.
  - Qualquer visitante curte sem cadastro (toque de novo para descurtir). O site lembra quem curtiu naquele aparelho.
  - Ao tocar em comentários, abre a lista e um campo com **nome** e **comentário** (até 300 caracteres). O comentário aparece na hora.
- **Na aba Fotos da história**, cada foto mostra curtidas e comentários, com botão **Apagar** em cada comentário (pede confirmação).

## Proteção contra abuso
- Limite por aparelho/conexão: até 5 comentários a cada 10 minutos; curtida conta uma por aparelho por foto.
- Links e textos muito curtos ou repetidos são recusados.
- Ninguém de fora consegue apagar nem editar comentários.

## Fora deste pedido
- Planos 1 e 2, flags, contratos, cobranças e PIX não são tocados. O site não é publicado.

## Detalhes técnicos
- Config `festa10anos.ts`: troca "2023–2024" por "2023" e "2024"; `FestaFotosAdmin` usa a mesma lista. Atualizar `festa_fotos.ano` de "2023–2024" para "2023" (via query de dados).
- Novas tabelas `festa_fotos_curtidas` (foto_id, visitante_id, created_at, único por par) e `festa_fotos_comentarios` (foto_id, nome, texto, ip_hash, created_at). GRANTs + RLS: anon sem escrita direta; SELECT público só via RPC `fn_festa_fotos_interacoes` (contagens + comentários sem ip_hash); equipe de gestão lê e apaga.
- Edge function `festa-fotos-interagir` (curtir/descurtir/comentar) com validação, rate limit por ip_hash usando `festa_rate_limit`, visitante_id aleatório guardado no navegador.
- `FestaFotosAno.tsx`: barra de curtir/comentários por foto (também no slide) e painel de comentários acessível.
- Rollback em `scripts/festa-fotos-interacoes.rollback.sql`; testes de validação do comentário e da contagem.
- Verificação com Playwright no celular (393px) e computador.
