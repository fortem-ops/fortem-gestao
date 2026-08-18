# Coordenador e admin não veem os Modelos dos professores

## Causa (verificada no banco)

A política de leitura da tabela de modelos personalizados do Banco de Treinos é:

```
is_professor_staff() OR criado_por = auth.uid()
```

E a função `is_professor_staff()` considera apenas os papéis `professor`, `nutricionista` e `fisioterapeuta` — **coordenador e admin não estão na lista**. Resultado: coordenador/admin só recebem do banco os modelos que eles mesmos criaram, então os blocos "Modelos <Professor>" simplesmente não aparecem na tela. A tela em si (`src/pages/BancoTreinos.tsx`) já agrupa por autor corretamente; o problema é só de permissão de leitura.

## Correção

Migration única substituindo a política de SELECT da tabela `banco_treinos_personalizados` por:

```sql
DROP POLICY "Staff or creator can view personalizados" ON public.banco_treinos_personalizados;

CREATE POLICY "Staff or creator can view personalizados"
ON public.banco_treinos_personalizados
FOR SELECT TO authenticated
USING (public.is_staff() OR criado_por = auth.uid());
```

`is_staff()` cobre professor, nutricionista, fisioterapeuta, coordenador e admin. Nenhuma outra política (insert/update/delete) muda — a proteção extra dos modelos "Corrida %" para coord/admin permanece.

## Resultado

Coordenador e admin passam a ver, no Banco de Treinos, "Meus Modelos" e os blocos "Modelos <nome do professor>" de toda a equipe. Nenhuma alteração de frontend é necessária.
