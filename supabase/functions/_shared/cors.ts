const allowedOrigins = [
  Deno.env.get("ALLOWED_ORIGIN") || "https://pilarsoft.com.br",
  "http://localhost:8080",
  "http://localhost:5173",
];

export function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const matchedOrigin = allowedOrigins.find((o) => o === origin) || allowedOrigins[0];
  return {
    "Access-Control-Allow-Origin": matchedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

// Fallback estático para compatibilidade com functions existentes
const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN");
export const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin ?? "https://pilarsoft.com.br",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
