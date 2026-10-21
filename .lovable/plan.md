# Termos completos no cadastro facial do balcão

- Alterar somente a tela de cadastro facial: equipe mantém seu termo; adulto usa o termo completo do app; menor ou pessoa sem nascimento usa o termo completo do responsável.
- Exibir o termo escolhido em caixa rolável antes da confirmação, preservando o campo do responsável e o fluxo atual.
- Remover versão e texto curtos antigos da tela, sem alterar consentimentos históricos.

## Verificação
- Adicionar testes locais da escolha de versão/texto e executar os testes faciais existentes.
- Abrir os diálogos com adulto e menor simulados, sem salvar nem enviar foto, e conferir erros de console.
- Consultar apenas as contagens finais e o modo de observação: referência 227 credenciais, 1 consentimento, 1 pedido e modo `log`.

## Limites técnicos
- Nenhuma alteração no banco, nas funções ou na configuração facial; nenhuma publicação ou criação de dados reais.
- Código funcional restrito a `src/components/student/StudentFacial.tsx`; testes locais adicionais apenas para verificar a seleção dos termos.