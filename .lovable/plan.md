# Plano: calibração de articulações no Config. Mapa Corporal

## Objetivo
Centralizar a calibração anatômica em **Config. Mapa Corporal**. O mapa de Avaliações Premium/Resultados ficará somente como consumidor das formas salvas, e toda métrica de mobilidade será renderizada sobre uma articulação — nunca sobre um músculo.

## Diagnóstico confirmado
- `bodymap_shapes` já aceita `kind = "articulacao"`, mas atualmente não há formas desse tipo cadastradas.
- `bodymap_region_overrides` guarda os pontos de referência usados pelo mapa atual e hoje é alterada pelo modo de calibração dentro de Resultados.
- As métricas de mobilidade já estão associadas a regiões equivalentes a Ombro RI/RE, Torácica, Quadril RI/RE e Tornozelo.
- O banco de exercícios usa categorias/subcategorias, mas não possui ainda um vínculo estruturado exercício → articulação.

## Implementação proposta

1. **Config. Mapa Corporal como fonte de calibração**
   - Remover o modo de calibração, arraste, salvar/resetar e ações administrativas de `BodyMap` em Resultados.
   - Estender `BodyMapShapesConfig` para tratar articulações como entidades de calibração: criar, selecionar, arrastar/redimensionar pontos, espelhar quando aplicável e salvar em `bodymap_shapes`.
   - Pré-configurar as articulações necessárias, com chaves estáveis e pares laterais:
     - `ombro-ri-esquerdo` / `ombro-ri-direito`
     - `ombro-re-esquerdo` / `ombro-re-direito`
     - `quadril-ri-esquerdo` / `quadril-ri-direito`
     - `quadril-re-esquerdo` / `quadril-re-direito`
     - `tornozelo-esquerdo` / `tornozelo-direito`
     - `toracica`
   - Manter `bodymap_region_overrides` como compatibilidade para pontos legados; a nova configuração de articulações será a autoridade visual das métricas de mobilidade.

2. **Vínculo obrigatório de mobilidade → articulação**
   - Criar um mapa centralizado e tipado para as seis métricas de mobilidade, apontando cada uma para as chaves de articulação acima e para seus lados esquerdo/direito.
   - Ajustar o renderer do mapa para procurar formas `kind = "articulacao"` por essas chaves e aplicar nelas o valor/risco da métrica.
   - Não reutilizar `FORCA_SHAPE_MUSCLE` nem `FLEXIBILIDADE_SHAPE_MUSCLE` para mobilidade.
   - Exibir estado vazio/aviso controlado quando uma articulação ainda não foi configurada, sem quebrar as demais camadas.

3. **Leitura no mapa de Resultados**
   - Fazer `BodyMapSVG` consumir as articulações salvas e os overrides existentes somente para leitura.
   - Preservar a seleção de camada Mobilidade/Flexibilidade/Força/Tudo e a lateralidade já corrigida.
   - Garantir que alterações salvas no Config sejam refletidas após invalidação/refetch, sem duplicar geometria ou estado de edição em Resultados.

4. **Exercícios de mobilidade**
   - Reutilizar a taxonomia atual de `exercicios_personalizados` para identificar exercícios de Mobilidade Articular.
   - Adicionar uma configuração explícita de articulação ao exercício (preferencialmente uma tabela de vínculo, permitindo que um exercício seja relacionado a uma ou mais articulações sem alterar o JSON legado).
   - Aplicar validação no editor do Banco de Exercícios: exercício de mobilidade não pode ser salvo sem articulação relacionada.
   - Disponibilizar a articulação no seletor/uso do exercício para que prescrições futuras mantenham o vínculo.

## Ordem de execução
1. Definir chaves, tipos e o formato do vínculo exercício → articulação.
2. Criar/seedar as articulações necessárias e a persistência segura do vínculo, com grants/RLS no mesmo migration quando houver nova tabela pública.
3. Implementar a edição de articulações em Config. Mapa Corporal.
4. Implementar o mapa centralizado de métricas e a renderização das articulações em `BodyMapSVG`.
5. Remover a calibração administrativa de Resultados e validar atualização após salvar no Config.
6. Aplicar a obrigatoriedade no Banco de Exercícios e revisar os fluxos de seleção/prescrição.

## Riscos e cuidados
- **Chaves e seed:** formas criadas hoje manualmente podem usar nomes inconsistentes; a configuração deve normalizar e impedir duplicidade das chaves reservadas.
- **Dados legados:** avaliações antigas continuam usando as métricas já persistidas; a mudança deve afetar apenas a camada visual, sem alterar valores históricos.
- **Articulação central:** `toracica` não tem par lateral e precisa de tratamento próprio no espelhamento e na renderização.
- **Compatibilidade:** Flexibilidade continua ligada a músculos e Força continua ligada aos músculos atuais; somente Mobilidade passa a usar articulações.
- **Permissões:** Config permanece restrito a perfis autorizados; Resultados apenas lê as formas, sem expor mutações administrativas.
- **Escopo de lançamento:** a tela/modo Lançamento não será alterada nesta etapa, salvo o vínculo de articulação exigido no cadastro de exercícios.