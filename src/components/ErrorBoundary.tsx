import { Component, type ErrorInfo, type ReactNode } from "react";
import { monitoring } from "@/lib/monitoring";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, copied: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, copied: false };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    monitoring.captureException(error, { componentStack: errorInfo.componentStack });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleBack = () => {
    window.history.back();
    setTimeout(() => this.setState({ hasError: false, error: null, copied: false }), 100);
  };

  handleCopy = () => {
    const text = this.state.error?.stack ?? this.state.error?.message ?? "Erro desconhecido";
    navigator.clipboard.writeText(text).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { error, copied } = this.state;
    const message = error?.message ?? "Erro desconhecido";

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-lg">
          <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-5 h-5 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-base font-semibold text-gray-900">Algo deu errado</h1>
                <p className="text-xs text-gray-400">Um erro inesperado impediu a renderização desta página</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg px-4 py-3 mb-6 border border-gray-100">
              <p className="text-xs font-mono text-red-600 break-all leading-relaxed">{message}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex items-center px-4 py-2 rounded-full bg-black text-white text-sm font-medium hover:bg-black/90 transition-colors"
              >
                Recarregar página
              </button>
              <button
                type="button"
                onClick={this.handleBack}
                className="inline-flex items-center px-4 py-2 rounded-full bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={this.handleCopy}
                className="inline-flex items-center px-4 py-2 rounded-full bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors ml-auto"
              >
                {copied ? "Copiado!" : "Copiar erro"}
              </button>
            </div>
          </div>
          <p className="text-center text-xs text-gray-400 mt-4">
            Se o problema persistir, entre em contato com o suporte.
          </p>
        </div>
      </div>
    );
  }
}
