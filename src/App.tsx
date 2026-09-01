import { Suspense } from "react";
import { lazyWithReload } from "@/lib/lazyWithReload";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RequireStudent } from "@/components/portal/RequireStudent";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { StudentPortalProvider } from "@/contexts/StudentPortalContext";
import { AppLayout } from "@/components/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";
import Login from "./pages/Login";
const Dashboard = lazyWithReload(() => import("./pages/Dashboard"));
const RecoverPassword = lazyWithReload(() => import("./pages/RecoverPassword"));
const ResetPassword = lazyWithReload(() => import("./pages/ResetPassword"));

// Lazy-loaded routes — keeps initial bundle small and speeds up first paint.
const StudentList = lazyWithReload(() => import("./pages/StudentList"));
const ClientesAvulsos = lazyWithReload(() => import("./pages/ClientesAvulsos"));

const StudentProfile = lazyWithReload(() => import("./pages/StudentProfile"));
const TaskCenter = lazyWithReload(() => import("./pages/TaskCenter"));
const Admin = lazyWithReload(() => import("./pages/Admin"));
const AdminNotificacoesEmail = lazyWithReload(() => import("./pages/AdminNotificacoesEmail"));

const Agenda = lazyWithReload(() => import("./pages/Agenda"));
const AgendaTreinos = lazyWithReload(() => import("./pages/AgendaTreinos"));
const KnowledgeBase = lazyWithReload(() => import("./pages/KnowledgeBase"));
const Presencas = lazyWithReload(() => import("./pages/Presencas"));
const CarteiraAlunos = lazyWithReload(() => import("./pages/CarteiraAlunos"));
const ExerciseBank = lazyWithReload(() => import("./pages/ExerciseBank"));
const Avaliacoes = lazyWithReload(() => import("./pages/Avaliacoes"));
const AvaliacoesPremium = lazyWithReload(() => import("./pages/AvaliacoesPremium"));
const BodyMapShapesConfig = lazyWithReload(() => import("./pages/BodyMapShapesConfig"));
const BancoTreinos = lazyWithReload(() => import("./pages/BancoTreinos"));
const ArquivosMetodologicos = lazyWithReload(() => import("./pages/ArquivosMetodologicos"));
const MeusTreinos = lazyWithReload(() => import("./pages/MeusTreinos"));
const PublicWorkout = lazyWithReload(() => import("./pages/PublicWorkout"));
const Pipeline = lazyWithReload(() => import("./pages/Pipeline"));
const Notificar = lazyWithReload(() => import("./pages/Notificar"));
const Leads = lazyWithReload(() => import("./pages/Leads"));
const Prospects = lazyWithReload(() => import("./pages/Prospects"));
const InscricoesCorrida = lazyWithReload(() => import("./pages/corrida/InscricoesCorrida"));
const Clube = lazyWithReload(() => import("./pages/Clube"));
const ClubeFortem = lazyWithReload(() => import("./pages/ClubeFortem"));
const AdminParceiros = lazyWithReload(() => import("./pages/AdminParceiros"));
const PartnerScannerPage = lazyWithReload(() => import("./pages/PartnerScannerPage"));
const Ponto = lazyWithReload(() => import("./pages/Ponto"));
const PontoEquipe = lazyWithReload(() => import("./pages/PontoEquipe"));
const PontoFechamento = lazyWithReload(() => import("./pages/PontoFechamento"));
const RelatorioPonto = lazyWithReload(() => import("./pages/RelatorioPonto"));
const AdminPonto = lazyWithReload(() => import("./pages/AdminPonto"));
const DiagnosticoBancoHoras = lazyWithReload(() => import("./pages/DiagnosticoBancoHoras"));
const AnexosJuridicos = lazyWithReload(() => import("./pages/AnexosJuridicos"));
const Comissionamentos = lazyWithReload(() => import("./pages/Comissionamentos"));
const LegalAnnexFlow = lazyWithReload(() => import("./pages/LegalAnnexFlow"));
const NotFound = lazyWithReload(() => import("./pages/NotFound"));
const RelatoriosLayout = lazyWithReload(() => import("./components/relatorios/RelatoriosLayout").then(m => ({ default: m.RelatoriosLayout })));
const RelatoriosHome = lazyWithReload(() => import("./pages/relatorios/Index"));
const RelatoriosVendas = lazyWithReload(() => import("./pages/relatorios/Vendas"));
const RelatoriosFinanceiro = lazyWithReload(() => import("./pages/relatorios/Financeiro"));
const CartoesCredito = lazyWithReload(() => import("./pages/financeiro/CartoesCredito"));
const Contratos = lazyWithReload(() => import("./pages/financeiro/Contratos"));
const TemplatesContratos = lazyWithReload(() => import("./pages/financeiro/TemplatesContratos"));
const Adquirente = lazyWithReload(() => import("./pages/financeiro/Adquirente"));
const RelatoriosPlanos = lazyWithReload(() => import("./pages/relatorios/Planos"));
const RelatoriosCancelamentos = lazyWithReload(() => import("./pages/relatorios/Cancelamentos"));
const RelatoriosServicos = lazyWithReload(() => import("./pages/relatorios/Servicos"));
const RelatoriosEmBreve = lazyWithReload(() => import("./pages/relatorios/EmBreve"));
const RelatoriosCRM = lazyWithReload(() => import("./pages/relatorios/CRM"));
const RelatoriosEquipe = lazyWithReload(() => import("./pages/relatorios/Equipe"));
const WhatsApp = lazyWithReload(() => import("./pages/WhatsApp"));
const Corrida = lazyWithReload(() => import("./pages/Corrida"));
const Planos = lazyWithReload(() => import("./pages/Planos"));
const Privacidade = lazyWithReload(() => import("./pages/Privacidade"));
const TermoAptidaoUsoImagem = lazyWithReload(() => import("./pages/TermoAptidaoUsoImagem"));
const OAuthConsent = lazyWithReload(() => import("./pages/OAuthConsent"));

