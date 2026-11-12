import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Camera, Check, ChevronLeft, ChevronRight, Download, Upload, X } from "lucide-react";
import { Seo } from "@/components/Seo";
import { supabase } from "@/integrations/supabase/client";
import { maskWhatsApp } from "@/lib/festa10anos";
import {
  adicionarFotos, mensagemErro, problemasBusca, problemasEnvio, textoBotaoEnvio, textoContador, textoEncontradas, textoRecebidas, totalPaginas, MAX_FOTOS_ENVIO,
} from "@/lib/fotosPublico";
import { BUCKET_FOTOS } from "@/components/fotosEventos/api";
import { prepararFoto } from "@/components/fotosEventos/imagem";
import logoBranco from "@/assets/fotos-evento/logo-fortem-branco.svg.asset.json";
import { chamar, type EventoPublico, type FotoPublica } from "./api";
import Selfie from "./Selfie";
import TurnstileFotos from "./TurnstileFotos";
import "./fotosEvento.css";

type Tela = "inicio" | "selfie" | "buscando" | "resultado" | "vazio" | "galeria" | "enviado";
type Cor = "colorida" | "pb";
const PRIVACIDADE = "/10anos/fotos/privacidade";

function Topo() {
  return (
    <header className="fe-topo">
      <img src={logoBranco.url} alt="FORTEM" className="fe-logo" />
      <span className="fe-10anos">10 ANOS</span>
    </header>
  );
}
const Cantoneiras = () => <><span className="fe-cant fe-cant-sd" aria-hidden /><span className="fe-cant fe-cant-ie" aria-hidden /></>;

function Seletor<T extends string>({ opcoes, valor, onChange }: { opcoes: [T, string][]; valor: T; onChange: (v: T) => void }) {
  return <div className="fe-seletor">{opcoes.map(([v, r]) => <button key={v} className={v === valor ? "ativo" : ""} onClick={() => onChange(v)}>{r}</button>)}</div>;
}

function Grade({ fotos, cor, onAbrir }: { fotos: FotoPublica[]; cor: Cor; onAbrir: (i: number) => void }) {
  return (
    <div className="fe-grade">
      {fotos.map((f, i) => (
        <button key={f.id} onClick={() => onAbrir(i)} aria-label={`Abrir foto ${i + 1}`}>
          {f.url_previa && <img src={f.url_previa} alt="" loading="lazy" className={cor === "pb" ? "fe-pb" : ""} />}
        </button>
      ))}
    </div>
  );
}

/** Foto aberta. Formato e cor já ficam escolhidos; a moldura e o download chegam na próxima fase. */
function FotoAberta({ fotos, indice, cor, setCor, onFechar, onIndice }: { fotos: FotoPublica[]; indice: number; cor: Cor; setCor: (c: Cor) => void; onFechar: () => void; onIndice: (i: number) => void }) {
  const [formato, setFormato] = useState<"foto" | "stories">("foto");
  const f = fotos[indice];
  return (
    <div className="fe-tela fe-aberta">
      <div className="fe-selfie-topo">
        <button onClick={onFechar} aria-label="Voltar"><ChevronLeft className="h-5 w-5" /></button>
        <span>SUAS FOTOS</span><span className="fe-cinza">{indice + 1} de {fotos.length}</span>
      </div>
      <div className="fe-aberta-foto">
        {f?.url_previa && <img src={f.url_previa} alt="" className={cor === "pb" ? "fe-pb" : ""} />}
        {indice > 0 && <button className="fe-nav fe-nav-e" onClick={() => onIndice(indice - 1)} aria-label="Anterior"><ChevronLeft /></button>}
        {indice < fotos.length - 1 && <button className="fe-nav fe-nav-d" onClick={() => onIndice(indice + 1)} aria-label="Próxima"><ChevronRight /></button>}
      </div>
      <div className="fe-corpo">
        <p className="fe-label">FORMATO</p>
        <Seletor<"foto" | "stories"> opcoes={[["foto", "FOTO"], ["stories", "STORIES"]]} valor={formato} onChange={setFormato} />
        <p className="fe-label">COR</p>
        <Seletor<Cor> opcoes={[["colorida", "COLORIDA"], ["pb", "PRETO E BRANCO"]]} valor={cor} onChange={setCor} />
        <button className="fe-botao" disabled><Download className="h-4 w-4" />{formato === "foto" ? "BAIXAR FOTO" : "BAIXAR PARA STORIES"}</button>
        <p className="fe-nota">O download com a moldura da FORTEM fica disponível em breve.</p>
        {formato === "stories" && <p className="fe-nota">Marque a FORTEM quando postar.</p>}
      </div>
    </div>
  );
}

