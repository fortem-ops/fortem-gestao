# 2C-1 — Inventário de lint (somente leitura)

Fonte: `bunx eslint . -f json -o /tmp/eslint.json`. Excluído: `WorkoutDetail.tsx` (onde estão os 7 `rules-of-hooks`). Nenhum arquivo, commit, banco ou função alterado.

## src/ e raiz (32 itens; raiz sem erros — `tailwind.config.ts` só tem aviso)

N | arquivo:linha | regra | trecho atual | correção proposta | classe
---|---|---|---|---|---
1 | src/components/clube/PartnerScanner.tsx:52 | unused-disable | `// eslint-disable-next-line react-hooks/exhaustive-deps` | remover comentário | a
2 | src/components/disparos/DisparosAvulsos.tsx:97 | no-unused-expressions | `const s = new Set(removidos); s.has(id) ? s.delete(id) : s.add(id); setSel(...)` | `if (s.has(id)) s.delete(id); else s.add(id);` — intencional (toggle) | a
3 | src/components/financeiro/ConciliarSaidaSoma.tsx:80 | no-unused-expressions | `const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n` | if/else — intencional (toggle) | a
4 | src/components/financeiro/EstornarCobrancaDialog.tsx:46 | unused-disable | `// eslint-disable-next-line react-hooks/exhaustive-deps` | remover comentário | a
5 | src/components/notificar/NotificacaoDetail.tsx:6 | no-useless-escape | `txt.split(/(\/financeiro\/[\w\-/]+(?:\?[\w=&\-]+)?)/g)` | `[\w/-]` e `[\w=&-]` (mesmo conjunto) | a
6 | src/components/pipeline/PipedriveImportSheet.tsx:174 | no-unused-expressions | `n.has(id) ? n.delete(id) : n.add(id);` | if/else — intencional | a
7 | src/components/pipeline/PipelineLeadSummary.tsx:54 | prefer-const | `let nameMap: Record<string, string> = {};` | `const` | a
8 | src/components/planos/CartaoPagamento2027.tsx:42 | unused-disable | `useEffect(() => { if (fase === "aprovado" && t) { ... /* eslint-disable ... */` | remover comentário | a
9 | src/components/planos/CheckoutSite2027.tsx:112 | unused-disable | `useEffect(() => { carregarRevisao(); /* eslint-disable-next-line ... */ }, [` | remover comentário | a
10 | src/components/planos/ConsultasPagamentoPrevia2027.tsx:37 | unused-disable | `useEffect(() => { void chamar('estado'); /* eslint-disable-next-line ... */` | remover comentário | a
11 | src/components/planos/PagamentoReservado2027.tsx:51 | unused-disable | `useEffect(() => { if (t?.status === "aprovado") { ... /* eslint-disable ... */` | remover comentário | a
12 | src/components/ponto/MeuRelatorioPonto.tsx:251 | prefer-const | `let statusFechamento = "aberto";` | `const` | a
13 | src/components/ponto/MeusAcordosIntervalo.tsx:41 | no-empty | `} catch {}` | comentário `/* IP é opcional */` no bloco | a
14 | src/components/student/StudentPicker.tsx:77 | unused-disable | `// eslint-disable-next-line no-constant-condition` | remover comentário | a
15 | src/components/ui/command.tsx:24 | no-empty-object-type | `interface CommandDialogProps extends DialogProps {}` | `type CommandDialogProps = DialogProps;` | a
16 | src/components/ui/textarea.tsx:5 | no-empty-object-type | `export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}` | `export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;` | a
17 | src/contexts/NotifChatContext.tsx:33 | no-empty | `} catch {}` | comentário explicando fallback | a
18 | src/contexts/NotifChatContext.tsx:39 | no-empty | `} catch {}` | comentário explicando fallback | a
19 | src/lib/despesasExport.ts:38 | no-useless-escape | `meta.periodo.replace(/[\/\s]/g, "-")` | `/[/\s]/g` | a
20 | src/lib/logger.ts:35 | unused-disable | `// eslint-disable-next-line no-console` | remover comentário | a
21 | src/lib/studentImport.ts:309 | prefer-const | `let val = value;` | `const` | a
22 | src/pages/CarteiraAlunos.tsx:205 | no-unused-expressions | `next.has(id) ? next.delete(id) : next.add(id);` | if/else — intencional | a
23 | src/pages/CarteiraAlunos.tsx:390 | no-unused-expressions | `onCheckedChange={(e) => { e && e !== true; toggleSelect(aluno.id); }}` | remover `e && e !== true;` (não faz nada hoje) — parece guarda esquecida/resto de edição | c
24 | src/pages/CarteiraConsultor.tsx:206 | no-unused-expressions | `next.has(id) ? next.delete(id) : next.add(id);` | if/else — intencional | a
25 | src/pages/Leads.tsx:44 | no-unused-expressions | `n.has(id) ? n.delete(id) : n.add(id);` | if/else — intencional | a
26 | src/pages/Pipeline.tsx:35 | no-empty | `try { window.localStorage.setItem(VIEW_STORAGE_KEY, viewMode); } catch {}` | comentário no bloco | a
27 | src/pages/Prospects.tsx:63 | no-unused-expressions | `n.has(id) ? n.delete(id) : n.add(id);` | if/else — intencional | a
28 | src/pages/StudentList.tsx:357 | prefer-const | `let droppedReasons: Record<string, number> = {};` | `const` | a
29 | src/pages/financeiro/Contratos.tsx:177 | no-unused-expressions | `next.has(id) ? next.delete(id) : next.add(id);` | if/else — intencional | a
30 | src/pages/portal/PortalAgenda.tsx:723 | unused-disable | `// eslint-disable-next-line no-console` | remover comentário | a
31 | src/site/rastreamento.ts:91 | prefer-spread | `if (n.callMethod) n.callMethod.apply(n, args); else (n.queue as unknown[]).push(args);` | `n.callMethod(...args)` (mesmo `this`) | a
32 | src/site/rastreamento.ts:109 | prefer-spread | `if (f.callMethod) f.callMethod.apply(f, args); else f(...args);` | `f.callMethod(...args)` | a

