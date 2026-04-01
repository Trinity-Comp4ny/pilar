import { z } from "zod";
import { PROJECT_STATUS } from "@/constants";

export const projetoSchema = z.object({
  codigo_projeto: z.string().min(1, "Código do projeto é obrigatório"),
  nome: z.string().min(1, "Nome é obrigatório"),
  cliente_id: z.string().min(1, "Cliente é obrigatório"),
  localizacao: z.string().optional().default(""),
  parcelas: z.string().optional().default(""),
  area_m2: z.string().optional().default(""),
  data_inicio: z.string().optional().default(""),
  data_previsao: z.string().optional().default(""),
  data_final: z.string().optional().default(""),
  valor_contrato: z.string().optional().default(""),
  observacao: z.string().optional().default(""),
  status: z.string().default(PROJECT_STATUS.PLANEJAMENTO),
});

export type ProjetoFormData = z.infer<typeof projetoSchema>;

export const projetoDefaultValues: ProjetoFormData = {
  codigo_projeto: "",
  nome: "",
  cliente_id: "",
  localizacao: "",
  parcelas: "",
  area_m2: "",
  data_inicio: "",
  data_previsao: "",
  data_final: "",
  valor_contrato: "",
  observacao: "",
  status: PROJECT_STATUS.PLANEJAMENTO,
};
