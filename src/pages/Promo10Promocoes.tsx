import { useEffect, useState } from "react";
import TurnstileFotos from "@/site/fotosEvento/TurnstileFotos";
import { promo10Api } from "@/site/promo10/api";
import { Promo10Encerradas, Promo10InteresseRegistrado, Promo10SemOferta } from "@/site/promo10/Promo10Interesse";
import { Promo10Ofertas } from "@/site/promo10/Promo10Ofertas";
import { linkWhatsAppPromo10, mascararCpfInput, type InteressePromo10, type RespostaOfertasPromo10 } from "@/lib/promo10Texto";
import "@/site/promo10/promo10.css";

type Etapa = "cpf" | "codigo" | "ofertas" | "registrado" | "sem_oferta" | "encerrada";

export default function Promo10Promocoes() {
  const [etapa, setEtapa] = useState<Etapa>("cpf");
  const [cpf, setCpf] = useState("");
  const [turnstileAtivo, setTurnstileAtivo] = useState(false);
  const [siteKey, setSiteKey] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileKey, setTurnstileKey] = useState(0);

  const [verificacaoId, setVerificacaoId] = useState<string | null>(null);
  const [emailMascarado, setEmailMascarado] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [esperaReenvio, setEsperaReenvio] = useState(0);

  const [sessao, setSessao] = useState<string | null>(null);
  const [primeiroNome, setPrimeiroNome] = useState("");
  const [ofertas, setOfertas] = useState<RespostaOfertasPromo10 | null>(null);
  const [interesses, setInteresses] = useState<InteressePromo10[]>([]);

  const [carregando, setCarregando] = useState(false);
  const [enviandoInteresse, setEnviandoInteresse] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    document.title = "FORTEM 10 Anos · Condições especiais de aniversário";
    promo10Api.turnstileConfig().then((cfg) => {
      if (cfg.encerrada) { setEtapa("encerrada"); return; }
      setTurnstileAtivo(Boolean(cfg.ativo));
      setSiteKey(cfg.site_key ?? null);
    }).catch(() => { /* mantém tela inicial */ });
  }, []);

  useEffect(() => {
    if (esperaReenvio <= 0) return;
    const t = window.setTimeout(() => setEsperaReenvio((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [esperaReenvio]);

  async function handleEnviarCpf(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const digitos = cpf.replace(/\D/g, "");
    if (digitos.length !== 11) { setErro("Digite um CPF válido com 11 números."); return; }
    if (turnstileAtivo && !turnstileToken) { setErro("Confirme a verificação de segurança."); return; }

    setCarregando(true);
    try {
      let passe: string | null = null;
      if (turnstileAtivo && turnstileToken) {
        const ts = await promo10Api.turnstile(turnstileToken);
        if (ts.encerrada) { setEtapa("encerrada"); return; }
        if (!ts.ok) { setErro("Verificação de segurança expirada. Tente novamente."); setTurnstileKey((k) => k + 1); setTurnstileToken(null); return; }
        passe = ts.passe ?? null;
      }
      const r = await promo10Api.enviar(digitos, passe);
      if (r.encerrada) { setEtapa("encerrada"); return; }
      if (!r.enviado) {
        setErro(
          r.motivo === "cpf_invalido" ? "CPF inválido. Confira os números digitados."
            : r.motivo === "limitado" ? "Muitas tentativas. Aguarde alguns minutos."
              : "Não foi possível continuar agora. Tente novamente.",
        );
        setTurnstileKey((k) => k + 1);
        setTurnstileToken(null);
        return;
      }
      setVerificacaoId(r.verificacao_id ?? null);
      setEmailMascarado(r.email_mascarado ?? null);
      setCodigo("");
      setEsperaReenvio(60);
      setEtapa("codigo");
    } catch {
      setErro("Não foi possível enviar o código agora. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  async function handleReenviar() {
    if (!verificacaoId || esperaReenvio > 0) return;
    setErro(null);
    setCarregando(true);
    try {
      const r = await promo10Api.reenviar(verificacaoId);
      if (r.encerrada) { setEtapa("encerrada"); return; }
      if (!r.ok) {
        if (r.motivo === "aguarde" && r.aguardar_segundos) setEsperaReenvio(r.aguardar_segundos);
        setErro(r.motivo === "limitado" ? "Limite de envios atingido. Aguarde alguns minutos." : "Aguarde para reenviar o código.");
        return;
      }
      if (r.verificacao_id) setVerificacaoId(r.verificacao_id);
      if (r.email_mascarado) setEmailMascarado(r.email_mascarado);
      setEsperaReenvio(60);
    } catch {
      setErro("Não foi possível reenviar agora.");
    } finally {
      setCarregando(false);
    }
  }

  async function handleValidarCodigo(e: React.FormEvent) {
    e.preventDefault();
    if (!verificacaoId) return;
    setErro(null);
    const limpo = codigo.replace(/\D/g, "");
    if (limpo.length !== 6) { setErro("Digite o código de 6 dígitos."); return; }
    setCarregando(true);
    try {
      const r = await promo10Api.validar(verificacaoId, limpo);
      if (r.encerrada) { setEtapa("encerrada"); return; }
      if (!r.ok || !r.sessao || !r.ofertas) {
        setErro(
          r.motivo === "expirado" ? "Código expirado. Peça um novo código."
            : r.motivo === "bloqueado" ? "Limite de tentativas atingido. Volte e peça um novo código."
              : typeof r.restantes === "number" ? `Código incorreto. Tentativas restantes: ${r.restantes}.`
                : "Código incorreto.",
        );
        return;
      }
      setSessao(r.sessao);
      setPrimeiroNome(r.primeiro_nome ?? "");
      setOfertas(r.ofertas);
      setInteresses(r.interesses ?? []);
      const temOferta = (r.ofertas.principal?.length ?? 0) > 0 || Boolean(r.ofertas.corrida);
      setEtapa(r.ofertas.encerrada ? "encerrada" : temOferta ? "ofertas" : "sem_oferta");
    } catch {
      setErro("Não foi possível validar o código agora.");
    } finally {
      setCarregando(false);
    }
  }

  async function handleInteresse(tipo: "principal" | "corrida", chave: string) {
    if (!sessao) { setEtapa("cpf"); return; }
    setErro(null);
    setEnviandoInteresse(`${tipo}:${chave}`);
    try {
      const r = await promo10Api.interesse(sessao, tipo, chave);
      if (r.encerrada) { setEtapa("encerrada"); return; }
      if (!r.ok) {
        if (r.motivo === "sessao_invalida") { setErro("Sua sessão expirou. Informe seu CPF novamente."); setEtapa("cpf"); return; }
        if (r.motivo === "ja_contatado") { setErro("A equipe já está em contato sobre a sua oferta principal. Fale no WhatsApp para alterar."); return; }
        setErro("Não foi possível registrar seu interesse agora.");
        return;
      }
      setInteresses(r.interesses ?? []);
      setEtapa("registrado");
    } catch {
      setErro("Não foi possível registrar seu interesse agora.");
    } finally {
      setEnviandoInteresse(null);
    }
  }

  async function handleVoltarOfertas() {
    if (!sessao) { setEtapa("cpf"); return; }
    setErro(null);
    try {
      const r = await promo10Api.ofertas(sessao);
      if (r.encerrada) { setEtapa("encerrada"); return; }
      if (!r.ok || !r.ofertas) { setEtapa("cpf"); return; }
      setOfertas(r.ofertas);
      setInteresses(r.interesses ?? []);
      setEtapa("ofertas");
    } catch {
      setEtapa("ofertas");
    }
  }

  return (
    <div data-promo10="" className="flex min-h-screen flex-col">
      <header className="border-b border-[#4a4b4b] bg-[#0e0e0e]">
        <div className="mx-auto flex max-w-xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="text-xl font-black uppercase tracking-[0.12em] text-white">FORTEM</span>
            <span className="p10-badge">10 ANOS</span>
          </div>
          <a href="/10anos" className="text-xs font-bold uppercase tracking-wider text-[#a3a3a3] hover:text-white">
            Voltar
          </a>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-5 py-8">
        {etapa === "encerrada" && <Promo10Encerradas />}
        {etapa === "sem_oferta" && <Promo10SemOferta />}
        {etapa === "ofertas" && ofertas && (
          <Promo10Ofertas
            primeiroNome={primeiroNome}
            ofertas={ofertas}
            enviando={enviandoInteresse}
            erro={erro}
            onInteresse={handleInteresse}
          />
        )}
        {etapa === "registrado" && (
          <Promo10InteresseRegistrado
            primeiroNome={primeiroNome}
            interesses={interesses}
            onVoltar={handleVoltarOfertas}
          />
        )}

        {etapa === "cpf" && (
          <section className="space-y-6">
            <form onSubmit={handleEnviarCpf} className="p10-card p-6 space-y-5">
              <div className="space-y-2">
                <h1 className="text-2xl font-black uppercase tracking-tight">Condições especiais de aniversário</h1>
                <p className="text-sm leading-relaxed text-[#d4d4d4]">
                  Informe seu CPF. Enviamos um código de verificação para o e-mail do seu cadastro para liberar suas condições.
                </p>
              </div>
              <div className="space-y-2">
                <label htmlFor="promo10-cpf" className="block text-xs font-bold uppercase tracking-[0.1em] text-[#a3a3a3]">
                  CPF
                </label>
                <input
                  id="promo10-cpf"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => setCpf(mascararCpfInput(e.target.value))}
                  className="p10-input"
                />
              </div>
              {turnstileAtivo && siteKey && (
                <TurnstileFotos key={turnstileKey} siteKey={siteKey} onToken={setTurnstileToken} />
              )}
              {erro && <p role="alert" className="text-sm text-[#f87171]">{erro}</p>}
              <button type="submit" disabled={carregando} className="p10-btn-primary w-full px-4 text-sm">
                {carregando ? "Enviando..." : "Ver minhas promoções"}
              </button>
            </form>

            <div className="p10-card p-5 space-y-1">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#a3a3a3]">Para quem</p>
              <p className="text-sm text-[#e5e5e5]">
                Para quem: alunos, ex-alunos e alunos Wellhub e TotalPass da FORTEM
              </p>
            </div>
          </section>
        )}

        {etapa === "codigo" && (
          <section className="space-y-5">
            <form onSubmit={handleValidarCodigo} className="p10-card p-6 space-y-5">
              <div className="space-y-2">
                <h1 className="text-2xl font-black uppercase tracking-tight">Confirme que é você</h1>
                <p className="text-sm leading-relaxed text-[#d4d4d4]">
                  Enviamos um código de 6 dígitos para <strong className="text-white">{emailMascarado ?? "o e-mail do seu cadastro"}</strong>. Ele vale por 10 minutos.
                </p>
              </div>
              <div className="space-y-2">
                <label htmlFor="promo10-codigo" className="block text-xs font-bold uppercase tracking-[0.1em] text-[#a3a3a3]">
                  Código de 6 dígitos
                </label>
                <input
                  id="promo10-codigo"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="p10-input text-center text-2xl font-black tracking-[0.35em]"
                />
              </div>
              {erro && <p role="alert" className="text-sm text-[#f87171]">{erro}</p>}
              <button type="submit" disabled={carregando} className="p10-btn-primary w-full px-4 text-sm">
                {carregando ? "Confirmando..." : "Confirmar código"}
              </button>
              <div className="flex flex-col gap-2 pt-1 text-xs text-[#a3a3a3]">
                <p>Não encontrou? Confira a caixa de spam ou lixo eletrônico.</p>
                <button
                  type="button"
                  disabled={carregando || esperaReenvio > 0}
                  onClick={handleReenviar}
                  className="p10-btn-secondary w-full px-3 text-xs disabled:opacity-45"
                >
                  {esperaReenvio > 0 ? `Reenviar código em ${esperaReenvio}s` : "Reenviar código"}
                </button>
                <a
                  href={linkWhatsAppPromo10("Olá, equipe FORTEM. Preciso atualizar meu e-mail de cadastro para acessar as promoções de 10 anos.")}
                  target="_blank"
                  rel="noreferrer"
                  className="pt-2 text-center underline underline-offset-4 hover:text-white"
                >
                  E-mail desatualizado? Fale com a equipe
                </a>
              </div>
            </form>
          </section>
        )}
      </main>

      <footer className="border-t border-[#4a4b4b] px-5 py-6">
        <div className="mx-auto max-w-xl space-y-2 text-xs text-[#a3a3a3]">
          <p>Promoções válidas até 31/12/2026. Corrida pode ser somada a qualquer oferta; as demais são uma por CPF.</p>
          <p>
            Dúvidas?{" "}
            <a href={linkWhatsAppPromo10()} target="_blank" rel="noreferrer" className="text-white underline underline-offset-4">
              Fale com a equipe pelo WhatsApp
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}