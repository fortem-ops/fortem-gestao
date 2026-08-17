# Ocultar Comercial e Financeiro para equipe técnica

Professores, Nutricionistas e Fisioterapeutas deixam de ver os grupos **Comercial** e **Financeiro** no menu lateral. Coordenadores e Admins continuam vendo tudo, como hoje.

## O que muda

- O grupo **Comercial** (Inscrições Corrida, Pipeline) passa a aparecer somente para Coordenador/Admin.
- O grupo **Financeiro** (Contratos, Templates de Contratos, Cartões de Crédito, Adquirente) passa a aparecer somente para Coordenador/Admin.
- Nenhum outro grupo do menu é alterado.

## Detalhes técnicos

Em `src/components/AppSidebar.tsx`, envolver os dois `SidebarGroup` (Comercial e Financeiro) na condição `isCoordAdmin && (...)`, no mesmo padrão já usado pelo grupo "Análise" (Relatórios). As regras internas existentes (`isAdmin` para Pipeline) permanecem.

Isso remove a visualização no menu. As rotas em si continuam acessíveis por URL direta — se quiser bloquear o acesso direto também, posso adicionar guarda de rota nessas páginas em um passo seguinte.
