const dsn = import.meta.env.VITE_SENTRY_MARKETING_DSN?.trim();

export function initMonitoring() {
  if (!dsn) return;

  // A primeira falha ativa o SDK sem aumentar o download da visita saudável.
  let loading = false;
  const carregarERelatar = (error: Error) => {
    if (loading) return;
    loading = true;
    void import("@sentry/react")
      .then((sentry) => {
        sentry.init({
          dsn,
          environment: import.meta.env.VITE_SENTRY_ENV || __MARKETING_SENTRY_ENV__,
          release: __MARKETING_RELEASE__,
          sendDefaultPii: false,
          maxBreadcrumbs: 0,
          beforeSend(event) {
            // Mantém stack e tipo. URLs, mensagens e contextos do navegador
            // podem incluir parâmetros de campanha ou textos de origem externa.
            return {
              event_id: event.event_id,
              type: event.type,
              timestamp: event.timestamp,
              platform: event.platform,
              environment: event.environment,
              release: event.release,
              level: event.level,
              tags: { surface: "marketing" },
              exception: {
                values: (event.exception?.values ?? []).map((exception) => ({
                  type: exception.type,
                  value: "Falha de execução na landing",
                  stacktrace: exception.stacktrace && {
                    frames: exception.stacktrace.frames?.map((frame) => ({
                      filename: frame.filename?.split(/[?#]/, 1)[0],
                      function: frame.function,
                      lineno: frame.lineno,
                      colno: frame.colno,
                      in_app: frame.in_app,
                    })),
                  },
                })),
              },
            };
          },
        });
        detach();
        sentry.captureException(error);
      })
      .catch(() => {
        loading = false;
      });
  };
  const onError = (event: ErrorEvent) => {
    carregarERelatar(event.error instanceof Error ? event.error : new Error("Erro ao carregar a landing"));
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    carregarERelatar(event.reason instanceof Error ? event.reason : new Error("Falha assíncrona na landing"));
  };
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);

  const detach = () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}

declare const __MARKETING_RELEASE__: string;
declare const __MARKETING_SENTRY_ENV__: string;
