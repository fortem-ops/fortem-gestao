import { lazy, Suspense } from "react";
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
const Dashboard = lazy(() => import("./pages/Dashboard"));
const RecoverPassword = lazy(() => import("./pages/RecoverPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));

// Lazy-loaded routes — keeps initial bundle small and speeds up first paint.
const StudentList = lazy(() => import("./pages/StudentList"));
const StudentProfile = lazy(() => import("./pages/StudentProfile"));
const TaskCenter = lazy(() => import("./pages/TaskCenter"));
const Admin = lazy(() => import("./pages/Admin"));
const AdminNotificacoesEmail = lazy(() => import("./pages/AdminNotificacoesEmail"));

const Agenda = lazy(() => import("./pages/Agenda"));
const AgendaTreinos = lazy(() => import("./pages/AgendaTreinos"));
const Presencas = lazy(() => import("./pages/Presencas"));
const CarteiraAlunos = lazy(() => import("./pages/CarteiraAlunos"));
const ExerciseBank = lazy(() => import("./pages/ExerciseBank"));
const Avaliacoes = lazy(() => import("./pages/Avaliacoes"));
const AvaliacoesPremium = lazy(() => import("./pages/AvaliacoesPremium"));
const BancoTreinos = lazy(() => import("./pages/BancoTreinos"));
const PublicWorkout = lazy(() => import("./pages/PublicWorkout"));
const Pipeline = lazy(() => import("./pages/Pipeline"));
const Notificar = lazy(() => import("./pages/Notificar"));
const Leads = lazy(() => import("./pages/Leads"));
const Prospects = lazy(() => import("./pages/Prospects"));
const Clube = lazy(() => import("./pages/Clube"));
const AdminClube = lazy(() => import("./pages/AdminClube"));
const PartnerScannerPage = lazy(() => import("./pages/PartnerScannerPage"));
const Ponto = lazy(() => import("./pages/Ponto"));
const PontoEquipe = lazy(() => import("./pages/PontoEquipe"));
const PontoFechamento = lazy(() => import("./pages/PontoFechamento"));
const RelatorioPonto = lazy(() => import("./pages/RelatorioPonto"));
const AdminPonto = lazy(() => import("./pages/AdminPonto"));
const AnexosJuridicos = lazy(() => import("./pages/AnexosJuridicos"));
const Comissionamentos = lazy(() => import("./pages/Comissionamentos"));
const LegalAnnexFlow = lazy(() => import("./pages/LegalAnnexFlow"));
const NotFound = lazy(() => import("./pages/NotFound"));
const RelatoriosLayout = lazy(() => import("./components/relatorios/RelatoriosLayout").then(m => ({ default: m.RelatoriosLayout })));
const RelatoriosHome = lazy(() => import("./pages/relatorios/Index"));
const RelatoriosVendas = lazy(() => import("./pages/relatorios/Vendas"));
const RelatoriosFinanceiro = lazy(() => import("./pages/relatorios/Financeiro"));
const CartoesCredito = lazy(() => import("./pages/financeiro/CartoesCredito"));
const Contratos = lazy(() => import("./pages/financeiro/Contratos"));
const Adquirente = lazy(() => import("./pages/financeiro/Adquirente"));
const RelatoriosPlanos = lazy(() => import("./pages/relatorios/Planos"));
const RelatoriosCancelamentos = lazy(() => import("./pages/relatorios/Cancelamentos"));
const RelatoriosServicos = lazy(() => import("./pages/relatorios/Servicos"));
const RelatoriosEmBreve = lazy(() => import("./pages/relatorios/EmBreve"));
const RelatoriosEquipe = lazy(() => import("./pages/relatorios/Equipe"));
const WhatsApp = lazy(() => import("./pages/WhatsApp"));
const Privacidade = lazy(() => import("./pages/Privacidade"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));

// Portal do Aluno
const PortalLogin = lazy(() => import("./pages/portal/PortalLogin"));
const PortalSignUp = lazy(() => import("./pages/portal/PortalSignUp"));
const PortalRecoverPassword = lazy(() => import("./pages/portal/PortalRecoverPassword"));
const PortalResetPassword = lazy(() => import("./pages/portal/PortalResetPassword"));
const PortalProfile = lazy(() => import("./pages/portal/PortalProfile"));
const PortalHome = lazy(() => import("./pages/portal/PortalHome"));
const PortalWorkouts = lazy(() => import("./pages/portal/PortalWorkouts"));
const PortalAssessments = lazy(() => import("./pages/portal/PortalAssessments"));
const PortalClube = lazy(() => import("./pages/portal/PortalClube"));
const PortalAgenda = lazy(() => import("./pages/portal/PortalAgenda"));
const PortalPlano = lazy(() => import("./pages/portal/PortalPlano"));
const PortalNotificacoes = lazy(() => import("./pages/portal/PortalNotificacoes"));

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
            <Route path="/privacidade" element={<Suspense fallback={<RouteFallback />}><Privacidade /></Suspense>} />
            <Route path="/admin/vapid-setup" element={<Suspense fallback={<RouteFallback />}><AdminVapidSetup /></Suspense>} />
            <Route path="/.lovable/oauth/consent" element={<Suspense fallback={<RouteFallback />}><OAuthConsent /></Suspense>} />

            {/* Portal do Aluno — auth e rotas próprias */}
            <Route path="/portal/login" element={<Suspense fallback={<RouteFallback />}><PortalLogin /></Suspense>} />
            <Route path="/portal/cadastro" element={<Suspense fallback={<RouteFallback />}><PortalSignUp /></Suspense>} />
            <Route path="/portal/recuperar-senha" element={<Suspense fallback={<RouteFallback />}><PortalRecoverPassword /></Suspense>} />
            <Route path="/portal/redefinir-senha" element={<Suspense fallback={<RouteFallback />}><PortalResetPassword /></Suspense>} />
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
                path="/banco-treinos"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <BancoTreinos />
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
                path="/admin/clube"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <AdminClube />
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
                <Route path="crm" element={<Suspense fallback={<RouteFallback />}><RelatoriosEmBreve titulo="CRM" /></Suspense>} />
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
