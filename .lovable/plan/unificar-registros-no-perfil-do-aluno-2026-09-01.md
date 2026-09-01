# Unificar Registros no perfil do aluno

Hoje o perfil tem quatro abas separadas que tratam do mesmo assunto (o acompanhamento do aluno): Avaliações/Relatórios, Tarefas, Observações e Uploads. A proposta é agrupá-las numa aba única chamada **Registros**, com sub-abas internas — sem alterar nenhuma funcionalidade existente.

## Como fica

Barra principal do perfil:

```text
Resumo | Pipeline | Clube | Plano/Serviços | Carteira | Pagamentos | Treinos | Frequência | Registros
```

Dentro de **Registros**, uma segunda linha de abas:

```text
Avaliações/Relatórios | Observações | Tarefas | Uploads
```

Cada sub-aba renderiza exatamente o componente que já existe hoje, com os mesmos botões, permissões e diálogos. Nada é reescrito, apenas reposicionado.

## Detalhes de comportamento

- Contadores discretos nas sub-abas (ex.: "Observações 12", "Tarefas 3") para dar noção de volume sem precisar clicar.
- A sub-aba padrão ao abrir Registros é Avaliações/Relatórios.
- Links antigos continuam funcionando: `?tab=avaliacoes`, `?tab=observacoes`, `?tab=tarefas`, `?tab=uploads` abrem Registros já na sub-aba certa. A URL passa a usar `?tab=registros&sub=observacoes`, mantendo o estado ao recarregar ou compartilhar o link.
- Permissões inalteradas: professor/nutri/fisio continuam vendo Registros; as abas comerciais seguem restritas a admin/coordenador.

## Detalhes técnicos

- `src/pages/StudentProfile.tsx`: substituir os quatro `TabsTrigger`/`TabsContent` por um único `registros`, adicionar `sub` aos search params e um mapa de redirecionamento das chaves antigas.
- Novo `src/components/student/StudentRegistros.tsx`: `Tabs` internas (estilo secundário, menor que a barra principal) que montam `StudentAssessments`, `StudentNotes`, `StudentTasks` e `StudentUploads` recebendo `student`.
- Contadores via queries leves (`count: "exact", head: true`) em `avaliacoes`, `historico_profissional`, `tarefas` e `uploads`, reaproveitando as query keys já usadas para não duplicar requisições.
- Nenhuma mudança de banco, RLS ou lógica de negócio.

## Fora de escopo

- Linha do tempo cronológica unificada (pode ser adicionada depois como uma quinta sub-aba, sem retrabalho).
- Alterações nos formulários, exportações ou regras das quatro áreas.
