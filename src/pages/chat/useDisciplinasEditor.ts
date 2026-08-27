import { useCallback, useState } from "react";
import { toast } from "sonner";
import { PROJECT_PRIORITY } from "@/constants";
import {
  type DisciplinaResponsavel,
  type DisciplinaObservacao,
  type ResponsavelDatas,
  getResponsaveisList,
} from "@/types/projetos";
import type { TemplateProjeto } from "@/hooks/useTemplates";
import type { FluxoDisciplinas } from "@/types/fluxoDisciplinas";
import { responsaveisEfetivos } from "@/lib/fluxoCascata";

/**
 * Estado + handlers de edição de disciplinas de projeto, extraídos de useProjetoForm
 * para reuso no card do agente. É a MESMA lógica da plataforma (paridade), sem o
 * acoplamento ao submit/geocode do formulário completo.
 */

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

/** Shape que useBulkSaveDisciplinas espera (uma disciplina). */
export type DisciplinaBulk = {
  nome: string;
  status: string;
  data_inicio: string | null;
  data_fim: string | null;
  data_fim_real: string | null;
  prioridade: string | null;
  justificativa_atraso: string | null;
  responsavel_ids: string[];
};

type Params = {
  pessoas: { id: string; nome: string }[];
  templatesData: TemplateProjeto[];
  fluxosData: FluxoDisciplinas[];
  currentUser: { name: string; email: string } | null;
};

