# Adicionar "Agregador" no select de Nível mínimo (Novo benefício)

Em `src/components/clube/AdminBeneficiosTable.tsx` (linha 38), a constante `NIVEIS` que alimenta o select de "Nível mínimo" está hardcoded sem `agregador`.

## Mudança

Incluir `"agregador"` no array (no início, mantendo a ordem crescente de privilégio):

```ts
const NIVEIS: NivelMembro[] = ["agregador", "start", "start_plus", "power", "pro", "max"];
```

O label já existe em `NIVEL_LABEL` (`"AGREGADOR"`), então a opção aparecerá automaticamente no `<Select>` de criação/edição de benefícios.
