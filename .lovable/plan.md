# Semestrais de agregadoras — opção 2x/semana

## Resumo
Criar 4 itens Semestrais 2x (8 créditos/mês) com a mesma lógica dos 3x. Software e /10anos/promocoes passam a tratar 2x e 3x. Itens novos entram **desligados**; nada é publicado.

| Item (código) | Agregadora | Valor/mês | Bota |
|---|---|---|---|
| start_semestral_wellhub_2x | Wellhub | R$ 409 | 0 |
| pro_semestral_wellhub_2x | Wellhub | R$ 429 | 4/mês |
| start_semestral_totalpass_2x | TotalPass | R$ 399 | 0 |
| pro_semestral_totalpass_2x | TotalPass | R$ 419 | 4/mês |

Os demais campos são copiados do item 3x correspondente: 6 meses, ciclo mensal, sem taxa de recorrência, sem multa, 2 Avaliações (1º e 6º mês), fixar horários só no Pro, sem licença, reposição, nível no Clube ou brindes, vendável até 31/12/2026.

## Contrato: basta parametrizar
Os 2 modelos de contrato Semestral (Wellhub e TotalPass) não têm "3x" nem "12 créditos" escritos no texto. Frequência, créditos e valor já vêm do item do catálogo. **Não precisa de contrato novo.** Vou conferir num contrato de teste 2x que ele mostra "2x" e "8".

## O que hoje está fixo em 3x (levantamento)
1. **Catálogo**: só existem os 4 itens `*_3x`.
2. **`fn_promo10_ofertas`**: compara com o Start pelo código fixo `start_2027_3x_mensal` (variável `v_ref_start3x`), em valor de referência, preço sem desconto e economia por mês e em 6 meses.
3. **`Promo10Ofertas.tsx`**: vantagem fixa "3x por semana (12 créditos por mês)", textos "Start 3x hoje R$ 599/mês" e "Menos que o Start 3x", sem seletor de frequência nos Semestrais.
4. **`src/lib/semestral.ts`**: `beneficiosSemestral` assume `"3x"` quando a frequência vem vazia.
5. **Aviso aos admins em `promo10-publico`** e **Comercial > Promoções 10 anos**: o rótulo "Pro Semestral Wellhub" sai sem a frequência.
6. **Itens não fixos** (leem do catálogo, revisar só com teste): liberação de créditos por ciclo (`fn_semestral_liberar_ciclo`, usa `quantidade_creditos`), bota (`bota_compressao_mes`), venda e ativação (`fn_venda_semestral_criar`, `fn_semestral_ativar_venda`), renovação mensal e cobrança. Vou confirmar se fixar horários limita os horários pela frequência do item e não por um 3 fixo.

## Mudanças
**Software**
- Migration: inserir os 4 itens com `ativo=false`.
- Nova Venda (`VendaSemestral`): itens agrupados por Start/Pro com seletor 2x/3x. Só aparecem os itens da agregadora do aluno.
- Remover a frequência padrão "3x" em `beneficiosSemestral`.
- Rótulos (aviso, Comercial, detalhe) com a frequência: "Pro Semestral Wellhub 2x".

**/10anos/promocoes (aluno de agregadora)**
- `fn_promo10_ofertas`: devolver os itens 2x e 3x da agregadora do aluno (filtro já existente). Cada item é comparado com o `start_2027_<freq>_mensal` da mesma frequência (2x = R$ 499, 3x = R$ 599, lidos do catálogo), com economia por mês e em 6 meses.
- Tela: seletor 2x/3x igual ao do ex-aluno (padrão 3x). Os cartões Start e Pro mostram o preço, o valor riscado "Start 2x/3x hoje" e a vantagem "2x por semana (8 créditos por mês)" ou "3x…(12…)".
- Interesse: a chave passa a ser o código do item. O servidor recalcula e grava `frequencia` em `detalhes`. Resumo, WhatsApp e aviso mostram a frequência.
- `src/lib/promo10.ts`: tipos e regras com a frequência do Semestral.

## Elegibilidade (sem mudança de regra)
Agregadora no cadastro, bloqueio de quem tem as duas e uma contratação por CPF para sempre, contando só vendas pagas e ativadas, valendo para 2x e 3x juntos. Uma agregadora nunca recebe itens da outra.

## Testes
- Preços por agregadora e frequência (4 novos e 4 atuais).
- Comparação com o Start da mesma frequência (499/599) e economias.
- Créditos: 8 no 2x e 12 no 3x por ciclo, sem acúmulo. Bota 4 só no Pro.
- Elegibilidade: bloqueio com as duas agregadoras, uma por CPF (um 3x pago bloqueia o 2x e o contrário) e venda não paga não bloqueia.
- Isolamento: Wellhub nunca vê preço TotalPass, e o contrário.
- Interesse grava a frequência. Rótulo "Pro Semestral Wellhub 2x".
- Itens novos nascem desligados.
- Rodar `bunx vitest run` e eslint dos arquivos alterados. Conferir a tela no celular com os itens ligados só dentro de uma transação de teste ou com dados simulados, sem ligar no catálogo.

## Fora do escopo
Ligar os itens, publicar, mexer nos 3x atuais.

## Detalhes técnicos
- `fn_promo10_ofertas`: trocar a busca fixa por `SELECT valor FROM planos_catalogo WHERE codigo = 'start_2027_'||v_item.frequencia||'_mensal'` dentro do laço de itens (só leitura, sem gravação em `cobrancas`).
- A mudança da chave do interesse precisa continuar aceitando a chave antiga, para os interesses já gravados aparecerem no Comercial.
- Atualizar `src/components/planos/AGENTS.md` (Semestral com 2x/3x por item do catálogo).
