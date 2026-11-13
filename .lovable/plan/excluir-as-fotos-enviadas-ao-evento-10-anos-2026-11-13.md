# Excluir as fotos enviadas ao evento 10 anos

## Situação atual (conferida no banco)
- Evento `10anos`: 5 fotos, todas enviadas por convidados, aprovadas e indexadas (5 rostos na coleção `fortem-evento-10anos`).
- Uma delas está definida como foto de capa.

## O que será apagado
1. Os 5 rostos dessas fotos na coleção de reconhecimento da AWS (a coleção continua existindo, vazia, pronta para as fotos do fotógrafo).
2. Os arquivos original e prévia de cada foto no armazenamento privado.
3. Os registros de rostos e as 5 fotos no banco.
4. A capa do evento volta para vazia (tela inicial mostra fundo preto com cantoneiras).

## O que NÃO muda
- O evento `10anos`, suas configurações e a coleção.
- Cadastros de convidados (leads) e o registro das buscas feitas.
- Código do site e da área da equipe.

## Como
Hoje nenhuma ação apaga foto aprovada. Rodar uma única vez, como admin, uma rotina temporária que faz os passos 1 a 4 só para as fotos desse evento, e removê-la logo depois. Nada fica publicado.

## Conferência
- Banco: 0 fotos e 0 rostos no evento, capa vazia.
- Armazenamento: nenhum arquivo na pasta do evento.
- AWS: coleção existe e lista 0 rostos.
- Página /10anos/fotos: busca por selfie retorna vazio e galeria vazia.