// Portal do Aluno
const PortalLogin = lazyWithReload(() => import("./pages/portal/PortalLogin"));
const PortalSignUp = lazyWithReload(() => import("./pages/portal/PortalSignUp"));
const PortalRecoverPassword = lazyWithReload(() => import("./pages/portal/PortalRecoverPassword"));
const PortalResetPassword = lazyWithReload(() => import("./pages/portal/PortalResetPassword"));
const PortalProfile = lazyWithReload(() => import("./pages/portal/PortalProfile"));
const PortalPagamentos = lazyWithReload(() => import("./pages/portal/PortalPagamentos"));
const CadastrarCartaoPublico = lazyWithReload(() => import("./pages/CadastrarCartao"));
const AceitarContratoToken = lazyWithReload(() => import("./pages/AceitarContratoToken"));
const PortalHome = lazyWithReload(() => import("./pages/portal/PortalHome"));
const PortalWorkouts = lazyWithReload(() => import("./pages/portal/PortalWorkouts"));
const PortalAssessments = lazyWithReload(() => import("./pages/portal/PortalAssessments"));
const PortalClube = lazyWithReload(() => import("./pages/portal/PortalClube"));
const PortalAgenda = lazyWithReload(() => import("./pages/portal/PortalAgenda"));
const PortalPlano = lazyWithReload(() => import("./pages/portal/PortalPlano"));
const PortalNotificacoes = lazyWithReload(() => import("./pages/portal/PortalNotificacoes"));
const PortalCarteirinha = lazyWithReload(() => import("./pages/portal/PortalCarteirinha"));
const PortalAssistente = lazyWithReload(() => import("./pages/portal/PortalAssistente"));
const PortalContratos = lazyWithReload(() => import("./pages/portal/PortalContratos"));

