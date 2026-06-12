## Correção de CPFs dos alunos ativos

Comparei a lista enviada com os CPFs atualmente cadastrados na base. Encontrei **36 alunos com CPF trocado** — o padrão é claro: durante a importação, os CPFs ficaram deslocados em uma linha (o CPF de cada aluno foi gravado no aluno anterior), afetando o trecho que vai de **AIRTON LUIZ MORAES JUNIOR** até **CELIA POHLMANN GARCIA**, mais alguns casos isolados depois.

### O que vou fazer

Atualizar o CPF dos seguintes 36 alunos ativos para o valor correto da lista (todos os demais alunos ativos já estão com CPF coerente com a lista e não serão tocados):

| Aluno | CPF atual (errado) | CPF correto |
|---|---|---|
| AIRTON LUIZ MORAES JUNIOR | 001.176.710-37 | 006.282.950-57 |
| ALICE BRINCKMANN OLIVEIRA NETTO | 006.282.950-57 | 027.348.880-50 |
| ALICE MUELLER | 027.348.880-50 | 033.690.110-00 |
| ALICE OSÓRIO DORNELES | 033.690.110-00 | 834.636.740-68 |
| ALONSO ALEJANDRO GONZALEZ CORNEJO | 051.123.250-03 | 124.182.231-08 |
| AMANDA ELY PATZER | 124.182.231-08 | 031.206.850-62 |
| ANA CLARA PURPER DA SILVA | *(vazio)* | 023.279.930-08 |
| ANA LUCIA GONZALEZ | 023.279.930-08 | 298.405.838-08 |
| ANTONIO VAN BASTEN MACHADO | 298.405.838-08 | 017.168.610-12 |
| ARTUR ZANELATTO SANTOS | 017.168.610-12 | 729.505.871-00 |
| BÁRBARA BORQUES SANTANA | 729.505.871-00 | 010.227.280-83 |
| BÁRBARA MIGLIORINI NUNES | 010.227.280-83 | 010.854.550-41 |
| BETINA SCHNEIDER DE LIMA | 010.854.550-41 | 019.223.800-08 |
| BIANCA BUENO AIRES | 019.223.800-08 | 017.630.520-36 |
| BRUNA CALABRIA DINIZ | 017.630.520-36 | 029.732.970-79 |
| BRUNA MEYER | 029.732.970-79 | 010.754.500-47 |
| BRUNO CARDOSO PEREIRA | 004.431.290-37 | 817.326.270-53 |
| BRUNO SIMÕES DO CANTO | 817.326.270-53 | 026.856.890-10 |
| BRUNO TEIXEIRA NOGUEIRA | 026.856.890-10 | 018.906.770-51 |
| CAMILA BOFF | 018.906.770-51 | 938.860.800-30 |
| CAMILA CANALI SCHMITZ | 938.860.800-30 | 011.747.040-63 |
| CAMILA MOREIRA RAFFAINER | 011.747.040-63 | 369.386.518-33 |
| CAMILLE DAME ABREU | 369.386.518-33 | 003.547.460-22 |
| CARLA CIMONE PORTES RODRIGUES | 003.547.460-22 | 777.065.360-68 |
| CARLA LUCIANE SOARES FURTAT | 777.065.360-68 | 659.592.300-97 |
| CARLOS AUGUSTO PICCININI | 659.592.300-97 | 009.088.250-48 |
| CARLOS ROBERTO WINCKLER | 009.088.250-48 | 285.357.900-04 |
| CARMEM MARIA GALVÃO | 285.357.900-04 | 026.541.070-35 |
| CAROLINA GUERRA BAIÃO | 026.541.070-35 | 938.877.870-72 |
| CAROLINA NOCCHI GUERRA | 938.877.870-72 | 008.383.720-58 |
| CÁTIA AGNE VANZELLOTTI | 008.383.720-58 | 014.480.610-08 |
| CECILIA PELISOLI GAFFORELLI | 014.480.610-08 | 030.056.780-40 |
| CELIA POHLMANN GARCIA | 030.056.780-40 | 360.731.300-82 |
| DAIANE HEMIELEWSKI | 234.178.890-49 | 001.176.710-37 |
| ERIC TEMPASS HAFEMEISTER | *(vazio)* | 020.586.920-39 |
| RAFAEL MARQUES DOS SANTOS | *(vazio)* | 028.603.560-02 |

### Como será feito

Uma única operação `UPDATE` na tabela `alunos`, mirando por `id` (já mapeado), aplicando os 36 novos CPFs. Atualização feita em duas passadas para evitar colisão temporária com o índice único de CPF: primeiro limpando os CPFs afetados, depois gravando os valores corretos.

### Observações (não serão alteradas sem sua confirmação)

- **Nomes da sua lista que não estão entre os ativos no sistema** (não cadastrados ou com outro status): ADEMAR FERNANDES JÚNIOR, ALICE NOVAES, ANA JULIA ARAÚJO DE CARVALHO, BRUNO FUNARI, BRUNO SILVA FUNARI, CELSO COMIRAN, DEBORA DA SILVA, EDUARDA BORDINI FERRO, ESTHEFANI PEIXOTO GUEDES, FÁBIO MALET, FELIPE GONZAGA SILVA, IVETE MADALENA COMIRAN, JESSICA LORENZZI ELKFURY, JULIO HENRIQUE PREDIGER, MARISTELA HARDER PETERS, MATHEUS SUÑE, MUSSA KADAN, NICOLAS SJ, STEPHANIE QUADROS DE CARVALHO.
- **Nomes ativos no sistema que não constam na sua lista**: ALLANA NUNES BENTO, ANA CAROLINA TESAINER MITIDIERO, ELIEZER BERNART, FERNANDO NARCIZO LEAL, JULIA PEREIRA SILVEIRA, NATHALIA NUNES DA CONCEICAO.
- **Atenção:** na lista enviada, BRUNO FUNARI e BRUNO SILVA FUNARI aparecem com o mesmo CPF (022.288.780-06) — provável duplicidade. Como nenhum dos dois está ativo na base, não fará diferença agora, mas vale revisar.

Me confirme para aplicar a correção dos 36 CPFs.