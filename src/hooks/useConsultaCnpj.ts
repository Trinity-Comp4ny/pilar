import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { edgeFunctionErrorMessage } from "@/lib/edgeFunctionError";
import { validCnpjChecksum } from "@/schemas/authSchemas";

export type DadosReceita = {
  razaoSocial: string;
  situacao: string;
  nomeFantasia: string | null;
  endereco: { logradouro: string; cidade: string | null; uf: string | null; cep: string | null } | null;
};

export type ConsultaCnpj =
  | { estado: "inativo" }
  | { estado: "consultando" }
  | { estado: "ok"; dados: DadosReceita }
  | { estado: "indisponivel" }
  | { estado: "erro"; mensagem: string };

type Resposta = {
  status?: "ok" | "indisponivel";
  razao_social?: string;
  situacao_cadastral?: string;
  nome_fantasia?: string | null;
  endereco?: DadosReceita["endereco"];
};

/**
 * Consulta o CNPJ na Receita (BrasilAPI, pela edge verificar-documento em modo
 * só consulta) assim que ele fica completo e válido (SPEC 149). Não grava nada:
 * serve para o dono conferir razão social, situação e endereço antes de salvar.
 */
export function useConsultaCnpj(cnpj: string, atrasoMs = 400): ConsultaCnpj {
  const digits = cnpj.replace(/\D/g, "");
  const completo = digits.length === 14 && validCnpjChecksum(digits);
  const [consulta, setConsulta] = useState<ConsultaCnpj>({ estado: "inativo" });

  useEffect(() => {
    if (!completo) {
      setConsulta({ estado: "inativo" });
      return;
    }
    let cancelado = false;
    const timer = window.setTimeout(async () => {
      setConsulta({ estado: "consultando" });
      const { data, error } = await supabase.functions.invoke<Resposta>("verificar-documento", {
        body: { documento: digits, apenas_consultar: true },
      });
      if (cancelado) return;
      if (error) {
        setConsulta({
          estado: "erro",
          mensagem: await edgeFunctionErrorMessage(error, "Não foi possível consultar a Receita agora."),
        });
        return;
      }
      if (data?.status !== "ok" || !data.razao_social) {
        setConsulta({ estado: "indisponivel" });
        return;
      }
      setConsulta({
        estado: "ok",
        dados: {
          razaoSocial: data.razao_social,
          situacao: data.situacao_cadastral ?? "",
          nomeFantasia: data.nome_fantasia ?? null,
          endereco: data.endereco ?? null,
        },
      });
    }, atrasoMs);
    return () => {
      cancelado = true;
      window.clearTimeout(timer);
    };
  }, [digits, completo, atrasoMs]);

  return consulta;
}
