import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import {
  WHATSAPP_NUMERO,
  formatBRL,
  getFrequencia,
  getPlano,
  precoFinal,
  type FrequenciaPlano,
  type PlanoId,
} from "@/data/planosPricing";

interface Props {
  frequencia: FrequenciaPlano;
  plano: PlanoId;
  recorrencia: boolean;
}

export function montarMensagem(frequencia: FrequenciaPlano, plano: PlanoId, recorrencia: boolean): string {
  const valor = precoFinal(frequencia, plano, recorrencia);
  const extra = recorrencia && !getPlano(plano).recorrenciaNativa ? " + recorrência mensal" : "";
  return `Olá! Montei meu plano no site da Fortem: ${getFrequencia(frequencia).label} – ${getPlano(plano).nome} – ${formatBRL(valor)}/mês${extra}. Gostaria de finalizar minha matrícula.`;
}

export function montarUrlWhatsApp(frequencia: FrequenciaPlano, plano: PlanoId, recorrencia: boolean): string {
  return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(
    montarMensagem(frequencia, plano, recorrencia),
  )}`;
}

/** Botão final de conversão — abre o WhatsApp com a escolha resumida. */
const WhatsAppCta = ({ frequencia, plano, recorrencia }: Props) => (
  <Button asChild size="lg" className="w-full text-base font-bold">
    <a
      href={montarUrlWhatsApp(frequencia, plano, recorrencia)}
      target="_blank"
      rel="noopener noreferrer"
    >
      <MessageCircle className="mr-2 h-5 w-5" />
      COMEÇAR A TREINAR AGORA
    </a>
  </Button>
);

export default WhatsAppCta;
