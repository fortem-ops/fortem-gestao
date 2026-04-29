## Objetivo

Exibir a **Localização** de cada parceiro no card da aba "Parceiros" do Clube FORTEM, com um link clicável que abre o local no Google Maps.

## Onde aparece

- `src/components/clube/PartnersList.tsx` — usado em duas telas:
  - `/clube` (visão professor/coordenador)
  - `/portal/clube` (Portal do Aluno)

A mudança beneficia ambas automaticamente.

## Alterações

### 1. Banco de dados (migração)

A tabela `parceiros` hoje tem `latitude` e `longitude`, mas **não tem um campo de endereço textual**. Vou adicionar:

- `endereco` (text, nullable) — endereço completo legível (ex.: "Av. Paulista, 1000 — São Paulo/SP")

Sem mudanças em RLS (as políticas atuais já cobrem o novo campo).

### 2. Formulário admin de parceiros

Em `src/components/clube/AdminParceirosTable.tsx` (form de criar/editar parceiro): adicionar campo "Endereço" no formulário, gravando em `parceiros.endereco`.

### 3. Card do parceiro (`PartnersList.tsx`)

No card de cada parceiro, adicionar uma linha "Localização" com:

- Ícone `MapPin` + texto do endereço (ou "Ver no mapa" como fallback quando só houver coordenadas).
- Link clicável (`<a target="_blank" rel="noopener noreferrer">`) construído assim:
  - Se houver `latitude` e `longitude`: `https://www.google.com/maps/search/?api=1&query=<lat>,<lng>`
  - Senão, se houver `endereco`: `https://www.google.com/maps/search/?api=1&query=<encodeURIComponent(endereco)>`
  - Senão: não renderiza a linha.
- Mantém a exibição de distância (km) já existente, agora ao lado do link.

Layout dentro do card (abaixo dos benefícios):

```text
[📍] Av. Paulista, 1000 — São Paulo/SP   ·  1.2 km
     ↑ link azul, abre Google Maps em nova aba
```

### 4. Tipos

`src/integrations/supabase/types.ts` é regenerado automaticamente após a migração — nenhuma edição manual.

## Fora de escopo

- Mapa embutido (iframe) — somente link externo, conforme pedido.
- Alterar a visão admin do mapa de parceiros.
