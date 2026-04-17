import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrencyInput, parseCurrencyString } from "@/lib/currencyUtils";
import { supabase } from "@/integrations/supabase/client";
import { getSafeErrorMessage } from "@/lib/safeError";
import { PROJECT_STATUS, PROJECT_PRIORITY, type ProjectPriority } from "@/constants";
import {
  type Projeto,
  type DisciplinaResponsavel,
  type DisciplinaObservacao,
  type ResponsavelDatas,
  getResponsaveisList,
} from "@/pages/projetos/types";
import { type TemplateProjeto } from "@/hooks/useTemplates";
import type { FluxoDisciplinas } from "@/types/fluxoDisciplinas";
import { toast } from "sonner";
import { useBulkSaveDisciplinas } from "@/hooks/useProjetoDisciplinas";

export const ESTADOS_BR = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

const EMPTY_FORM = {
  codigo_projeto: "",
  nome: "",
  cliente_id: "",
  localizacao: "",
  loc_cep: "",
  loc_logradouro: "",
  loc_numero: "",
  loc_bairro: "",
  loc_cidade: "",
  loc_estado: "",
  parcelas: "",
  area_m2: "",
  data_inicio: "",
  data_previsao: "",
  data_final: "",
  valor_contrato: "",
  observacao: "",
  status: PROJECT_STATUS.PLANEJAMENTO as Projeto["status"],
  prioridade: PROJECT_PRIORITY.MEDIA as ProjectPriority,
};

function composeLocalizacao(form: typeof EMPTY_FORM): string {
  const parts = [form.loc_logradouro, form.loc_numero, form.loc_bairro, form.loc_cidade, form.loc_estado].filter(
    Boolean
  );
  const address = parts.join(", ");
  const cepDigits = form.loc_cep.replace(/\D/g, "");
  if (cepDigits.length === 8) {
    return `${cepDigits.slice(0, 5)}-${cepDigits.slice(5)}, ${address}`;
  }
  return address;
}

function parseLocalizacao(loc: string) {
  const parts = loc.split(",").map((s) => s.trim());

  // Detect CEP at the beginning (format: 12345-678 or 12345678)
  let cep = "";
  let addressParts = parts;
  if (parts.length > 0 && /^\d{5}-?\d{3}$/.test(parts[0])) {
    cep = parts[0];
    addressParts = parts.slice(1);
  }

  if (addressParts.length >= 4) {
    return {
      loc_cep: cep,
      loc_logradouro: addressParts[0],
      loc_numero: addressParts.length >= 5 ? addressParts[1] : "",
      loc_bairro: addressParts.length >= 5 ? addressParts[2] : addressParts[1],
      loc_cidade: addressParts.length >= 5 ? addressParts[3] : addressParts[2],
      loc_estado: addressParts.length >= 5 ? addressParts[4] : addressParts[3],
    };
  }
  return {
    loc_cep: cep,
    loc_logradouro: addressParts.join(", "),
    loc_numero: "",
    loc_bairro: "",
    loc_cidade: "",
    loc_estado: "",
  };
}

const EMPTY_TEMP_DISCIPLINA: Partial<DisciplinaResponsavel> = {
  disciplina: "",
  responsavel_id: "",
  data_inicio: "",
  data_previsao: "",
  data_final: "",
  status: "Não Iniciado",
  prioridade: PROJECT_PRIORITY.MEDIA,
  observacoes: [],
};

interface UseProjetoFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editProjeto: Projeto | null;
  pessoas: { id: string; nome: string }[];
  templatesData: TemplateProjeto[];
  fluxosData?: FluxoDisciplinas[];
  currentUser: { name: string; email: string } | null;
  onSaved: () => void;
}

