# Padronizar os 12 PDFs de treino

## Objetivo
Aplicar o padrão visual de Fases/Personalizado aos demais métodos sem alterar regras de treino, garantindo frequência lateral, observações digitadas, aquecimento consistente e paginação legível.

## Implementação

1. **Centralizar elementos compartilhados**
   - Extrair para o utilitário de PDF a coluna lateral de frequência no mesmo desenho da referência.
   - Adicionar um helper de observações que imprime primeiro o texto salvo, quando houver, e mantém linhas em branco para anotação manual.
   - Reutilizar esses helpers em todos os exportadores, preservando logo, cabeçalho e identidade visual atuais.

2. **Frequência lateral correta**
   - Adicionar a coluna em M102, Plan Strong 50, Planilha 5RM, X-FAB, PTTP, PTTP2, Foolproof, Easy Strength e Quality a Mile Deep 1RM/5RM.
   - Calcular T1–Tn pela frequência efetiva de cada prescrição; no Mile Deep 1RM usar os 2 pares/sessões e no 5RM a quantidade de sessões cadastradas.
   - Reservar a largura lateral apenas na página 1, mantendo páginas de progressão com largura integral.

3. **Observações digitadas em todos os métodos**
   - Acrescentar observações ao conteúdo exportável de Fases/Personalizado e renderizá-las sem remover o quadro manual.
   - Fazer o mesmo em 5-3-1, M102 e Plan Strong 50.
   - Manter o comportamento já existente nos outros métodos, agora pelo mesmo padrão compartilhado.

4. **Aquecimento do Quality a Mile Deep**
   - Trocar “DIAS” por colunas T1–Tn com bolinhas vermelhas.
   - Exibir faixa de grupo com sigla e nome completo para LIB/MOB/ATI/PREV/POT.
   - Manter ordem dos grupos e dados de repetições conforme os demais métodos.

5. **Paginação legível**
   - Em Mile Deep 1RM/5RM, Foolproof, Easy Strength, PTTP e PTTP2, deixar cabeçalho, frequência, observações e aquecimento na página 1.
   - Iniciar força/progressão em páginas seguintes quando necessário e permitir fluxo natural, sem comprimir fonte ou cortar tabelas.
   - Preservar a estratégia atual de 5-3-1, M102 e Plan Strong 50, ajustando somente frequência e observações onde solicitado.

## Validação

- Criar dados representativos para os 12 métodos e permitir geração em memória para inspeção automatizada.
- Gerar os 12 PDFs reais em arquivos temporários.
- Conferir texto, quantidade de páginas e presença de logo, frequência, observações e aquecimento.
- Renderizar todas as páginas em imagens e fazer inspeção visual de cortes, sobreposições, margens, legibilidade e continuidade.
- Corrigir os problemas visuais encontrados e repetir a inspeção das páginas afetadas.
- Rodar testes direcionados, checagem de tipos e conferir o diff final.

## Premissas

- “12 PDFs” considera Fases/Personalizado como um único padrão e Quality a Mile Deep 1RM/5RM como duas variantes do mesmo exportador compartilhado.
- A coluna de frequência representa quatro semanas, como na referência, salvo quando o próprio método já possuir uma duração visual explicitamente diferente.
- Nenhuma fórmula, progressão ou persistência de treino será alterada.
