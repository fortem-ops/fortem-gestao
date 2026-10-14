// ANEXO I no contrato do /planos: mesmos componentes e textos do /assinar.
// Nome, CPF, e-mail, telefone e nascimento já vêm do cadastro; aqui só o que falta.
import TermsContent from "@/components/legal-annex/TermsContent";
import MedicalEvaluation from "@/components/legal-annex/MedicalEvaluation";
import ImageAuthorization from "@/components/legal-annex/ImageAuthorization";
import SignaturePad from "@/components/legal-annex/SignaturePad";
import { rolouAteOFim } from "@/lib/checkoutSite2027";
import { TEXTOS_CHECKOUT as C } from "@/config/planosPublicoTextos";

export const ANEXO1_VERSAO = "anexo1-2027-v1";

export type Anexo1Estado = {
  termos_lidos: boolean; medical_status: "ok" | "restricao" | null; image_usage: boolean | null;
  emergency_contact_name: string; emergency_contact_phone: string; lgpd: boolean; assinatura: string | null;
};
export const ANEXO1_VAZIO: Anexo1Estado = {
  termos_lidos: false, medical_status: null, image_usage: null, emergency_contact_name: "", emergency_contact_phone: "", lgpd: false, assinatura: null,
};

export function anexoCompleto(a: Anexo1Estado) {
  return a.termos_lidos && !!a.medical_status && a.image_usage !== null && a.lgpd && !!a.assinatura
    && a.emergency_contact_name.trim().length >= 3 && a.emergency_contact_phone.replace(/\D/g, "").length >= 10;
}

/** Corpo enviado ao servidor; a assinatura vai à parte e nunca entra no hash. */
export function anexoParaEnvio(a: Anexo1Estado) {
  return {
    anexo: {
      versao: ANEXO1_VERSAO, medical_status: a.medical_status, image_usage: a.image_usage, lgpd: a.lgpd, termos_lidos: a.termos_lidos,
      emergency_contact_name: a.emergency_contact_name.trim(), emergency_contact_phone: a.emergency_contact_phone.replace(/\D/g, ""),
    },
    anexo_assinatura: a.assinatura,
  };
}

export function Anexo1Checkout2027({ valor, onChange, nome }: { valor: Anexo1Estado; onChange: (f: (a: Anexo1Estado) => Anexo1Estado) => void; nome: string }) {
  const set = (p: Partial<Anexo1Estado>) => onChange((a) => ({ ...a, ...p }));
  return (
    <section aria-labelledby="anexo1-titulo" className="mt-8 border-t border-border pt-6">
      <h2 id="anexo1-titulo" className="font-display text-lg font-bold uppercase">{C.anexo.titulo}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{C.anexo.subtitulo}</p>
      <div tabIndex={0} role="document" aria-label={C.anexo.titulo}
        onScroll={(e) => { if (rolouAteOFim(e.currentTarget)) set({ termos_lidos: true }); }}
        className="mt-4 h-72 overflow-y-auto border border-border bg-card p-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <TermsContent />
      </div>
      <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">{valor.termos_lidos ? "Termos lidos até o fim." : C.anexo.leia}</p>

      <div className="mt-6">
        <MedicalEvaluation status={valor.medical_status} onStatusChange={(s) => set({ medical_status: s })}
          attestFile={null} onFileChange={() => {}} avisoSemAtestado={C.anexo.restricaoAviso} />
      </div>
      <div className="mt-6">
        <ImageAuthorization authorized={valor.image_usage} onAuthChange={(v) => set({ image_usage: v })} />
      </div>

      <h3 className="mt-6 text-base font-semibold">{C.anexo.emergencia}</h3>
      <div className="mt-2 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">{C.anexo.emergenciaNome}
          <input className="campo mt-2" value={valor.emergency_contact_name} maxLength={120} autoComplete="off"
            onChange={(e) => set({ emergency_contact_name: e.target.value })} />
        </label>
        <label className="block text-sm">{C.anexo.emergenciaTelefone}
          <input className="campo mt-2" inputMode="tel" value={valor.emergency_contact_phone} maxLength={20} autoComplete="off"
            onChange={(e) => set({ emergency_contact_phone: e.target.value })} placeholder="(51) 99999-9999" />
        </label>
      </div>

      <label className="mt-6 flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1 size-4 accent-[hsl(var(--primary))]" checked={valor.lgpd} onChange={(e) => set({ lgpd: e.target.checked })} />
        <span>{C.anexo.lgpdAntes}<a href="/privacidade" target="_blank" rel="noopener noreferrer" className="text-primary underline">{C.anexo.lgpdLink}</a>{C.anexo.lgpdDepois}</span>
      </label>

      <h3 className="mt-6 mb-2 text-base font-semibold">{C.anexo.assinatura}</h3>
      <SignaturePad signerName={nome} onSignatureChange={(s) => set({ assinatura: s })} />
    </section>
  );
}
