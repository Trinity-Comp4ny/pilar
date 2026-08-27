import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { formatValorToInput, parseCurrencyString } from "@/lib/currencyUtils";
import { supabase } from "@/integrations/supabase/client";
import { addBusinessDays, formatDateLocal, parseDateLocal } from "@/lib/businessDays";
import { calcularDatasFluxo, responsaveisEfetivos } from "@/lib/fluxoCascata";
import { PROJECT_STATUS, PROJECT_PRIORITY, type ProjectPriority } from "@/constants";
import {
  type Projeto,
  type ProjetoDisciplinaDB,
  type DisciplinaResponsavel,
  type DisciplinaObservacao,
  type ResponsavelDatas,
  getResponsaveisList,
  dbDisciplinaToLegacy,
} from "@/types/projetos";
import { type TemplateProjeto } from "@/hooks/useTemplates";
import type { FluxoDisciplinas } from "@/types/fluxoDisciplinas";
import { toast } from "sonner";
import { getSafeErrorMessage } from "@/lib/safeError";
import { lookupCEP } from "@/lib/brasilApi";
import { useBulkSaveDisciplinas } from "@/hooks/useProjetoDisciplinas";
import { useFormPersist, clearFormPersist } from "@/hooks/useFormPersist";

const PROJETO_DRAFT_KEY = "projeto-novo";

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
  prazo_dias_uteis: "",
  dia_pagamento: "",
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
  /** Disciplinas relacionais já persistidas — usadas para hidratar o state em modo edição. */
  existingDisciplinas?: ProjetoDisciplinaDB[];
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
  existingDisciplinas = [],
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
  // Snapshot do estado inicial do formulário ao abrir, para detectar alterações
  // não salvas e confirmar antes de descartar.
  const initialSnapshotRef = useRef<string>("");

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [projetosDisciplinas, setProjetosDisciplinas] = useState<DisciplinaResponsavel[]>([]);
  const [tempDisciplina, setTempDisciplina] = useState<Partial<DisciplinaResponsavel>>(EMPTY_TEMP_DISCIPLINA);
  const [selectedDisciplinaIndex, setSelectedDisciplinaIndex] = useState<number | null>(null);
  const [isDisciplinaDetailOpen, setIsDisciplinaDetailOpen] = useState(false);
  const [newObservation, setNewObservation] = useState("");
  const [addingRespToFormDisc, setAddingRespToFormDisc] = useState<number | null>(null);
  const [newFormResp, setNewFormResp] = useState({
    responsavel_id: "",
    data_inicio: "",
    data_previsao: "",
    data_final: "",
  });

  const fetchCep = useCallback(async (cep: string) => {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;

    setIsFetchingCep(true);
    try {
      const end = await lookupCEP(digits);
      if (!end) {
        toast.error("CEP não encontrado");
        return;
      }
      setFormData((prev) => ({
        ...prev,
        loc_logradouro: end.street || prev.loc_logradouro,
        loc_bairro: end.neighborhood || prev.loc_bairro,
        loc_cidade: end.city || prev.loc_cidade,
        loc_estado: end.state || prev.loc_estado,
      }));
    } finally {
      setIsFetchingCep(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    if (editProjeto) {
      const parsed = parseLocalizacao(editProjeto.localizacao || "");
      const nextForm = {
        codigo_projeto: editProjeto.codigo_projeto,
        nome: editProjeto.nome,
        cliente_id: editProjeto.cliente_id,
        localizacao: editProjeto.localizacao || "",
        ...parsed,
        parcelas: editProjeto.parcelas || "",
        area_m2: editProjeto.area_m2?.toString() || "",
        data_inicio: editProjeto.data_inicio || "",
        data_previsao: editProjeto.data_previsao || "",
        data_final: editProjeto.data_final || "",
        valor_contrato: editProjeto.valor_contrato !== undefined ? formatValorToInput(editProjeto.valor_contrato) : "",
        observacao: editProjeto.observacao || "",
        status: editProjeto.status,
        prioridade: editProjeto.prioridade || PROJECT_PRIORITY.MEDIA,
        prazo_dias_uteis: "",
        dia_pagamento: "",
      };
      setFormData(nextForm);
      // editProjeto.disciplinas é legado (sempre []). Hidrata da tabela relacional
      // preservando os IDs para que bulkSave faça update/delete coerentes.
      const hydrated =
        existingDisciplinas.length > 0 ? existingDisciplinas.map(dbDisciplinaToLegacy) : editProjeto.disciplinas || [];
      setProjetosDisciplinas(hydrated);
      initialSnapshotRef.current = JSON.stringify({ form: nextForm, disc: hydrated });
    } else {
      setFormData(EMPTY_FORM);
      setProjetosDisciplinas([]);
      initialSnapshotRef.current = JSON.stringify({ form: EMPTY_FORM, disc: [] });
    }

    setTempDisciplina(EMPTY_TEMP_DISCIPLINA);
    setSelectedDisciplinaIndex(null);
    setIsDisciplinaDetailOpen(false);
    setNewObservation("");
    setIsSaving(false);
  }, [open, editProjeto, existingDisciplinas]);

  // Rascunho de novo projeto: restaura ao abrir (create) e salva a cada mudança.
  // Só ativo no modo criação; edição nunca persiste. TTL de 24h no hook.
  useFormPersist({
    storageKey: PROJETO_DRAFT_KEY,
    values: formData,
    enabled: open && !isEditMode,
    onRestore: ({ values }) => setFormData({ ...EMPTY_FORM, ...values }),
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };

      if (field === "prazo_dias_uteis" || field === "data_inicio") {
        const prazo = field === "prazo_dias_uteis" ? value : prev.prazo_dias_uteis;
        const inicio = field === "data_inicio" ? value : prev.data_inicio;
        const prazoNum = parseInt(prazo, 10);
        if (inicio && prazoNum > 0 && prazoNum <= 999) {
          try {
            const startDate = parseDateLocal(inicio);
            const endDate = addBusinessDays(startDate, prazoNum);
            next.data_previsao = formatDateLocal(endDate);
          } catch {
            // ignore parse errors
          }
        }
      }

      return next;
    });
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
    if (!tempDisciplina.disciplina) return;

    const pessoa = pessoas.find((p) => p.id === tempDisciplina.responsavel_id);

    const novaDisciplina: DisciplinaResponsavel = {
      disciplina: tempDisciplina.disciplina,
      responsavel_id: tempDisciplina.responsavel_id || "",
      responsavel_nome: pessoa?.nome || "",
      data_inicio: tempDisciplina.data_inicio,
      data_previsao: tempDisciplina.data_previsao,
      data_final: tempDisciplina.data_final,
      status: tempDisciplina.status || "Não Iniciado",
      prioridade: tempDisciplina.prioridade || PROJECT_PRIORITY.MEDIA,
      observacoes: tempDisciplina.observacoes || [],
      responsaveis: tempDisciplina.responsavel_id
        ? [
            {
              responsavel_id: tempDisciplina.responsavel_id,
              responsavel_nome: pessoa?.nome || "",
              data_inicio: tempDisciplina.data_inicio,
              data_previsao: tempDisciplina.data_previsao,
              data_final: tempDisciplina.data_final,
              status: tempDisciplina.status || "Não Iniciado",
            },
          ]
        : [],
    };

    setProjetosDisciplinas([...projetosDisciplinas, novaDisciplina]);
    setTempDisciplina(EMPTY_TEMP_DISCIPLINA);
  };

  const removeProjetoDisciplina = (index: number) => {
    setProjetosDisciplinas((prev) => prev.filter((_, i) => i !== index));
  };

  const addResponsavelToDisc = (discIdx: number) => {
    const updated = [...projetosDisciplinas];
    const disc = updated[discIdx];
    const currentResps = getResponsaveisList(disc);

    if (!newFormResp.responsavel_id) {
      const hasDates = newFormResp.data_inicio || newFormResp.data_previsao || newFormResp.data_final;
      if (!hasDates) return;
      // Save dates directly on the disc without a responsável
      updated[discIdx] = {
        ...disc,
        data_inicio: newFormResp.data_inicio || disc.data_inicio,
        data_previsao: newFormResp.data_previsao || disc.data_previsao,
        data_final: newFormResp.data_final || disc.data_final,
      };
      setProjetosDisciplinas(updated);
      setNewFormResp({ responsavel_id: "", data_inicio: "", data_previsao: "", data_final: "" });
      setAddingRespToFormDisc(null);
      return;
    }

    if (currentResps.some((r) => r.responsavel_id && r.responsavel_id === newFormResp.responsavel_id)) {
      toast.error("Responsável já adicionado nesta disciplina");
      return;
    }

    const pessoa = pessoas.find((p) => p.id === newFormResp.responsavel_id);
    const novoResp: ResponsavelDatas = {
      responsavel_id: newFormResp.responsavel_id,
      responsavel_nome: pessoa?.nome || "",
      data_inicio: newFormResp.data_inicio || undefined,
      data_previsao: newFormResp.data_previsao || undefined,
      data_final: newFormResp.data_final || undefined,
      status: "Não Iniciado",
    };

    // Replace placeholder (dates-only entry with empty responsavel_id) if it exists
    const hasPlaceholder = currentResps.length === 1 && !currentResps[0].responsavel_id;
    const newResps = hasPlaceholder ? [novoResp] : [...currentResps, novoResp];
    updated[discIdx] = {
      ...disc,
      responsaveis: newResps,
      responsavel_id: novoResp.responsavel_id,
      responsavel_nome: novoResp.responsavel_nome,
    };
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
    const isDateField = field === "data_inicio" || field === "data_previsao" || field === "data_final";
    const topLevel = isDateField && respIdx === 0 ? { [field]: value } : {};
    updated[discIdx] = { ...disc, responsaveis: resps, ...topLevel };
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

    const datas = calcularDatasFluxo(fluxo.disciplinas, formData.data_inicio || undefined);

    const novasDisciplinas: DisciplinaResponsavel[] = fluxo.disciplinas.map((d, i) => {
      const dataDisc = datas[i];
      // União dos responsáveis das tarefas (ou fallback manual da disciplina,
      // se nenhuma tarefa tiver responsável) — spec 071 revisão.
      const { ids: responsaveisIds, nomes: responsaveisNomes } = responsaveisEfetivos(d);
      return {
        disciplina: d.nome,
        responsavel_id: responsaveisIds[0] || "",
        responsavel_nome: responsaveisNomes[0] || "",
        status: "Não Iniciado",
        etapa: d.ordem,
        data_inicio: dataDisc?.data_inicio,
        data_previsao: dataDisc?.data_previsao,
        checklist_padrao: d.checklist_padrao,
        observacoes: [],
        responsaveis: responsaveisIds.map((id, ri) => ({
          responsavel_id: id,
          responsavel_nome: responsaveisNomes[ri] || "",
          status: "Não Iniciado",
          data_inicio: dataDisc?.data_inicio,
          data_previsao: dataDisc?.data_previsao,
        })),
      };
    });

    const colunas = new Set(fluxo.disciplinas.map((d) => d.ordem)).size;
    setProjetosDisciplinas(novasDisciplinas);
    toast.success("Fluxo aplicado", {
      description: `${novasDisciplinas.length} disciplina(s) em ${colunas} coluna(s) de "${fluxo.nome}"`,
    });
  };

  const handleSubmit = async () => {
    if (!formData.nome) {
      toast.error("Campo obrigatório", { description: "Preencha o nome do projeto" });
      return;
    }

    // Safety net: se o usuário preencheu disciplina temp mas esqueceu de clicar
    // em "Incluir na lista", inclui automaticamente antes de salvar.
    let finalDisciplinas = projetosDisciplinas;
    if (tempDisciplina.disciplina) {
      const pessoa = pessoas.find((p) => p.id === tempDisciplina.responsavel_id);
      const novaDisciplina: DisciplinaResponsavel = {
        disciplina: tempDisciplina.disciplina,
        responsavel_id: tempDisciplina.responsavel_id || "",
        responsavel_nome: pessoa?.nome || "",
        data_inicio: tempDisciplina.data_inicio,
        data_previsao: tempDisciplina.data_previsao,
        data_final: tempDisciplina.data_final,
        status: tempDisciplina.status || "Não Iniciado",
        prioridade: tempDisciplina.prioridade || PROJECT_PRIORITY.MEDIA,
        observacoes: tempDisciplina.observacoes || [],
        responsaveis: tempDisciplina.responsavel_id
          ? [
              {
                responsavel_id: tempDisciplina.responsavel_id,
                responsavel_nome: pessoa?.nome || "",
                data_inicio: tempDisciplina.data_inicio,
                data_previsao: tempDisciplina.data_previsao,
                data_final: tempDisciplina.data_final,
                status: tempDisciplina.status || "Não Iniciado",
              },
            ]
          : [],
      };
      finalDisciplinas = [...projetosDisciplinas, novaDisciplina];
      setProjetosDisciplinas(finalDisciplinas);
      setTempDisciplina(EMPTY_TEMP_DISCIPLINA);
      toast.info("Disciplina pendente incluída automaticamente", {
        description: `"${tempDisciplina.disciplina}" foi adicionada à lista antes de salvar.`,
      });
    }

    // Validação de datas das disciplinas vs prazo do projeto
    const projetoPrevisao = formData.data_previsao;
    const projetoFinal = formData.data_final;
    const projetoInicio = formData.data_inicio;
    for (const disc of finalDisciplinas) {
      const resps = getResponsaveisList(disc);
      const datas =
        resps.length > 0
          ? resps
          : [{ data_inicio: disc.data_inicio, data_previsao: disc.data_previsao, data_final: disc.data_final }];
      for (const d of datas) {
        if (projetoInicio && d.data_inicio && d.data_inicio < projetoInicio) {
          toast.error("Datas inválidas", {
            description: `Disciplina "${disc.disciplina}" tem início anterior ao do projeto`,
          });
          return;
        }
        if (projetoPrevisao && d.data_previsao && d.data_previsao > projetoPrevisao) {
          toast.error("Datas inválidas", {
            description: `Previsão da disciplina "${disc.disciplina}" ultrapassa a previsão do projeto`,
          });
          return;
        }
        if (projetoFinal && d.data_final && d.data_final > projetoFinal) {
          toast.error("Datas inválidas", {
            description: `Conclusão da disciplina "${disc.disciplina}" é posterior à conclusão do projeto`,
          });
          return;
        }
      }
    }

    setIsSaving(true);
    const localizacaoComposta = composeLocalizacao(formData) || formData.localizacao;
    // Id do projeto recém-criado, para o geocode (o código não é mais digitado).
    let novoProjetoId: string | null = null;

    try {
      if (isEditMode && editProjeto) {
        const { error } = await supabase.rpc("update_projeto_completo", {
          p_projeto_id: editProjeto.id,
          // Código e cliente são opcionais; a coluna aceita null e o UNIQUE de
          // código ignora nulls. O tipo gerado marca como string (mais estrito
          // que o banco), daí o cast.
          p_codigo: (formData.codigo_projeto || null) as unknown as string,
          p_nome: formData.nome,
          p_cliente_id: (formData.cliente_id || null) as unknown as string,
          p_data_inicio: formData.data_inicio || undefined,
          p_data_previsao: formData.data_previsao || undefined,
          p_data_final: formData.data_final || undefined,
          p_valor_contrato: parseCurrencyString(formData.valor_contrato) || 0,
          p_observacao: formData.observacao,
          p_localizacao: localizacaoComposta,
          p_parcelas: formData.parcelas || undefined,
          p_area_m2: parseFloat(formData.area_m2) || 0,
          p_disciplinas: finalDisciplinas as unknown as never,
          p_status: formData.status,
          p_prioridade: formData.prioridade,
        });

        if (error) throw error;

        // Sincroniza disciplinas relacionais. State foi hidratado de
        // existingDisciplinas preservando IDs, então bulkSave faz upsert das
        // existentes, insert das novas e delete das removidas.
        const discsForBulk = finalDisciplinas.map((d) => {
          const resps = getResponsaveisList(d);
          return {
            id: d.id,
            nome: d.disciplina,
            status: d.status || "Não Iniciado",
            data_inicio: d.data_inicio || null,
            data_fim: d.data_previsao || null,
            data_fim_real: d.data_final || null,
            prioridade: d.prioridade || null,
            justificativa_atraso: d.justificativa_atraso || null,
            ordem_etapa: d.etapa ?? null,
            checklist_padrao: d.checklist_padrao,
            responsavel_ids: resps.map((r) => r.responsavel_id).filter(Boolean),
          };
        });
        await bulkSaveDisciplinas.mutateAsync({
          projetoId: editProjeto.id,
          disciplinas: discsForBulk,
        });

        toast.success("Projeto atualizado", { description: "Projeto foi atualizado com sucesso" });
      } else {
        // Código gerado automático (PRJ-XXXX sequencial por empresa): não se pede
        // ao usuário. A RLS de projetos escopa a busca à empresa do chamador.
        const { data: codigosExistentes } = await supabase
          .from("projetos")
          .select("codigo_projeto")
          .is("deleted_at", null);
        let maxSeq = 0;
        for (const c of codigosExistentes ?? []) {
          const m = /^PRJ-(\d+)$/i.exec((c.codigo_projeto ?? "").trim());
          if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
        }
        const codigoAuto = `PRJ-${String(maxSeq + 1).padStart(4, "0")}`;

        const { data: newProjetoId, error } = await supabase.rpc("create_projeto_completo", {
          p_codigo: codigoAuto,
          p_nome: formData.nome,
          p_cliente_id: (formData.cliente_id || null) as unknown as string,
          p_data_inicio: formData.data_inicio || undefined,
          p_data_previsao: formData.data_previsao || undefined,
          p_data_final: formData.data_final || undefined,
          p_valor_contrato: parseCurrencyString(formData.valor_contrato) || 0,
          p_observacao: formData.observacao,
          p_localizacao: localizacaoComposta,
          p_parcelas: formData.parcelas || undefined,
          p_area_m2: parseFloat(formData.area_m2) || 0,
          p_disciplinas: finalDisciplinas as unknown as never,
          p_prioridade: formData.prioridade,
        });

        if (error) throw new Error(error.message || String(error));

        novoProjetoId = (newProjetoId as string) ?? null;

        // Sync disciplinas to relational table for new project.
        // Se falhar, faz rollback do projeto pra não deixar registro órfão sem disciplinas.
        if (newProjetoId && finalDisciplinas.length > 0) {
          const discsForBulk = finalDisciplinas.map((d) => {
            const resps = getResponsaveisList(d);
            return {
              nome: d.disciplina,
              status: d.status || "Não Iniciado",
              data_inicio: d.data_inicio || null,
              data_fim: d.data_previsao || null,
              data_fim_real: d.data_final || null,
              prioridade: d.prioridade || null,
              justificativa_atraso: d.justificativa_atraso || null,
              ordem_etapa: d.etapa ?? null,
              checklist_padrao: d.checklist_padrao,
              responsavel_ids: resps.map((r) => r.responsavel_id).filter(Boolean),
            };
          });
          try {
            await bulkSaveDisciplinas.mutateAsync({
              projetoId: newProjetoId as string,
              disciplinas: discsForBulk,
            });
          } catch (discErr) {
            await supabase
              .from("projetos")
              .delete()
              .eq("id", newProjetoId as string);
            throw discErr;
          }
        }

        const numParcelas = parseInt(formData.parcelas || "0", 10);
        const diaFixo = parseInt(formData.dia_pagamento || "0", 10);
        if (newProjetoId && numParcelas > 0 && diaFixo >= 1 && diaFixo <= 31) {
          const { error: parcelasError } = await (
            supabase.rpc as unknown as (
              name: "rpc_gerar_parcelas_dia_fixo",
              args: { p_projeto_id: string; p_num_parcelas: number; p_dia_fixo: number }
            ) => Promise<{ error: { message: string } | null }>
          )("rpc_gerar_parcelas_dia_fixo", {
            p_projeto_id: newProjetoId as string,
            p_num_parcelas: numParcelas,
            p_dia_fixo: diaFixo,
          });
          if (parcelasError) {
            toast.error("Projeto salvo, mas as parcelas não foram geradas", {
              description: getSafeErrorMessage(parcelasError, "Gere as parcelas de novo na aba de pagamentos."),
            });
          } else {
            toast.success(`${numParcelas} parcela(s) geradas`, {
              description: `Vencimento dia ${diaFixo} de cada mês`,
            });
          }
        }

        toast.success("Projeto cadastrado", { description: "Novo projeto foi adicionado com sucesso" });
        clearFormPersist(PROJETO_DRAFT_KEY);
      }

      onOpenChange(false);
      onSaved();

      if (localizacaoComposta.trim()) {
        // Marca esta geocodificação como a mais recente. Se o usuário salvar de
        // novo antes desta terminar, a anterior não sobrescreve as coordenadas.
        geocodeAbortRef.current?.abort();
        const abortController = new AbortController();
        geocodeAbortRef.current = abortController;
        const { signal } = abortController;

        const street = [formData.loc_logradouro, formData.loc_numero].filter(Boolean).join(" ");
        const cepDigits = formData.loc_cep.replace(/\D/g, "");
        const postalcode = cepDigits.length === 8 ? `${cepDigits.slice(0, 5)}-${cepDigits.slice(5)}` : "";

        const saveCoords = (lat: number, lng: number) => {
          if (signal.aborted) return;
          const alvoId = isEditMode && editProjeto ? editProjeto.id : novoProjetoId;
          if (!alvoId) return;
          const query = supabase.from("projetos").update({ latitude: lat, longitude: lng }).eq("id", alvoId);
          query.then(() => {
            onSaved();
            queryClient.invalidateQueries({ queryKey: ["projetos-mapa"] });
          });
        };

        // Geocodifica via edge function (User-Agent + fair-use do Nominatim no
        // servidor). A edge já faz o fallback cidade+estado internamente.
        supabase.functions
          .invoke("geocode-address", {
            body: {
              street: street || undefined,
              city: formData.loc_cidade || undefined,
              state: formData.loc_estado || undefined,
              postalcode: postalcode || undefined,
              address: localizacaoComposta,
            },
          })
          .then(({ data, error }) => {
            if (signal.aborted) return;
            if (error) {
              toast.warning("Geocodificação falhou", {
                description: "Não foi possível obter coordenadas do endereço. O projeto não aparecerá no mapa.",
              });
              return;
            }
            const lat = typeof data?.lat === "number" ? data.lat : NaN;
            const lng = typeof data?.lng === "number" ? data.lng : NaN;
            if (data?.found && !isNaN(lat) && !isNaN(lng)) {
              saveCoords(lat, lng);
              return;
            }
            toast.warning("Endereço não localizado", {
              description: "Não foi possível encontrar as coordenadas do endereço. O projeto não aparecerá no mapa.",
            });
          })
          .catch(() => {
            if (signal.aborted) return;
            toast.warning("Geocodificação falhou", {
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
      const message = err instanceof Error ? err.message : String(err);
      toast.error("Erro ao salvar", { description: message });
    } finally {
      setIsSaving(false);
    }
  };

  const isDirty = useCallback(
    () => JSON.stringify({ form: formData, disc: projetosDisciplinas }) !== initialSnapshotRef.current,
    [formData, projetosDisciplinas]
  );

  return {
    isEditMode,
    isSaving,
    isFetchingCep,
    formData,
    isDirty,
    handleInputChange,
    fetchCep,
    // Disciplinas
    projetosDisciplinas,
    tempDisciplina,
    setTempDisciplina,
    addProjetoDisciplina,
    removeProjetoDisciplina,
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
