import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import StudentList from "./pages/StudentList";
import StudentProfile from "./pages/StudentProfile";
import TaskCenter from "./pages/TaskCenter";
import Admin from "./pages/Admin";
import Agenda from "./pages/Agenda";
import CarteiraAlunos from "./pages/CarteiraAlunos";
import ExerciseBank from "./pages/ExerciseBank";
import Treinos from "./pages/Treinos";
import Avaliacoes from "./pages/Avaliacoes";
import BancoTreinos from "./pages/BancoTreinos";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

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
              <Route path="/alunos" element={<StudentList />} />
              <Route path="/alunos/:id" element={<StudentProfile />} />
              <Route path="/exercicios" element={<ExerciseBank />} />
              <Route path="/treinos" element={<Treinos />} />
              <Route path="/avaliacoes" element={<Avaliacoes />} />
              <Route path="/banco-treinos" element={<BancoTreinos />} />
              <Route path="/carteira" element={<CarteiraAlunos />} />
              <Route path="/tarefas" element={<TaskCenter />} />
              <Route path="/agenda" element={<Agenda />} />
              <Route path="/admin" element={<Admin />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
