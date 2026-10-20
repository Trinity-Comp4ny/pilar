import { z } from "zod";
import type { RdoRow } from "@/pages/obras/hooks/useObraRdo";

/** Valor do Select quando o campo não foi informado. */
export const NAO_INFORMADO = "__none__";

export const schema = z.object({
  data: z.string().min(1, "Escolha a data"),
  clima: z.string(),
  condicao_trabalho: z.string(),
  efetivo: z.string(),
  atividades: z.string(),
  ocorrencias: z.string(),
  pendencias: z.string(),
});
export type FormData = z.infer<typeof schema>;

export const hoje = () => new Date().toISOString().slice(0, 10);

export const vazio = (): FormData => ({
  data: hoje(),
  clima: NAO_INFORMADO,
  condicao_trabalho: NAO_INFORMADO,
  efetivo: "",
  atividades: "",
  ocorrencias: "",
  pendencias: "",
});

export const doRdo = (r: RdoRow): FormData => ({
  data: r.data,
  clima: r.clima ?? NAO_INFORMADO,
  condicao_trabalho: r.condicao_trabalho ?? NAO_INFORMADO,
  efetivo: r.efetivo != null ? String(r.efetivo) : "",
  atividades: r.atividades ?? "",
  ocorrencias: r.ocorrencias ?? "",
  pendencias: r.pendencias ?? "",
});
