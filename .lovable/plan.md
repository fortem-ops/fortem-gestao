# ANEXO I (Aptidão Física e Uso de Imagem) dentro do contrato do /planos

Somente plano. Nada implementado.

## 1. Situação atual (conferido)

- "Consent&Care" era um projeto separado; os registros foram trazidos para cá pela função `migrate-from-consent-care`. Hoje o anexo vive neste sistema:
  - Tabela `legal_annexes` (34 registros: 32 "anexo", 2 "experimental"; só 11 ligados a um aluno). Grava nome, nascimento, contato de emergência, `medical_status` ("ok"/"restricao"), `image_usage` (sim/não), assinatura desenhada, atestado anexado, IP, `signed_at`, `valid_until`, `cpf_hash`.
  - Assinatura pública em `/assinar` (`LegalAnnexFlow.tsx` + `components/legal-annex/*`), gravada por `submit-legal-annex` (uma linha por CPF+tipo, sobrescreve a anterior).
  - Ficha do aluno (`StudentSummary`) e Portal (`PortalContratos`, `PortalHome`) acham o anexo pelo `cpf_hash`, não pelo aluno.
  - Painel admin em `AnexosJuridicos.tsx`.
- Texto do anexo: está escrito direto na tela (`TermsContent.tsx`, `MedicalEvaluation.tsx`, `ImageAuthorization.tsx`), **sem número de versão**.
- **Divergência importante:** os 22 contratos ativos (§7º/§8º) pedem "realizou avaliação médica prévia" **ou** "opta, por sua conta e risco, por praticar sem avaliação médica recente". O anexo atual pergunta outra coisa: "sem restrições médicas" **ou** "com limitações atestadas" (esta exige enviar atestado). As opções não correspondem.
- **Alerta de segurança:** `legal_annexes` ainda guarda o CPF completo numa coluna aberta (`cpf`), além do hash e da versão cifrada.

## 2. Proposta para o checkout do /planos

Passo do contrato (antes do pagamento):
1. Logo abaixo do contrato, mostrar o ANEXO I com o texto oficial versionado (ex.: `anexo1-2027-v1`), guardado num único arquivo de configuração e igual no servidor.
2. Duas escolhas obrigatórias (o botão de aceitar só funciona com as duas):
   - Avaliação médica: "Realizei avaliação médica prévia" / "Opto, por minha conta e risco, por praticar sem avaliação médica recente".
   - Uso de imagem: "Autorizo" / "Não autorizo" (sem resposta = não autoriza; mesmo assim, a escolha é obrigatória).
3. Aceite (`fn_checkout_2027_aceitar` → `propostas_2027_aceites`): gravar as 2 respostas, a versão do anexo, IP, navegador e horário. O servidor confere se as respostas e a versão são válidas e recusa se faltar alguma.
4. Hash: o HTML do contrato passa a incluir o ANEXO I já com as respostas marcadas. Assim, o hash, o documento guardado e o e-mail da Fase E mostram exatamente o que foi aceito.
5. Ativação (`fn_checkout_2027_ativar`): criar uma linha em `legal_annexes` (tipo "anexo", origem "site_2027", ligada ao aluno, com `cpf_hash`, sem assinatura desenhada e com validade definida pelo dono). Assim, ficha e Portal mostram o anexo sem mudança de tela. Para não apagar um anexo de balcão mais recente, só gravar se for mais novo, ou sempre criar uma linha nova (decisão técnica abaixo).
6. "Alterar" depois do aceite já invalida o aceite: as respostas do anexo caem junto e precisam ser marcadas de novo.

## 3. Impactos

- Ativação automática: um passo a mais, dentro da mesma ativação segura (se falhar, gera aviso e nunca desfaz o pagamento). Teste continua só no NICOLAS TESTE.
- Contratos e propostas existentes: nada muda. Propostas com aceite antigo sem anexo seriam obrigadas a aceitar de novo, ou ficariam como estão (decisão do dono).
- Pagamento: nada muda (valor, parcelas, Pix, cartão, recorrência). O hash do contrato muda, mas o pagamento já se baseia no aceite novo.
- Balcão e `/assinar`: intactos.
- Testes: Vitest (aceite bloqueado sem as 2 respostas, texto no contrato e no e-mail), Deno/SQL em transação desfeita (aceite recusa respostas inválidas, hash inclui anexo, ativação grava o anexo no NICOLAS TESTE), regressões (Fase E, Alterar, 12x, Pix, recorrência).
- Banco: precisa de 1 migração (colunas de respostas/versão no aceite, origem em `legal_annexes`, ajuste no aceitar/gerar contrato/ativar). Mostro o texto da migração e o script de volta antes de aplicar.

## 4. Decisões do dono

1. **Opções da avaliação médica:** usar as do contrato (realizei / opto sem avaliação, recomendado), ou as do anexo atual (sem restrição / com restrição + atestado)? Se for "com restrição", o site teria que receber atestado (não recomendado no checkout).
2. **Texto exato do ANEXO I:** usar o texto atual da tela `/assinar` ajustado às opções do contrato, ou o dono envia o texto oficial?
3. **Menores de idade:** o cadastro do site não pede data de nascimento. Bloquear a compra de menores, exigir responsável legal ou só declarar "sou maior de 18 anos"?
4. **Validade** do anexo gravado na ficha (ex.: 12 meses ou o prazo do contrato)?
5. **Uso de imagem "Não autorizo":** apenas registrar, ou avisar a equipe/marketing?
6. **Propostas com aceite já feito** sem anexo: exigir novo aceite (recomendado) ou deixar como estão?
7. **Assinatura desenhada:** o site usa só aceite com clique (IP + hash), sem desenho. Isso basta?
8. Aproveitar para **remover o CPF aberto** de `legal_annexes` (projeto separado, com aprovação própria)?

## Detalhes técnicos

- Texto/versão: `src/config/anexo1Planos2027.ts` espelhado em `_shared` da função; versão incluída no hash.
- Aceite: `fn_checkout_2027_aceitar(..., p_anexo jsonb)` com `{versao, avaliacao_medica: 'realizou'|'sem_avaliacao', uso_imagem: bool}`; `fn_checkout_2027_contrato_gerar` adiciona o bloco do anexo ao HTML.
- `legal_annexes.medical_status` ganha os valores novos `realizou`/`sem_avaliacao`; ficha e Portal precisam exibir esses valores, com ajuste só de texto.
- Ordem: migração + ensaio desfeito → função `planos-checkout` → tela → testes → publicar função; Publish do app com o dono.