export function useProjetoForm({
  open,
  onOpenChange,
  editProjeto,
  pessoas,
  templatesData,
  fluxosData = [],
  currentUser,
  onSaved,
}: UseProjetoFormProps) {
  const queryClient = useQueryClient();
  const bulkSaveDisciplinas = useBulkSaveDisciplinas();
  const isEditMode = editProjeto !== null;
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingCep, setIsFetchingCep] = useState(false);
  const geocodeAbortRef = useRef<AbortController | null>(null);

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [projetosDisciplinas, setProjetosDisciplinas] = useState<DisciplinaResponsavel[]>([]);
  const [tempDisciplina, setTempDisciplina] = useState<Partial<DisciplinaResponsavel>>(EMPTY_TEMP_DISCIPLINA);
  const [selectedDisciplinaIndex, setSelectedDisciplinaIndex] = useState<number | null>(null);
  const [isDisciplinaDetailOpen, setIsDisciplinaDetailOpen] = useState(false);
  const [newObservation, setNewObservation] = useState("");
  const [expandedFormDiscIdx, setExpandedFormDiscIdx] = useState<number | null>(null);
  const [addingRespToFormDisc, setAddingRespToFormDisc] = useState<number | null>(null);
  const [newFormResp, setNewFormResp] = useState({
    responsavel_id: "",
    data_inicio: "",
    data_previsao: "",
    data_final: "",
  });

  const fetchCep = useCallback(
    async (cep: string) => {
      const digits = cep.replace(/\D/g, "");
      if (digits.length !== 8) return;

      setIsFetchingCep(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
        const data = await res.json();
        if (data.erro) {
          toast.error("CEP não encontrado");
          return;
        }
        setFormData((prev) => ({
          ...prev,
          loc_logradouro: data.logradouro || prev.loc_logradouro,
          loc_bairro: data.bairro || prev.loc_bairro,
          loc_cidade: data.localidade || prev.loc_cidade,
          loc_estado: data.uf || prev.loc_estado,
        }));
      } catch {
        toast.error("Erro ao buscar CEP");
      } finally {
        setIsFetchingCep(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    if (!open) return;

    if (editProjeto) {
      const parsed = parseLocalizacao(editProjeto.localizacao || "");
      setFormData({
        codigo_projeto: editProjeto.codigo_projeto,
        nome: editProjeto.nome,
        cliente_id: editProjeto.cliente_id,
        localizacao: editProjeto.localizacao || "",
        loc_cep: "",
        ...parsed,
        parcelas: editProjeto.parcelas || "",
        area_m2: editProjeto.area_m2?.toString() || "",
        data_inicio: editProjeto.data_inicio || "",
        data_previsao: editProjeto.data_previsao || "",
        data_final: editProjeto.data_final || "",
        valor_contrato:
          editProjeto.valor_contrato !== undefined
            ? formatCurrencyInput((editProjeto.valor_contrato * 100).toString())
            : "",
        observacao: editProjeto.observacao || "",
        status: editProjeto.status,
        prioridade: editProjeto.prioridade || PROJECT_PRIORITY.MEDIA,
      });
      setProjetosDisciplinas(editProjeto.disciplinas || []);
    } else {
      setFormData(EMPTY_FORM);
      setProjetosDisciplinas([]);
    }

    setTempDisciplina(EMPTY_TEMP_DISCIPLINA);
    setSelectedDisciplinaIndex(null);
    setIsDisciplinaDetailOpen(false);
    setNewObservation("");
    setIsSaving(false);
  }, [open, editProjeto]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleOpenDisciplinaDetail = (index: number) => {
    setSelectedDisciplinaIndex(index);
    setIsDisciplinaDetailOpen(true);
  };

  const handleAddObservation = () => {
    if (!newObservation.trim() || selectedDisciplinaIndex === null) return;

    const updatedDisciplinas = [...projetosDisciplinas];
    const discipline = updatedDisciplinas[selectedDisciplinaIndex];

    const newObs: DisciplinaObservacao = {
      id: crypto.randomUUID(),
      texto: newObservation,
      usuario: currentUser?.name || "Usuário",
      data: new Date().toISOString(),
    };

    updatedDisciplinas[selectedDisciplinaIndex] = {
      ...discipline,
      observacoes: [...(discipline.observacoes || []), newObs],
    };

    setProjetosDisciplinas(updatedDisciplinas);
    setNewObservation("");
  };

  const updateDisciplinaField = (field: keyof DisciplinaResponsavel, value: string) => {
    if (selectedDisciplinaIndex === null) return;
    const updatedDisciplinas = [...projetosDisciplinas];
    updatedDisciplinas[selectedDisciplinaIndex] = {
      ...updatedDisciplinas[selectedDisciplinaIndex],
      [field]: value,
    };
    setProjetosDisciplinas(updatedDisciplinas);
  };

  const updateDisciplinaResponsavel = (val: string, nome: string) => {
    if (selectedDisciplinaIndex === null) return;
    const updatedDisciplinas = [...projetosDisciplinas];
    updatedDisciplinas[selectedDisciplinaIndex] = {
      ...updatedDisciplinas[selectedDisciplinaIndex],
      responsavel_id: val,
      responsavel_nome: nome,
    };
    setProjetosDisciplinas(updatedDisciplinas);
  };

  const addProjetoDisciplina = () => {
    if (!tempDisciplina.disciplina || !tempDisciplina.responsavel_id) return;

    const pessoa = pessoas.find((p) => p.id === tempDisciplina.responsavel_id);

    const novaDisciplina: DisciplinaResponsavel = {
      disciplina: tempDisciplina.disciplina,
      responsavel_id: tempDisciplina.responsavel_id,
      responsavel_nome: pessoa?.nome || "",
      data_inicio: tempDisciplina.data_inicio,
      data_previsao: tempDisciplina.data_previsao,
      data_final: tempDisciplina.data_final,
      status: tempDisciplina.status || "Não Iniciado",
      prioridade: tempDisciplina.prioridade || PROJECT_PRIORITY.MEDIA,
      observacoes: tempDisciplina.observacoes || [],
      responsaveis: [
        {
          responsavel_id: tempDisciplina.responsavel_id!,
          responsavel_nome: pessoa?.nome || "",
          data_inicio: tempDisciplina.data_inicio,
          data_previsao: tempDisciplina.data_previsao,
          data_final: tempDisciplina.data_final,
          status: tempDisciplina.status || "Não Iniciado",
        },
      ],
    };

    setProjetosDisciplinas([...projetosDisciplinas, novaDisciplina]);
    setTempDisciplina(EMPTY_TEMP_DISCIPLINA);
  };

  const removeProjetoDisciplina = (index: number) => {
    setProjetosDisciplinas((prev) => prev.filter((_, i) => i !== index));
    if (expandedFormDiscIdx === index) setExpandedFormDiscIdx(null);
  };

  const addResponsavelToDisc = (discIdx: number) => {
    if (!newFormResp.responsavel_id) return;
    const pessoa = pessoas.find((p) => p.id === newFormResp.responsavel_id);
    const updated = [...projetosDisciplinas];
    const disc = updated[discIdx];
    const currentResps = getResponsaveisList(disc);

    if (currentResps.some((r) => r.responsavel_id === newFormResp.responsavel_id)) {
      toast.error("Responsável já adicionado nesta disciplina");
      return;
    }

    const novoResp: ResponsavelDatas = {
      responsavel_id: newFormResp.responsavel_id,
      responsavel_nome: pessoa?.nome || "",
      data_inicio: newFormResp.data_inicio || undefined,
      data_previsao: newFormResp.data_previsao || undefined,
      data_final: newFormResp.data_final || undefined,
      status: "Não Iniciado",
    };

    updated[discIdx] = { ...disc, responsaveis: [...currentResps, novoResp] };
    setProjetosDisciplinas(updated);
    setNewFormResp({ responsavel_id: "", data_inicio: "", data_previsao: "", data_final: "" });
    setAddingRespToFormDisc(null);
  };

  const removeResponsavelFromDisc = (discIdx: number, respIdx: number) => {
    const updated = [...projetosDisciplinas];
    const disc = updated[discIdx];
    const resps = getResponsaveisList(disc);
    if (resps.length <= 1) {
      toast.error("A disciplina precisa ter ao menos um responsável");
      return;
    }
    const newResps = resps.filter((_, i) => i !== respIdx);
    updated[discIdx] = {
      ...disc,
      responsaveis: newResps,
      responsavel_id: newResps[0].responsavel_id,
      responsavel_nome: newResps[0].responsavel_nome,
    };
    setProjetosDisciplinas(updated);
  };

  const updateRespDatasInForm = (discIdx: number, respIdx: number, field: keyof ResponsavelDatas, value: string) => {
    const updated = [...projetosDisciplinas];
    const disc = updated[discIdx];
    const resps = [...getResponsaveisList(disc)];
    resps[respIdx] = { ...resps[respIdx], [field]: value };
    updated[discIdx] = { ...disc, responsaveis: resps };
    setProjetosDisciplinas(updated);
  };

  const applyTemplate = (templateId: string) => {
    const template = templatesData.find((t) => t.id === templateId);
    if (!template) return;

    const novasDisciplinas: DisciplinaResponsavel[] = template.fases.flatMap((fase) =>
      fase.disciplinas.map((d) => ({
        disciplina: d.disciplina,
        responsavel_id: "",
        responsavel_nome: "",
        status: "Não Iniciado",
        observacoes: [],
      }))
    );

    setProjetosDisciplinas(novasDisciplinas);
    toast.success("Template aplicado", {
      description: `${novasDisciplinas.length} disciplina(s) adicionadas de "${template.nome}"`,
    });
  };

  const applyFluxo = (fluxoId: string | null) => {
    if (!fluxoId) {
      setProjetosDisciplinas([]);
      return;
    }
    const fluxo = fluxosData.find((f) => f.id === fluxoId);
    if (!fluxo) return;

    const novasDisciplinas: DisciplinaResponsavel[] = fluxo.etapas.flatMap((etapa) =>
      etapa.disciplinas.map((d) => ({
        disciplina: d.nome,
        responsavel_id: d.responsavel_id || "",
        responsavel_nome: d.responsavel_nome || "",
        status: "Não Iniciado",
        etapa: etapa.ordem,
        observacoes: [],
        responsaveis: d.responsavel_id
          ? [{ responsavel_id: d.responsavel_id, responsavel_nome: d.responsavel_nome || "", status: "Não Iniciado" }]
          : [],
      }))
    );

    setProjetosDisciplinas(novasDisciplinas);
    toast.success("Fluxo aplicado", {
      description: `${novasDisciplinas.length} disciplina(s) em ${fluxo.etapas.length} etapa(s) de "${fluxo.nome}"`,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.codigo_projeto || !formData.cliente_id || !formData.nome) {
      toast.error("Campos obrigatórios", { description: "Preencha Código, Nome e Cliente" });
      return;
    }

    setIsSaving(true);
    const localizacaoComposta = composeLocalizacao(formData) || formData.localizacao;

    try {
      if (isEditMode && editProjeto) {
        const { error } = await supabase.rpc("update_projeto_completo", {
          p_projeto_id: editProjeto.id,
          p_codigo: formData.codigo_projeto,
          p_nome: formData.nome,
          p_cliente_id: formData.cliente_id,
          p_data_inicio: formData.data_inicio || null,
          p_data_previsao: formData.data_previsao || null,
          p_data_final: formData.data_final || null,
          p_valor_contrato: parseCurrencyString(formData.valor_contrato) || 0,
          p_observacao: formData.observacao,
          p_localizacao: localizacaoComposta,
          p_parcelas: formData.parcelas || null,
          p_area_m2: parseFloat(formData.area_m2) || 0,
          p_disciplinas: projetosDisciplinas,
          p_status: formData.status,
          p_prioridade: formData.prioridade,
        });

        if (error) throw error;

        // Sync disciplinas to relational table
        const discsForBulk = projetosDisciplinas.map((d) => {
          const resps = getResponsaveisList(d);
          return {
            nome: d.disciplina,
            status: d.status || "Não Iniciado",
            data_inicio: d.data_inicio || null,
            data_fim: d.data_previsao || null,
            data_fim_real: d.data_final || null,
            prioridade: d.prioridade || null,
            justificativa_atraso: d.justificativa_atraso || null,
            responsavel_ids: resps.map((r) => r.responsavel_id).filter(Boolean),
          };
        });
        await bulkSaveDisciplinas.mutateAsync({
          projetoId: editProjeto.id,
          disciplinas: discsForBulk,
        });

        toast.success("Projeto atualizado", { description: "Projeto foi atualizado com sucesso" });
      } else {
        const { data: newProjetoId, error } = await supabase.rpc("create_projeto_completo", {
          p_codigo: formData.codigo_projeto,
          p_nome: formData.nome,
          p_cliente_id: formData.cliente_id,
          p_data_inicio: formData.data_inicio || null,
          p_data_previsao: formData.data_previsao || null,
          p_data_final: formData.data_final || null,
          p_valor_contrato: parseCurrencyString(formData.valor_contrato) || 0,
          p_observacao: formData.observacao,
          p_localizacao: localizacaoComposta,
          p_parcelas: formData.parcelas || null,
          p_area_m2: parseFloat(formData.area_m2) || 0,
          p_disciplinas: projetosDisciplinas,
          p_prioridade: formData.prioridade,
        });

        if (error) throw error;

        // Sync disciplinas to relational table for new project
        if (newProjetoId && projetosDisciplinas.length > 0) {
          const discsForBulk = projetosDisciplinas.map((d) => {
            const resps = getResponsaveisList(d);
            return {
              nome: d.disciplina,
              status: d.status || "Não Iniciado",
              data_inicio: d.data_inicio || null,
              data_fim: d.data_previsao || null,
              data_fim_real: d.data_final || null,
              prioridade: d.prioridade || null,
              justificativa_atraso: d.justificativa_atraso || null,
              responsavel_ids: resps.map((r) => r.responsavel_id).filter(Boolean),
            };
          });
          await bulkSaveDisciplinas.mutateAsync({
            projetoId: newProjetoId as string,
            disciplinas: discsForBulk,
          });
        }

        toast.success("Projeto cadastrado", { description: "Novo projeto foi adicionado com sucesso" });
      }

      onOpenChange(false);
      onSaved();

      if (localizacaoComposta.trim()) {
        // Cancela geocodificação anterior se ainda estiver em andamento
        geocodeAbortRef.current?.abort();
        const abortController = new AbortController();
        geocodeAbortRef.current = abortController;
        const { signal } = abortController;

        const nominatimBase = "https://nominatim.openstreetmap.org/search";
        const headers = { Accept: "application/json" };
        const street = [formData.loc_logradouro, formData.loc_numero].filter(Boolean).join(" ");
        const cepDigits = formData.loc_cep.replace(/\D/g, "");
        const postalcode = cepDigits.length === 8 ? `${cepDigits.slice(0, 5)}-${cepDigits.slice(5)}` : "";

        // Structured query: street + city + state + postalcode + country
        const params = new URLSearchParams({ format: "json", limit: "1", country: "Brazil" });
        if (street) params.set("street", street);
        if (formData.loc_cidade) params.set("city", formData.loc_cidade);
        if (formData.loc_estado) params.set("state", formData.loc_estado);
        if (postalcode) params.set("postalcode", postalcode);

        const saveCoords = (lat: number, lng: number) => {
          if (signal.aborted) return;
          const query =
            isEditMode && editProjeto
              ? supabase.from("projetos").update({ latitude: lat, longitude: lng }).eq("id", editProjeto.id)
              : supabase
                  .from("projetos")
                  .update({ latitude: lat, longitude: lng })
                  .eq("codigo_projeto", formData.codigo_projeto);
          query.then(() => {
            onSaved();
            queryClient.invalidateQueries({ queryKey: ["projetos-mapa"] });
          });
        };

        const extractCoords = (results: { lat: string; lon: string }[]) => {
          if (!results || results.length === 0) return null;
          const lat = parseFloat(results[0].lat);
          const lng = parseFloat(results[0].lon);
          return !isNaN(lat) && !isNaN(lng) ? { lat, lng } : null;
        };

        fetch(`${nominatimBase}?${params}`, { headers, signal })
          .then((res) => res.json())
          .then((results) => {
            const coords = extractCoords(results);
            if (coords) {
              saveCoords(coords.lat, coords.lng);
              return;
            }
            // Fallback: city + state only (at least place on the map at city level)
            if (formData.loc_cidade) {
              const fallback = new URLSearchParams({ format: "json", limit: "1", country: "Brazil" });
              fallback.set("city", formData.loc_cidade);
              if (formData.loc_estado) fallback.set("state", formData.loc_estado);
              return fetch(`${nominatimBase}?${fallback}`, { headers, signal })
                .then((res) => res.json())
                .then((fallbackResults) => {
                  const fallbackCoords = extractCoords(fallbackResults);
                  if (fallbackCoords) {
                    saveCoords(fallbackCoords.lat, fallbackCoords.lng);
                  } else {
                    toast.success("Endereço não localizado", {
                      description: "Não foi possível encontrar as coordenadas. O projeto não aparecerá no mapa.",
                    });
                  }
                });
            }
            toast.success("Endereço não localizado", {
              description: "Não foi possível encontrar as coordenadas do endereço. O projeto não aparecerá no mapa.",
            });
          })
          .catch((err: unknown) => {
            if (err instanceof DOMException && err.name === "AbortError") return;
            toast.success("Geocodificação falhou", {
              description: "Não foi possível obter coordenadas do endereço. O projeto não aparecerá no mapa.",
            });
          });
      } else if (isEditMode && editProjeto) {
        supabase
          .from("projetos")
          .update({ latitude: null, longitude: null })
          .eq("id", editProjeto.id)
          .then(() => onSaved());
      }
    } catch (err: unknown) {
      toast.error("Erro ao salvar");
    } finally {
      setIsSaving(false);
    }
  };

  return {
    isEditMode,
    isSaving,
    isFetchingCep,
    formData,
    handleInputChange,
    fetchCep,
    // Disciplinas
    projetosDisciplinas,
    tempDisciplina,
    setTempDisciplina,
    addProjetoDisciplina,
    removeProjetoDisciplina,
    expandedFormDiscIdx,
    setExpandedFormDiscIdx,
    addingRespToFormDisc,
    setAddingRespToFormDisc,
    newFormResp,
    setNewFormResp,
    addResponsavelToDisc,
    removeResponsavelFromDisc,
    updateRespDatasInForm,
    // Disciplina detail dialog
    selectedDisciplinaIndex,
    isDisciplinaDetailOpen,
    setIsDisciplinaDetailOpen,
    handleOpenDisciplinaDetail,
    updateDisciplinaField,
    updateDisciplinaResponsavel,
    newObservation,
    setNewObservation,
    handleAddObservation,
    // Template, Fluxo & submit
    applyTemplate,
    applyFluxo,
    handleSubmit,
  };
}
