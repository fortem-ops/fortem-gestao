## Objetivo

Trazer todos os termos já assinados no projeto **Consent & Care** (`jmdgxyzqaujxnclmvxlh`) para a tabela `legal_annexes` deste projeto, preservando nome, CPF, e-mail, data de assinatura, status médico, autorização de imagem, contato de emergência, tipo de documento, IP e a assinatura digital. Depois da migração, todos os registros aparecerão no painel `/anexos`.

## Análise

Verifiquei o schema do projeto-origem. As duas tabelas `legal_annexes` são quase idênticas — todos os campos do Consent & Care existem aqui:

| Campo | Origem | Destino |
|---|---|---|
| nome, cpf, email, telefone | ✓ | ✓ |
| data_nascimento, signed_at, valid_until | ✓ | ✓ |
| medical_status, image_usage, signature_data | ✓ | ✓ |
| emergency_contact_name / phone | ✓ | ✓ |
| document_type, ip_address | ✓ | ✓ |
| attachment_url, aluno_id | — | ✓ (ficam vazios) |

Não há perda de dados. O `aluno_id` será preenchido automaticamente pelo trigger `trg_legal_annex_link_aluno` sempre que o CPF bater com um aluno cadastrado.

## Bloqueio técnico

O `legal_annexes` do Consent & Care só permite `SELECT` para admins autenticados. Com a anon key pública não consigo ler os registros. Preciso da **service role key** do Consent & Care para extrair os dados uma única vez.

## Plano

### 1. Coletar credencial do projeto-origem

Solicitar ao usuário que adicione um secret `CONSENT_CARE_SERVICE_ROLE_KEY` (a service_role key do projeto Consent & Care, encontrada no painel daquele projeto em Cloud → Settings → API keys).

### 2. Criar edge function `migrate-from-consent-care` (one-shot)

Função protegida por admin que:

- Conecta ao Consent & Care via `https://jmdgxyzqaujxnclmvxlh.supabase.co` usando a service role key.
- Faz `SELECT *` paginado em `legal_annexes` (1000 por página).
- Para cada registro, verifica se já existe aqui o par (`cpf`, `signed_at`) — evita duplicatas em re-execuções.
- Faz `INSERT` em `legal_annexes` deste projeto preservando `signed_at`, `valid_until`, `created_at`.
- Retorna contagem: importados, ignorados (já existiam), com erro.

A função tem `verify_jwt = false` mas valida internamente que o chamador é admin via `getClaims` + `is_admin`.

### 3. Botão "Importar do Consent & Care" em `/anexos`

Adicionar no header do `AnexosJuridicos.tsx`:

- Visível só para admins.
- Abre confirmação ("Importar X registros do Consent & Care?").
- Chama a edge function e mostra toast com o resumo.
- Recarrega a lista.

### 4. Limpeza pós-migração

Após confirmação do usuário de que tudo veio certo, removo a edge function e o botão. O secret pode ser deletado também.

## O que NÃO faz parte deste plano

- **Sincronização contínua** entre os dois projetos. É uma migração única. Se o Consent & Care continuar recebendo assinaturas, conversamos depois sobre desativar ele ou apontar o domínio dele para este backend.
- **Migração de assinaturas como imagem** (PNG no Storage). O campo `signature_data` do origem guarda a string base64 da assinatura — eu copio essa string como está. Se o origem tiver gerado PNGs no Storage, eles ficam no projeto antigo (não acessíveis daqui). Posso, opcionalmente, regerar o PNG aqui durante a importação.

## Detalhes técnicos

**Mapeamento do INSERT (1:1 com fallbacks):**

```text
nome                     ← origem.nome
data_nascimento          ← origem.data_nascimento
cpf                      ← origem.cpf
telefone                 ← origem.telefone
email                    ← origem.email
emergency_contact_name   ← origem.emergency_contact_name
emergency_contact_phone  ← origem.emergency_contact_phone
medical_status           ← origem.medical_status
image_usage              ← origem.image_usage
signature_data           ← origem.signature_data (base64)
document_type            ← origem.document_type
ip_address               ← origem.ip_address
signed_at                ← origem.signed_at        (preservado)
valid_until              ← origem.valid_until      (preservado)
created_at               ← origem.created_at       (preservado)
attachment_url           ← NULL
aluno_id                 ← NULL (trigger preenche se CPF bater)
```

**Deduplicação:** chave lógica `(cpf, signed_at)` — extremamente improvável colidir entre pessoas/momentos diferentes.

**Pseudo-fluxo da edge function:**

```text
1. Validar admin (getClaims → is_admin)
2. supabaseOrigem = createClient(URL_origem, SERVICE_ROLE_origem)
3. supabaseDestino = createClient(URL_local, SERVICE_ROLE_local)
4. loop paginado (range 0..999, 1000..1999, ...)
   - selectAll do origem
   - filtrar os que já existem no destino (cpf+signed_at)
   - bulk insert no destino
5. retornar { importados, ignorados, erros, total_origem }
```

## Riscos

- **Service role key vaza se commitada.** Por isso uso secret e edge function — nunca front-end.
- **Trigger `trg_legal_annex_validate` rejeita document_type fora do esperado.** Vou normalizar para `'anexo'` se vier inválido.
- **Trigger de e-mail (`submit-legal-annex`) não dispara nesta importação** porque o INSERT é direto, não via edge function. Isso é intencional — não queremos reenviar e-mail para todos os assinantes antigos.
