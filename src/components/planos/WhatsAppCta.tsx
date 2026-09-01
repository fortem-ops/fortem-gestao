import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import {
  WHATSAPP_NUMERO,
  formatBRL,
  getFrequencia,
  getPlano,
  nomePlano,
  precoDe,
  type FrequenciaPlano,
  type PlanoId,
} from "@/data/planosPricing";

interface Props {
  frequencia: FrequenciaPlano;
  plano: PlanoId;
}

export function montarMensagem(frequencia: FrequenciaPlano, plano: PlanoId): string {
  const valor = precoDe(frequencia, plano);
  const horario = getPlano(plano).horario ? ` (${getPlano(plano).horario})` : "";
  return `Olá! Montei meu plano no site da Fortem: ${getFrequencia(frequencia).label} – ${nomePlano(frequencia, plano)}${horario} – ${formatBRL(valor)}/mês. Gostaria de finalizar minha matrícula.`;
}

export function montarUrlWhatsApp(frequencia: FrequenciaPlano, plano: PlanoId): string {
  return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(
    montarMensagem(frequencia, plano),
  )}`;
}

/** Botão final de conversão — abre o WhatsApp com a escolha resumida. */
const WhatsAppCta = ({ frequencia, plano }: Props) => (
  <Button asChild size="lg" className="w-full text-base font-bold">
    <a href={montarUrlWhatsApp(frequencia, plano)} target="_blank" rel="noopener noreferrer">
      <MessageCircle className="mr-2 h-5 w-5" />
      COMEÇAR A TREINAR AGORA
    </a>
  </Button>
);

export default WhatsAppCta;
