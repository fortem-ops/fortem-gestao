import { useEffect, useState } from "react";
import { WHATSAPP_NUMERO } from "@/site/config";
import {
  CALENDARIO_PROVAS_2027, agruparPorMes, mensagemProva, partesData, statusProva, type ProvaCalendario,
} from "@/site/conteudoCalendarioProvas";

function hojeLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Props = {
  provas?: ProvaCalendario[];
  /** Preparado para filtro futuro por mês (AAAA-MM); não usado hoje. */
  filtroMes?: string | null;
};

const CalendarioProvasSection = ({ provas = CALENDARIO_PROVAS_2027, filtroMes = null }: Props) => {
  // Calculado só no navegador, depois da primeira renderização.
  const [hoje, setHoje] = useState<string | null>(null);
  useEffect(() => setHoje(hojeLocal()), []);
  const grupos = agruparPorMes(provas).filter((g) => !filtroMes || g.chave === filtroMes);

  return (
    <section id="calendario" aria-labelledby="calendario-titulo" className="sp-cal" data-wa-origem="corrida-calendario">
      <div className="sp-cal-wrap">
        <h2 id="calendario-titulo" className="sp-cal-titulo">CALENDÁRIO DE PROVAS 2027</h2>
        <p className="sp-cal-apoio">
          As provas de 2027 que a equipe de corrida da FORTEM acompanha. O calendário pode ganhar novas datas ao longo do ano.
        </p>
        {grupos.map((g) => (
          <div key={g.chave} className="sp-cal-grupo">
            <div className="sp-cal-grupo-cab">
              <h3 className="sp-cal-grupo-titulo">{g.rotulo}</h3>
              <span className="sp-cal-grupo-linha" aria-hidden="true" />
              <span className="sp-cal-grupo-qtd">{g.provas.length === 1 ? "1 prova" : `${g.provas.length} provas`}</span>
            </div>
            <ul className="sp-cal-grade">
              {g.provas.map((p) => {
                const { dia, mes } = partesData(p.data);
                const status = hoje ? statusProva(p.data, hoje) : null;
                const realizada = status === "REALIZADA";
                const href = `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensagemProva(p.nome))}`;
                return (
                  <li key={p.id} className="sp-cal-card">
                    <div className="sp-cal-corpo">
                      <time dateTime={p.data} className="sp-cal-data">
                        <span className="sp-cal-dia">{dia}</span>
                        <span className="sp-cal-mesano"><span>{mes}</span><span>{p.data.slice(0, 4)}</span></span>
                      </time>
                      <h4 className="sp-cal-nome">{p.nome}</h4>
                      {p.local && <p className="sp-cal-extra">{p.local}</p>}
                      {p.distancias && p.distancias.length > 0 && (
                        <div className="sp-cal-dist">
                          <span className="sp-cal-dist-apoio">Distâncias da equipe FORTEM</span>
                          <ul className="sp-cal-dist-lista">
                            {p.distancias.map((d) => <li key={d} className="sp-cal-dist-item">{d}</li>)}
                          </ul>
                        </div>
                      )}
                      {p.observacao && <p className="sp-cal-extra">{p.observacao}</p>}
                    </div>
                    <div className="sp-cal-rodape">
                      <span className="sp-cal-status">{status ?? ""}</span>
                      <span className="sp-cal-links">
                        {!realizada && (
                          <a href={href} target="_blank" rel="noopener noreferrer" className="sp-cal-link"
                            aria-label={`Falar com a equipe sobre a ${p.nome} no WhatsApp (abre em nova aba)`}>
                            FALAR COM A EQUIPE →
                          </a>
                        )}
                        {p.linkInscricao && (
                          <a href={p.linkInscricao} target="_blank" rel="noopener" className="sp-cal-link">SITE DA PROVA →</a>
                        )}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
};

export default CalendarioProvasSection;
