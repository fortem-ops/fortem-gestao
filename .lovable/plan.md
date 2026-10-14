# ANEXO I no checkout do /planos — cópia da operação atual

Somente plano. Nada implementado.

## Decisão do dono
O anexo do site é uma cópia do `/assinar` de hoje. O que o cliente preencher aparece no sistema exatamente como hoje, sem telas novas:
- ficha do aluno > Resumo > Jurídico (Contrato / Termo de Aptidão Física / Direito de Imagem);
- Portal do aluno;
- Anexos Jurídicos.

## Como funciona hoje (conferido)
- `/assinar` tem 5 etapas: dados pessoais + contato de emergência; termos (rolagem obrigatória) + LGPD; avaliação médica ("Sem restrições" / "Com restrições", esta com atestado obrigatório); uso de imagem (Autorizo / Não autorizo); assinatura desenhada.
- A função `submit-legal-annex` grava em `legal_annexes` com tipo "anexo", mantendo uma linha por CPF.
- O próprio banco já faz o resto: protege o CPF (`trg_legal_annex_secure_cpf`), liga ao aluno (`trg_legal_annex_link_aluno`), valida os dados, registra auditoria e aplica a validade de 1 ano a partir da gravação (`valid_until`).
- Atestado: guardado no espaço privado `legal_annex_attachments`.

## O que será feito
1. **Na tela do contrato** (antes de aceitar), dentro do mesmo passo:
   - mostrar o contrato e, abaixo, o ANEXO I com os mesmos componentes do `/assinar`: `TermsContent`, `MedicalEvaluation`, `ImageAuthorization`, consentimento LGPD e `SignaturePad`;
   - aplicar o visual claro do /planos;
   - o botão "Aceitar" só funciona com tudo preenchido.
2. **Sem pedir duas vezes:** nome, CPF, e-mail, telefone (WhatsApp) e nascimento vêm do cadastro do checkout. O site só pede o que falta: contato de emergência (nome + telefone), as duas escolhas e a assinatura.
3. **"Com restrições":** igual ao balcão, com envio de atestado obrigatório. O envio acontece pelo servidor, ligado à proposta, porque o cliente do site não tem login.
4. **Assinatura:** desenhada, como no balcão. Assim, os cards e Anexos Jurídicos ficam iguais. O clique de aceite continua registrando IP e hash do contrato.
5. **Gravação:** feita pelo mesmo núcleo do `submit-legal-annex`, com as mesmas regras e valores (`anexo`, `ok`/`restricao`, `image_usage`, `signed_at`, validade padrão, `aluno_id` preenchido pela ligação do banco).
   - Na ativação (após o pagamento), as respostas guardadas no aceite são gravadas em `legal_annexes`, com o aluno já existente.
   - Teste: grava só no NICOLAS TESTE, nunca no cadastro do CPF real.
6. **Aceite do contrato:** passa a registrar que o anexo foi aceito, com as duas respostas, a versão do texto do anexo, a impressão do conteúdo do anexo (sem a imagem da assinatura), IP e horário.
   - Essa marca entra no hash do contrato, num bloco "ANEXO I aceito" anexado ao contrato.
   - O mesmo bloco vai no e-mail da Fase E.
7. **"Alterar" depois do aceite:** apaga o anexo pendente junto com o aceite.

## Divergência no texto do contrato
- O contrato 2027 (3ª §7) diz: "realizou avaliação médica prévia **ou** opta, por sua conta e risco, praticar sem avaliação médica recente".
- O anexo atual diz: "Nenhum médico informou restrições" / "Possuo limitações atestadas".
- Proposta mínima (o dono pode trocar o texto do contrato depois): "...obrigando-se a assinalar expressamente o campo referente à Avaliação Médica, declarando se possui ou não restrições médicas à prática de atividade física, apresentando atestado quando houver restrição."
- O site não muda por causa disso; só o texto dos 22 modelos ativos.

## Impacto
- **Pagamento:** nada muda.
- **Ativação automática:** um passo a mais dentro da ativação segura. Se falhar, gera aviso e nunca desfaz o pagamento.
- **Contratos e anexos já existentes, balcão e `/assinar`:** intactos.
- **Anexo antigo no mesmo CPF:** a regra atual é uma linha por CPF, que é substituída. O anexo do site substitui o anterior, como hoje acontece se o aluno assina de novo.
- **Banco:** 1 migração pequena. Novos campos no aceite (anexo pendente + versão) e ajuste em aceitar, gerar contrato e ativar. O texto e o script de volta serão mostrados antes de aplicar.
- **Testes:**
  - Vitest: aceite bloqueado sem anexo; "Com restrições" exige atestado.
  - Ensaios em transação desfeita: aceite inválido recusado; hash inclui o anexo; ativação grava em `legal_annexes` do NICOLAS TESTE e a ficha mostra os 3 cards.
  - Regressões: Fase E, Alterar, 12x, Pix, recorrência.

## Decisões que ainda dependem do dono
1. Aceita o texto mínimo proposto para a 3ª §7 dos contratos (agora ou depois)?
2. "Com restrições" no site: aceitar com atestado (recomendado, igual ao balcão) ou bloquear a compra e mandar ao WhatsApp?
3. Menores de idade: o nascimento já é pedido. Bloquear compra de menores de 18 anos no site e mandar ao WhatsApp?
4. Quando o anexo antigo do CPF ainda é válido (menos de 1 ano): substituir mesmo assim (regra atual) ou manter o antigo?

## Detalhes técnicos
- Extrair o núcleo de validação/gravação de `submit-legal-annex` para `_shared/legal-annex.ts`, usado pelas duas funções, sem mudar o comportamento de `/assinar`.
- O anexo pendente fica no aceite (`propostas_2027_aceites.anexo jsonb` + `anexo_versao`). A assinatura fica no armazenamento privado com caminho por proposta. O CPF nunca é gravado em JSON ou log.
- `fn_checkout_2027_contrato_gerar` adiciona o bloco do ANEXO I ao HTML com hash; `fn_checkout_2027_ativar` chama a gravação.
