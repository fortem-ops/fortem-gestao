import TermsContent from "@/components/legal-annex/TermsContent";
import { Seo } from "@/components/Seo";

const TermoAptidaoUsoImagem = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Seo
        title="Termo de Aptidão Física e Uso de Imagem — Fortem"
        description="Leia o termo de aptidão física e autorização de uso de imagem da Fortem Treinamento Físico, aceito por alunos e participantes das atividades."
        path="/termos/aptidao-fisica-uso-imagem"
      />
      <main className="max-w-3xl mx-auto px-4 py-10 sm:py-16">
        <header className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Termo de Aptidão Física e Uso de Imagem
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Fortem Treinamento Físico Ltda.
          </p>
        </header>

        <article className="space-y-8 leading-relaxed text-[15px]">
          <TermsContent />
        </article>
      </main>
    </div>
  );
};

export default TermoAptidaoUsoImagem;
