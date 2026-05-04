import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";

import { authenticateUser, jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { sendEmail, templateDisciplinaConcluida, templateProjetoConcluido } from "../_shared/email.ts";
import { isValidEmail } from "../_shared/validators.ts";

type CompletionType = "project" | "subject";

serve(
  withSentry("send-completion-email", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);
    if (req.method !== "POST") return safeErrorResponse(405, "Method not allowed", req);

    const auth = await authenticateUser(req);
    if (auth.error) return auth.error;

    try {
      const { email, name, type } = (await req.json()) as {
        email?: string;
        name?: string;
        type?: CompletionType;
      };

      if (!isValidEmail(email)) {
        return safeErrorResponse(400, "Email inválido", req);
      }
      if (!name || typeof name !== "string") {
        return safeErrorResponse(400, "Nome obrigatório", req);
      }
      if (type !== "project" && type !== "subject") {
        return safeErrorResponse(400, "Tipo inválido (project | subject)", req);
      }

      const subject = type === "project" ? `Projeto "${name}" concluído` : `Disciplina "${name}" concluída`;

      const html = type === "project" ? templateProjetoConcluido(name) : templateDisciplinaConcluida(name);

      await sendEmail({ to: email!, subject, html });

      return jsonResponse({ success: true }, 200, req);
    } catch (err) {
      console.error("[send-completion-email]", err);
      return safeErrorResponse(500, "Erro ao enviar email", req);
    }
  })
);
