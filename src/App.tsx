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
                path="/agenda"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <Agenda />
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
