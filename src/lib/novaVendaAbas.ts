// Nova Venda (R1): opções da aba "Planos". Só tela — cálculo e gravação ficam nos fluxos existentes.
// Start/Power/Pro/Consultoria vendem pelo fluxo 2027; Corrida e agregadoras/VIP pelo fluxo legado, intactos.

/** Liga a tela nova. false = volta ao seletor "Planos atuais / Planos 2027" (código antigo preservado). */
export const NOVA_VENDA_R1 = true;

export type OpcaoPlanoR1 =
  | { chave: string; label: string; tipo: "2027"; familia: string }
  | { chave: string; label: string; tipo: "legado"; nomes?: string[]; corrida?: boolean };

export const OPCOES_PLANOS_R1: OpcaoPlanoR1[] = [
  { chave: "start_2027", label: "Start", tipo: "2027", familia: "start_2027" },
  { chave: "power_2027", label: "Power", tipo: "2027", familia: "power_2027" },
  { chave: "pro_2027", label: "Pro", tipo: "2027", familia: "pro_2027" },
  { chave: "consultoria_online_2027", label: "Consultoria Online", tipo: "2027", familia: "consultoria_online_2027" },
  { chave: "corrida", label: "Corrida", tipo: "legado", corrida: true },
  { chave: "gympass", label: "Gympass/Wellhub", tipo: "legado", nomes: ["Gympass/Wellhub"] },
  { chave: "totalpass", label: "Total Pass", tipo: "legado", nomes: ["Total Pass"] },
  { chave: "vip", label: "VIP", tipo: "legado", nomes: ["VIP"] },
];

type PlanoLegado = { nome: string; atividade?: string | null };

/** Itens do catálogo legado que a opção mostra. Start antigo, Start+, Power/Pro antigos e Consultoria 6 meses ficam fora. */
export function filtrarPlanosLegadoR1<T extends PlanoLegado>(planos: T[], chave: string): T[] {
  const op = OPCOES_PLANOS_R1.find((o) => o.chave === chave);
  if (!op || op.tipo !== "legado") return [];
  if (op.corrida) return planos.filter((p) => p.atividade === "corrida");
  return planos.filter((p) => p.atividade !== "corrida" && (op.nomes ?? []).includes(p.nome));
}

/** Opções visíveis: as 2027 só para quem pode vender 2027 (mesma regra do servidor). */
export function opcoesPlanosVisiveis(podeVender2027: boolean): OpcaoPlanoR1[] {
  return OPCOES_PLANOS_R1.filter((o) => o.tipo === "legado" || podeVender2027);
}
