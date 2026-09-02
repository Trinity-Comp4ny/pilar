import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  AlertTriangle,
  Camera,
  Check,
  ClipboardList,
  Loader2,
  Mic,
  Pencil,
  Plus,
  Square,
  Trash2,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CLIMA_OPCOES,
  CONDICAO_OPCOES,
  TIPO_IMPEDIMENTO_OPCOES,
  mesclarExtracaoVoz,
  somaEfetivo,
  tipoImpedimentoLabel,
  type SugestoesRdoVoz,
  type TipoImpedimento,
} from "@/lib/obras";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateRdo, useUpdateRdo, type RdoRow } from "@/hooks/useObraRdo";
import { useObraTarefas, useCreateObraTarefa } from "@/hooks/useObraTarefas";
import { useObraFrentes } from "@/hooks/useObraFrentes";
import { useObraRdoTarefas, useSaveRdoTarefas, type ResultadoRdoTarefa } from "@/hooks/useObraRdoTarefas";
import { useFornecedoresLite } from "@/hooks/useFornecedorDetalhe";
import { useObraRdoEfetivo, useSaveRdoEfetivo, type EntradaEfetivo } from "@/hooks/useObraRdoEfetivo";
import {
  useObraRdoImpedimentos,
  useSaveRdoImpedimentos,
  type EntradaImpedimento,
} from "@/hooks/useObraRdoImpedimentos";
import { useObraRdoVisitas, useSaveRdoVisitas, type EntradaVisita } from "@/hooks/useObraRdoVisitas";
import {
  MAX_FOTO_RDO_BYTES,
  MIME_FOTO_RDO,
  useDeleteRdoFoto,
  useObraFotos,
  useUploadRdoFoto,
} from "@/hooks/useObraFotos";
import { useTranscreverRdoVoz } from "@/hooks/useTranscreverRdoVoz";
import { useObra } from "@/hooks/useObras";
import { buscarClimaDoDia } from "@/lib/clima";

const GRAVACAO_MAX_MS = 3 * 60 * 1000;

interface FotoLocal {
  file: File;
  preview: string;
}

function escolherMimeTypeAudio(): string {
  const candidatos = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  for (const c of candidatos) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(c)) return c;
  }
  return "";
}

const NAO_INFORMADO = "__none__";
const OUTRO = "__outro__";

const RESULTADO_OPCOES: ReadonlyArray<{ value: ResultadoRdoTarefa; label: string }> = [
  { value: "avancou", label: "Avançou" },
  { value: "concluiu", label: "Concluiu" },
  { value: "parou", label: "Parou" },
];

const schema = z.object({
  data: z.string().min(1, "Escolha a data"),
  clima: z.string(),
  condicao_trabalho: z.string(),
  efetivo: z.string(),
  atividades: z.string(),
  ocorrencias: z.string(),
  pendencias: z.string(),
});
type FormData = z.infer<typeof schema>;

const hoje = () => new Date().toISOString().slice(0, 10);

const vazio = (): FormData => ({
  data: hoje(),
  clima: NAO_INFORMADO,
  condicao_trabalho: NAO_INFORMADO,
  efetivo: "",
  atividades: "",
  ocorrencias: "",
  pendencias: "",
});

const doRdo = (r: RdoRow): FormData => ({
  data: r.data,
  clima: r.clima ?? NAO_INFORMADO,
  condicao_trabalho: r.condicao_trabalho ?? NAO_INFORMADO,
  efetivo: r.efetivo != null ? String(r.efetivo) : "",
  atividades: r.atividades ?? "",
  ocorrencias: r.ocorrencias ?? "",
  pendencias: r.pendencias ?? "",
});

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
}