export default function FotosEventoPublico() {
  const [ev, setEv] = useState<EventoPublico | null>(null);
  const [indisponivel, setIndisponivel] = useState(false);
  const [aba, setAba] = useState<"encontrar" | "enviar">("encontrar");
  const [tela, setTela] = useState<Tela>("inicio");
  const [nome, setNome] = useState(""); const [whats, setWhats] = useState(""); const [email, setEmail] = useState("");
  const [aceite, setAceite] = useState(false); const [aceiteEnvio, setAceiteEnvio] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null); const [tsKey, setTsKey] = useState(0);
  const [progresso, setProgresso] = useState(0);
  const [encontradas, setEncontradas] = useState<FotoPublica[]>([]);
  const [cor, setCor] = useState<Cor>("colorida");
  const [aberta, setAberta] = useState<{ lista: FotoPublica[]; i: number } | null>(null);
  const [galeria, setGaleria] = useState<{ fotos: FotoPublica[]; total: number; pagina: number; por: number } | null>(null);
  const [arquivos, setArquivos] = useState<{ file: File; url: string }[]>([]);
  const [enviando, setEnviando] = useState(false); const [recebidas, setRecebidas] = useState(0);

  useEffect(() => { chamar<EventoPublico>("fotos-evento-publico", { acao: "evento" }).then(setEv).catch(() => setIndisponivel(true)); }, []);
  useEffect(() => () => arquivos.forEach((a) => URL.revokeObjectURL(a.url)), [arquivos]);
  useEffect(() => { window.scrollTo(0, 0); }, [tela, aba]);

  const ts = ev?.turnstile;
  const precisaToken = !!ts?.ativo;
  const tsPronto = !precisaToken || !!token;
  const novoToken = () => { setToken(null); setTsKey((k) => k + 1); };

  function irParaSelfie() {
    const p = problemasBusca({ nome, whatsapp: whats, email, aceite });
    if (p.length) { setErro(p[0]); return; }
    if (!tsPronto) { setErro(mensagemErro("verificacao_necessaria")); return; }
    setErro(null); setTela("selfie");
  }

  async function buscar(selfie: string) {
    setTela("buscando"); setProgresso(10);
    const t = setInterval(() => setProgresso((p) => Math.min(90, p + 8)), 400);
    try {
      const r = await chamar<{ fotos: FotoPublica[]; total: number }>("fotos-evento-publico", { acao: "buscar", nome, whatsapp: whats, email, aceite_biometria: true, selfie, turnstile: token });
      setEncontradas(r.fotos); setProgresso(100);
      setTela(r.fotos.length ? "resultado" : "vazio");
    } catch (e) {
      setErro(mensagemErro(e instanceof Error ? e.message : "")); setTela("inicio");
    } finally { clearInterval(t); novoToken(); }
  }

  async function abrirGaleria(pagina = 0) {
    setErro(null);
    try {
      const r = await chamar<{ fotos: FotoPublica[]; total: number; pagina: number; por_pagina: number }>("fotos-evento-publico", { acao: "galeria", pagina });
      setGaleria({ fotos: r.fotos, total: r.total, pagina: r.pagina, por: r.por_pagina }); setTela("galeria");
    } catch (e) { setErro(mensagemErro(e instanceof Error ? e.message : "")); }
  }

  function escolher(lista: FileList | null) {
    if (!lista) return;
    const r = adicionarFotos(arquivos.map((a) => a.file), [...lista]);
    const novos = r.lista.slice(arquivos.length).map((file) => ({ file, url: URL.createObjectURL(file) }));
    setArquivos([...arquivos, ...novos]);
    setErro(r.recusadas ? `${r.recusadas} arquivo(s) ignorado(s): use JPEG, PNG ou HEIC até 15 MB.` : r.excedentes ? `O limite é de ${MAX_FOTOS_ENVIO} fotos por envio.` : null);
  }
  function remover(i: number) { URL.revokeObjectURL(arquivos[i].url); setArquivos(arquivos.filter((_, j) => j !== i)); }

  async function enviar() {
    const p = problemasEnvio({ nome, whatsapp: whats, aceite: aceiteEnvio, qtd: arquivos.length });
    if (p.length) { setErro(p[0]); return; }
    if (!tsPronto) { setErro(mensagemErro("verificacao_necessaria")); return; }
    setErro(null); setEnviando(true); setProgresso(0);
    try {
      const prontas = [];
      for (const a of arquivos) prontas.push(await prepararFoto(a.file));
      const r = await chamar<{ envio_id: string; arquivos: { original: { path: string; token: string }; previa: { path: string; token: string } }[] }>("fotos-evento-envio", {
        acao: "iniciar", nome, whatsapp: whats, aceite_publicacao: true, turnstile: token,
        arquivos: prontas.map((p, i) => ({ nome: arquivos[i].file.name, tipo: p.tipo, tamanho: p.original.size, largura: p.largura, altura: p.altura })),
      });
      const st = supabase.storage.from(BUCKET_FOTOS);
      for (let i = 0; i < r.arquivos.length; i++) {
        const d = r.arquivos[i]; const p = prontas[i];
        await Promise.all([st.uploadToSignedUrl(d.original.path, d.original.token, p.original, { contentType: p.tipo }), st.uploadToSignedUrl(d.previa.path, d.previa.token, p.previa, { contentType: "image/jpeg" })]);
        setProgresso(Math.round(((i + 1) / r.arquivos.length) * 90));
      }
      const c = await chamar<{ recebidas: number }>("fotos-evento-envio", { acao: "concluir", envio_id: r.envio_id });
      setRecebidas(c.recebidas); setArquivos([]); setAceiteEnvio(false); setTela("enviado");
    } catch (e) { setErro(mensagemErro(e instanceof Error ? e.message : "")); }
    finally { setEnviando(false); novoToken(); }
  }

  const voltarInicio = () => { setErro(null); setTela("inicio"); };
  const camposPessoa = (
    <>
      <label className="fe-label" htmlFor="fe-nome">NOME</label>
      <input id="fe-nome" className="fe-input" placeholder="Seu nome" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" />
      <label className="fe-label" htmlFor="fe-whats">WHATSAPP</label>
      <input id="fe-whats" className="fe-input" placeholder="(51) 90000-0000" inputMode="tel" value={whats} onChange={(e) => setWhats(maskWhatsApp(e.target.value))} autoComplete="tel" />
    </>
  );
  const verificacao = precisaToken && ts?.site_key ? <TurnstileFotos key={tsKey} siteKey={ts.site_key} onToken={setToken} /> : null;

  let conteudo: React.ReactNode;
  if (aberta) {
    conteudo = <FotoAberta fotos={aberta.lista} indice={aberta.i} cor={cor} setCor={setCor} onFechar={() => setAberta(null)} onIndice={(i) => setAberta({ ...aberta, i })} />;
  } else if (tela === "selfie") {
    conteudo = <Selfie onVoltar={voltarInicio} onSelfie={(b) => void buscar(b)} />;
  } else if (tela === "buscando") {
    conteudo = (
      <><Topo /><div className="fe-centro">
        <span className="fe-icone-cant" aria-hidden />
        <h1 className="fe-h1">PROCURANDO VOCÊ</h1>
        <p className="fe-texto">Estamos comparando sua selfie com as fotos da festa.</p>
        <div className="fe-barra"><div style={{ width: `${progresso}%` }} /></div>
        <p className="fe-nota">Sua selfie é apagada assim que a busca termina.</p>
      </div></>
    );
  } else if (tela === "resultado") {
    conteudo = (
      <><Topo /><div className="fe-corpo">
        <p className="fe-rotulo">FESTA DE 10 ANOS · 14.11.2026</p>
        <h1 className="fe-h1">{textoEncontradas(encontradas.length)}</h1>
        <p className="fe-texto">Toque numa foto para escolher o formato e baixar.</p>
        <Seletor<Cor> opcoes={[["colorida", "COLORIDAS"], ["pb", "PRETO E BRANCO"]]} valor={cor} onChange={setCor} />
        <Grade fotos={encontradas} cor={cor} onAbrir={(i) => setAberta({ lista: encontradas, i })} />
        <button className="fe-botao" disabled><Download className="h-4 w-4" />BAIXAR TODAS ({encontradas.length})</button>
        <p className="fe-nota">O download com a moldura da FORTEM fica disponível em breve.</p>
        <button className="fe-link fe-centro-txt" onClick={() => setTela("selfie")}>Faltou alguma? Tente outra selfie</button>
      </div></>
    );
  } else if (tela === "vazio") {
    conteudo = (
      <><Topo /><div className="fe-corpo fe-vazio">
        <span className="fe-icone-cant" aria-hidden />
        <h1 className="fe-h1">AINDA NÃO ENCONTRAMOS VOCÊ</h1>
        <p className="fe-texto">Pode ser a luz ou o ângulo da selfie. Tente de novo, de frente e num lugar claro. Se as fotos ainda estão chegando, volte mais tarde.</p>
        <button className="fe-botao" onClick={() => setTela("selfie")}>TENTAR OUTRA SELFIE</button>
        <button className="fe-botao fe-botao-borda" onClick={() => void abrirGaleria(0)}>VER TODAS AS FOTOS</button>
      </div></>
    );
  } else if (tela === "galeria" && galeria) {
    const paginas = totalPaginas(galeria.total, galeria.por);
    conteudo = (
      <><Topo /><div className="fe-corpo">
        <button className="fe-link" onClick={voltarInicio}><ChevronLeft className="inline h-4 w-4" />Voltar</button>
        <h1 className="fe-h1">TODAS AS FOTOS</h1>
        <p className="fe-texto">{galeria.total} foto(s) da festa.</p>
        <Seletor<Cor> opcoes={[["colorida", "COLORIDAS"], ["pb", "PRETO E BRANCO"]]} valor={cor} onChange={setCor} />
        {galeria.fotos.length ? <Grade fotos={galeria.fotos} cor={cor} onAbrir={(i) => setAberta({ lista: galeria.fotos, i })} /> : <p className="fe-texto">As fotos ainda estão sendo preparadas. Volte mais tarde.</p>}
        {paginas > 1 && (
          <div className="fe-paginas">
            <button className="fe-botao fe-botao-borda" disabled={galeria.pagina === 0} onClick={() => void abrirGaleria(galeria.pagina - 1)}>ANTERIOR</button>
            <span>{galeria.pagina + 1} de {paginas}</span>
            <button className="fe-botao fe-botao-borda" disabled={galeria.pagina >= paginas - 1} onClick={() => void abrirGaleria(galeria.pagina + 1)}>PRÓXIMA</button>
          </div>
        )}
      </div></>
    );
  } else if (tela === "enviado") {
    conteudo = (
      <><Topo /><div className="fe-corpo fe-vazio">
        <span className="fe-ok" aria-hidden><Check className="h-5 w-5" /></span>
        <h1 className="fe-h1">{textoRecebidas(recebidas)}</h1>
        <p className="fe-texto">Elas entram na galeria depois da aprovação da equipe. Obrigado por registrar a festa com a gente.</p>
        <button className="fe-botao fe-botao-borda" onClick={() => { setTela("inicio"); setAba("enviar"); }}>ENVIAR MAIS FOTOS</button>
        <button className="fe-link fe-centro-txt" onClick={() => { setTela("inicio"); setAba("encontrar"); }}>Encontrar minhas fotos</button>
      </div></>
    );
  } else {
    conteudo = (
      <>
        <Topo />
        {aba === "encontrar" && (
          <div className="fe-capa">
            {ev?.capa?.url && <img src={ev.capa.url} alt="" className="fe-pb" />}
            <Cantoneiras />
          </div>
        )}
        <div className="fe-corpo">
          <p className="fe-rotulo">FESTA DE 10 ANOS · 14.11.2026</p>
          <h1 className="fe-h1">{aba === "encontrar" ? "ENCONTRE SUAS FOTOS" : "ENVIE SUAS FOTOS"}</h1>
          <p className="fe-texto">{aba === "encontrar"
            ? "Tire uma selfie e mostramos as fotos da festa em que você aparece. Leva menos de um minuto."
            : "Tirou fotos na festa? Envie aqui. Depois da aprovação da equipe, elas entram na galeria e todos podem se encontrar nelas."}</p>
          <div className="fe-abas" role="tablist">
            <button role="tab" aria-selected={aba === "encontrar"} className={aba === "encontrar" ? "ativo" : ""} onClick={() => { setAba("encontrar"); setErro(null); }}>ENCONTRAR MINHAS FOTOS</button>
            <button role="tab" aria-selected={aba === "enviar"} className={aba === "enviar" ? "ativo" : ""} onClick={() => { setAba("enviar"); setErro(null); }}>ENVIAR FOTOS</button>
          </div>
          {indisponivel && <p className="fe-erro">As fotos desta festa ainda não estão disponíveis. Volte depois da festa.</p>}
          {camposPessoa}
          {aba === "encontrar" ? (
            <>
              <label className="fe-label" htmlFor="fe-email">E-MAIL <span className="fe-cinza">(opcional)</span></label>
              <input id="fe-email" className="fe-input" type="email" placeholder="voce@email.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              <label className="fe-aceite">
                <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} />
                <span>Autorizo o uso da minha selfie apenas para localizar minhas fotos neste evento. A imagem é processada por um serviço da AWS (Amazon), não é armazenada e é apagada logo após a busca. <Link to={PRIVACIDADE} className="fe-link-inline">Política de privacidade</Link></span>
              </label>
              {verificacao}
              {erro && <p className="fe-erro" role="alert">{erro}</p>}
              <button className="fe-botao" onClick={irParaSelfie} disabled={indisponivel}><Camera className="h-4 w-4" />TIRAR SELFIE</button>
              <button className="fe-link fe-centro-txt" onClick={() => void abrirGaleria(0)} disabled={indisponivel}>Prefere ver todas as fotos da festa?</button>
            </>
          ) : (
            <>
              <label className="fe-selecionar">
                <Upload className="h-5 w-5" /><b>SELECIONAR FOTOS</b><span>Até {MAX_FOTOS_ENVIO} fotos, 15 MB cada</span>
                <input type="file" multiple accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif" hidden onChange={(e) => { escolher(e.target.files); e.target.value = ""; }} />
              </label>
              <p className="fe-label">{textoContador(arquivos.length)} selecionadas</p>
              {arquivos.length > 0 && (
                <div className="fe-miniaturas">
                  {arquivos.map((a, i) => (
                    <div key={a.url}><img src={a.url} alt="" /><button onClick={() => remover(i)} aria-label="Remover foto" disabled={enviando}><X className="h-3 w-3" /></button></div>
                  ))}
                </div>
              )}
              <label className="fe-aceite">
                <input type="checkbox" checked={aceiteEnvio} onChange={(e) => setAceiteEnvio(e.target.checked)} />
                <span>Declaro que tirei estas fotos na festa e autorizo a FORTEM a publicá-las na galeria do evento e a usá-las para que os participantes encontrem suas fotos.</span>
              </label>
              {verificacao}
              {enviando && <div className="fe-barra"><div style={{ width: `${progresso}%` }} /></div>}
              {erro && <p className="fe-erro" role="alert">{erro}</p>}
              <button className="fe-botao" onClick={() => void enviar()} disabled={enviando || indisponivel}>{enviando ? "ENVIANDO..." : textoBotaoEnvio(arquivos.length)}</button>
            </>
          )}
        </div>
      </>
    );
  }

  return (
    <main className="fotos-evento">
      <Seo title="Fotos da festa de 10 anos | FORTEM" description="Encontre suas fotos da festa de 10 anos da FORTEM com uma selfie, ou envie as fotos que você tirou." path="/10anos/fotos" />
      <div className="fe-app">{conteudo}</div>
    </main>
  );
}
