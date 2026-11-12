// Regras puras da página pública /10anos/fotos (testáveis sem navegador).
import { arquivoAceito } from "@/lib/fotosEventos";
import { whatsappValido } from "@/lib/festa10anos";

export const SLUG_FESTA = "10anos";
export const MAX_FOTOS_ENVIO = 30;

export type DadosBusca = { nome: string; whatsapp: string; email: string; aceite: boolean };
export type DadosEnvio = { nome: string; whatsapp: string; aceite: boolean; qtd: number };

const emailOk = (e: string) => !e.trim() || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.trim());

/** Lista de problemas do formulário de busca; vazio = pode tirar a selfie. */
export function problemasBusca(d: DadosBusca): string[] {
  const p: string[] = [];
  if (d.nome.trim().length < 2) p.push("Informe seu nome.");
  if (!whatsappValido(d.whatsapp)) p.push("Informe um WhatsApp com DDD.");
  if (!emailOk(d.email)) p.push("Confira o e-mail ou deixe em branco.");
  if (!d.aceite) p.push("Marque a autorização para usar a selfie.");
  return p;
}

export function problemasEnvio(d: DadosEnvio): string[] {
  const p: string[] = [];
  if (d.nome.trim().length < 2) p.push("Informe seu nome.");
  if (!whatsappValido(d.whatsapp)) p.push("Informe um WhatsApp com DDD.");
  if (d.qtd < 1) p.push("Selecione pelo menos uma foto.");
  if (d.qtd > MAX_FOTOS_ENVIO) p.push(`Selecione no máximo ${MAX_FOTOS_ENVIO} fotos.`);
  if (!d.aceite) p.push("Marque a declaração sobre as fotos.");
  return p;
}

/** Junta novas fotos às já escolhidas: ignora tipos/tamanhos inválidos e corta em 30. */
export function adicionarFotos<T extends { type: string; name: string; size: number }>(atuais: T[], novas: T[]): { lista: T[]; recusadas: number; excedentes: number } {
  const validas = novas.filter(arquivoAceito);
  const espaco = Math.max(0, MAX_FOTOS_ENVIO - atuais.length);
  return { lista: [...atuais, ...validas.slice(0, espaco)], recusadas: novas.length - validas.length, excedentes: Math.max(0, validas.length - espaco) };
}

export function textoContador(n: number): string { return `${n} de ${MAX_FOTOS_ENVIO}`; }
export function textoBotaoEnvio(n: number): string { return n === 1 ? "ENVIAR 1 FOTO" : `ENVIAR ${n} FOTOS`; }
export function textoEncontradas(n: number): string { return n === 1 ? "ENCONTRAMOS 1 FOTO SUA" : `ENCONTRAMOS ${n} FOTOS SUAS`; }
export function textoRecebidas(n: number): string { return n === 1 ? "RECEBEMOS SUA FOTO" : `RECEBEMOS SUAS ${n} FOTOS`; }

/** Mensagens claras para os códigos devolvidos pelo servidor. */
export function mensagemErro(codigo: string): string {
  const m: Record<string, string> = {
    limite_buscas: "Você fez muitas buscas na última hora. Tente de novo mais tarde.",
    limite_envios: "Você fez muitos envios na última hora. Tente de novo mais tarde.",
    verificacao_necessaria: "Confirme a verificação de segurança e tente de novo.",
    rosto_nao_detectado: "Não conseguimos ver um rosto na selfie. Tente de frente e num lugar claro.",
    selfie_invalida: "A selfie não pôde ser lida. Tente outra.",
    evento_nao_encontrado: "As fotos desta festa ainda não estão disponíveis.",
    aceite_obrigatorio: "Marque a autorização para continuar.",
    dados_invalidos: "Confira nome e WhatsApp.",
    arquivo_invalido: "Uma das fotos não é aceita. Use JPEG, PNG ou HEIC até 15 MB.",
    quantidade_invalida: `Envie de 1 a ${MAX_FOTOS_ENVIO} fotos.`,
  };
  return m[codigo] ?? "Algo deu errado. Tente de novo em instantes.";
}

export function totalPaginas(total: number, porPagina: number): number { return Math.max(1, Math.ceil(total / Math.max(1, porPagina))); }

/** Tamanho da selfie enviada: maior lado até 1280px (Rekognition aceita até 5 MB). */
export function dimensoesSelfie(w: number, h: number, lado = 1280): { w: number; h: number } {
  const m = Math.max(w, h);
  if (m <= lado) return { w, h };
  const k = lado / m;
  return { w: Math.round(w * k), h: Math.round(h * k) };
}
