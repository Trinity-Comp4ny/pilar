import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AlertTriangle, Camera, Plus, Trash2, UserCheck, Users, X } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CLIMA_OPCOES, CONDICAO_OPCOES, TIPO_IMPEDIMENTO_OPCOES, somaEfetivo, type TipoImpedimento } from "@/lib/obras";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateRdo, useUpdateRdo, type RdoRow } from "@/pages/obras/hooks/useObraRdo";
import { useObraTarefas, useCreateObraTarefa } from "@/pages/obras/hooks/useObraTarefas";
import { useObraFrentes } from "@/pages/obras/hooks/useObraFrentes";
import { useObraRdoTarefas, useSaveRdoTarefas, type ResultadoRdoTarefa } from "@/pages/obras/hooks/useObraRdoTarefas";
import { useFornecedoresLite } from "@/hooks/useFornecedorDetalhe";
import { useObraRdoEfetivo, useSaveRdoEfetivo, type EntradaEfetivo } from "@/pages/obras/hooks/useObraRdoEfetivo";
import {
  useObraRdoImpedimentos,
  useSaveRdoImpedimentos,
  type EntradaImpedimento,
} from "@/pages/obras/hooks/useObraRdoImpedimentos";
import { useObraRdoVisitas, useSaveRdoVisitas, type EntradaVisita } from "@/pages/obras/hooks/useObraRdoVisitas";
import {
  MAX_FOTO_RDO_BYTES,
  MIME_FOTO_RDO,
  useDeleteRdoFoto,
  useObraFotos,
  useUploadRdoFoto,
} from "@/pages/obras/hooks/useObraFotos";
import { useObra } from "@/pages/obras/hooks/useObras";
import { buscarClimaDoDia } from "@/pages/obras/lib/clima";
import type { RascunhoRdo } from "@/pages/obras/lib/resumoDia";
import { useVincularRegistrosRdo } from "@/pages/obras/hooks/useObraRegistros";
import { NAO_INFORMADO, doRdo, hoje, schema, vazio, type FormData } from "@/pages/obras/lib/rdoForm";
import { analytics } from "@/lib/analytics";

import { BusyMark } from "@/components/motion/BusyMark";

interface FotoLocal {
  file: File;
  preview: string;
}

const OUTRO = "__outro__";

const RESULTADO_OPCOES: ReadonlyArray<{ value: ResultadoRdoTarefa; label: string }> = [
  { value: "avancou", label: "Avançou" },
  { value: "concluiu", label: "Concluiu" },
  { value: "parou", label: "Parou" },
];

/** Estado de uma tarefa reportada no dia: marcada, com resultado e observação. */
interface SelTarefa {
  resultado: ResultadoRdoTarefa;
  observacao: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  obraId: string;
  /** RDOs já existentes da obra, para aplicar a regra de 1 por dia. */
  rdos: RdoRow[];
  /** Quando presente, abre editando este registro. */
  rdoInicial?: RdoRow | null;
  /** Fechar o dia pelos registros (SPEC 135): preenche o formulário e liga os registros ao RDO salvo. */
  rascunho?: RascunhoRdo | null;
}