// Portal do Parceiro
const PartnerLogin = lazyWithReload(() => import("./pages/parceiro/PartnerLogin"));
const PartnerPortal = lazyWithReload(() => import("./pages/parceiro/PartnerPortal"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      // Retry só faz sentido para erros de rede; quebra-de-regra (4xx) não deve repetir.
      retry: (failureCount, error: unknown) => {
        if (failureCount >= 2) return false;
        const msg = error instanceof Error ? error.message : String(error);
        return /fetch|network|timeout|aborted/i.test(msg);
      },
      retryDelay: (attempt) => Math.min(400 * 2 ** attempt, 2000),
    },
    mutations: {
      retry: false,
    },
  },
});

const RouteFallback = () => (
  <div className="space-y-4 p-2">
    <Skeleton className="h-8 w-48" />
    <Skeleton className="h-64 w-full" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/recuperar-senha" element={<Suspense fallback={<RouteFallback />}><RecoverPassword /></Suspense>} />
            <Route path="/redefinir-senha" element={<Suspense fallback={<RouteFallback />}><ResetPassword /></Suspense>} />
            <Route path="/corrida" element={<Suspense fallback={<RouteFallback />}><Corrida /></Suspense>} />
            <Route path="/planos" element={<Suspense fallback={<RouteFallback />}><Planos /></Suspense>} />
            <Route path="/privacidade" element={<Suspense fallback={<RouteFallback />}><Privacidade /></Suspense>} />
            <Route path="/termos/aptidao-fisica-uso-imagem" element={<Suspense fallback={<RouteFallback />}><TermoAptidaoUsoImagem /></Suspense>} />
            
            <Route path="/.lovable/oauth/consent" element={<Suspense fallback={<RouteFallback />}><OAuthConsent /></Suspense>} />

            {/* Portal do Aluno — auth e rotas próprias */}
            <Route path="/portal/login" element={<Suspense fallback={<RouteFallback />}><PortalLogin /></Suspense>} />
            <Route path="/portal/cadastro" element={<Suspense fallback={<RouteFallback />}><PortalSignUp /></Suspense>} />
            <Route path="/portal/recuperar-senha" element={<Suspense fallback={<RouteFallback />}><PortalRecoverPassword /></Suspense>} />
            <Route path="/portal/redefinir-senha" element={<Suspense fallback={<RouteFallback />}><PortalResetPassword /></Suspense>} />

            {/* Portal do Parceiro — fora do ProtectedRoute e do AppLayout */}
            <Route path="/parceiro/login" element={<Suspense fallback={<RouteFallback />}><PartnerLogin /></Suspense>} />
            <Route path="/parceiro" element={<Suspense fallback={<RouteFallback />}><PartnerPortal /></Suspense>} />
            <Route
              element={
                <RequireStudent>
                  <StudentPortalProvider>
                    <PortalLayout />
                  </StudentPortalProvider>
                </RequireStudent>
              }
            >
              <Route path="/portal" element={<Navigate to="/portal/home" replace />} />
              <Route path="/portal/home" element={<Suspense fallback={<RouteFallback />}><PortalHome /></Suspense>} />
              <Route path="/portal/perfil" element={<Suspense fallback={<RouteFallback />}><PortalProfile /></Suspense>} />
              <Route path="/portal/treinos" element={<Suspense fallback={<RouteFallback />}><PortalWorkouts /></Suspense>} />
              <Route path="/portal/avaliacoes" element={<Suspense fallback={<RouteFallback />}><PortalAssessments /></Suspense>} />
              <Route path="/portal/clube" element={<Suspense fallback={<RouteFallback />}><PortalClube /></Suspense>} />
              <Route path="/portal/agenda" element={<Suspense fallback={<RouteFallback />}><PortalAgenda /></Suspense>} />
              <Route path="/portal/plano" element={<Suspense fallback={<RouteFallback />}><PortalPlano /></Suspense>} />
              <Route path="/portal/notificacoes" element={<Suspense fallback={<RouteFallback />}><PortalNotificacoes /></Suspense>} />
              <Route path="/portal/carteirinha" element={<Suspense fallback={<RouteFallback />}><PortalCarteirinha /></Suspense>} />
              <Route path="/portal/assistente" element={<Suspense fallback={<RouteFallback />}><PortalAssistente /></Suspense>} />
              <Route path="/portal/contratos" element={<Suspense fallback={<RouteFallback />}><PortalContratos /></Suspense>} />
              <Route path="/portal/pagamentos" element={<Suspense fallback={<RouteFallback />}><PortalPagamentos /></Suspense>} />
            </Route>

            {/* Public, read-only workout view — opened by the QR code printed on the PDF. */}
            <Route
              path="/treino/:id"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <PublicWorkout />
                </Suspense>
              }
            />
            {/* Public legal annex signing flow */}
            <Route
              path="/assinar"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <LegalAnnexFlow documentType="anexo" />
                </Suspense>
              }
            />
            <Route
              path="/assinar-experimental"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <LegalAnnexFlow documentType="experimental" />
                </Suspense>
              }
            />
            <Route
              path="/cartao/:token"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <CadastrarCartaoPublico />
                </Suspense>
              }
            />
            <Route
              path="/contrato/:token"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <AceitarContratoToken />
                </Suspense>
              }
            />
            <Route
              path="/cadastrar-cartao"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <CadastrarCartaoPublico />
                </Suspense>
              }
            />
            {/* Painel autônomo do parceiro — protegido por auth, mas sem AppLayout (UX kiosk). */}
            <Route
              path="/parceiros/scanner"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<RouteFallback />}>
                    <PartnerScannerPage />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              element={
                <ProtectedRoute requireStaff>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Suspense fallback={<RouteFallback />}><Dashboard /></Suspense>} />
              <Route
                path="/alunos"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <StudentList mode="ativos" />
                  </Suspense>
                }
              />
              <Route
                path="/alunos-inativos"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <StudentList mode="inativos" />
                  </Suspense>
                }
              />
              <Route
                path="/clientes-avulsos"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <ClientesAvulsos />
                  </Suspense>
                }
              />

              <Route
                path="/alunos/:id"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <StudentProfile />
                  </Suspense>
                }
              />
              <Route
                path="/exercicios"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <ExerciseBank />
                  </Suspense>
                }
              />
              <Route
                path="/avaliacoes"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <Avaliacoes />
                  </Suspense>
                }
              />
              <Route
                path="/avaliacoes-premium"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <AvaliacoesPremium />
                  </Suspense>
                }
              />
              <Route
                path="/avaliacoes-premium/:alunoId"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <AvaliacoesPremium />
                  </Suspense>
                }
              />
              <Route
                path="/bodymap-config"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <BodyMapShapesConfig />
                  </Suspense>
                }
              />
              <Route
                path="/banco-treinos"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <BancoTreinos />
                  </Suspense>
                }
              />
              <Route
                path="/arquivos-metodologicos"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <ArquivosMetodologicos />
                  </Suspense>
                }
              />
              <Route
                path="/meus-treinos"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <MeusTreinos />
                  </Suspense>
                }
              />

              <Route
                path="/carteira"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <CarteiraAlunos />
                  </Suspense>
                }
              />
              <Route
                path="/tarefas"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <TaskCenter />
                  </Suspense>
                }
              />
              <Route
                path="/notificar"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <Notificar />
                  </Suspense>
                }
              />
              <Route
                path="/leads"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <Leads />
                  </Suspense>
                }
              />
              <Route
                path="/anexos"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<RouteFallback />}>
                      <AnexosJuridicos />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/prospects"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <Prospects />
                  </Suspense>
                }
              />
              <Route
                path="/corrida/inscricoes"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <InscricoesCorrida />
                  </Suspense>
                }
              />
              <Route
                path="/pipeline"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <Pipeline />
                  </Suspense>
                }
              />
              <Route
                path="/agenda"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <Agenda />
                  </Suspense>
                }
              />
              <Route
                path="/agenda-treinos"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <AgendaTreinos />
                  </Suspense>
                }
              />
              <Route
                path="/knowledge-base"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <KnowledgeBase />
                  </Suspense>
                }
              />
              <Route
                path="/clube-fortem"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <ClubeFortem />
                  </Suspense>
                }
              />
              <Route
                path="/admin-parceiros"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <AdminParceiros />
                  </Suspense>
                }
              />
              <Route
                path="/presencas"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <Presencas />
                  </Suspense>
                }
              />
              <Route
                path="/clube"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <Clube />
                  </Suspense>
                }
              />
              <Route
                path="/ponto"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <Ponto />
                  </Suspense>
                }
              />
              <Route
                path="/ponto/equipe"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <PontoEquipe />
                  </Suspense>
                }
              />
              <Route
                path="/ponto/fechamento"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <PontoFechamento />
                  </Suspense>
                }
              />
              <Route
                path="/ponto/relatorio"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <RelatorioPonto />
                  </Suspense>
                }
              />
              <Route
                path="/admin/ponto"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <AdminPonto />
                  </Suspense>
                }
              />
              <Route
                path="/admin/diagnostico-banco-horas"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <DiagnosticoBancoHoras />
                  </Suspense>
                }
              />
              <Route
                path="/admin"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <Admin />
                  </Suspense>
                }
              />
              <Route
                path="/admin/notificacoes-email"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <AdminNotificacoesEmail />
                  </Suspense>
                }
              />
              <Route
                path="/whatsapp"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <WhatsApp />
                  </Suspense>
                }
              />
              <Route
                path="/configuracoes/whatsapp"
                element={<Navigate to="/whatsapp" replace />}
              />

              <Route
                path="/comissionamentos"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <Comissionamentos />
                  </Suspense>
                }
              />
              <Route
                path="/financeiro/cartoes"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <CartoesCredito />
                  </Suspense>
                }
              />
              <Route
                path="/financeiro/contratos"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <Contratos />
                  </Suspense>
                }
              />
              <Route
                path="/financeiro/templates-contratos"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <TemplatesContratos />
                  </Suspense>
                }
              />

              <Route
                path="/financeiro/adquirente"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <Adquirente />
                  </Suspense>
                }
              />

              <Route
                path="/relatorios"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <RelatoriosLayout />
                  </Suspense>
                }
              >
                <Route index element={<Suspense fallback={<RouteFallback />}><RelatoriosHome /></Suspense>} />
                <Route path="vendas" element={<Suspense fallback={<RouteFallback />}><RelatoriosVendas /></Suspense>} />
                <Route path="financeiro" element={<Suspense fallback={<RouteFallback />}><RelatoriosFinanceiro /></Suspense>} />
                <Route path="planos" element={<Suspense fallback={<RouteFallback />}><RelatoriosPlanos /></Suspense>} />
                <Route path="cancelamentos" element={<Suspense fallback={<RouteFallback />}><RelatoriosCancelamentos /></Suspense>} />
                <Route path="servicos" element={<Suspense fallback={<RouteFallback />}><RelatoriosServicos /></Suspense>} />
                <Route path="crm" element={<Suspense fallback={<RouteFallback />}><RelatoriosCRM /></Suspense>} />
                <Route path="tecnicos" element={<Suspense fallback={<RouteFallback />}><RelatoriosEmBreve titulo="Técnicos" /></Suspense>} />
                <Route path="equipe" element={<Suspense fallback={<RouteFallback />}><RelatoriosEquipe /></Suspense>} />
              </Route>
            </Route>
            <Route
              path="*"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <NotFound />
                </Suspense>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
