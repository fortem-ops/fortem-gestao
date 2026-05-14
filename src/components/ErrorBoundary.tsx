import React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clipboard } from "lucide-react";
import { logger } from "@/lib/logger";
import { toastSuccess, toastError } from "@/lib/toast-helpers";

interface State {
  hasError: boolean;
  error: Error | null;
  info: React.ErrorInfo | null;
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
  state: State = { hasError: false, error: null, info: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, info: null };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ info });
    logger.error(error, { boundary: "global", componentStack: info.componentStack });
  }

  reset = () => {
    this.setState({ hasError: false, error: null, info: null });
  };

  copyReport = async () => {
    const { error, info } = this.state;
    const report = [
      `Rota: ${typeof window !== "undefined" ? window.location.pathname + window.location.search : "?"}`,
      `Quando: ${new Date().toISOString()}`,
      `Mensagem: ${error?.message ?? "(sem mensagem)"}`,
      "",
      "Stack:",
      error?.stack ?? "(sem stack)",
      "",
      "Component stack:",
      info?.componentStack ?? "(indisponível)",
    ].join("\n");

    try {
      await navigator.clipboard.writeText(report);
      toastSuccess("Relatório copiado", "Cole no chat de suporte para ajudarmos.");
    } catch (err) {
      toastError(err, "Não foi possível copiar");
    }
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
          <div className="flex flex-wrap gap-2 justify-center pt-2">
            <Button variant="outline" onClick={this.reset}>
              Tentar novamente
            </Button>
            <Button variant="outline" onClick={this.copyReport}>
              <Clipboard className="w-4 h-4 mr-1" />
              Reportar problema
            </Button>
            <Button onClick={() => window.location.reload()}>Recarregar página</Button>
          </div>
        </div>
      </div>
    );
  }
}

