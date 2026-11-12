import { Link } from "react-router-dom";
import { Seo } from "@/components/Seo";
import logoBranco from "@/assets/fotos-evento/logo-fortem-branco.svg.asset.json";
import { EMAIL_CONTATO } from "@/site/config";
import "./fotosEvento.css";

export default function PrivacidadeFotos() {
  return (
    <main className="fotos-evento">
      <Seo title="Privacidade das fotos da festa | FORTEM" description="Como a FORTEM trata sua selfie e suas fotos na busca por reconhecimento facial da festa de 10 anos." path="/10anos/fotos/privacidade" />
      <div className="fe-app">
        <header className="fe-topo"><img src={logoBranco.url} alt="FORTEM" className="fe-logo" /><span className="fe-10anos">10 ANOS</span></header>
        <article className="fe-corpo fe-privacidade">
          <Link to="/10anos/fotos" className="fe-link">Voltar para as fotos</Link>
          <h1 className="fe-h1">PRIVACIDADE DAS FOTOS</h1>
          <h2>Sua selfie</h2>
          <p>Usamos a selfie só para localizar as fotos em que você aparece na festa de 10 anos. Ela é enviada a um serviço de reconhecimento facial da AWS (Amazon), comparada com os rostos das fotos do evento e descartada logo após a busca. A selfie não é gravada em nenhum arquivo, banco de dados ou registro.</p>
          <h2>Fotos do evento</h2>
          <p>As fotos do fotógrafo e as enviadas por convidados (depois da aprovação da equipe) ficam guardadas de forma privada e só aparecem por links temporários. Os rostos dessas fotos são registrados para permitir a busca.</p>
          <h2>Seus dados</h2>
          <p>Guardamos nome, WhatsApp, e-mail (se informado) e a data e hora das suas autorizações, para registrar o uso e falar com você sobre o evento.</p>
          <h2>Por quanto tempo</h2>
          <p>Ao fim do prazo de guarda do evento (90 dias, salvo aviso), apagamos as fotos e os registros de rostos.</p>
          <h2>Seus direitos</h2>
          <p>Você pode pedir a remoção de uma foto ou dos seus dados pelo e-mail <a href={`mailto:${EMAIL_CONTATO}`} className="fe-link-inline">{EMAIL_CONTATO}</a>. A política completa do site está em <Link to="/privacidade" className="fe-link-inline">soufortem.com.br/privacidade</Link>.</p>
        </article>
      </div>
    </main>
  );
}
