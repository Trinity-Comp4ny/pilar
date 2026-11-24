// Canais comerciais. A demonstração e a conversa sobre implantação são
// opcionais: a contratação direta continua disponível nos cartões dos planos.

/** Página do site com a agenda embutida. Todo botão de demonstração leva para cá. */
export const DEMO_PATH = "/demonstracao";

/** Link curto da agenda do Google, para quem prefere abrir fora do site. */
export const DEMO_URL = "https://calendar.app.google/SGrmJrzqrmGykdjT9";

/**
 * A mesma agenda no formato que o Google deixa embutir (`?gv=true`). O link curto
 * acima redireciona para este endereço; a CSP do site (vercel.json) libera
 * `frame-src https://calendar.google.com` só por causa dele.
 */
export const DEMO_EMBED_URL =
  "https://calendar.google.com/calendar/appointments/schedules/AcZssZ01YQzEtGslbNt73mFm68wrSvD-KTBhdHzJMpw70Bgxnh9sNxWFO9IttDU5iMssIVFn3bb-8m26?gv=true";

export const WHATSAPP_COMERCIAL_URL = "https://wa.me/5514998721100";

/**
 * Perfis oficiais da Pilar. Os mesmos endereços entram no `sameAs` do JSON-LD
 * (apps/marketing/index.html): é por eles que o Google liga o site aos perfis.
 */
export const REDES_SOCIAIS = [
  { nome: "Instagram", rotulo: "Pilar no Instagram (@pilarsoft.app)", url: "https://www.instagram.com/pilarsoft.app/" },
  { nome: "LinkedIn", rotulo: "Pilar no LinkedIn", url: "https://www.linkedin.com/company/pilarsoft/" },
] as const;
