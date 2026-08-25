import { Component, type ErrorInfo, type ReactNode } from "react";
import { monitoring } from "@/lib/monitoring";
import { isStaleChunkError, tentarReloadPorChunkVelho } from "@/lib/staleChunkReload";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  eventId: string | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, eventId: null, copied: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Chunk velho depois de um deploy não é erro de aplicação: o bundle na aba do
    // usuário ficou órfão. Recarregar uma vez (guarda de sessionStorage em
    // staleChunkReload) resolve, e é melhor que tela de erro. Ver PILAR-D.
    if (isStaleChunkError(error) && tentarReloadPorChunkVelho()) {
      monitoring.addBreadcrumb("stale_chunk_reload", { origem: "ErrorBoundary" });
      return;
    }

    const eventId = monitoring.captureException(error, {
      componentStack: errorInfo.componentStack,
    });
    if (eventId) this.setState({ eventId });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleBack = () => {
    window.history.back();
    setTimeout(
      () => this.setState({ hasError: false, error: null, eventId: null, copied: false }),
      100,
    );
  };

  handleCopy = () => {
    const { error, eventId } = this.state;
    const detalhe = error?.stack ?? error?.message ?? "Erro desconhecido";
    const text = eventId ? `Código: ${eventId}\n\n${detalhe}` : detalhe;
    navigator.clipboard.writeText(text).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { error, eventId, copied } = this.state;
    const message = error?.message ?? "Erro desconhecido";

    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center bg-background px-4 py-10">
        <div className="w-full max-w-md">
          <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
            <div className="w-11 h-11 rounded-full bg-destructive/10 flex items-center justify-center mb-5">
              <svg
                className="w-5 h-5 text-destructive"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            </div>

            <h1 className="text-lg font-semibold text-foreground">
              Esta página não carregou
            </h1>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              O erro foi registrado e a equipe já foi avisada. Tente abrir de novo. Se continuar,
              volte e siga por outro caminho, seus dados não foram afetados.
            </p>

            <div className="flex flex-wrap gap-2 mt-6">
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex items-center px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Tentar de novo
              </button>
              <button
                type="button"
                onClick={this.handleBack}
                className="inline-flex items-center px-4 py-2 rounded-full bg-muted text-foreground text-sm font-medium hover:bg-muted/80 transition-colors"
              >
                Voltar
              </button>
            </div>

            <details className="mt-6 group">
              <summary className="text-xs text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors list-none flex items-center gap-1">
                <svg
                  className="w-3 h-3 transition-transform group-open:rotate-90"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                Detalhes técnicos
              </summary>
              <div className="mt-3 bg-muted/50 rounded-lg px-4 py-3 border border-border">
                <p className="text-xs font-mono text-destructive break-all leading-relaxed">
                  {message}
                </p>
                {eventId && (
                  <p className="text-[11px] text-muted-foreground mt-2 font-mono">
                    Código: {eventId}
                  </p>
                )}
                <button
                  type="button"
                  onClick={this.handleCopy}
                  className="mt-3 text-xs font-medium text-foreground hover:underline"
                >
                  {copied ? "Copiado" : "Copiar detalhes"}
                </button>
              </div>
            </details>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-4">
            Se o problema persistir, envie o código acima para o suporte.
          </p>
        </div>
      </div>
    );
  }
}