### Contexto exigido

- **no-unused-expressions (toggles, itens 2,3,6,22,24,25,27,29):** todos seguem o padrão `const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;` dentro de `setX(...)`. Intencional.
- **Item 23 (CarteiraAlunos:388-392):**
  ```
  <Checkbox
    checked={selected.has(aluno.id)}
    onCheckedChange={(e) => { e && e !== true; toggleSelect(aluno.id); }}
    onClick={(e) => e.stopPropagation()}
  />
  ```
  A expressão não tem efeito; a caixa sempre alterna. Suspeita de condição esquecida, mas o comportamento atual parece correto.
- **no-empty — o que é engolido:**
  - 13 MeusAcordosIntervalo:41 — falha no `fetch("https://api.ipify.org")` para pegar o IP no aceite do acordo de intervalo; segue com `ip = null`. Não é pagamento nem banco: o erro do `insert` logo abaixo é tratado.
  - 17 NotifChatContext:33 — erro de `sessionStorage.getItem`/`JSON.parse` ao restaurar os chats abertos.
  - 18 NotifChatContext:39 — erro de `sessionStorage.setItem` (cota/modo privado).
  - 26 Pipeline:35 — erro de `localStorage.setItem` da preferência de visualização.
- **no-empty-object-type:** declarações estão nos itens 15 e 16 (componentes padrão da biblioteca de UI).

## supabase/functions/ (24 itens — só registro, não serão corrigidos agora)

N | arquivo:linha | regra | trecho atual | correção proposta | classe
---|---|---|---|---|---
33 | _shared/avisar-recusa.ts:25 | ban-ts-comment | `// @ts-ignore — disponível no runtime das edge functions` | `@ts-expect-error` + motivo | a
34 | _shared/avisar-recusa.ts:27 | ban-ts-comment | `// @ts-ignore` | `@ts-expect-error` + motivo | a
35 | _shared/inter-cob.ts:44 | ban-ts-comment | `// @ts-ignore Deno.createHttpClient is unstable ...` | idem | a
36 | _shared/inter-cob.ts:76 | ban-ts-comment | `// @ts-ignore unstable client option` | idem | a
37 | _shared/inter-cob.ts:134 | ban-ts-comment | `// @ts-ignore unstable client option` | idem | a
38 | _shared/inter-pagamento.ts:29 | ban-ts-comment | `// @ts-ignore unstable` | idem | a
39 | _shared/inter-pagamento.ts:48 | ban-ts-comment | `// @ts-ignore` | idem | a
40 | _shared/inter-pagamento.ts:77 | ban-ts-comment | `// @ts-ignore` | idem | a
41 | _shared/inter-pagamento.ts:86 | ban-ts-comment | `// @ts-ignore` | idem | a
42 | _shared/inter.ts:104 | ban-ts-comment | `// @ts-ignore Deno.createHttpClient is unstable ...` | idem | a
43 | _shared/inter.ts:118 | ban-ts-comment | `// @ts-ignore unstable client option` | idem | a
44 | _shared/inter.ts:187 | ban-ts-comment | `// @ts-ignore unstable client option` | idem | a
45 | _shared/inter.ts:229 | ban-ts-comment | `// @ts-ignore unstable client option` | idem | a
46 | agenda-ics/index.ts:156 | prefer-const | `let excecoesByAgenda = new Map<string, string[]>();` | `const` | a
47 | conciliar-extrato-diario/index.ts:251 | no-unused-expressions | `confianca === "exata" ? resumo.exatas++ : resumo.aproximadas++;` | if/else — intencional (contador). Contexto: `registrosUsados.add(c.id); resumo.conciliados++; <linha>; }` | a
48 | inter-extrato-sync/index.ts:183 | ban-ts-comment | `// @ts-ignore Deno.createHttpClient disponível no Edge Runtime` | `@ts-expect-error` + motivo | a
49 | inter-extrato-sync/index.ts:187 | ban-ts-comment | `// @ts-ignore` | idem | a
50 | inter-extrato-sync/index.ts:248 | ban-ts-comment | `// @ts-ignore unstable option` | idem | a
51 | inter-extrato-sync/index.ts:269 | ban-ts-comment | `// @ts-ignore unstable option` | idem | a
52 | mcp/index.ts:18 | no-var | `var list_alunos_default = defineTool({` | `const` (arquivo parece gerado por bundler) | a
53 | mcp/index.ts:57 | no-var | `var get_aluno_default = defineTool2({` | `const` | a
54 | mcp/index.ts:89 | no-var | `var agenda_do_dia_default = defineTool3({` | `const` | a
55 | mcp/index.ts:121 | no-var | `var projectRef = "dmudgqedzeosfpehpgep";` | `const` | a
56 | mcp/index.ts:122 | no-var | `var mcp_default = defineMcp({` | `const` | a

Observação: trocar `@ts-ignore` por `@ts-expect-error` não muda nada quando roda, mas acusa erro na checagem de tipos se a linha deixar de ter erro.

## Resumo

Pasta | (a) | (b) | (c) | total
---|---|---|---|---
src/ + raiz | 31 | 0 | 1 | 32
supabase/functions/ | 24 | 0 | 0 | 24