export function useDisciplinasEditor({ pessoas, templatesData, fluxosData, currentUser }: Params) {
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

  const handleOpenDisciplinaDetail = useCallback((index: number) => {
    setSelectedDisciplinaIndex(index);
    setIsDisciplinaDetailOpen(true);
  }, []);

  const handleAddObservation = useCallback(() => {
    if (!newObservation.trim() || selectedDisciplinaIndex === null) return;
    setProjetosDisciplinas((prev) => {
      const updated = [...prev];
      const disc = updated[selectedDisciplinaIndex];
      const novaObs: DisciplinaObservacao = {
        id: crypto.randomUUID(),
        texto: newObservation,
        usuario: currentUser?.name || "Usuário",
        data: new Date().toISOString(),
      };
      updated[selectedDisciplinaIndex] = { ...disc, observacoes: [...(disc.observacoes || []), novaObs] };
      return updated;
    });
    setNewObservation("");
  }, [newObservation, selectedDisciplinaIndex, currentUser]);

  const updateDisciplinaField = useCallback(
    (field: keyof DisciplinaResponsavel, value: string) => {
      if (selectedDisciplinaIndex === null) return;
      setProjetosDisciplinas((prev) => {
        const updated = [...prev];
        updated[selectedDisciplinaIndex] = { ...updated[selectedDisciplinaIndex], [field]: value };
        return updated;
      });
    },
    [selectedDisciplinaIndex]
  );

  const updateDisciplinaResponsavel = useCallback(
    (val: string, nome: string) => {
      if (selectedDisciplinaIndex === null) return;
      setProjetosDisciplinas((prev) => {
        const updated = [...prev];
        updated[selectedDisciplinaIndex] = {
          ...updated[selectedDisciplinaIndex],
          responsavel_id: val,
          responsavel_nome: nome,
        };
        return updated;
      });
    },
    [selectedDisciplinaIndex]
  );

  const addProjetoDisciplina = useCallback(() => {
    if (!tempDisciplina.disciplina) return;
    const pessoa = pessoas.find((p) => p.id === tempDisciplina.responsavel_id);
    const nova: DisciplinaResponsavel = {
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
    setProjetosDisciplinas((prev) => [...prev, nova]);
    setTempDisciplina(EMPTY_TEMP_DISCIPLINA);
  }, [tempDisciplina, pessoas]);

  const removeProjetoDisciplina = useCallback((index: number) => {
    setProjetosDisciplinas((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const addResponsavelToDisc = useCallback(
    (discIdx: number) => {
      setProjetosDisciplinas((prev) => {
        const updated = [...prev];
        const disc = updated[discIdx];
        const currentResps = getResponsaveisList(disc);

        if (!newFormResp.responsavel_id) {
          const hasDates = newFormResp.data_inicio || newFormResp.data_previsao || newFormResp.data_final;
          if (!hasDates) return prev;
          updated[discIdx] = {
            ...disc,
            data_inicio: newFormResp.data_inicio || disc.data_inicio,
            data_previsao: newFormResp.data_previsao || disc.data_previsao,
            data_final: newFormResp.data_final || disc.data_final,
          };
          return updated;
        }

        if (currentResps.some((r) => r.responsavel_id && r.responsavel_id === newFormResp.responsavel_id)) {
          toast.error("Responsável já adicionado nesta disciplina");
          return prev;
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
        const hasPlaceholder = currentResps.length === 1 && !currentResps[0].responsavel_id;
        const newResps = hasPlaceholder ? [novoResp] : [...currentResps, novoResp];
        updated[discIdx] = {
          ...disc,
          responsaveis: newResps,
          responsavel_id: novoResp.responsavel_id,
          responsavel_nome: novoResp.responsavel_nome,
        };
        return updated;
      });
      setNewFormResp({ responsavel_id: "", data_inicio: "", data_previsao: "", data_final: "" });
      setAddingRespToFormDisc(null);
    },
    [newFormResp, pessoas]
  );

  const removeResponsavelFromDisc = useCallback((discIdx: number, respIdx: number) => {
    setProjetosDisciplinas((prev) => {
      const updated = [...prev];
      const disc = updated[discIdx];
      const resps = getResponsaveisList(disc);
      if (resps.length <= 1) {
        toast.error("A disciplina precisa ter ao menos um responsável");
        return prev;
      }
      const newResps = resps.filter((_, i) => i !== respIdx);
      updated[discIdx] = {
        ...disc,
        responsaveis: newResps,
        responsavel_id: newResps[0].responsavel_id,
        responsavel_nome: newResps[0].responsavel_nome,
      };
      return updated;
    });
  }, []);

  const updateRespDatasInForm = useCallback(
    (discIdx: number, respIdx: number, field: keyof ResponsavelDatas, value: string) => {
      setProjetosDisciplinas((prev) => {
        const updated = [...prev];
        const disc = updated[discIdx];
        const resps = [...getResponsaveisList(disc)];
        resps[respIdx] = { ...resps[respIdx], [field]: value };
        const isDateField = field === "data_inicio" || field === "data_previsao" || field === "data_final";
        const topLevel = isDateField && respIdx === 0 ? { [field]: value } : {};
        updated[discIdx] = { ...disc, responsaveis: resps, ...topLevel };
        return updated;
      });
    },
    []
  );

  const applyTemplate = useCallback(
    (templateId: string) => {
      const template = templatesData.find((t) => t.id === templateId);
      if (!template) return;
      const novas: DisciplinaResponsavel[] = template.fases.flatMap((fase) =>
        fase.disciplinas.map((d) => ({
          disciplina: d.disciplina,
          responsavel_id: "",
          responsavel_nome: "",
          status: "Não Iniciado",
          observacoes: [],
        }))
      );
      setProjetosDisciplinas(novas);
      toast.success("Template aplicado", { description: `${novas.length} disciplina(s) de "${template.nome}"` });
    },
    [templatesData]
  );

  const applyFluxo = useCallback(
    (fluxoId: string | null) => {
      if (!fluxoId) {
        setProjetosDisciplinas([]);
        return;
      }
      const fluxo = fluxosData.find((f) => f.id === fluxoId);
      if (!fluxo) return;
      const novas: DisciplinaResponsavel[] = fluxo.disciplinas.map((d) => {
        const { ids: responsaveisIds, nomes: responsaveisNomes } = responsaveisEfetivos(d);
        return {
          disciplina: d.nome,
          responsavel_id: responsaveisIds[0] || "",
          responsavel_nome: responsaveisNomes[0] || "",
          status: "Não Iniciado",
          etapa: d.ordem,
          observacoes: [],
          responsaveis: responsaveisIds.map((id, i) => ({
            responsavel_id: id,
            responsavel_nome: responsaveisNomes[i] || "",
            status: "Não Iniciado",
          })),
        };
      });
      const colunas = new Set(fluxo.disciplinas.map((d) => d.ordem)).size;
      setProjetosDisciplinas(novas);
      toast.success("Fluxo aplicado", {
        description: `${novas.length} disciplina(s) em ${colunas} coluna(s) de "${fluxo.nome}"`,
      });
    },
    [fluxosData]
  );

  /** Converte o estado no shape esperado por useBulkSaveDisciplinas (mesmo mapeamento da plataforma). */
  const buildDiscsForBulk = useCallback((): DisciplinaBulk[] => {
    return projetosDisciplinas.map((d) => {
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
  }, [projetosDisciplinas]);

  const selectedDisciplina = selectedDisciplinaIndex !== null ? projetosDisciplinas[selectedDisciplinaIndex] : null;

  return {
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
    selectedDisciplinaIndex,
    selectedDisciplina,
    isDisciplinaDetailOpen,
    setIsDisciplinaDetailOpen,
    handleOpenDisciplinaDetail,
    updateDisciplinaField,
    updateDisciplinaResponsavel,
    newObservation,
    setNewObservation,
    handleAddObservation,
    applyTemplate,
    applyFluxo,
    buildDiscsForBulk,
  };
}
