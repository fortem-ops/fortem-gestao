import React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface State {
  hasError: boolean;
  error: Error | null;
}

interface Props {
  children: React.ReactNode;
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
}

/**
 * ErrorBoundary global. Captura exceções de render para evitar tela branca
 * e oferece um caminho de recuperação ao usuário.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log em console — em produção poderia enviar para um serviço de telemetria.
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    const error = this.state.error ?? new Error("Erro desconhecido");
    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full glass-card p-8 rounded-2xl text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>
          <h1 className="font-heading font-bold text-lg">Algo deu errado</h1>
          <p className="text-sm text-muted-foreground break-words">
            {error.message || "Ocorreu um erro inesperado ao carregar esta tela."}
          </p>
          <div className="flex gap-2 justify-center pt-2">
            <Button variant="outline" onClick={this.reset}>
              Tentar novamente
            </Button>
            <Button onClick={() => window.location.reload()}>Recarregar página</Button>
          </div>
        </div>
      </div>
    );
  }
}
