import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Sparkles,
  BarChart3,
  FileText,
  AlertTriangle,
  Users,
  FileCheck,
  Loader2,
  Clock,
  ChevronRight,
  FileStack,
  FilePlus2,
  CalendarCheck,
  UserPlus,
  FlaskConical,
  BadgeDollarSign,
} from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePageTitle } from "@/hooks/usePageTitle";
import {
  useAiInsights,
  useAiUsage,
  useGenerateInsight,
  AI_TIPOS,
  type AiTipo,
  type AiInsight,
} from "@/hooks/useAiInsight";

const ICON_MAP: Record<string, typeof BarChart3> = {
  BarChart3,
  FileText,
  AlertTriangle,
  Users,
  FileCheck,
  FileStack,
  FilePlus2,
  CalendarCheck,
  UserPlus,
  FlaskConical,
  BadgeDollarSign,
};

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

export default function AiHub() {
  usePageTitle("IA");
  const { data: insights = [], isLoading: loadingInsights } = useAiInsights(undefined, 20);
  const { data: usage } = useAiUsage();
  const generateInsight = useGenerateInsight();

  const [selectedInsight, setSelectedInsight] = useState<AiInsight | null>(null);
  const [activeGenerator, setActiveGenerator] = useState<AiTipo | null>(null);

  // Form states para cada tipo
  const [propostaForm, setPropostaForm] = useState({ briefing: "", area_m2: "", tipologia: "", prazo_dias: "" });
  const [relatorioForm, setRelatorioForm] = useState({ periodo: "semanal" });
  const [fechamentoForm, setFechamentoForm] = useState({
    mes: String(new Date().getMonth() + 1),
    ano: String(new Date().getFullYear()),
  });
  const [documentosForm, setDocumentosForm] = useState({ projeto_id: "", tipo_documento: "relatorio_progresso" });
  const [aditivoForm, setAditivoForm] = useState({ projeto_id: "", motivo_aditivo: "", descricao_mudanca: "" });
  const [pautaForm, setPautaForm] = useState({ tipo_reuniao: "diretoria", projeto_id: "", participantes_contexto: "" });
  const [contratacaoForm, setContratacaoForm] = useState({ horizonte_meses: "6" });
  const [simulacaoForm, setSimulacaoForm] = useState({ tipo: "perda_cliente", descricao: "" });
  const [projetosOptions, setProjetosOptions] = useState<{ id: string; nome: string }[]>([]);

  // Carrega projetos para selects
  useEffect(() => {
    supabase
      .from("projetos")
      .select("id, nome")
      .is("deleted_at", null)
      .order("nome")
      .then(({ data }) => {
        if (data) setProjetosOptions(data);
      });
  }, []);

  const handleGenerate = (tipo: AiTipo) => {
    let params: Record<string, unknown> = {};

    switch (tipo) {
      case "proposta_copilot":
        params = {
          briefing: propostaForm.briefing,
          area_m2: parseFloat(propostaForm.area_m2) || undefined,
          tipologia: propostaForm.tipologia,
          prazo_dias: parseInt(propostaForm.prazo_dias) || undefined,
        };
        break;
      case "relatorio_executivo":
        params = { periodo: relatorioForm.periodo };
        break;
      case "fechamento_mensal":
        params = { mes: parseInt(fechamentoForm.mes), ano: parseInt(fechamentoForm.ano) };
        break;
      case "documentos":
        params = { projeto_id: documentosForm.projeto_id, tipo_documento: documentosForm.tipo_documento };
        break;
      case "aditivo_copilot":
        params = {
          projeto_id: aditivoForm.projeto_id,
          motivo_aditivo: aditivoForm.motivo_aditivo,
          descricao_mudanca: aditivoForm.descricao_mudanca,
        };
        break;
      case "pauta_reuniao":
        params = {
          tipo_reuniao: pautaForm.tipo_reuniao,
          projeto_id: pautaForm.projeto_id || undefined,
          participantes_contexto: pautaForm.participantes_contexto || undefined,
        };
        break;
      case "planejador_contratacao":
        params = { horizonte_meses: parseInt(contratacaoForm.horizonte_meses) || 6 };
        break;
      case "simulacao_impacto":
        params = { cenario: { tipo: simulacaoForm.tipo, descricao: simulacaoForm.descricao } };
        break;
      default:
        params = {};
    }

    generateInsight.mutate(
      { tipo, params },
      {
        onSuccess: (data) => {
          toast.success(`${AI_TIPOS[tipo].label} gerado com sucesso`);
          setActiveGenerator(null);
          setSelectedInsight(data);
        },
        onError: (err: Error) => {
          toast.error("Erro na IA");
        },
      }
    );
  };

  const usagePct = usage ? (usage.total_requests / usage.limite_requests) * 100 : 0;

  return (
    <PageLayout>
      <PageHeader title="IA Pilar" description="Inteligência artificial aplicada à sua operação">
        <Badge variant="secondary" className="text-xs">
          <Sparkles className="h-3 w-3 mr-1" />
          {usage?.total_requests || 0}/{usage?.limite_requests || 100} consultas
        </Badge>
      </PageHeader>

      {/* Quota bar */}
      <div className="mb-6">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${usagePct > 80 ? "bg-red-500" : usagePct > 60 ? "bg-yellow-500" : "bg-green-500"}`}
            style={{ width: `${Math.min(usagePct, 100)}%` }}
          />
        </div>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {(Object.entries(AI_TIPOS) as [AiTipo, (typeof AI_TIPOS)[AiTipo]][]).map(([tipo, config]) => {
          const Icon = ICON_MAP[config.icon] || Sparkles;
          return (
            <Card
              key={tipo}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setActiveGenerator(tipo)}
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold">{config.label}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{config.descricao}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground mt-1" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Insights recentes */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Insights Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingInsights ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : insights.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nenhum insight gerado ainda.</p>
              <p className="text-xs mt-1">Clique em uma das opções acima para gerar o primeiro.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {insights.map((insight) => {
                const config = AI_TIPOS[insight.tipo as AiTipo];
                const Icon = config ? ICON_MAP[config.icon] || Sparkles : Sparkles;
                return (
                  <div
                    key={insight.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => setSelectedInsight(insight)}
                  >
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{config?.label || insight.tipo}</p>
                      <p className="text-xs text-muted-foreground truncate">{insight.resumo}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTimeAgo(insight.created_at)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog: Gerador */}
      <Dialog
        open={!!activeGenerator}
        onOpenChange={(open) => {
          if (!open) setActiveGenerator(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {activeGenerator && AI_TIPOS[activeGenerator].label}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {activeGenerator === "proposta_copilot" && (
              <>
                <div className="space-y-2">
                  <Label>Briefing do Cliente</Label>
                  <Textarea
                    value={propostaForm.briefing}
                    onChange={(e) => setPropostaForm({ ...propostaForm, briefing: e.target.value })}
                    rows={3}
                    placeholder="Descreva o que o cliente precisa..."
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Área (m²)</Label>
                    <Input
                      value={propostaForm.area_m2}
                      onChange={(e) => setPropostaForm({ ...propostaForm, area_m2: e.target.value })}
                      type="number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipologia</Label>
                    <Input
                      value={propostaForm.tipologia}
                      onChange={(e) => setPropostaForm({ ...propostaForm, tipologia: e.target.value })}
                      placeholder="Residencial"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Prazo (dias)</Label>
                    <Input
                      value={propostaForm.prazo_dias}
                      onChange={(e) => setPropostaForm({ ...propostaForm, prazo_dias: e.target.value })}
                      type="number"
                    />
                  </div>
                </div>
              </>
            )}

            {activeGenerator === "relatorio_executivo" && (
              <div className="space-y-2">
                <Label>Período</Label>
                <Select value={relatorioForm.periodo} onValueChange={(v) => setRelatorioForm({ periodo: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="semanal">Semanal</SelectItem>
                    <SelectItem value="mensal">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {activeGenerator === "fechamento_mensal" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Mês</Label>
                  <Select
                    value={fechamentoForm.mes}
                    onValueChange={(v) => setFechamentoForm({ ...fechamentoForm, mes: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>
                          {new Date(2024, i).toLocaleDateString("pt-BR", { month: "long" })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ano</Label>
                  <Input
                    value={fechamentoForm.ano}
                    onChange={(e) => setFechamentoForm({ ...fechamentoForm, ano: e.target.value })}
                    type="number"
                  />
                </div>
              </div>
            )}

            {(activeGenerator === "previsao_atraso" ||
              activeGenerator === "radar_cliente" ||
              activeGenerator === "diagnostico_precificacao") && (
              <p className="text-sm text-muted-foreground">
                Esta análise será gerada automaticamente com base nos dados atuais dos seus projetos e clientes.
              </p>
            )}

            {activeGenerator === "documentos" && (
              <>
                <div className="space-y-2">
                  <Label>Projeto</Label>
                  <Select
                    value={documentosForm.projeto_id}
                    onValueChange={(v) => setDocumentosForm({ ...documentosForm, projeto_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o projeto" />
                    </SelectTrigger>
                    <SelectContent>
                      {projetosOptions.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Documento</Label>
                  <Select
                    value={documentosForm.tipo_documento}
                    onValueChange={(v) => setDocumentosForm({ ...documentosForm, tipo_documento: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ata_reuniao">Ata de Reunião</SelectItem>
                      <SelectItem value="relatorio_progresso">Relatório de Progresso</SelectItem>
                      <SelectItem value="termo_encerramento">Termo de Encerramento</SelectItem>
                      <SelectItem value="memorial_descritivo">Memorial Descritivo</SelectItem>
                      <SelectItem value="ordem_servico">Ordem de Serviço</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {activeGenerator === "aditivo_copilot" && (
              <>
                <div className="space-y-2">
                  <Label>Projeto</Label>
                  <Select
                    value={aditivoForm.projeto_id}
                    onValueChange={(v) => setAditivoForm({ ...aditivoForm, projeto_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o projeto" />
                    </SelectTrigger>
                    <SelectContent>
                      {projetosOptions.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Motivo do Aditivo</Label>
                  <Input
                    value={aditivoForm.motivo_aditivo}
                    onChange={(e) => setAditivoForm({ ...aditivoForm, motivo_aditivo: e.target.value })}
                    placeholder="Ex: mudança de escopo, atraso do cliente..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descrição da Mudança</Label>
                  <Textarea
                    value={aditivoForm.descricao_mudanca}
                    onChange={(e) => setAditivoForm({ ...aditivoForm, descricao_mudanca: e.target.value })}
                    rows={3}
                    placeholder="Descreva o que mudou ou precisa ser adicionado..."
                  />
                </div>
              </>
            )}

            {activeGenerator === "pauta_reuniao" && (
              <>
                <div className="space-y-2">
                  <Label>Tipo de Reunião</Label>
                  <Select
                    value={pautaForm.tipo_reuniao}
                    onValueChange={(v) => setPautaForm({ ...pautaForm, tipo_reuniao: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="diretoria">Diretoria / Sócios</SelectItem>
                      <SelectItem value="projeto">Acompanhamento de Projeto</SelectItem>
                      <SelectItem value="comercial">Comercial</SelectItem>
                      <SelectItem value="operacional">Operacional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Projeto (opcional)</Label>
                  <Select
                    value={pautaForm.projeto_id}
                    onValueChange={(v) => setPautaForm({ ...pautaForm, projeto_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione se for reunião de projeto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhum (geral)</SelectItem>
                      {projetosOptions.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Contexto adicional (opcional)</Label>
                  <Textarea
                    value={pautaForm.participantes_contexto}
                    onChange={(e) => setPautaForm({ ...pautaForm, participantes_contexto: e.target.value })}
                    rows={2}
                    placeholder="Participantes, temas específicos..."
                  />
                </div>
              </>
            )}

            {activeGenerator === "planejador_contratacao" && (
              <div className="space-y-2">
                <Label>Horizonte de Planejamento (meses)</Label>
                <Select
                  value={contratacaoForm.horizonte_meses}
                  onValueChange={(v) => setContratacaoForm({ horizonte_meses: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 meses</SelectItem>
                    <SelectItem value="6">6 meses</SelectItem>
                    <SelectItem value="12">12 meses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {activeGenerator === "simulacao_impacto" && (
              <>
                <div className="space-y-2">
                  <Label>Tipo de Cenário</Label>
                  <Select
                    value={simulacaoForm.tipo}
                    onValueChange={(v) => setSimulacaoForm({ ...simulacaoForm, tipo: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="perda_cliente">Perda de Cliente</SelectItem>
                      <SelectItem value="novo_projeto">Novo Projeto Grande</SelectItem>
                      <SelectItem value="aumento_custo">Aumento de Custo</SelectItem>
                      <SelectItem value="atraso_projeto">Atraso de Projeto</SelectItem>
                      <SelectItem value="contratacao">Nova Contratação</SelectItem>
                      <SelectItem value="custom">Cenário Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Descrição do Cenário</Label>
                  <Textarea
                    value={simulacaoForm.descricao}
                    onChange={(e) => setSimulacaoForm({ ...simulacaoForm, descricao: e.target.value })}
                    rows={3}
                    placeholder="Descreva o cenário que deseja simular..."
                  />
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setActiveGenerator(null)}>
                Cancelar
              </Button>
              <Button
                onClick={() => activeGenerator && handleGenerate(activeGenerator)}
                disabled={generateInsight.isPending}
              >
                {generateInsight.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Analisando...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-1" /> Gerar Análise
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Visualizar Insight */}
      <Dialog
        open={!!selectedInsight}
        onOpenChange={(open) => {
          if (!open) setSelectedInsight(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {selectedInsight && AI_TIPOS[selectedInsight.tipo as AiTipo]?.label}
            </DialogTitle>
          </DialogHeader>
          {selectedInsight && (
            <div className="space-y-4 mt-2">
              {selectedInsight.resumo && (
                <div className="p-3 bg-primary/5 rounded-lg">
                  <p className="text-sm">{selectedInsight.resumo}</p>
                </div>
              )}
              <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(selectedInsight.conteudo, null, 2)}
              </pre>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>Modelo: {selectedInsight.modelo_ia}</span>
                <span>Tokens: {(selectedInsight.tokens_entrada || 0) + (selectedInsight.tokens_saida || 0)}</span>
                <span>{new Date(selectedInsight.created_at).toLocaleString("pt-BR")}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
