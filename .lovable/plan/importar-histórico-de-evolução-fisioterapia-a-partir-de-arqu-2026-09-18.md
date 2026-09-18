# Importar histórico de Evolução (Fisioterapia) a partir de arquivo

Na tela Relatórios > Fisioterapia > Evolução, o profissional poderá enviar o documento com o histórico do paciente (PDF ou Word) e o sistema preenche automaticamente uma sessão para cada atendimento encontrado.

## Como vai funcionar

1. Botão "Importar histórico" no topo da Evolução, ao lado de "Nova sessão".
2. O profissional escolhe um arquivo PDF ou .docx (até 15 MB).
3. O sistema lê o texto e separa os atendimentos procurando os títulos de sessão, no formato usado hoje: por exemplo "2° fisio 23/02/2026", "5º fisio 04/03/2026", "45° fisio 17/07/2026". Aceita os símbolos º, °, ª, "o" e também variações como "fisio 2 - 23/02/2026" e marcadores (•, -, *) antes do texto.
4. O trecho inicial do documento (NOME, Fisioterapeuta, AVALIAÇÃO com a data, QP, HDA, achados clínicos, condutas, recomendações) vira a **Sessão 1**, com a data da avaliação.
5. Abre uma janela de conferência com a lista do que foi lido: número, data e texto de cada sessão, todos editáveis, com opção de remover linhas e de ver quantas sessões serão criadas. Nada é gravado antes de confirmar.
6. Ao confirmar, as sessões entram **já registradas** (fechadas), com a data de cada atendimento e o nome do profissional que fez a importação.

## Regras

- A numeração segue a do documento. Se já existirem sessões no prontuário do aluno, a janela avisa quais números colidem e o profissional escolhe entre substituir essas sessões ou renumerar as importadas para o final. Nunca sobrescreve em silêncio.
- Sessões sem texto são descartadas.
- O texto de cada sessão é preservado como está (quebras de linha e itens da lista), sem reformatação.
- Se o documento não tiver nenhum título no padrão, a janela informa que nada foi identificado e sugere revisar o arquivo; nada é gravado.
- PDFs digitalizados (imagem, sem texto) não podem ser lidos — a janela avisa isso claramente.
- Só a equipe (professor, fisio, nutri, coordenação, administração) pode importar; nada muda para o aluno.

## Detalhes técnicos

- `SessaoEvolucao` ganha campos opcionais `data` (YYYY-MM-DD) e `origem` ("importacao"), mantendo compatibilidade com registros já existentes (campos ausentes continuam válidos). A Sessão 1 vinda da Avaliação Fisioterapia continua exibida como hoje; quando a importação criar uma Sessão 1, ela é mostrada como sessão normal do array.
- Extração de texto no cliente, sem edge function e sem IA:
  - PDF: `pdfjs-dist` (worker via `?url`), concatenando os itens de texto por página com quebra de linha por diferença de Y.
  - DOCX: `mammoth` (`extractRawText`).
- Novo módulo `src/lib/fisioEvolucaoImport.ts` com funções puras:
  - `dividirSessoes(texto)` → `{ cabecalho, sessoes: [{ n, data, texto }] }` usando regex de título `^[\s•\-\*●]*(\d{1,3})\s*[°ºoª]?\s*(?:ª|a)?\s*(?:sess[ãa]o|fisio)[^\d]{0,20}(\d{2}\/\d{2}\/\d{4})?`, tolerante a negrito colado e a linhas com "(Nª semana PO)".
  - `dataDoCabecalho(texto)` → data após "AVALIAÇÃO:".
  - Normalização de datas dd/mm/aaaa → ISO.
- Novo componente `src/components/student/assessment/ImportarEvolucaoDialog.tsx`: upload, parsing, tabela editável de conferência, detecção de colisão de números, e callback `onConfirmar(sessoes)`.
- `ReabilitacaoEvolucao.tsx`: botão de importação, merge no estado `dados.sessoes` (marcando `finalizado_em`, `autor_id`, `autor_nome` do usuário atual) e reaproveitamento do autosave existente — sem mudança de schema no banco e sem migration.
- Testes puros para `dividirSessoes` em `src/test/`, cobrindo os formatos vistos no documento de exemplo (2°, 5º, 45°, marcadores, sessão sem data, cabeçalho de avaliação).
- Validação final: suíte completa, typecheck e build.
