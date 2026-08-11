# Abertura /corrida: preços na faixa branca, oferta sob demanda e logos NB

## O que muda

### 1. Banner preto (abertura)
- Sai dali o bloco de preços (Anual / Mensal prospect). O banner fica com: watermark 42K, eyebrow "PORTO ALEGRE 2027", headline, "Garanta sua vaga até 20/08.", checklist de 5 benefícios, card de CPF e os dois links de atalho.
- Entram os logos New Balance na área preta: um logo no topo (junto ao eyebrow "PORTO ALEGRE 2027", com a marca Fortem) e uma assinatura discreta próxima à headline, ambos em versão sobre fundo escuro. Imagem publicada como asset de CDN a partir do arquivo enviado.

### 2. Faixa branca (seção do configurador)
- Os dois cards de preço para não-aluno passam a abrir a faixa branca, logo abaixo do banner: "Anual — a partir de R$ X/mês (parcelável em até 10x)" e "Mensal — R$ Y/mês", sempre buscados ao vivo de `planos_catalogo` (`Corrida - Prospect`). Sem hardcode.
- Esses preços ficam sempre visíveis, mesmo antes de qualquer escolha.

### 3. "Monte a sua oferta" só após escolha
- O conteúdo do configurador (seleção de período, provas, kits, avaliação, resumo e total) só aparece depois que o visitante clicar em um dos três caminhos: verificar CPF de aluno, "Não sou aluno, quero ver meu preço" ou "Quero só me inscrever numa prova".
- Enquanto nada foi escolhido, a faixa branca mostra só os preços e uma linha curta convidando a escolher um dos caminhos acima.
- Ao escolher, o bloco aparece e a página rola até ele (comportamento atual mantido).

## Detalhes técnicos

- `NbCortesiaBanner.tsx`: remover a query/render dos cards de preço; adicionar `<img>` dos logos NB a partir de `src/assets/new-balance.png.asset.json` (criado via `lovable-assets create` do upload).
- `CorridaConfigurator.tsx`: mover para cá a query `corrida-planos-prospect` e renderizar os dois cards de preço no topo da seção; envolver o restante (`Monte a sua oferta` em diante) em `rotaProp !== null`. Remover o fallback `rota = rotaProp ?? "prospect"` do caminho de render (mantido só depois de definido).
- Nenhuma mudança em preços, lógica de resumo, kits, MIPOA, avaliação ou datas.
