import { linkWhatsApp, type OrigemWhatsApp } from "../config";

export function Depoimentos({ itens = [] }: { itens?: { nome: string; texto: string }[] }) {
  return (
    <section className="sp-fundo-superficie py-16" aria-labelledby="sp-depoimentos">
      <div className="sp-container">
        <p className="sp-rotulo sp-texto-acao">Depoimentos</p>
        <h2 id="sp-depoimentos" className="mt-2 text-3xl">Quem treina na FORTEM</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {(itens.length ? itens : [1, 2, 3].map(() => ({ nome: "Nome do aluno", texto: "Depoimento em breve." }))).map((d, i) => (
            <blockquote key={i} className="sp-borda bg-[hsl(var(--sp-branco))] p-6">
              <p className="sp-texto2">“{d.texto}”</p>
              <footer className="sp-rotulo mt-4">{d.nome}</footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Horarios({ linhas = [] }: { linhas?: { dia: string; horario: string }[] }) {
  return (
    <section className="py-16" aria-labelledby="sp-horarios" id="horarios">
      <div className="sp-container">
        <p className="sp-rotulo sp-texto-acao">Horários e local</p>
        <h2 id="sp-horarios" className="mt-2 text-3xl">Quando estamos abertos</h2>
        <dl className="mt-8 max-w-xl">
          {(linhas.length ? linhas : [{ dia: "Segunda a sexta", horario: "Em breve" }, { dia: "Sábado", horario: "Em breve" }]).map((l) => (
            <div key={l.dia} className="flex justify-between border-b border-[hsl(var(--sp-cinza))] py-3">
              <dt className="sp-rotulo">{l.dia}</dt><dd className="sp-texto2">{l.horario}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export function ChamadaAcao({ titulo = "Comece pela sua avaliação", texto, origem = "geral" }: { titulo?: string; texto?: string; origem?: OrigemWhatsApp }) {
  return (
    <section className="sp-fundo-vermelho py-14">
      <div className="sp-container flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl">{titulo}</h2>
          {texto && <p className="mt-2 max-w-xl">{texto}</p>}
        </div>
        <a href={linkWhatsApp(origem)} target="_blank" rel="noopener noreferrer" aria-label="Falar no WhatsApp com a FORTEM (abre em nova aba)" className="sp-btn sp-btn-branco">Falar no WhatsApp</a>
      </div>
    </section>
  );
}