export function RdoFormDialog({ open, onOpenChange, obraId, rdos, rdoInicial, rascunho }: Props) {
  const { profile } = useAuth();
  const empresaId = profile?.empresa_id ?? null;
  const criar = useCreateRdo();
  const atualizar = useUpdateRdo();
  const salvarTarefas = useSaveRdoTarefas();
  const salvarEfetivo = useSaveRdoEfetivo();
  const salvarImpedimentos = useSaveRdoImpedimentos();
  const salvarVisitas = useSaveRdoVisitas();
  const criarTarefa = useCreateObraTarefa(obraId, null);
  const uploadFoto = useUploadRdoFoto();
  const deleteFoto = useDeleteRdoFoto(obraId);
  const vincularRegistros = useVincularRegistrosRdo(obraId);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const { data: tarefas = [] } = useObraTarefas(obraId);
  const { data: frentes = [] } = useObraFrentes(obraId);
  const { data: vinculos = [] } = useObraRdoTarefas(obraId);
  const { data: fornecedores = [] } = useFornecedoresLite();
  const { data: efetivoExistente = [] } = useObraRdoEfetivo(obraId);
  const { data: impedimentosExistentes = [] } = useObraRdoImpedimentos(obraId);
  const { data: visitasExistentes = [] } = useObraRdoVisitas(obraId);
  const { data: fotosPorRdo = {} } = useObraFotos(obraId);
  const { data: obra } = useObra(obraId);

  // tarefaId → seleção do dia (resultado + observação).
  const [sel, setSel] = useState<Record<string, SelTarefa>>({});
  const [novaTarefa, setNovaTarefa] = useState<{ titulo: string; frenteId: string }>({ titulo: "", frenteId: "" });

  const [efetivoLinhas, setEfetivoLinhas] = useState<EntradaEfetivo[]>([]);
  const [impedimentoLinhas, setImpedimentoLinhas] = useState<EntradaImpedimento[]>([]);
  const [visitaLinhas, setVisitaLinhas] = useState<EntradaVisita[]>([]);
  const [novoEfetivo, setNovoEfetivo] = useState<{ fornecedorId: string; nomeLivre: string; quantidade: string }>({
    fornecedorId: "",
    nomeLivre: "",
    quantidade: "",
  });
  const [novoImpedimento, setNovoImpedimento] = useState<{ descricao: string; tipo: TipoImpedimento }>({
    descricao: "",
    tipo: "falta_material",
  });
  const [novaVisita, setNovaVisita] = useState<{ fornecedorId: string; nomeLivre: string; observacao: string }>({
    fornecedorId: "",
    nomeLivre: "",
    observacao: "",
  });

  // Fotos anexadas nesta sessão do formulário, ainda não enviadas (sobem no
  // onSubmit, junto dos outros blocos satélite — o path precisa do rdo.id real).
  const [fotosNovas, setFotosNovas] = useState<FotoLocal[]>([]);
  const fotoInputRef = useRef<HTMLInputElement>(null);

  // Clima sugerido automaticamente pela previsão do tempo (spec 080): mostra
  // uma dica sutil enquanto o valor não foi editado à mão.
  const [climaAuto, setClimaAuto] = useState(false);
  const form = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: vazio() });
  const { register, handleSubmit, reset, watch, setValue, formState } = form;
  const dataSel = watch("data");

  useEffect(() => {
    if (!open) return;
    setNovaTarefa({ titulo: "", frenteId: "" });
    setNovoEfetivo({ fornecedorId: "", nomeLivre: "", quantidade: "" });
    setNovoImpedimento({ descricao: "", tipo: "falta_material" });
    setNovaVisita({ fornecedorId: "", nomeLivre: "", observacao: "" });
    setFotosNovas([]);
    setClimaAuto(false);
    if (rdoInicial) {
      setEditandoId(rdoInicial.id);
      reset(doRdo(rdoInicial));
    } else {
      setEditandoId(null);
      reset({ ...vazio(), ...(rascunho ? { data: rascunho.data, ...rascunho.campos } : {}) });
    }
  }, [open, rdoInicial, rascunho, reset]);

  // Prefill das tarefas reportadas quando edita um dia existente.
  useEffect(() => {
    if (!open) return;
    if (!editandoId) {
      setSel({});
      return;
    }
    const doDia = vinculos.filter((v) => v.rdo_id === editandoId);
    setSel(
      Object.fromEntries(doDia.map((v) => [v.tarefa_id, { resultado: v.resultado, observacao: v.observacao ?? "" }]))
    );
  }, [open, editandoId, vinculos]);

  // Prefill de efetivo/impedimento/visita quando edita um dia existente.
  useEffect(() => {
    if (!open) return;
    if (!editandoId) {
      setEfetivoLinhas(rascunho?.efetivoLinhas ?? []);
      setImpedimentoLinhas(rascunho?.impedimentoLinhas ?? []);
      setVisitaLinhas([]);
      return;
    }
    setEfetivoLinhas(
      efetivoExistente
        .filter((e) => e.rdo_id === editandoId)
        .map((e) => ({ fornecedor_id: e.fornecedor_id, fornecedor_nome: e.fornecedor_nome, quantidade: e.quantidade }))
    );
    setImpedimentoLinhas(
      impedimentosExistentes
        .filter((i) => i.rdo_id === editandoId)
        .map((i) => ({ descricao: i.descricao, tipo: i.tipo }))
    );
    setVisitaLinhas(
      visitasExistentes
        .filter((v) => v.rdo_id === editandoId)
        .map((v) => ({ fornecedor_id: v.fornecedor_id, fornecedor_nome: v.fornecedor_nome, observacao: v.observacao }))
    );
  }, [open, editandoId, rascunho, efetivoExistente, impedimentosExistentes, visitasExistentes]);

  // Regra de 1 por dia: se a data escolhida já tem RDO, passa a editar aquele.
  useEffect(() => {
    if (!open || !dataSel) return;
    const existente = rdos.find((r) => r.data === dataSel);
    if (existente && existente.id !== editandoId) {
      setEditandoId(existente.id);
      reset(doRdo(existente));
      toast.info("Já existe um registro nesse dia", { description: "Abrimos ele para você editar." });
    } else if (!existente && editandoId && !rdoInicial) {
      setEditandoId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSel]);

  // Mantém o campo "Efetivo (total)" visualmente em sincronia com a soma das
  // linhas por fornecedor, mesmo desabilitado (spec 062).
  useEffect(() => {
    const total = somaEfetivo(efetivoLinhas);
    if (total != null) setValue("efetivo", String(total));
  }, [efetivoLinhas, setValue]);

  // Clima automático (spec 080): sugere o clima da data escolhida via previsão
  // do tempo (Open-Meteo, coordenada da obra), só enquanto o campo continua
  // "Não informado" — nunca sobrescreve escolha manual nem o que a voz já
  // preencheu. Silencioso quando falha ou a obra não tem localização: é atalho,
  // não obrigação.
  useEffect(() => {
    if (!open || !dataSel) return;
    if (!obra?.latitude || !obra?.longitude) return;
    if (form.getValues("clima") !== NAO_INFORMADO) return;
    let cancelado = false;
    buscarClimaDoDia(obra.latitude, obra.longitude, dataSel).then((clima) => {
      if (cancelado || !clima) return;
      if (form.getValues("clima") !== NAO_INFORMADO) return;
      setValue("clima", clima);
      setClimaAuto(true);
    });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dataSel, obra?.latitude, obra?.longitude]);

  // Tarefa pendura no serviço (spec 111): rótulo "Etapa › Serviço", que é o
  // que o mestre reconhece no canteiro.
  const frenteNome = useMemo(() => {
    const porId = new Map(frentes.map((f) => [f.id, f]));
    return new Map(
      frentes.map((f) => {
        const pai = f.parent_id ? porId.get(f.parent_id) : undefined;
        return [f.id, f.nivel === "servico" && pai ? `${pai.nome} › ${f.nome}` : f.nome];
      })
    );
  }, [frentes]);
  const servicos = useMemo(() => frentes.filter((f) => f.nivel === "servico"), [frentes]);
  const fornecedorNomePorId = useMemo(() => new Map(fornecedores.map((f) => [f.id, f.nome])), [fornecedores]);
  const fotosExistentes = editandoId ? (fotosPorRdo[editandoId] ?? []) : [];

  const adicionarFotos = (files: FileList | null) => {
    if (!files) return;
    const validas: FotoLocal[] = [];
    for (const file of Array.from(files)) {
      if (!MIME_FOTO_RDO.includes(file.type)) {
        toast.error("Formato não suportado", { description: "Envie JPG, PNG ou WebP." });
        continue;
      }
      if (file.size > MAX_FOTO_RDO_BYTES) {
        toast.error("Foto grande demais", { description: `${file.name}: máx. 8MB.` });
        continue;
      }
      validas.push({ file, preview: URL.createObjectURL(file) });
    }
    setFotosNovas((prev) => [...prev, ...validas]);
  };
  const removerFotoNova = (i: number) =>
    setFotosNovas((prev) => {
      URL.revokeObjectURL(prev[i].preview);
      return prev.filter((_, idx) => idx !== i);
    });
  const removerFotoExistente = async (id: string, path: string) => {
    try {
      await deleteFoto.mutateAsync({ id, path });
    } catch {
      toast.error("Não foi possível remover a foto");
    }
  };

  const nomeLinhaFornecedor = (fornecedorId?: string | null, fornecedorNome?: string | null) =>
    (fornecedorId && fornecedorNomePorId.get(fornecedorId)) || fornecedorNome || "Sem nome";

  const adicionarEfetivo = () => {
    const quantidade = Number(novoEfetivo.quantidade);
    if (!Number.isFinite(quantidade) || quantidade <= 0) return;
    const usaLivre = novoEfetivo.fornecedorId === OUTRO;
    if (!novoEfetivo.fornecedorId) return;
    if (usaLivre && !novoEfetivo.nomeLivre.trim()) return;
    setEfetivoLinhas((prev) => [
      ...prev,
      {
        fornecedor_id: usaLivre ? null : novoEfetivo.fornecedorId,
        fornecedor_nome: usaLivre ? novoEfetivo.nomeLivre.trim() : null,
        quantidade,
      },
    ]);
    setNovoEfetivo({ fornecedorId: "", nomeLivre: "", quantidade: "" });
  };
  const removerEfetivo = (i: number) => setEfetivoLinhas((prev) => prev.filter((_, idx) => idx !== i));

  const adicionarImpedimento = () => {
    const descricao = novoImpedimento.descricao.trim();
    if (!descricao) return;
    setImpedimentoLinhas((prev) => [...prev, { descricao, tipo: novoImpedimento.tipo }]);
    setNovoImpedimento({ descricao: "", tipo: "falta_material" });
  };
  const removerImpedimento = (i: number) => setImpedimentoLinhas((prev) => prev.filter((_, idx) => idx !== i));

  const adicionarVisita = () => {
    const usaLivre = novaVisita.fornecedorId === OUTRO;
    if (!novaVisita.fornecedorId) return;
    if (usaLivre && !novaVisita.nomeLivre.trim()) return;
    setVisitaLinhas((prev) => [
      ...prev,
      {
        fornecedor_id: usaLivre ? null : novaVisita.fornecedorId,
        fornecedor_nome: usaLivre ? novaVisita.nomeLivre.trim() : null,
        observacao: novaVisita.observacao.trim() || null,
      },
    ]);
    setNovaVisita({ fornecedorId: "", nomeLivre: "", observacao: "" });
  };
  const removerVisita = (i: number) => setVisitaLinhas((prev) => prev.filter((_, idx) => idx !== i));

  const toggleTarefa = (id: string) => {
    setSel((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = { resultado: "avancou", observacao: "" };
      return next;
    });
  };
  const setResultado = (id: string, resultado: ResultadoRdoTarefa) =>
    setSel((prev) => ({ ...prev, [id]: { ...prev[id], resultado } }));
  const setObs = (id: string, observacao: string) => setSel((prev) => ({ ...prev, [id]: { ...prev[id], observacao } }));

  const adicionarTarefa = async () => {
    const titulo = novaTarefa.titulo.trim();
    if (!titulo) return;
    try {
      const t = await criarTarefa.mutateAsync({
        titulo,
        obra_frente_id: novaTarefa.frenteId || null,
      });
      setSel((prev) => ({ ...prev, [t.id]: { resultado: "avancou", observacao: "" } }));
      setNovaTarefa({ titulo: "", frenteId: "" });
    } catch (e) {
      toast.error("Não foi possível criar a tarefa", {
        description: e instanceof Error ? e.message : "Tente novamente",
      });
    }
  };

  const onSubmit = handleSubmit(async (d) => {
    // efetivo (total) é derivado da soma das linhas quando há alguma lançada;
    // sem nenhuma linha, continua o número solto do campo (spec 062).
    const efetivoDerivado = somaEfetivo(efetivoLinhas);
    const payload = {
      obra_id: obraId,
      data: d.data,
      clima: d.clima === NAO_INFORMADO ? null : d.clima,
      condicao_trabalho: d.condicao_trabalho === NAO_INFORMADO ? null : d.condicao_trabalho,
      efetivo: efetivoDerivado ?? (d.efetivo.trim() === "" ? null : Number(d.efetivo)),
      atividades: d.atividades.trim() || null,
      ocorrencias: d.ocorrencias.trim() || null,
      pendencias: d.pendencias.trim() || null,
    };
    try {
      const rdo = editandoId
        ? await atualizar.mutateAsync({ id: editandoId, ...payload })
        : await criar.mutateAsync(payload);

      const entradas = Object.entries(sel).map(([tarefa_id, s]) => ({
        tarefa_id,
        resultado: s.resultado,
        observacao: s.observacao,
      }));
      if (fotosNovas.length > 0 && !empresaId) {
        throw new Error("Perfil não carregado. Tente novamente em instantes.");
      }
      await Promise.all([
        salvarTarefas.mutateAsync({ rdoId: rdo.id, obraId, entradas }),
        salvarEfetivo.mutateAsync({ rdoId: rdo.id, obraId, entradas: efetivoLinhas }),
        salvarImpedimentos.mutateAsync({ rdoId: rdo.id, obraId, entradas: impedimentoLinhas }),
        salvarVisitas.mutateAsync({ rdoId: rdo.id, obraId, entradas: visitaLinhas }),
        ...fotosNovas.map((f) =>
          uploadFoto.mutateAsync({ empresaId: empresaId!, obraId, rdoId: rdo.id, file: f.file })
        ),
      ]);

      if (rascunho) await vincularRegistros.mutateAsync({ rdoId: rdo.id, registroIds: rascunho.registroIds });

      fotosNovas.forEach((f) => URL.revokeObjectURL(f.preview));
      setFotosNovas([]);
      if (!editandoId) analytics.track("rdo_registrado", { fotos: fotosNovas.length });
      toast.success(editandoId ? "Registro atualizado" : "Dia registrado");
      onOpenChange(false);
    } catch (e) {
      toast.error("Não foi possível salvar", {
        description: e instanceof Error ? e.message : "Tente novamente",
      });
    }
  });

  const saving =
    criar.isPending ||
    atualizar.isPending ||
    salvarTarefas.isPending ||
    salvarEfetivo.isPending ||
    salvarImpedimentos.isPending ||
    salvarVisitas.isPending ||
    uploadFoto.isPending;

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="flex max-h-[90dvh] max-w-lg flex-col overflow-hidden p-0">
        <div className="border-b border-black/5 px-6 pb-4 pt-6">
          <DialogHeader>
            <DialogTitle>{editandoId ? "Editar dia" : "Registrar dia"}</DialogTitle>
            <DialogDescription>Diário de obra (RDO). Um registro por dia.</DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="data">Data *</Label>
                <Input id="data" type="date" max={hoje()} {...register("data")} />
                {formState.errors.data && <p className="text-xs text-danger-strong">{formState.errors.data.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="efetivo">Total de pessoas na obra</Label>
                <Input
                  id="efetivo"
                  type="number"
                  min={0}
                  disabled={efetivoLinhas.length > 0}
                  {...register("efetivo")}
                />
                {efetivoLinhas.length > 0 && (
                  <p className="text-[11px] text-muted-foreground">Somado a partir das equipes abaixo.</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="clima">Clima</Label>
                <Select
                  value={watch("clima")}
                  onValueChange={(v) => {
                    setValue("clima", v);
                    setClimaAuto(false);
                  }}
                >
                  <SelectTrigger id="clima">
                    <SelectValue placeholder="Não informado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NAO_INFORMADO}>Não informado</SelectItem>
                    {CLIMA_OPCOES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {climaAuto && <p className="text-[11px] text-muted-foreground">Sugerido pela previsão do tempo.</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="condicao">Condição de trabalho</Label>
                <Select value={watch("condicao_trabalho")} onValueChange={(v) => setValue("condicao_trabalho", v)}>
                  <SelectTrigger id="condicao">
                    <SelectValue placeholder="Não informado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NAO_INFORMADO}>Não informado</SelectItem>
                    {CONDICAO_OPCOES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tarefas do cronograma reportadas no dia — o loop que mantém o
              cronograma vivo: concluir aqui fecha a tarefa e move o avanço. */}
            <div className="space-y-2 rounded-xl border border-black/5 p-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Tarefas do cronograma</Label>
                <span className="text-[11px] text-muted-foreground">Marque o que andou hoje</span>
              </div>

              {tarefas.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhuma tarefa no cronograma ainda. Crie a primeira abaixo.
                </p>
              ) : (
                <div className="max-h-56 space-y-1.5 overflow-y-auto">
                  {tarefas.map((t) => {
                    const marcada = !!sel[t.id];
                    return (
                      <div key={t.id} className="rounded-lg bg-muted/40 px-2.5 py-2">
                        <div className="flex items-start gap-2">
                          <Checkbox
                            id={`t-${t.id}`}
                            checked={marcada}
                            onCheckedChange={() => toggleTarefa(t.id)}
                            className="mt-0.5"
                          />
                          <label htmlFor={`t-${t.id}`} className="min-w-0 flex-1 cursor-pointer">
                            <span className="block truncate text-sm text-ink">{t.titulo}</span>
                            {t.obra_frente_id && (
                              <span className="block text-[11px] text-muted-foreground">
                                {frenteNome.get(t.obra_frente_id) ?? ""}
                              </span>
                            )}
                          </label>
                        </div>
                        {marcada && (
                          <div className="mt-2 flex flex-col gap-2 pl-6 sm:flex-row">
                            <Select
                              value={sel[t.id].resultado}
                              onValueChange={(v) => setResultado(t.id, v as ResultadoRdoTarefa)}
                            >
                              <SelectTrigger className="h-8 w-full sm:w-36">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {RESULTADO_OPCOES.map((r) => (
                                  <SelectItem key={r.value} value={r.value}>
                                    {r.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              className="h-8 flex-1"
                              placeholder="O que foi feito (opcional)"
                              value={sel[t.id].observacao}
                              onChange={(e) => setObs(t.id, e.target.value)}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Criar tarefa na hora, se não estiver no cronograma. */}
              <div className="flex flex-col gap-2 border-t border-black/5 pt-2 sm:flex-row">
                <Input
                  className="h-8 flex-1"
                  placeholder="Nova tarefa (ex: concretar laje)"
                  value={novaTarefa.titulo}
                  onChange={(e) => setNovaTarefa((p) => ({ ...p, titulo: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      adicionarTarefa();
                    }
                  }}
                />
                {servicos.length > 0 && (
                  <Select
                    value={novaTarefa.frenteId || NAO_INFORMADO}
                    onValueChange={(v) => setNovaTarefa((p) => ({ ...p, frenteId: v === NAO_INFORMADO ? "" : v }))}
                  >
                    <SelectTrigger className="h-8 w-full sm:w-48">
                      <SelectValue placeholder="Sem serviço" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NAO_INFORMADO}>Sem serviço</SelectItem>
                      {servicos.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {frenteNome.get(f.id)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0"
                  onClick={adicionarTarefa}
                  disabled={!novaTarefa.titulo.trim() || criarTarefa.isPending}
                >
                  {criarTarefa.isPending ? <BusyMark className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Equipes no canteiro (efetivo por fornecedor) — quem esteve na obra,
          não só quantas pessoas (spec 062). */}
            <div className="space-y-2 rounded-xl border border-black/5 p-3">
              <div>
                <Label className="text-sm">Equipes no canteiro</Label>
                <p className="text-[11px] text-muted-foreground">Quantas pessoas de cada empresa trabalharam hoje.</p>
              </div>
              {efetivoLinhas.length > 0 && (
                <div className="space-y-1">
                  {efetivoLinhas.map((e, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5 text-sm"
                    >
                      <span className="inline-flex items-center gap-1.5 text-ink/90">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        {nomeLinhaFornecedor(e.fornecedor_id, e.fornecedor_nome)}: {e.quantidade}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removerEfetivo(i)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-col gap-2 border-t border-black/5 pt-2 sm:flex-row">
                <Select
                  value={novoEfetivo.fornecedorId || NAO_INFORMADO}
                  onValueChange={(v) => setNovoEfetivo((p) => ({ ...p, fornecedorId: v === NAO_INFORMADO ? "" : v }))}
                >
                  <SelectTrigger className="h-8 flex-1">
                    <SelectValue placeholder="Fornecedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NAO_INFORMADO}>Selecione</SelectItem>
                    {fornecedores.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nome}
                        {f.cnpj ? ` · ${f.cnpj}` : ""}
                      </SelectItem>
                    ))}
                    <SelectItem value={OUTRO}>Outro (digitar nome)</SelectItem>
                  </SelectContent>
                </Select>
                {novoEfetivo.fornecedorId === OUTRO && (
                  <Input
                    className="h-8 flex-1"
                    placeholder="Nome do prestador"
                    value={novoEfetivo.nomeLivre}
                    onChange={(e) => setNovoEfetivo((p) => ({ ...p, nomeLivre: e.target.value }))}
                  />
                )}
                <Input
                  className="h-8 w-full sm:w-24"
                  type="number"
                  min={1}
                  placeholder="Qtd"
                  value={novoEfetivo.quantidade}
                  onChange={(e) => setNovoEfetivo((p) => ({ ...p, quantidade: e.target.value }))}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0"
                  onClick={adicionarEfetivo}
                  disabled={!novoEfetivo.fornecedorId || !novoEfetivo.quantidade}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Impedimentos — o que travou o serviço, tipado e destacado, separado de Ocorrências (spec 062). */}
            <div className="space-y-2 rounded-xl border border-black/5 p-3">
              <div>
                <Label className="inline-flex items-center gap-1.5 text-sm">
                  <AlertTriangle className="h-3.5 w-3.5 text-warning-strong" />
                  Impedimentos
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  O que travou o serviço (falta de material, chuva...).
                </p>
              </div>
              {impedimentoLinhas.length > 0 && (
                <div className="space-y-1">
                  {impedimentoLinhas.map((i, idx) => (
                    <div
                      key={idx}
                      className="flex items-start justify-between gap-2 rounded-lg bg-warning-soft px-2.5 py-1.5 text-sm"
                    >
                      <span className="text-ink/90">
                        <span className="font-medium">
                          {TIPO_IMPEDIMENTO_OPCOES.find((o) => o.value === i.tipo)?.label}:
                        </span>{" "}
                        {i.descricao}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => removerImpedimento(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-col gap-2 border-t border-black/5 pt-2 sm:flex-row">
                <Select
                  value={novoImpedimento.tipo}
                  onValueChange={(v) => setNovoImpedimento((p) => ({ ...p, tipo: v as TipoImpedimento }))}
                >
                  <SelectTrigger className="h-8 w-full sm:w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPO_IMPEDIMENTO_OPCOES.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="h-8 flex-1"
                  placeholder="O que travou (ex: falta de cimento)"
                  value={novoImpedimento.descricao}
                  onChange={(e) => setNovoImpedimento((p) => ({ ...p, descricao: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      adicionarImpedimento();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0"
                  onClick={adicionarImpedimento}
                  disabled={!novoImpedimento.descricao.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Visitas — quem esteve na obra sem trabalhar (arquiteto, cliente, fiscal) (spec 062). */}
            <div className="space-y-2 rounded-xl border border-black/5 p-3">
              <div>
                <Label className="text-sm">Visitas</Label>
                <p className="text-[11px] text-muted-foreground">
                  Quem esteve na obra sem trabalhar (cliente, fiscal, arquiteto).
                </p>
              </div>
              {visitaLinhas.length > 0 && (
                <div className="space-y-1">
                  {visitaLinhas.map((v, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5 text-sm"
                    >
                      <span className="inline-flex items-center gap-1.5 text-ink/90">
                        <UserCheck className="h-3.5 w-3.5 text-muted-foreground" />
                        {nomeLinhaFornecedor(v.fornecedor_id, v.fornecedor_nome)}
                        {v.observacao && <span className="text-muted-foreground"> — {v.observacao}</span>}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removerVisita(i)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-col gap-2 border-t border-black/5 pt-2 sm:flex-row">
                <Select
                  value={novaVisita.fornecedorId || NAO_INFORMADO}
                  onValueChange={(v) => setNovaVisita((p) => ({ ...p, fornecedorId: v === NAO_INFORMADO ? "" : v }))}
                >
                  <SelectTrigger className="h-8 flex-1">
                    <SelectValue placeholder="Visitante" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NAO_INFORMADO}>Selecione</SelectItem>
                    {fornecedores.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nome}
                        {f.cnpj ? ` · ${f.cnpj}` : ""}
                      </SelectItem>
                    ))}
                    <SelectItem value={OUTRO}>Outro (digitar nome)</SelectItem>
                  </SelectContent>
                </Select>
                {novaVisita.fornecedorId === OUTRO && (
                  <Input
                    className="h-8 flex-1"
                    placeholder="Nome do visitante"
                    value={novaVisita.nomeLivre}
                    onChange={(e) => setNovaVisita((p) => ({ ...p, nomeLivre: e.target.value }))}
                  />
                )}
                <Input
                  className="h-8 flex-1"
                  placeholder="Motivo (opcional)"
                  value={novaVisita.observacao}
                  onChange={(e) => setNovaVisita((p) => ({ ...p, observacao: e.target.value }))}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0"
                  onClick={adicionarVisita}
                  disabled={!novaVisita.fornecedorId}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Fotos — o escritório passa a poder anexar imagem, não só o campo (spec 080). */}
            <div className="space-y-2 rounded-xl border border-black/5 p-3">
              <Label className="text-sm">Fotos</Label>
              <input
                ref={fotoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => {
                  adicionarFotos(e.target.files);
                  e.target.value = "";
                }}
              />
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {fotosExistentes.map((f) => (
                  <div key={f.id} className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                    <img src={f.url} alt="Foto da obra" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removerFotoExistente(f.id, f.path)}
                      aria-label="Remover foto"
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {fotosNovas.map((f, i) => (
                  <div key={f.preview} className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                    <img src={f.preview} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removerFotoNova(i)}
                      aria-label="Remover foto"
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => fotoInputRef.current?.click()}
                  className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-black/15 bg-muted/40 text-muted-foreground"
                >
                  <Camera className="h-5 w-5" />
                  <span className="text-[10px]">Foto</span>
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="atividades">Observações do dia</Label>
              <Textarea id="atividades" rows={2} placeholder="Nota livre (opcional)" {...register("atividades")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ocorrencias">Ocorrências</Label>
              <Textarea id="ocorrencias" rows={2} {...register("ocorrencias")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pendencias">Pendências</Label>
              <Textarea id="pendencias" rows={2} {...register("pendencias")} />
            </div>

            <DialogFooter className="pt-2">
              <DialogClose asChild>
                <Button type="button" variant="ghost" disabled={saving}>
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit" variant="brand" loading={saving}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
