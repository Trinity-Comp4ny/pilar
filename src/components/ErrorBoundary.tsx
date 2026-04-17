import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Algo deu errado</h1>
          <p className="text-sm text-gray-500 mb-6">Ocorreu um erro inesperado. Tente recarregar a página.</p>
          <button
            type="button"
            onClick={this.handleReload}
            className="inline-flex items-center px-4 py-2 rounded-md bg-black text-white text-sm font-medium hover:bg-black/90 transition-colors"
          >
            Recarregar página
          </button>
        </div>
      </div>
    );
  }
}
