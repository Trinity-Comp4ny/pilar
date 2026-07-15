import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import type { FolhaItem, HistoryItem } from "./folha-pagamento/types";
import { MONTHS, getMonthLabel, buildYearRange } from "./folha-pagamento/types";
import { FolhaSummaryCards } from "./folha-pagamento/components/FolhaSummaryCards";
import { FolhaTable } from "./folha-pagamento/components/FolhaTable";
import { FolhaHistory } from "./folha-pagamento/components/FolhaHistory";
import { FinanceErrorState } from "../components/FinanceErrorState";
import {
  CloseMonthDialog,
  ConfirmPersonDialog,
  DetailEditDialog,
  HistoryDetailDialog,
} from "./folha-pagamento/components/FolhaDialogs";

export default function FolhaPagamento() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<FolhaItem[]>([]);
  const [statusFolha, setStatusFolha] = useState<"preview" | "closed">("preview");
  const [confirmedUsers, setConfirmedUsers] = useState<Set<string>>(new Set());
  const [totalUniqueArea, setTotalUniqueArea] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [personConfirmDialogOpen, setPersonConfirmDialogOpen] = useState(false);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, selectedYear]);

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

  const fetchData = async () => {
    setLoading(true);
    setLoadError(false);
    setConfirmedUsers(new Set());
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
        const { data: peopleData } = await supabase.from("pessoas").select("id, nome, cargo").in("id", personIds);
        const peopleMap = new Map((peopleData || []).map((p) => [p.id, p]));

        setData(
          existingData.map((item) => {
            const salario_fixo = Number(item.salario_fixo ?? 0);
            const valor_m2 = Number(item.valor_m2 ?? 0);
            const soma_area = Number(item.total_area_projetada ?? 0);
            const v_variavel = Number(item.adicional_variavel ?? soma_area * valor_m2);
            const v_total = Number(item.total_receber ?? salario_fixo + v_variavel);
            return {
              p_id: item.pessoa_id,
              p_nome: peopleMap.get(item.pessoa_id)?.nome || "Desconhecido",
              p_cargo: peopleMap.get(item.pessoa_id)?.cargo || "-",
              p_salario_fixo: salario_fixo,
              p_valor_m2: valor_m2,
              soma_area,
              v_variavel,
              v_total,
              lista_projetos: [],
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
            return {
              p_id: String(item.p_id ?? item.pessoa_id ?? item.id ?? ""),
              p_nome: String(item.p_nome ?? item.nome ?? ""),
              p_cargo: String(item.p_cargo ?? item.cargo ?? ""),
              p_salario_fixo: salario_fixo,
              p_valor_m2: valor_m2,
              soma_area,
              v_variavel,
              v_total,
              lista_projetos: (item.lista_projetos ?? item.projetos_nomes ?? []) as string[],
              edited_fields: [] as string[],
            };
          })
        );
      }
    } catch (err: unknown) {
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
    } catch (err: unknown) {
      toast.error("Erro ao fechar folha");
    } finally {
      setSaving(false);
    }
  };

  const handleCheckboxChange = (item: FolhaItem, isChecked: boolean) => {
    if (isChecked) {
      setSelectedPerson(item);
      setPersonConfirmDialogOpen(true);
    } else {
      const next = new Set(confirmedUsers);
      next.delete(item.p_id);
      setConfirmedUsers(next);
    }
  };

  const confirmPerson = () => {
    if (!selectedPerson) return;
    const next = new Set(confirmedUsers);
    next.add(selectedPerson.p_id);
    setConfirmedUsers(next);
    setPersonConfirmDialogOpen(false);
    setSelectedPerson(null);
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
    const newEditedFields = new Set(selectedPerson.edited_fields || []);
    if (editForm.p_salario_fixo !== selectedPerson.p_salario_fixo) newEditedFields.add("salario");
    if (editForm.soma_area !== selectedPerson.soma_area) newEditedFields.add("area");
    if (editForm.v_variavel !== selectedPerson.v_variavel) newEditedFields.add("variavel");
    if (editForm.v_total !== selectedPerson.v_total) newEditedFields.add("total");

    const updatedItem = { ...selectedPerson, ...editForm, edited_fields: Array.from(newEditedFields) };
    setData((prev) => prev.map((p) => (p.p_id === selectedPerson.p_id ? (updatedItem as FolhaItem) : p)));
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
    } catch (err: unknown) {
      // Reverte o status (DB + estado local) para não deixar a folha "paga" sem a despesa
      // correspondente — assim o próximo "Marcar Pago" recria a despesa corretamente.
      await supabase.from("folha_pagamento").update({ status: previousStatus }).eq("id", folhaId);
      setData((prev) => prev.map((item) => (item.folha_id === folhaId ? { ...item, status: previousStatus } : item)));
      toast.error("Erro ao atualizar status. A alteração foi revertida — tente novamente.");
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
        const { data: peopleData } = await supabase.from("pessoas").select("id, nome, cargo").in("id", personIds);
        const peopleMap = new Map((peopleData || []).map((p) => [p.id, p]));

        setHistoryDetailItems(
          existingData.map((item) => {
            const salario_fixo = Number(item.salario_fixo ?? 0);
            const valor_m2 = Number(item.valor_m2 ?? 0);
            const soma_area = Number(item.total_area_projetada ?? 0);
            const v_variavel = Number(item.adicional_variavel ?? soma_area * valor_m2);
            const v_total = Number(item.total_receber ?? salario_fixo + v_variavel);
            return {
              p_id: item.pessoa_id,
              p_nome: peopleMap.get(item.pessoa_id)?.nome || "Desconhecido",
              p_cargo: peopleMap.get(item.pessoa_id)?.cargo || "-",
              p_salario_fixo: salario_fixo,
              p_valor_m2: valor_m2,
              soma_area,
              v_variavel,
              v_total,
              lista_projetos: [] as string[],
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

  const totalFolha = data.reduce((acc, item) => acc + item.v_total, 0);
  const allConfirmed = data.length > 0 && confirmedUsers.size === data.length;

  return (
    <div className="space-y-8 pb-10">
      <div className="space-y-6">
        {/* Filtros e ações */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-lg border border-border shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Período:</span>
            </div>
            <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
              <SelectTrigger className="w-[140px] h-9 rounded-full text-sm">
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => (
                  <SelectItem key={m.value} value={m.value.toString()}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-[100px] h-9 rounded-full text-sm">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={y.toString()}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                allConfirmed={allConfirmed}
                onConfirm={handleCloseMonth}
              />
            )}
            {statusFolha === "closed" && (
              <Badge
                variant="secondary"
                className="bg-positive/10 text-positive-strong px-3 py-1 text-sm flex gap-1 items-center"
              >
                <CheckCircle2 className="h-3 w-3" />
                Folha Fechada
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
              data={data}
              loading={loading}
              statusFolha={statusFolha}
              confirmedUsers={confirmedUsers}
              onCheckboxChange={handleCheckboxChange}
              onRowClick={openDetailDialog}
              onStatusChange={handleStatusChange}
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

      <ConfirmPersonDialog
        open={personConfirmDialogOpen}
        onOpenChange={setPersonConfirmDialogOpen}
        person={selectedPerson}
        onConfirm={confirmPerson}
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
      />
    </div>
  );
}
