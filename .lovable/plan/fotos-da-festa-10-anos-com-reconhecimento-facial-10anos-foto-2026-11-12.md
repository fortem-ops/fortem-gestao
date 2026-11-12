# Fotos da festa 10 anos com reconhecimento facial (/10anos/fotos)

Já existe no projeto: página /10anos, tabelas festa_fotos / festa_fotos_comentarios / festa_fotos_curtidas e funções festa-fotos-publico / festa-fotos-interagir (galeria atual com curtidas). O novo módulo é separado (genérico por evento); a galeria antiga (festa_fotos, curtidas e comentários) é mantida separada, sem nenhuma alteração.

## Fase 1 — Banco, storage, funções e Rekognition
Tabelas (todas com RLS e GRANTs explícitos; público sem acesso direto, só via funções). Papéis: eventos, upload, indexação e exportação de leads só admin e coordenador; aprovar/rejeitar fotos: admin, coordenador e professores; leitura: staff:
- eventos_fotos, fotos_evento, rostos_foto, leads_fotos — com os campos pedidos. Lead reaproveitado por (evento_id, whatsapp normalizado), índice único.
- fotos_buscas_log (só contadores: lead, ip_hash, qtd encontradas, data) — sem imagem.
- rate_limit_fotos_publico (ip_hash, acao, janela) — 10 buscas e 3 envios por IP/hora.
- Validações por trigger (status, orientação, 30 fotos por envio).
Bucket privado fotos-eventos: `{evento}/fotografo/original|preview/`, `{evento}/convidados/original|preview/`. URLs assinadas de 10 min.
Módulo `_shared/rekognition.ts` (assinatura AWS SigV4 própria, sem SDK pesado) + funções puras testáveis (nome de coleção com prefixo "fortem-", deduplicação de fotos por ExternalImageId).
Funções:
- fotos-evento-admin (staff): criar coleção, gerar URLs de upload, indexar lote (IndexFaces, ExternalImageId = foto_id; 0 rostos = sem_rosto), reprocessar erros, aprovar/rejeitar — admin, coordenador e professores (rejeitada apaga do storage; aprovada de convidado é indexada), CSV de leads, URL do original.
- fotos-evento-publico: buscar por selfie (SearchFacesByImage, limiar 90, 100 rostos; selfie só em memória, nunca em storage/banco/log), galeria paginada (só aprovadas e indexadas/sem_rosto), URLs assinadas.
- fotos-evento-envio: upload de convidados (até 30, JPEG/PNG/HEIC, 15 MB), DetectModerationLabels (70) só para sinalizar.
- fotos-evento-retencao (cron diário): após retencao_dias apaga coleção, rostos, fotos e arquivos.

## Fase 2 — Área da equipe (tema escuro)
Menu "Fotos de Eventos" (professores veem só a fila de moderação): lista/criação/edição de eventos; painel com totais por status e origem, buscas e leads (CSV); upload em lote com barra de progresso, HEIC→JPEG e prévia 1200px no navegador; fila de indexação em lotes de 5, retomável (estado no banco), botão "Reprocessar com erro"; moderação com alertas primeiro (borda vermelha + rótulos), seleção em lote, tela cheia com A/R/←/→, agrupamento de quase idênticas (hash perceptual da prévia, mesmo remetente); baixar original sem moldura.

## Fase 3 — Página pública /10anos/fotos
Celular primeiro, tema escuro, Archivo, cantos retos, sem sombras, textos sem exclamação. Abas "Encontrar minhas fotos" e "Enviar fotos", com todas as telas descritas (formulário + aceite desmarcado, selfie com contorno oval e "Enviar da galeria", busca com aviso de descarte, resultado, nenhuma foto, galeria paginada, envio com contador X de 30 e confirmação). Turnstile reaproveitado do /planos. Página curta /10anos/fotos/privacidade (selfie usada só para localizar fotos, processamento pela AWS, selfie não armazenada, fotos guardadas por 90 dias, contato da Fortem), linkada no aceite. Logo só depois dos SVG enviados.

## Fase 4 — Molduras e downloads
Módulo puro de layout (cálculo de posições para Foto e Stories horizontal/vertical, nas cores colorida/P&B, exatamente nas medidas pedidas) + desenho em canvas, P&B por pixels, Archivo carregada antes, JPEG 90. Prévia usa o mesmo arquivo. ZIP no navegador; Web Share API com arquivo quando houver. Depende dos SVG e mockups.

## Fase 5 — Testes e ajustes
Testes vitest (node e jsdom) e Deno:
- foto sem rosto => sem_rosto; vários rostos => N linhas em rostos_foto
- busca sem correspondência => lista vazia; resultado sem fotos repetidas
- rate limit 11ª busca e 4º envio bloqueados
- selfie não persistida (nenhuma escrita em storage/banco; log sem bytes)
- pendente fora da busca e da galeria; rejeitada removida; 31 fotos recusadas
- molduras: horizontal, vertical e muito clara × 4 combinações, logo com proporção preservada e textos dentro das áreas seguras
Ensaio no banco com AWS real em coleção de teste "fortem-teste-…", apagada ao fim.

## Decisões do dono
1. Galeria antiga: mantida separada, sem alterações.
2. Política de privacidade: página curta própria do evento.
3. Moderação: admin, coordenador e professores; o resto só admin e coordenador.

## Execução
Depois da aprovação, implementar SOMENTE a Fase 1 e parar para validação.

## Observação
Em modo de planejamento não consigo registrar esta tarefa na lista de tarefas; registro na Fase 1, ao começar.
