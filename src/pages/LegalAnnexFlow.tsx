import { useState } from "react";
import { ChevronRight, ChevronLeft, Check } from "lucide-react";
import fortemLogoRed from "@/assets/fortem-logo-red.png";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import ProgressBar from "@/components/legal-annex/ProgressBar";
import StudentDataForm, { StudentData, validateCPF } from "@/components/legal-annex/StudentDataForm";
import TermsScroller from "@/components/legal-annex/TermsScroller";
import MedicalEvaluation from "@/components/legal-annex/MedicalEvaluation";
import ImageAuthorization from "@/components/legal-annex/ImageAuthorization";
import SignaturePad from "@/components/legal-annex/SignaturePad";
import LegalPulse from "@/components/legal-annex/LegalPulse";
import { cn } from "@/lib/utils";

interface LegalAnnexFlowProps {
  documentType?: "anexo" | "experimental";
}

const LegalAnnexFlow = ({ documentType = "anexo" }: LegalAnnexFlowProps) => {
  const isExperimental = documentType === "experimental";
  const TOTAL_STEPS = 5;

  const [step, setStep] = useState(1);
  const [studentData, setStudentData] = useState<StudentData>({
    nome: "", dataNascimento: "", cpf: "", telefone: "", email: "",
    emergencyContactName: "", emergencyContactPhone: "",
  });
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof StudentData, string>>>({});
  const [hasReadTerms, setHasReadTerms] = useState(false);
  const [medicalStatus, setMedicalStatus] = useState<"ok" | "restricao" | null>(null);
  const [attestFile, setAttestFile] = useState<File | null>(null);
  const [medicalError, setMedicalError] = useState("");
  const [imageUsage, setImageUsage] = useState<boolean | null>(null);
  const [imageError, setImageError] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submitToDatabase = async () => {
    setSubmitting(true);
    try {
      let attachmentUrl: string | null = null;
      if (attestFile) {
        const fileExt = attestFile.name.split(".").pop();
        const filePath = `attestados/${crypto.randomUUID()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("legal_annex_attachments")
          .upload(filePath, attestFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("legal_annex_attachments").getPublicUrl(filePath);
        attachmentUrl = urlData.publicUrl;
      }

      const { error } = await supabase.functions.invoke("submit-legal-annex", {
        body: {
          document_type: documentType,
          nome: studentData.nome,
          data_nascimento: studentData.dataNascimento || null,
          cpf: studentData.cpf,
          telefone: studentData.telefone,
          email: studentData.email,
          emergency_contact_name: studentData.emergencyContactName,
          emergency_contact_phone: studentData.emergencyContactPhone,
          medical_status: medicalStatus!,
          image_usage: isExperimental ? false : imageUsage!,
          signature_data: signatureData,
          attachment_url: attachmentUrl,
        },
      });
      if (error) throw error;
      setCompleted(true);
    } catch (err: any) {
      console.error("Erro ao salvar:", err);
      toast.error("Erro ao salvar o documento. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const validateStep = (): boolean => {
    if (step === 1) {
      const errors: Partial<Record<keyof StudentData, string>> = {};
      if (!studentData.nome.trim()) errors.nome = "Nome é obrigatório";
      if (!studentData.dataNascimento) errors.dataNascimento = "Data é obrigatória";
      if (!validateCPF(studentData.cpf)) errors.cpf = "CPF inválido";
      if (studentData.telefone.replace(/\D/g, "").length < 10) errors.telefone = "Telefone inválido";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(studentData.email)) errors.email = "E-mail inválido";
      if (!studentData.emergencyContactName.trim()) errors.emergencyContactName = "Nome do contato é obrigatório";
      if (studentData.emergencyContactPhone.replace(/\D/g, "").length < 10) errors.emergencyContactPhone = "Telefone inválido";
      setFormErrors(errors);
      return Object.keys(errors).length === 0;
    }
    if (step === 2) return hasReadTerms;
    if (step === 3) {
      if (!medicalStatus) { setMedicalError("Selecione uma opção"); return false; }
      if (medicalStatus === "restricao" && !attestFile) { setMedicalError("Upload do atestado é obrigatório"); return false; }
      setMedicalError("");
      if (!isExperimental) {
        if (imageUsage === null) { setImageError("Selecione uma opção"); return false; }
        setImageError("");
      }
      return true;
    }
    if (step === 4) return agreedToTerms;
    if (step === 5) return !!signatureData;
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    if (step === TOTAL_STEPS) { submitToDatabase(); return; }
    setStep((s) => s + 1);
  };

  if (completed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-[560px] w-full text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
          <div className="mx-auto w-20 h-20 rounded-full bg-success/10 flex items-center justify-center">
            <Check className="w-10 h-10 text-success" />
          </div>
          <h1 className="section-title text-2xl">Assinatura Concluída</h1>
          <p className="body-text">Seu documento foi assinado com sucesso. Você receberá uma cópia por e-mail em instantes.</p>
          <div className="bg-card rounded-2xl card-shadow p-6 text-left space-y-3">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Nome</span><span className="text-sm font-medium">{studentData.nome}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">CPF</span><span className="text-sm font-mono">{studentData.cpf}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Avaliação médica</span><span className="text-sm font-medium">{medicalStatus === "ok" ? "Sem restrições" : "Com restrições"}</span></div>
            {!isExperimental && (
              <div className="flex justify-between"><span className="text-sm text-muted-foreground">Uso de imagem</span><span className="text-sm font-medium">{imageUsage ? "Autorizado" : "Não autorizado"}</span></div>
            )}
          </div>
          <div className="flex justify-center"><LegalPulse /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[560px] mx-auto py-8 px-6 space-y-8">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <img src={fortemLogoRed} alt="FORTEM" className="h-6 w-auto" />
          </div>
          <h1 className="section-title text-xl">Segurança e Saúde em Primeiro Lugar</h1>
          <p className="body-text text-sm">Este documento garante que sua prática na FORTEM seja segura e legalmente protegida.</p>
        </div>

        <ProgressBar currentStep={step} totalSteps={TOTAL_STEPS} />

        <div className="bg-card rounded-2xl card-shadow p-6 space-y-6">
          {step === 1 && (
            <>
              <div>
                <h2 className="section-title text-lg">Dados do Aluno</h2>
                <p className="body-text text-sm mt-1">Preencha seus dados pessoais para continuar.</p>
              </div>
              <StudentDataForm data={studentData} onChange={setStudentData} errors={formErrors} />
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <h2 className="section-title text-lg">
                  {isExperimental ? "Anexo I – Declaração de Aptidão Física" : "Anexo I – Declaração de Aptidão Física e Uso de Imagem"}
                </h2>
                <p className="body-text text-sm mt-1">Leia os termos abaixo com atenção. Role até o final para continuar.</p>
              </div>
              <TermsScroller onScrollComplete={setHasReadTerms} isExperimental={isExperimental} />
              {!hasReadTerms && (
                <p className="text-xs text-muted-foreground text-center">↓ Role até o final para habilitar o botão</p>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <MedicalEvaluation
                status={medicalStatus}
                onStatusChange={(s) => { setMedicalStatus(s); setMedicalError(""); }}
                attestFile={attestFile}
                onFileChange={setAttestFile}
                error={medicalError}
              />
              {!isExperimental && (
                <>
                  <div className="border-t border-border" />
                  <ImageAuthorization
                    authorized={imageUsage}
                    onAuthChange={(a) => { setImageUsage(a); setImageError(""); }}
                    error={imageError}
                  />
                </>
              )}
            </>
          )}

          {step === 4 && (
            <>
              <div>
                <h2 className="section-title text-lg">Aceite Final</h2>
                <p className="body-text text-sm mt-1">Confirme que você leu e compreendeu todos os termos.</p>
              </div>
              <button
                type="button"
                onClick={() => setAgreedToTerms(!agreedToTerms)}
                className={cn(
                  "w-full flex items-start gap-4 p-4 rounded-xl transition-all duration-200 bg-card card-shadow hover:card-shadow-hover",
                  agreedToTerms ? "ring-2 ring-primary bg-primary/5" : ""
                )}
              >
                <div className={cn(
                  "mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                  agreedToTerms ? "border-primary bg-primary" : "border-muted-foreground/30"
                )}>
                  {agreedToTerms && <Check className="w-3 h-3 text-primary-foreground" />}
                </div>
                <p className="text-sm text-foreground text-left">Declaro que li e concordo com todos os termos acima</p>
              </button>
            </>
          )}

          {step === 5 && (
            <>
              <SignaturePad onSignatureChange={setSignatureData} signerName={studentData.nome} />
              <p className="text-xs text-center text-muted-foreground">
                Ao clicar em "Assinar e Finalizar", você concorda com este documento com validade jurídica.
              </p>
            </>
          )}
        </div>

        <div className="flex items-center justify-between">
          {step > 1 ? (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)} className="gap-1">
              <ChevronLeft className="w-4 h-4" /> Voltar
            </Button>
          ) : <div />}

          <Button
            size="lg"
            onClick={handleNext}
            disabled={
              submitting ||
              (step === 2 && !hasReadTerms) ||
              (step === 4 && !agreedToTerms) ||
              (step === 5 && !signatureData)
            }
            className="gap-2"
          >
            {step === TOTAL_STEPS ? (
              <>Assinar e Finalizar <Check className="w-4 h-4" /></>
            ) : (
              <>Continuar <ChevronRight className="w-4 h-4" /></>
            )}
          </Button>
        </div>

        <div className="flex justify-center"><LegalPulse /></div>
      </div>
    </div>
  );
};

export default LegalAnnexFlow;
