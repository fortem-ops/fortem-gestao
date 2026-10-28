# WhatsApp: figurinhas, reações, foto do contato e não lidas

## O que muda para você
1. **Reações (hoje aparece "[reaction]")**: o emoji da reação (ex.: 👍 ❤️) aparece pequeno embaixo da mensagem que recebeu a reação, como no WhatsApp. Na lista de conversas aparece "Reagiu 👍 à mensagem".
2. **Figurinhas e imagens**: a figurinha aparece como imagem (até 160 px) e as fotos recebidas aparecem como miniatura clicável. Legenda da foto, se houver, aparece embaixo.
3. **Emojis no texto** já chegam no texto e continuam aparecendo normalmente.
4. **Foto do cadastro**: ao lado do nome, na lista e no topo da conversa, aparece a foto do aluno quando o telefone bate com um cadastro. O nome do cadastro passa a ter prioridade sobre o nome do perfil do WhatsApp. Sem cadastro, aparecem as iniciais.
5. **Não lidas**: conversas com mensagens novas ficam com o nome e a última mensagem em negrito, além do número verde que já existe. Um filtro "Não lidas" fica ao lado da busca. Ao abrir a conversa aparece a linha "Mensagens não lidas" antes da primeira nova.
6. **Mensagens antigas**: as 14 reações e 2 imagens já recebidas são recuperadas do registro bruto guardado, se ele ainda existir. As que não existirem mais continuam como estão.

Limite: o WhatsApp não envia a foto de perfil do contato, por isso a foto vem só do cadastro da Fortem. Figurinhas animadas aparecem paradas em alguns navegadores.

## Detalhes técnicos
- Migração aditiva em `whatsapp_mensagens`: `reacao_a_wamid text`, `media_id text`, `media_path text`, `media_mime text`. Nada é removido.
- `whatsapp-webhook`: para `reaction`, grava `conteudo = emoji` e `reacao_a_wamid = message_id`, sem somar à contagem de não lidas. Para `sticker` e `image`, guarda `media_id`, a legenda e o mime; depois baixa a mídia pelo gateway (`GET /{media_id}` e então a URL) e salva em um bucket privado `whatsapp-midia`.
- Nova edge function `whatsapp-midia` (só equipe com JWT): devolve link assinado de curta duração. Também tenta baixar sob demanda se a mídia ainda não foi salva (o link da Meta vale cerca de 30 dias).
- `WhatsAppChat.tsx`: agrupa reações por `reacao_a_wamid` e as tira da linha do tempo; mostra mídia; avatar via mapa telefone normalizado → `alunos.nome, foto_url` (consulta leve); filtro e separador de não lidas, com a posição salva antes de zerar `nao_lidas`.
- Script para refazer o histórico a partir de `whatsapp_events`, com rollback em `scripts/`.
- Testes Vitest das funções puras: agrupar reações, rótulo da prévia e casar telefone.
- Não altera `send-whatsapp`, Disparo de Mensagens nem `whatsapp_disparos_config`.