export function RdoFormDialog({ open, onOpenChange, obraId, rdos, rdoInicial }: Props) {
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
  const transcreverVoz = useTranscreverRdoVoz();
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

  // Gravação de voz (spec 080).
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const gravacaoTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gravacaoLimiteRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [gravando, setGravando] = useState(false);
  const [tempoGravacao, setTempoGravacao] = useState(0);
  const [transcricao, setTranscricao] = useState<string | null>(null);
  const [erroVoz, setErroVoz] = useState<string | null>(null);
  // Clima sugerido automaticamente pela previsão do tempo (spec 080): mostra
  // uma dica sutil enquanto o valor não foi editado à mão.
  const [climaAuto, setClimaAuto] = useState(false);
  // Sugestões estruturadas da fala (spec 086): nada entra no formulário até o
  // usuário clicar "Adicionar" em cada item.
  const [sugestoes, setSugestoes] = useState<SugestoesRdoVoz | null>(null);
  // Fluxo em 2 etapas (spec 080, revisão UX): "gravar" abre focado no áudio,
  // "revisar" mostra todos os campos. Editar um dia já existente pula direto
  // pra revisão (o dado já está lá, forçar gravação não faz sentido).
  const [etapa, setEtapa] = useState<"gravar" | "revisar">("gravar");
  // Cancelar gravação (regravar): a próxima parada do MediaRecorder não deve
  // transcrever, só descartar o áudio e voltar pro estado ocioso.
  const canceladoRef = useRef(false);
  // Visualização reativa ao volume da voz durante a gravação (Web Audio API,
  // sem lib nova — nenhuma outra tela do projeto usa isso ainda).
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const N_BARRAS = 5;
  const [niveis, setNiveis] = useState<number[]>(new Array(N_BARRAS).fill(0.1));

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
    setTranscricao(null);
    setErroVoz(null);
    setClimaAuto(false);
    setSugestoes(null);
    setEtapa(rdoInicial ? "revisar" : "gravar");
    if (rdoInicial) {
      setEditandoId(rdoInicial.id);
      reset(doRdo(rdoInicial));
    } else {
      setEditandoId(null);
      reset(vazio());
    }
  }, [open, rdoInicial, reset]);

  // Fecha o dialog com gravação em andamento: para o microfone, os timers e a
  // visualização de áudio, sem deixar stream ativo em segundo plano.
  useEffect(() => {
    if (open) return;
    mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    if (gravacaoTickRef.current) clearInterval(gravacaoTickRef.current);
    if (gravacaoLimiteRef.current) clearTimeout(gravacaoLimiteRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setGravando(false);
  }, [open]);

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
      setEfetivoLinhas([]);
      setImpedimentoLinhas([]);
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
  }, [open, editandoId, efetivoExistente, impedimentosExistentes, visitasExistentes]);

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

  const frenteNome = useMemo(() => new Map(frentes.map((f) => [f.id, f.nome])), [frentes]);
  const fornecedorNomePorId = useMemo(() => new Map(fornecedores.map((f) => [f.id, f.nome])), [fornecedores]);
  const tarefaTituloPorId = useMemo(() => new Map(tarefas.map((t) => [t.id, t.titulo])), [tarefas]);
  // Cadastro real enviado pro backend casar sugestão de efetivo/visita/tarefa
  // da fala (spec 086) — só tarefas ainda não concluídas fazem sentido sugerir.
  const tarefasAbertasRef = useMemo(
    () => tarefas.filter((t) => t.status !== "concluida").map((t) => ({ id: t.id, nome: t.titulo })),
    [tarefas]
  );
  const fornecedoresRef = useMemo(() => fornecedores.map((f) => ({ id: f.id, nome: f.nome })), [fornecedores]);

  const fotosExistentes = editandoId ? (fotosPorRdo[editandoId] ?? []) : [];

  const processarAudioGravado = async (blob: Blob, mimeType: string) => {
    setErroVoz(null);
    try {
      const extraido = await transcreverVoz.mutateAsync({
        blob,
        mimeType: mimeType.split(";")[0],
        fornecedores: fornecedoresRef,
        tarefasAbertas: tarefasAbertasRef,
      });
      setTranscricao(extraido.transcricao);
      setSugestoes(extraido.sugestoes);
      const patch = mesclarExtracaoVoz(extraido, { permiteEfetivo: efetivoLinhas.length === 0 });
      (Object.entries(patch) as Array<[keyof FormData, string]>).forEach(([campo, valor]) => {
        setValue(campo, valor, { shouldDirty: true });
      });
      if (patch.clima) setClimaAuto(false);
      const temSugestao = Object.values(extraido.sugestoes).some((lista) => lista.length > 0);
      if (Object.keys(patch).length === 0 && !temSugestao) {
        toast.info("Nada de novo identificado na fala", { description: "Preencha os campos manualmente." });
      }
      setEtapa("revisar");
    } catch (e) {
      setErroVoz(e instanceof Error ? e.message : "Não foi possível transcrever o áudio");
    }
  };

  const removerSugestao = <K extends keyof SugestoesRdoVoz>(categoria: K, i: number) => {
    setSugestoes((prev) => {
      if (!prev) return prev;
      return { ...prev, [categoria]: prev[categoria].filter((_, idx) => idx !== i) };
    });
  };

  const aceitarSugestaoEfetivo = (i: number) => {
    const s = sugestoes?.efetivo_por_fornecedor[i];
    if (!s) return;
    setEfetivoLinhas((prev) => [
      ...prev,
      {
        fornecedor_id: s.fornecedor_id,
        fornecedor_nome: s.fornecedor_id ? null : s.fornecedor_nome,
        quantidade: s.quantidade,
      },
    ]);
    removerSugestao("efetivo_por_fornecedor", i);
  };

  const aceitarSugestaoImpedimento = (i: number) => {
    const s = sugestoes?.impedimentos[i];
    if (!s) return;
    setImpedimentoLinhas((prev) => [...prev, { descricao: s.descricao, tipo: s.tipo }]);
    removerSugestao("impedimentos", i);
  };

  const aceitarSugestaoVisita = (i: number) => {
    const s = sugestoes?.visitas[i];
    if (!s) return;
    setVisitaLinhas((prev) => [
      ...prev,
      {
        fornecedor_id: s.fornecedor_id,
        fornecedor_nome: s.fornecedor_id ? null : s.fornecedor_nome,
        observacao: s.observacao,
      },
    ]);
    removerSugestao("visitas", i);
  };

  const aceitarSugestaoTarefa = (i: number) => {
    const s = sugestoes?.tarefas[i];
    if (!s) return;
    setSel((prev) => ({ ...prev, [s.tarefa_id]: { resultado: s.resultado, observacao: "" } }));
    removerSugestao("tarefas", i);
  };

  // Liga um AnalyserNode no mesmo stream do MediaRecorder pra animar as barras
  // com o volume real da fala (não é uma decoração solta em loop).
  const iniciarVisualizacao = (stream: MediaStream) => {
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);
    audioCtxRef.current = ctx;
    const dados = new Uint8Array(analyser.frequencyBinCount);
    const grupo = Math.max(1, Math.floor(dados.length / N_BARRAS));
    const tick = () => {
      analyser.getByteFrequencyData(dados);
      const novos = Array.from({ length: N_BARRAS }, (_, i) => {
        const fatia = dados.slice(i * grupo, (i + 1) * grupo);
        const media = fatia.reduce((a, b) => a + b, 0) / (fatia.length || 1);
        return Math.max(0.1, Math.min(1, media / 150));
      });
      setNiveis(novos);
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
  };

  const pararVisualizacao = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setNiveis(new Array(N_BARRAS).fill(0.1));
  };

  const iniciarGravacao = async () => {
    setErroVoz(null);
    setTranscricao(null);
    canceladoRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = escolherMimeTypeAudio();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        pararVisualizacao();
        if (gravacaoTickRef.current) clearInterval(gravacaoTickRef.current);
        if (gravacaoLimiteRef.current) clearTimeout(gravacaoLimiteRef.current);
        if (canceladoRef.current) {
          canceladoRef.current = false;
          return;
        }
        const tipoFinal = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: tipoFinal });
        void processarAudioGravado(blob, tipoFinal);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      iniciarVisualizacao(stream);
      setGravando(true);
      setTempoGravacao(0);
      gravacaoTickRef.current = setInterval(() => setTempoGravacao((s) => s + 1), 1000);
      gravacaoLimiteRef.current = setTimeout(() => mediaRecorderRef.current?.stop(), GRAVACAO_MAX_MS);
    } catch {
      setErroVoz("Permita o microfone pra gravar o RDO por voz.");
    }
  };

  const pararGravacao = () => {
    mediaRecorderRef.current?.stop();
    setGravando(false);
  };

  /** Descarta a gravação em andamento e volta pro estado pronto-pra-gravar. */
  const cancelarGravacao = () => {
    canceladoRef.current = true;
    mediaRecorderRef.current?.stop();
    setGravando(false);
  };

  const tempoFormatado = `${Math.floor(tempoGravacao / 60)}:${String(tempoGravacao % 60).padStart(2, "0")}`;

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

      fotosNovas.forEach((f) => URL.revokeObjectURL(f.preview));
      setFotosNovas([]);
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

  const podeNavegar = !gravando && !transcreverVoz.isPending;

  const STEPS: ReadonlyArray<{ id: "gravar" | "revisar"; label: string; icon: typeof Mic }> = [
    { id: "gravar", label: "Gravar", icon: Mic },
    { id: "revisar", label: "Revisar", icon: ClipboardList },
  ];

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col overflow-hidden p-0">
        <div className="border-b border-black/5 px-6 pb-4 pt-6">
          <DialogHeader>
            <DialogTitle>{editandoId ? "Editar dia" : "Registrar dia"}</DialogTitle>
            <DialogDescription>Diário de obra (RDO). Um registro por dia.</DialogDescription>
          </DialogHeader>
        </div>

        {/* Stepper (padrão já usado em ClienteFormDialog/ProjetoFormDialog/
            PessoaFormDialog): só aparece pra RDO novo — editar já pula pra
            revisão, o dado já existe. */}
        {!editandoId && (
          <div className="flex shrink-0 items-center gap-1 border-b border-black/5 px-6 py-3">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isActive = etapa === s.id;
              const isCompleted = etapa === "revisar" && s.id === "gravar";
              const isClickable = podeNavegar;
              return (
                <div key={s.id} className="flex flex-1 items-center">
                  <button
                    type="button"
                    onClick={() => isClickable && setEtapa(s.id)}
                    disabled={!isClickable}
                    className={cn(
                      "flex flex-1 items-center gap-2 rounded-lg p-2 text-left transition-colors",
                      isClickable && "hover:bg-muted",
                      !isClickable && "cursor-not-allowed opacity-50"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                        (isActive || isCompleted) && "bg-brand text-ink",
                        !isActive && !isCompleted && "bg-muted text-muted-foreground"
                      )}
                    >
                      {isCompleted ? <Check className="h-4 w-4" /> : <Icon className="h-3.5 w-3.5" />}
                    </span>
                    <p
                      className={cn(
                        "truncate text-xs font-medium",
                        isActive ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {s.label}
                    </p>
                  </button>
                  {i < STEPS.length - 1 && (
                    <div className={cn("mx-1 h-px flex-1", etapa === "revisar" ? "bg-brand" : "bg-muted")} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {etapa === "gravar" ? (
            <div className="flex flex-col items-center justify-center gap-5 py-8 text-center">
              <div>
                <h3 className="text-base font-medium text-ink">Como foi o dia na obra?</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Grave um áudio contando o que aconteceu — a gente preenche o resto pra você revisar.
                </p>
              </div>

              {gravando ? (
                <div className="flex h-16 items-end justify-center gap-1.5">
                  {niveis.map((n, i) => (
                    <span
                      key={i}
                      className="w-2.5 rounded-full bg-brand transition-[height] duration-75"
                      style={{ height: `${16 + n * 48}px` }}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <button
                    type="button"
                    onClick={iniciarGravacao}
                    disabled={transcreverVoz.isPending}
                    aria-label="Gravar"
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-brand text-ink transition-transform hover:scale-105 disabled:opacity-50"
                  >
                    <Mic className="h-6 w-6" />
                  </button>
                  <span className="text-sm font-medium text-ink">Gravar</span>
                </div>
              )}

              {gravando && (
                <div className="flex flex-col items-center gap-2">
                  <p className="text-sm tabular-nums text-muted-foreground">{tempoFormatado}</p>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="brand" onClick={pararGravacao}>
                      <Square className="mr-1.5 h-3.5 w-3.5 fill-current" />
                      Parar e usar
                    </Button>
                    <Button type="button" variant="ghost" onClick={cancelarGravacao}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}

              {transcreverVoz.isPending && (
                <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Transcrevendo...
                </span>
              )}

              {erroVoz && <p className="text-sm text-danger-strong">{erroVoz}</p>}

              {!gravando && !transcreverVoz.isPending && (
                <button
                  type="button"
                  onClick={() => setEtapa("revisar")}
                  className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  Prefiro preencher manualmente
                </button>
              )}
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="data">Data *</Label>
                  <Input id="data" type="date" max={hoje()} {...register("data")} />
                  {formState.errors.data && (
                    <p className="text-xs text-danger-strong">{formState.errors.data.message}</p>
                  )}
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

              {/* RDO por voz, versão compacta: continua disponível na revisão
                  pra regravar ou complementar o que já foi dito (spec 080). */}
              <div className="space-y-2 rounded-xl border border-black/5 bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-2">
                  <Label className="inline-flex items-center gap-1.5 text-sm">
                    <Mic className="h-3.5 w-3.5 text-muted-foreground" />
                    RDO por voz
                  </Label>
                  {gravando && <span className="text-xs tabular-nums text-muted-foreground">{tempoFormatado}</span>}
                </div>
                {gravando ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex h-8 items-end gap-1">
                      {niveis.map((n, i) => (
                        <span
                          key={i}
                          className="w-1.5 rounded-full bg-brand transition-[height] duration-75"
                          style={{ height: `${6 + n * 24}px` }}
                        />
                      ))}
                    </div>
                    <Button type="button" size="sm" variant="brand" onClick={pararGravacao}>
                      <Square className="mr-1.5 h-3.5 w-3.5 fill-current" />
                      Parar
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={cancelarGravacao}>
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={iniciarGravacao}
                      disabled={transcreverVoz.isPending}
                    >
                      {transcricao ? <Pencil className="mr-1.5 h-3.5 w-3.5" /> : <Mic className="mr-1.5 h-4 w-4" />}
                      {transcricao ? "Regravar" : "Gravar"}
                    </Button>
                    {transcreverVoz.isPending && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Transcrevendo...
                      </span>
                    )}
                  </div>
                )}
                {erroVoz && <p className="text-xs text-danger-strong">{erroVoz}</p>}
                {transcricao && (
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer select-none">Ver transcrição</summary>
                    <p className="mt-1 whitespace-pre-wrap text-ink/80">{transcricao}</p>
                  </details>
                )}
              </div>

              {/* Sugestões estruturadas da fala (spec 086): nunca entram sozinhas —
          cada item exige clique em "Adicionar", que empurra pro mesmo estado
          que o "+" manual do bloco correspondente já usa. */}
              {sugestoes &&
                (sugestoes.efetivo_por_fornecedor.length > 0 ||
                  sugestoes.impedimentos.length > 0 ||
                  sugestoes.visitas.length > 0 ||
                  sugestoes.tarefas.length > 0) && (
                  <div className="space-y-3 rounded-xl border border-info-mid-border bg-info-soft p-3">
                    <div>
                      <Label className="text-sm">Sugestões da fala</Label>
                      <p className="text-[11px] text-muted-foreground">Revise e adicione o que fizer sentido.</p>
                    </div>

                    {sugestoes.efetivo_por_fornecedor.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Equipes no canteiro
                        </p>
                        {sugestoes.efetivo_por_fornecedor.map((s, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5 text-sm"
                          >
                            <span className="min-w-0 truncate text-ink/90">
                              {s.fornecedor_nome}: {s.quantidade}
                            </span>
                            <div className="flex shrink-0 gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                onClick={() => aceitarSugestaoEfetivo(i)}
                              >
                                Adicionar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                onClick={() => removerSugestao("efetivo_por_fornecedor", i)}
                              >
                                Descartar
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {sugestoes.impedimentos.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Impedimentos
                        </p>
                        {sugestoes.impedimentos.map((s, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5 text-sm"
                          >
                            <span className="min-w-0 truncate text-ink/90">
                              <span className="font-medium">{tipoImpedimentoLabel(s.tipo)}:</span> {s.descricao}
                            </span>
                            <div className="flex shrink-0 gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                onClick={() => aceitarSugestaoImpedimento(i)}
                              >
                                Adicionar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                onClick={() => removerSugestao("impedimentos", i)}
                              >
                                Descartar
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {sugestoes.visitas.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Visitas</p>
                        {sugestoes.visitas.map((s, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5 text-sm"
                          >
                            <span className="min-w-0 truncate text-ink/90">
                              {s.fornecedor_nome}
                              {s.observacao && ` — ${s.observacao}`}
                            </span>
                            <div className="flex shrink-0 gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                onClick={() => aceitarSugestaoVisita(i)}
                              >
                                Adicionar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                onClick={() => removerSugestao("visitas", i)}
                              >
                                Descartar
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {sugestoes.tarefas.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Tarefas do cronograma
                        </p>
                        {sugestoes.tarefas.map((s, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5 text-sm"
                          >
                            <span className="min-w-0 truncate text-ink/90">
                              {tarefaTituloPorId.get(s.tarefa_id) ?? "Tarefa"} —{" "}
                              {RESULTADO_OPCOES.find((r) => r.value === s.resultado)?.label ?? s.resultado}
                            </span>
                            <div className="flex shrink-0 gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                onClick={() => aceitarSugestaoTarefa(i)}
                              >
                                Adicionar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                onClick={() => removerSugestao("tarefas", i)}
                              >
                                Descartar
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

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
                  {frentes.length > 0 && (
                    <Select
                      value={novaTarefa.frenteId || NAO_INFORMADO}
                      onValueChange={(v) => setNovaTarefa((p) => ({ ...p, frenteId: v === NAO_INFORMADO ? "" : v }))}
                    >
                      <SelectTrigger className="h-8 w-full sm:w-40">
                        <SelectValue placeholder="Sem frente" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NAO_INFORMADO}>Sem frente</SelectItem>
                        {frentes.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.nome}
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
                    {criarTarefa.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
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
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
