# Aceites do Tecnofit + Fiscal de Contratos

## Resultado da simulação (nada foi gravado)

Planilha do Tecnofit: 149 alunos, todos com "Aceito em dd/mm/aaaa hh:mm", status Ativo.

Comparação por nome (sem acento, maiúsculas, espaços normalizados):
- **149 com um único aluno correspondente**, 0 sem correspondência, 0 com mais de um aluno.

Situação desses 149 no sistema atual:

| Situação | Qtde | O que acontece |
|---|---|---|
| Um contrato ativo, documento sem aceite | 31 | Aceite é gravado no documento que já existe |
| Um contrato ativo, **sem documento gerado** | 101 | Não há onde gravar o aceite — ver decisão 1 |
| Um contrato ativo, já aceito no sistema atual | 4 | Não mexe (aceite atual é mantido) |
| Mais de um contrato ativo | 7 | Bruna Meyer, Carmem Maria Galvão, Cecilia Pelisoli Gafforelli, Gabrieli Anay Pivetta Clerice, Juliana Leote Ribeiro, Laura de Castro e Garcia, Paula Cerski Lavratti — ver decisão 2 |
| Sem contrato ativo | 6 | Alonso Cornejo, Carlos Piccinini, Carolina Barbosa, Cátia Vanzellotti, Gabrieli Lazzari Vieira, Giovanna Vanzin — ficam de fora |

## Decisões que preciso de você

1. **Os 101 sem documento**: (a) criar para cada um um documento de registro "Aceite migrado do Tecnofit" ligado ao contrato ativo, já marcado como aceito com a data da planilha (recomendado), ou (b) não fazer nada e deixar o Fiscal acusar "sem documento".
2. **Os 7 com mais de um contrato ativo**: (a) gravar no contrato ativo mais recente, ou (b) deixar de fora e eu mostro os contratos de cada um para você escolher (recomendado).
3. **Aceite anterior ao contrato atual**: em alguns casos o contrato atual foi criado depois da data de aceite do Tecnofit (renovação). Gravar mesmo assim (o aceite migrado vale para o contrato vigente)? Recomendo gravar e mostrar a lista desses casos antes, na etapa de conferência.

## Como fica registrado que veio do Tecnofit

- `formato_aceite = 'migracao_tecnofit'` e `data_aceite` = a data da planilha (horário de Brasília).
- `variaveis_utilizadas` guarda `{origem: "tecnofit", codigo_tecnofit, contrato_tecnofit, aceite_original}`.
- Documentos novos (decisão 1a): texto "Aceite registrado no sistema anterior (Tecnofit) em dd/mm/aaaa hh:mm — contrato: X", sem modelo vinculado, versão 0.
- Aceites que já existem nunca são sobrescritos (a gravação só atinge documentos com aceite = falso).

## Etapas

1. Depois das suas respostas: gero a lista final (aluno, contrato, documento, data) e mostro para conferência — nada gravado.
2. Com sua confirmação: gravo os aceites (atualização dos 31 + criação dos documentos, se 1a) e confiro as contagens.
3. Fiscal de Contratos, conforme já combinado:
   - `aceite_pendente`: documento sem aceite há mais de 7 dias; atenção até 30 dias, crítico acima de 30 com contrato ativo.
   - `contrato_sem_documento`: contrato ativo/suspenso sem documento — atenção.
   - Ignora cancelados/encerrados e TotalPass/Gympass; Corrida entra; ficha de saúde fica de fora.
   - Aceite migrado do Tecnofit conta como aceite válido.
   - Entra no job diário junto dos outros quatro; categoria "Contratos" na Auditoria, no widget do Dashboard e no contador do menu.

## Detalhes técnicos

- Gravação de dados pelo executor de SQL (não por migração), em uma transação, com a lista fixa de ids conferida; WHERE `aceite = false` em todo UPDATE.
- Os 35 registros de Gympass e 15 de TotalPass da planilha entram na migração de aceite normalmente; só o Fiscal os ignora.
- Migração `fiscal_contratos`: `fn_auditoria_fiscal_contratos()` SECURITY DEFINER, search_path=public, EXECUTE só service_role; documento considerado = o mais recente do contrato.
- Job 33 passa a chamar os 5 fiscais; edge `auditoria-fiscal-pagamentos` devolve `resultado_contratos` e é redeployada.
- Frontend: `src/pages/Auditoria.tsx`, `src/components/dashboard/AuditoriaWidget.tsx`. Nada de Rede, cobranças ou grants de outras funções.
