# Mapa Corporal: salvar pelo site e lados corretos na vista frontal

## 1. Salvar não funciona no site publicado

Hoje as regras de acesso da tabela de formas permitem gravar apenas para o papel **Admin**. Quando um coordenador salva, a gravação atinge zero linhas e o app ainda mostra "Contorno salvo" — parece salvo, mas nada foi persistido. Pelo Lovable a alteração funciona porque roda com acesso interno.

Correções:

- Liberar criar, editar e excluir formas para **Admin e Coordenador**.
- Fazer o editor confirmar que a linha realmente foi gravada: se nenhuma linha voltar, exibir erro "Sem permissão para salvar" em vez do aviso de sucesso.
- Mesma verificação para espelhar, criar e excluir.

## 2. Lado E/D invertido na vista frontal

Convenção: na vista **anterior**, o lado **esquerdo do aluno** aparece à **direita da tela** (e vice-versa). Na vista posterior é o contrário — essa já está correta.

Situação atual na vista frontal:

- Já corretos: peitoral, bíceps, quadríceps.
- Invertidos: deltoide, adutor, antebraço anterior, psoas, tibial anterior.

Ações:

- Trocar os contornos entre os pares invertidos da vista frontal (o contorno hoje em "direito" passa para "esquerdo" e vice-versa), sem alterar a vista posterior.
- No editor, mostrar uma indicação de lado sobre a imagem ("E do aluno" / "D do aluno" nos respectivos lados da tela) e uma nota na lista de formas explicando a convenção, para evitar novas inversões.
- O espelhamento existente continua igual (espelha em torno de x = 512), agora coerente com a convenção.

## Detalhes técnicos

- Migração: substituir as políticas de INSERT/UPDATE/DELETE de `bodymap_shapes` de `is_admin(auth.uid())` para `has_role(auth.uid(),'admin') OR has_role(auth.uid(),'coordenador')`; leitura permanece `is_staff()`.
- Troca de dados dos 5 pares frontais via UPDATE (swap de `points` entre `*-direito` e `*-esquerdo`, `view = 'front'`).
- `useBodyMapShapes.ts`: adicionar `.select('shape_key')` nas mutations de update/insert/delete e lançar erro quando o retorno vier vazio.
- `BodyMapShapesConfig.tsx`: rótulos de lado no SVG e legenda da convenção.
