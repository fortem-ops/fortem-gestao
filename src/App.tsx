import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

// Lazy-loaded routes — keeps initial bundle small and speeds up first paint.
const StudentList = lazy(() => import("./pages/StudentList"));
const StudentProfile = lazy(() => import("./pages/StudentProfile"));
const TaskCenter = lazy(() => import("./pages/TaskCenter"));
const Admin = lazy(() => import("./pages/Admin"));
const Agenda = lazy(() => import("./pages/Agenda"));
const CarteiraAlunos = lazy(() => import("./pages/CarteiraAlunos"));
const ExerciseBank = lazy(() => import("./pages/ExerciseBank"));
const Avaliacoes = lazy(() => import("./pages/Avaliacoes"));
const BancoTreinos = lazy(() => import("./pages/BancoTreinos"));
const PublicWorkout = lazy(() => import("./pages/PublicWorkout"));
const Pipeline = lazy(() => import("./pages/Pipeline"));
const Clube = lazy(() => import("./pages/Clube"));
const AdminClube = lazy(() => import("./pages/AdminClube"));
const PartnerScannerPage = lazy(() => import("./pages/PartnerScannerPage"));
const Ponto = lazy(() => import("./pages/Ponto"));
const PontoEquipe = lazy(() => import("./pages/PontoEquipe"));
const PontoFechamento = lazy(() => import("./pages/PontoFechamento"));
const AdminPonto = lazy(() => import("./pages/AdminPonto"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
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
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            {/* Public, read-only workout view — opened by the QR code printed on the PDF. */}
            <Route
              path="/treino/:id"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <PublicWorkout />
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
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route
                path="/alunos"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <StudentList />
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
