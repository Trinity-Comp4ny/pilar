import { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarIcon, CheckCircle2, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { FiltroCompetencia } from "@/components/filters/FiltroCompetencia";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import type { FolhaItem, HistoryItem } from "./folha-pagamento/types";
import { getMonthLabel, buildYearRange } from "./folha-pagamento/types";
import { FolhaSummaryCards } from "./folha-pagamento/components/FolhaSummaryCards";
import { FolhaTable } from "./folha-pagamento/components/FolhaTable";
import { FolhaHistory } from "./folha-pagamento/components/FolhaHistory";
import { FinanceErrorState } from "../components/FinanceErrorState";
import { gerarComprovantePDF, gerarLoteComprovantesPDF } from "./folha-pagamento/folhaComprovante";
import { calcularVariavel, calcularTotal, parseDetalhe, firstPix } from "./folha-pagamento/folhaCalc";
import { CloseMonthDialog, DetailEditDialog, HistoryDetailDialog } from "./folha-pagamento/components/FolhaDialogs";

export default function FolhaPagamento() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<FolhaItem[]>([]);
  const [statusFolha, setStatusFolha] = useState<"preview" | "closed">("preview");
  const [totalUniqueArea, setTotalUniqueArea] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [empresaNome, setEmpresaNome] = useState<string | undefined>(undefined);
  // Total pago por pessoa no mês anterior; o delta (atual − anterior) é derivado.
  const [prevTotals, setPrevTotals] = useState<Map<string, number>>(new Map());

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");

  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [isEditingDetail, setIsEditingDetail] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<FolhaItem | null>(null);
  const [editForm, setEditForm] = useState<Partial<FolhaItem>>({});

  const [historyDetailOpen, setHistoryDetailOpen] = useState(false);
  const [historyDetailLoading, setHistoryDetailLoading] = useState(false);
  const [historyDetailItems, setHistoryDetailItems] = useState<FolhaItem[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<HistoryItem | null>(null);

  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const years = buildYearRange(currentDate.getFullYear());
  const { canEdit } = useFeatureAccess("financeiro");

  useEffect(() => {
    fetchData();
    fetchHistory();
    fetchPrevTotals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    // Nome da empresa para o cabeçalho do comprovante.
    (async () => {
      const empresaId = (await supabase.rpc("get_user_empresa_id")).data;
      if (!empresaId) return;
      const { data: emp } = await supabase.from("empresas").select("nome").eq("id", empresaId).maybeSingle();
      if (emp?.nome) setEmpresaNome(emp.nome);
    })();
  }, []);

  const fetchHistory = async () => {
    try {
      const { data: historyData, error } = await supabase
        .from("folha_pagamento")
        .select("mes, ano, total_receber, status")
        .order("ano", { ascending: false })
        .order("mes", { ascending: false });
      if (error) throw error;

      const grouped = new Map<string, HistoryItem>();
      const normalizeStatus = (s: string | null | undefined) => s ?? "pendente";
      historyData?.forEach((item) => {
        const key = `${item.mes}-${item.ano}`;
        const itemStatus = normalizeStatus(item.status);
        const current = grouped.get(key) || {
          mes: item.mes,
          ano: item.ano,
          total: 0,
          count: 0,
          status: itemStatus,
        };
        current.total += Number(item.total_receber || 0);
        current.count += 1;
        if (current.status !== "misto" && current.status !== itemStatus) {
          current.status = "misto";
        }
        grouped.set(key, current);
      });
      setHistory(Array.from(grouped.values()));
    } catch {
      toast.error("Erro ao carregar histórico da folha");
    }
  };

  // Total pago por pessoa no mês anterior, para o delta na revisão.
  const fetchPrevTotals = async () => {
    try {
      const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
      const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
      const { data: prev } = await supabase
        .from("folha_pagamento")
        .select("pessoa_id, total_receber")
        .eq("mes", prevMonth)
        .eq("ano", prevYear);
      const map = new Map<string, number>();
      (prev || []).forEach((r) => map.set(r.pessoa_id, Number(r.total_receber || 0)));
      setPrevTotals(map);
    } catch {
      setPrevTotals(new Map());
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const { data: projectsData } = await supabase
        .from("projetos")
        .select("area_m2, data_inicio")
        .eq("empresa_id", (await supabase.rpc("get_user_empresa_id")).data ?? "");

      const uniqueArea = (projectsData || [])
        .filter((p) => {
          if (!p.data_inicio) return false;
          const [ano, mes] = p.data_inicio.split("-").map(Number);
          return ano === selectedYear && mes === selectedMonth;
        })
        .reduce((acc, curr) => acc + Number(curr.area_m2 || 0), 0);
      setTotalUniqueArea(uniqueArea);

      const { data: existingData, error: checkError } = await supabase
        .from("folha_pagamento")
        .select("*")
        .eq("mes", selectedMonth)
        .eq("ano", selectedYear);
      if (checkError) throw checkError;

      if (existingData && existingData.length > 0) {
        setStatusFolha("closed");
        const personIds = existingData.map((d) => d.pessoa_id);
        // cpf/chaves_pix têm grant só para service_role (PII): o role autenticado
        // não pode lê-los aqui, senão o select inteiro falha e some com os nomes.
        const { data: peopleData } = await supabase
          .from("pessoas")
          .select("id, nome, cargo")
          .in("id", personIds);
        const peopleMap = new Map((peopleData || []).map((p) => [p.id, p]));

        setData(
          existingData.map((item) => {
            const salario_fixo = Number(item.salario_fixo ?? 0);
            const valor_m2 = Number(item.valor_m2 ?? 0);
            const soma_area = Number(item.total_area_projetada ?? 0);
            const v_variavel = Number(item.adicional_variavel ?? soma_area * valor_m2);
            const v_total = Number(item.total_receber ?? salario_fixo + v_variavel);
            const pessoa = peopleMap.get(item.pessoa_id);
            return {
              p_id: item.pessoa_id,
              p_nome: pessoa?.nome || "Desconhecido",
              p_cargo: pessoa?.cargo || "-",
              p_cpf: null,
              p_chave_pix: null,
              p_salario_fixo: salario_fixo,
              p_valor_m2: valor_m2,
              soma_area,
              v_variavel,
              v_total,
              lista_projetos: [],
              detalhe_projetos: parseDetalhe(
                (item as unknown as { detalhe_projetos?: unknown }).detalhe_projetos
              ),
              status: item.status ?? undefined,
              data_pagamento: item.data_pagamento ?? undefined,
              folha_id: item.id,
              edited_fields: [],
            };
          })
        );
      } else {
        setStatusFolha("preview");
        const { data: previewData, error: rpcError } = await supabase.rpc("get_folha_preview", {
          p_mes: selectedMonth,
          p_ano: selectedYear,
        });
        if (rpcError) throw rpcError;

        setData(
          ((previewData || []) as Record<string, unknown>[]).map((item) => {
            const salario_fixo = Number(item.p_salario_fixo ?? item.salario_fixo ?? 0);
            const valor_m2 = Number(item.p_valor_m2 ?? item.valor_m2 ?? 0);
            const soma_area = Number(item.soma_area ?? item.total_area ?? 0);
            const v_variavel = Number(item.v_variavel ?? item.total_variavel ?? soma_area * valor_m2);
            const v_total = Number(item.v_total ?? item.total_receber ?? salario_fixo + v_variavel);
            const detalhe = parseDetalhe(item.detalhe_projetos);
            return {
              p_id: String(item.p_id ?? item.pessoa_id ?? item.id ?? ""),
              p_nome: String(item.p_nome ?? item.nome ?? ""),
              p_cargo: String(item.p_cargo ?? item.cargo ?? ""),
              p_salario_fixo: salario_fixo,
              p_valor_m2: valor_m2,
              soma_area,
              v_variavel,
              v_total,
              lista_projetos: (item.projetos_nomes ?? []) as string[],
              detalhe_projetos: detalhe,
              edited_fields: [] as string[],
            };
          })
        );
      }
    } catch {
      setLoadError(true);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleCloseMonth = async () => {
    setSaving(true);
    try {
      const empresaId = (await supabase.rpc("get_user_empresa_id")).data;
      const payload = data.map((item) => ({
        empresa_id: empresaId,
        pessoa_id: item.p_id,
        mes: selectedMonth,
        ano: selectedYear,
        salario_fixo: item.p_salario_fixo,
        total_area_projetada: item.soma_area,
        valor_m2: item.p_valor_m2,
        adicional_variavel: item.v_variavel,
        total_receber: item.v_total,
        // Snapshot da origem do variável: fica congelado mesmo que o projeto mude.
        detalhe_projetos: item.detalhe_projetos ?? [],
        status: "pendente",
      }));
      const { error } = await supabase.from("folha_pagamento").insert(payload as never);
      if (error) throw error;

      toast.success("Folha fechada com sucesso!", {
        description: `Os registros para ${getMonthLabel(selectedMonth)}/${selectedYear} foram salvos.`,
      });
      setConfirmDialogOpen(false);
      fetchData();
      fetchHistory();
    } catch {
      toast.error("Erro ao fechar folha");
    } finally {
      setSaving(false);
    }
  };

  const openDetailDialog = (item: FolhaItem) => {
    setSelectedPerson(item);
    setIsEditingDetail(false);
    setEditForm({});
    setDetailDialogOpen(true);
  };

  const startEditing = () => {
    if (!selectedPerson) return;
    setEditForm({
      p_salario_fixo: selectedPerson.p_salario_fixo,
      soma_area: selectedPerson.soma_area,
      v_variavel: selectedPerson.v_variavel,
      v_total: selectedPerson.v_total,
    });
    setIsEditingDetail(true);
  };

  const saveEditing = () => {
    if (!selectedPerson) return;
    const salario = editForm.p_salario_fixo ?? selectedPerson.p_salario_fixo;
    const area = editForm.soma_area ?? selectedPerson.soma_area;
    // Recalcula os derivados pela fórmula; total só diverge se editado à mão.
    const variavel = calcularVariavel(area, selectedPerson.p_valor_m2);
    const total = editForm.v_total ?? calcularTotal(salario, variavel);

    const newEditedFields = new Set(selectedPerson.edited_fields || []);
    if (salario !== selectedPerson.p_salario_fixo) newEditedFields.add("salario");
    if (area !== selectedPerson.soma_area) newEditedFields.add("area");
    if (variavel !== selectedPerson.v_variavel) newEditedFields.add("variavel");
    if (total !== selectedPerson.v_total) newEditedFields.add("total");

    const updatedItem: FolhaItem = {
      ...selectedPerson,
      p_salario_fixo: salario,
      soma_area: area,
      v_variavel: variavel,
      v_total: total,
      edited_fields: Array.from(newEditedFields),
    };
    setData((prev) => prev.map((p) => (p.p_id === selectedPerson.p_id ? updatedItem : p)));
    setIsEditingDetail(false);
    setDetailDialogOpen(false);
    setSelectedPerson(null);
    toast.success("Alterações salvas no preview");
  };

  const handleStatusChange = async (folhaId: string | undefined, newStatus: string) => {
    if (!folhaId) return;
    const currentItem = data.find((item) => item.folha_id === folhaId);
    if (!currentItem) return;
    const previousStatus = currentItem.status;

    try {
      const { error } = await supabase.from("folha_pagamento").update({ status: newStatus }).eq("id", folhaId);
      if (error) throw error;

      setData((prev) => prev.map((item) => (item.folha_id === folhaId ? { ...item, status: newStatus } : item)));

      if (previousStatus !== "pago" && newStatus === "pago") {
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10);

        const { data: categorias } = await supabase
          .from("categorias_financeiras")
          .select("id, nome")
          .eq("tipo", "Despesa");
        let categoriaFolhaPagamento = categorias?.find((c) => c.nome === "Folha de Pagamento");

        if (!categoriaFolhaPagamento) {
          const empresaId = (await supabase.rpc("get_user_empresa_id")).data;
          const { data: insertedCategory, error: insertCategoriaError } = await supabase
            .from("categorias_financeiras")
            .insert({ nome: "Folha de Pagamento", tipo: "Despesa", empresa_id: empresaId } as never)
            .select("id, nome")
            .single();
          if (insertCategoriaError) throw insertCategoriaError;
          categoriaFolhaPagamento = insertedCategory;
        }

        const descricao = `Folha de Pagamento ${getMonthLabel(selectedMonth)}/${selectedYear} - ${currentItem.p_nome}`;
        const { data: existingDespesa } = await supabase
          .from("despesas")
          .select("id")
          .eq("descricao", descricao)
          .eq("valor", currentItem.v_total)
          .maybeSingle();

        if (!existingDespesa) {
          const { error: despesaError } = await supabase.from("despesas").insert([
            {
              data_vencimento: dateStr,
              data_pagamento: dateStr,
              descricao,
              categoria_id: categoriaFolhaPagamento ? categoriaFolhaPagamento.id : null,
              valor: currentItem.v_total,
              fornecedor_id: null,
              projeto_id: null,
              nota_fiscal: null,
              status: "Pago",
              conta_id: null,
              cartao_id: null,
              observacao: "Lançamento automático de Folha de Pagamento",
            },
          ] as never);
          if (despesaError) throw despesaError;
        }
      }

      toast.success("Status atualizado", { description: `O status foi alterado para ${newStatus}.` });
      fetchHistory();
    } catch {
      // Reverte o status (DB + estado local) para não deixar a folha "paga" sem a despesa
      // correspondente, assim o próximo "Marcar Pago" recria a despesa corretamente.
      await supabase.from("folha_pagamento").update({ status: previousStatus }).eq("id", folhaId);
      setData((prev) => prev.map((item) => (item.folha_id === folhaId ? { ...item, status: previousStatus } : item)));
      toast.error("Erro ao atualizar status. A alteração foi revertida, tente novamente.");
    }
  };

  const openHistoryDetail = async (historyItem: HistoryItem) => {
    setSelectedHistory(historyItem);
    setHistoryDetailOpen(true);
    setHistoryDetailLoading(true);

    try {
      const { data: existingData, error } = await supabase
        .from("folha_pagamento")
        .select("*")
        .eq("mes", historyItem.mes)
        .eq("ano", historyItem.ano);
      if (error) throw error;

      if (!existingData || existingData.length === 0) {
        setHistoryDetailItems([]);
      } else {
        const personIds = existingData.map((d) => d.pessoa_id);
        const { data: peopleData } = await supabase
          .from("pessoas")
          .select("id, nome, cargo")
          .in("id", personIds);
        const peopleMap = new Map((peopleData || []).map((p) => [p.id, p]));

        setHistoryDetailItems(
          existingData.map((item) => {
            const salario_fixo = Number(item.salario_fixo ?? 0);
            const valor_m2 = Number(item.valor_m2 ?? 0);
            const soma_area = Number(item.total_area_projetada ?? 0);
            const v_variavel = Number(item.adicional_variavel ?? soma_area * valor_m2);
            const v_total = Number(item.total_receber ?? salario_fixo + v_variavel);
            const pessoa = peopleMap.get(item.pessoa_id);
            return {
              p_id: item.pessoa_id,
              p_nome: pessoa?.nome || "Desconhecido",
              p_cargo: pessoa?.cargo || "-",
              p_cpf: null,
              p_chave_pix: null,
              p_salario_fixo: salario_fixo,
              p_valor_m2: valor_m2,
              soma_area,
              v_variavel,
              v_total,
              lista_projetos: [],
              detalhe_projetos: parseDetalhe((item as unknown as { detalhe_projetos?: unknown }).detalhe_projetos),
              status: item.status ?? undefined,
              data_pagamento: item.data_pagamento ?? undefined,
              folha_id: item.id,
            };
          })
        );
      }
    } catch {
      toast.error("Erro ao carregar detalhes", {
        description: "Não foi possível carregar os detalhes da folha selecionada.",
      });
    } finally {
      setHistoryDetailLoading(false);
    }
  };

  // Busca cpf/pix sob demanda (RPC gated a empresa + financeiro) e mescla nos
  // itens só na hora de gerar o comprovante — a PII não fica no estado da tela.
  const withPii = async (items: FolhaItem[]): Promise<FolhaItem[]> => {
    const ids = items.map((i) => i.p_id).filter(Boolean);
    if (ids.length === 0) return items;
    const { data: pii } = (await supabase.rpc("get_folha_pessoas_pii" as never, { p_ids: ids } as never)) as unknown as {
      data: Array<{ pessoa_id: string; cpf: string | null; chaves_pix: unknown }> | null;
    };
    const piiMap = new Map((pii || []).map((r) => [r.pessoa_id, r]));
    return items.map((item) => {
      const p = piiMap.get(item.p_id);
      return p ? { ...item, p_cpf: p.cpf ?? null, p_chave_pix: firstPix(p.chaves_pix) } : item;
    });
  };

  const downloadComprovante = async (item: FolhaItem) => {
    try {
      const [enriched] = await withPii([item]);
      await gerarComprovantePDF(enriched, { empresaNome, mes: selectedMonth, ano: selectedYear });
    } catch {
      toast.error("Erro ao gerar comprovante");
    }
  };

  const downloadComprovanteHistory = async (item: FolhaItem) => {
    if (!selectedHistory) return;
    try {
      const [enriched] = await withPii([item]);
      await gerarComprovantePDF(enriched, { empresaNome, mes: selectedHistory.mes, ano: selectedHistory.ano });
    } catch {
      toast.error("Erro ao gerar comprovante");
    }
  };

  const downloadLoteHistory = async () => {
    if (!selectedHistory || historyDetailItems.length === 0) return;
    try {
      const enriched = await withPii(historyDetailItems);
      await gerarLoteComprovantesPDF(enriched, {
        empresaNome,
        mes: selectedHistory.mes,
        ano: selectedHistory.ano,
      });
    } catch {
      toast.error("Erro ao gerar lote de comprovantes");
    }
  };

  const totalFolha = data.reduce((acc, item) => acc + item.v_total, 0);

  // Delta = total atual − total do mês anterior (undefined se não houver folha
  // anterior daquela pessoa, para a tabela mostrar "-" em vez de um número falso).
  const deltas = useMemo(() => {
    const m = new Map<string, number>();
    data.forEach((item) => {
      const prev = prevTotals.get(item.p_id);
      if (prev !== undefined) m.set(item.p_id, item.v_total - prev);
    });
    return m;
  }, [data, prevTotals]);

  const filteredData = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((item) => {
      if (q && !item.p_nome.toLowerCase().includes(q)) return false;
      if (statusFolha === "closed" && statusFilter !== "todos" && item.status !== statusFilter) return false;
      return true;
    });
  }, [data, search, statusFilter, statusFolha]);

  return (
    <div className="space-y-8 pb-10">
      <div className="space-y-6">
        {/* Filtros e ações */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-lg border border-border shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Período:</span>
            </div>
            <FiltroCompetencia
              mes={selectedMonth}
              ano={selectedYear}
              onChange={(mes, ano) => {
                setSelectedMonth(mes);
                setSelectedYear(ano);
              }}
              fromYear={years[0]}
              toYear={years[years.length - 1]}
            />
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar colaborador"
                className="pl-8 w-[200px]"
              />
            </div>
            {statusFolha === "closed" && (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex items-center gap-4">
            {statusFolha === "preview" && data.length > 0 && canEdit && (
              <CloseMonthDialog
                open={confirmDialogOpen}
                onOpenChange={setConfirmDialogOpen}
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
                peopleCount={data.length}
                totalFolha={totalFolha}
                saving={saving}
                onConfirm={handleCloseMonth}
              />
            )}
            {statusFolha === "closed" && (
              <Badge
                variant="secondary"
                className="bg-positive/10 text-positive-strong px-3 py-1 text-sm flex gap-1 items-center"
              >
                <CheckCircle2 className="h-3 w-3" />
                Folha fechada
              </Badge>
            )}
          </div>
        </div>

        {loadError && !loading ? (
          <FinanceErrorState onRetry={() => void fetchData()} />
        ) : (
          <>
            <FolhaSummaryCards totalFolha={totalFolha} peopleCount={data.length} totalUniqueArea={totalUniqueArea} />

            <FolhaTable
              data={filteredData}
              loading={loading}
              statusFolha={statusFolha}
              deltas={deltas}
              onRowClick={openDetailDialog}
              onStatusChange={handleStatusChange}
              onDownloadComprovante={downloadComprovante}
            />
          </>
        )}
      </div>

      <FolhaHistory
        history={history}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        onOpenDetail={openHistoryDetail}
      />

      <DetailEditDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        person={selectedPerson}
        isEditing={isEditingDetail}
        editForm={editForm}
        onStartEditing={startEditing}
        onCancelEditing={() => setIsEditingDetail(false)}
        onSaveEditing={saveEditing}
        onEditFormChange={(field, value) => setEditForm((prev) => ({ ...prev, [field]: value }))}
      />

      <HistoryDetailDialog
        open={historyDetailOpen}
        onOpenChange={setHistoryDetailOpen}
        selectedHistory={selectedHistory}
        loading={historyDetailLoading}
        items={historyDetailItems}
        onDownloadLote={downloadLoteHistory}
        onDownloadComprovante={downloadComprovanteHistory}
      />
    </div>
  );
}
