import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(
  withSentry("geocode-address", async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
      const { address } = await req.json();
      if (!address || typeof address !== "string") {
        throw new Error("Endereço é obrigatório");
      }

      const encoded = encodeURIComponent(address);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1&countrycodes=br`,
        {
          headers: {
            "User-Agent": "PilarSoft/1.0 (contato@pilarsoft.com.br)",
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Nominatim retornou ${response.status}`);
      }

      const results = await response.json();

      if (!results || results.length === 0) {
        return new Response(JSON.stringify({ lat: null, lng: null, found: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      const { lat, lon, display_name } = results[0];

      return new Response(JSON.stringify({ lat: parseFloat(lat), lng: parseFloat(lon), display_name, found: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao geocodificar";
      return new Response(JSON.stringify({ error: message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }
  })
);
