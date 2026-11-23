// Estado do push da equipe neste aparelho (puro, testado).
export type EstadoPushAparelho = "sem_suporte" | "atalho_iphone" | "bloqueado" | "ativado" | "desativado";

export interface AmbientePush {
  temApis: boolean;
  ios: boolean;
  standalone: boolean;
  permissao: NotificationPermission | "indisponivel";
  inscrito: boolean;
}

export function estadoPushAparelho(a: AmbientePush): EstadoPushAparelho {
  if (a.ios && !a.standalone) return "atalho_iphone";
  if (!a.temApis) return "sem_suporte";
  if (a.permissao === "denied") return "bloqueado";
  return a.inscrito && a.permissao === "granted" ? "ativado" : "desativado";
}

export const TEXTO_ESTADO: Record<EstadoPushAparelho, string> = {
  sem_suporte: "Este navegador não recebe notificações.",
  atalho_iphone: "No iPhone, abra pelo atalho FORTEM Equipe da tela inicial para ativar as notificações.",
  bloqueado: "As notificações estão bloqueadas nas configurações do navegador deste aparelho.",
  ativado: "Notificações ativadas neste aparelho.",
  desativado: "Notificações desativadas neste aparelho.",
};
