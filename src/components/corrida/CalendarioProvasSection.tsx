import { useEffect, useState } from "react";
import { WHATSAPP_NUMERO } from "@/site/config";
import {
  CALENDARIO_PROVAS_2027, mensagemProva, ordenarProvas, partesData, provaRealizada,
} from "@/site/conteudoCalendarioProvas";

function hojeLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const CalendarioProvasSection = () => {
  // Calculado só no navegador, depois da primeira renderização.
  const [hoje, setHoje] = useState<string | null>(null);
  useEffect(() => setHoje(hojeLocal()), []);
  const provas = ordenarProvas(CALENDARIO_PROVAS_2027);

  return (
    <section id="calendario" aria-labelledby="calendario-titulo" className="sp-cal" data-wa-origem="corrida-calendario">
      <div className="sp-cal-wrap">
        <h2 id="calendario-titulo" className="sp-cal-titulo">CALENDÁRIO DE PROVAS 2027</h2>
        <p className="sp-cal-apoio">
          As provas de 2027 que a equipe de corrida da FORTEM acompanha. O calendário pode ganhar novas datas ao longo do ano.
        </p>
        <ol className="sp-cal-lista">
          {provas.map((p) => {
            const { dia, mes } = partesData(p.data);
            const realizada = hoje ? provaRealizada(p.data, hoje) : false;
            const href = `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensagemProva(p.nome))}`;
            return (
              <li key={p.id} className="sp-cal-item">
                <time dateTime={p.data} className="sp-cal-data">
                  <span className="sp-cal-dia">{dia}</span>
                  <span className="sp-cal-mes">{mes}</span>
                </time>
                <div className="sp-cal-info">
                  {realizada && <span className="sp-cal-realizada">REALIZADA</span>}
                  <h3 className="sp-cal-nome">{p.nome}</h3>
                  {p.local && <p className="sp-cal-extra">{p.local}</p>}
                  {p.distancias && <p className="sp-cal-extra">{p.distancias}</p>}
                  {p.observacao && <p className="sp-cal-extra">{p.observacao}</p>}
                </div>
                <div className="sp-cal-acoes">
                  {!realizada && (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="sp-cal-btn"
                      aria-label={`Falar com a equipe sobre a ${p.nome} no WhatsApp (abre em nova aba)`}>
                      FALAR COM A EQUIPE
                    </a>
                  )}
                  {p.linkInscricao && (
                    <a href={p.linkInscricao} target="_blank" rel="noopener" className="sp-cal-link">
                      SITE DA PROVA →
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
};

export default CalendarioProvasSection;
