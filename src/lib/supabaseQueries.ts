import { supabase } from "@/integrations/supabase/client";

type LookupItem = { id: string; nome: string };
type ProjetoLookupItem = { id: string; nome: string; codigo_projeto: string };

/**
 * Lookups comuns para dropdowns — evita repetir a mesma query em vários componentes.
 */

export const fetchClientesLookup = async (): Promise<LookupItem[]> => {
  const { data } = await supabase.from("clientes").select("id, nome").is("deleted_at", null).order("nome");
  return (data as LookupItem[]) ?? [];
};

export const fetchPessoasLookup = async (): Promise<LookupItem[]> => {
  const { data } = await supabase.from("pessoas").select("id, nome").is("deleted_at", null).order("nome");
  return (data as LookupItem[]) ?? [];
};

export const fetchProjetosLookup = async (): Promise<ProjetoLookupItem[]> => {
  const { data } = await supabase
    .from("projetos")
    .select("id, nome, codigo_projeto")
    .is("deleted_at", null)
    .order("nome");
  return (data as ProjetoLookupItem[]) ?? [];
};

export const fetchLeadsLookup = async (): Promise<LookupItem[]> => {
  const { data } = await supabase.from("leads").select("id, nome").is("deleted_at", null).order("nome");
  return (data as LookupItem[]) ?? [];
};
