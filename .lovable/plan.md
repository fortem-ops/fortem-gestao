# Renomear para "Relatórios" e ligar Tipos ao módulo Técnico

## O que muda

1. **Renomear a tela Técnico > "Avaliação - Experimental" para "Relatórios"**
   - Item do menu lateral e título da página passam a ser "Relatórios".
   - Rota `/avaliacoes` permanece a mesma (nenhum link quebra).

2. **Renomear Administração > "Tipos de Avaliação" para "Relatórios"**
   - Rótulo da aba e o texto de subtítulo da página de Administração.

3. **Permitir excluir qualquer Tipo**
   - Hoje o botão de excluir só aparece em tipos que não são de sistema (Experimental, Composição Corporal, Funcional etc. não podem ser removidos pela tela).
   - Passa a existir o botão de excluir em todos os tipos. Para tipos de sistema, o aviso de confirmação é reforçado, indicando que a exclusão pode afetar telas que dependem daquele tipo.
   - Protocolos vinculados já são removidos em cascata pelo banco; avaliações antigas continuam preservadas.

4. **Novo Tipo passa a aparecer em Técnico > Relatórios**
   - Atualmente a tela Técnico só exibe o tipo com slug `experimental` (lista fixa no código), por isso o tipo "Relatórios" já criado não aparece.
   - A regra passa a ser dinâmica: a tela lista todos os tipos ativos, exceto os que pertencem ao módulo Avaliações (Premium) — ou seja, ficam de fora os de engine `funcional_v2` e `composicao_pollock`, que têm tela própria.
   - Resultado: qualquer tipo novo criado em Administração aparece automaticamente no seletor de Técnico > Relatórios, com seus protocolos.

## Detalhes técnicos

- `src/components/AppSidebar.tsx`: título do item `/avaliacoes` → "Relatórios".
- `src/pages/Avaliacoes.tsx`: `<h1>` → "Relatórios"; textos auxiliares ajustados ("Nova Avaliação" continua como ação de criação de registro).
- `src/pages/Admin.tsx`: label da aba `avaliacoes` → "Relatórios" e ajuste do subtítulo.
- `src/components/admin/AdminTiposAvaliacao.tsx`: remover a condição `!t.is_sistema` que esconde o botão de exclusão; texto de confirmação condicional para tipos de sistema.
- `src/components/student/assessment/AssessmentForm.tsx`: substituir a constante `TIPOS_PERMITIDOS_LEGADO = ["experimental"]` por um filtro de exclusão por engine (`funcional_v2`, `composicao_pollock`), mantendo `t.ativo`.
- Sem alterações de banco de dados: as políticas de acesso já permitem exclusão por Coordenação/Admin e a cascata de protocolos já existe.

## Verificação

- Build e suíte de testes (Vitest) ao final.
