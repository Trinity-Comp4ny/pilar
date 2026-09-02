import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Camera, Loader2, Plus, Ruler, UserCheck, Users, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { callUntypedRpc } from "@/lib/supabaseRpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CLIMA_OPCOES, TIPO_IMPEDIMENTO_OPCOES, somaEfetivo, type TipoImpedimento } from "@/lib/obras";
import { usePageTitle } from "@/hooks/usePageTitle";
import { getCampoToken } from "./useCampoAuth";
import { filaOfflineDb } from "./campoOfflineDb";
import type {
  FilaDiaPayload,
  FilaEfetivo,
  FilaFoto,
  FilaImpedimento,
  FilaMedicao,
  FilaTarefaVinculo,
  FilaVisita,
} from "./campoOfflineQueue";

interface TarefaCronograma {
  id: string;
  titulo: string;
  status: string;
  frente_nome: string | null;
}

interface FornecedorCampo {
  id: string;
  nome: string;
  cnpj: string | null;
}

const OUTRO = "__outro__";
const NAO_INFORMADO = "__none__";

interface EfetivoLocal {
  fornecedorId: string;
  nomeLivre: string;
  quantidade: string;
}
const efetivoVazio = (): EfetivoLocal => ({ fornecedorId: "", nomeLivre: "", quantidade: "" });

interface ImpedimentoLocal {
  descricao: string;
  tipo: TipoImpedimento;
}
const impedimentoVazio = (): ImpedimentoLocal => ({ descricao: "", tipo: "falta_material" });

interface VisitaLocal {
  fornecedorId: string;
  nomeLivre: string;
  observacao: string;
}
const visitaVazia = (): VisitaLocal => ({ fornecedorId: "", nomeLivre: "", observacao: "" });

type ResultadoTarefa = "avancou" | "concluiu" | "parou";
const RESULTADO_OPCOES: ReadonlyArray<{ value: ResultadoTarefa; label: string }> = [
  { value: "avancou", label: "Avançou" },
  { value: "concluiu", label: "Concluiu" },
  { value: "parou", label: "Parou" },
];
interface SelTarefa {
  resultado: ResultadoTarefa;
  observacao: string;
}

const hoje = () => new Date().toISOString().slice(0, 10);

interface FotoLocal {
  file: File;
  preview: string;
}

interface MedicaoLocal {
  item: string;
  quantidade: string;
  unidade: string;
}
const medicaoVazia = (): MedicaoLocal => ({ item: "", quantidade: "", unidade: "" });

// Comprime a foto no cliente (max 1600px, JPEG 0.8): essencial para subir em 4G
// ruim de canteiro. Devolve base64 puro (sem o prefixo data:) para a edge.
async function comprimir(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const max = 1600;
  const escala = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * escala);
  const h = Math.round(bitmap.height * escala);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), "image/jpeg", 0.8));
  if (!blob) throw new Error("blob");
  return await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res((r.result as string).split(",")[1] ?? "");
    r.onerror = () => rej(new Error("read"));
    r.readAsDataURL(blob);
  });
}

export default function CampoRegistrarDia() {
  usePageTitle("Pilar Campo | Registrar o dia");
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState(hoje());
  const [clima, setClima] = useState<string | null>(null);
  const [efetivo, setEfetivo] = useState("");
  const [atividades, setAtividades] = useState("");
  const [ocorrencias, setOcorrencias] = useState("");
  const [fotos, setFotos] = useState<FotoLocal[]>([]);
  const [medicoes, setMedicoes] = useState<MedicaoLocal[]>([]);
  const [selTarefas, setSelTarefas] = useState<Record<string, SelTarefa>>({});
  const [novaTarefaTitulo, setNovaTarefaTitulo] = useState("");
  const [criandoTarefa, setCriandoTarefa] = useState(false);
  const [tarefasExtras, setTarefasExtras] = useState<TarefaCronograma[]>([]);
  const [saving, setSaving] = useState(false);

  const [efetivos, setEfetivos] = useState<EfetivoLocal[]>([]);
  const [novoEfetivo, setNovoEfetivo] = useState<EfetivoLocal>(efetivoVazio());
  const [impedimentos, setImpedimentos] = useState<ImpedimentoLocal[]>([]);
  const [novoImpedimento, setNovoImpedimento] = useState<ImpedimentoLocal>(impedimentoVazio());
  const [visitas, setVisitas] = useState<VisitaLocal[]>([]);
  const [novaVisita, setNovaVisita] = useState<VisitaLocal>(visitaVazia());

  const { data: fornecedores = [] } = useQuery({
    queryKey: ["campo_fornecedores"],
    queryFn: async (): Promise<FornecedorCampo[]> => {
      const token = getCampoToken();
      if (!token) return [];
      const { data, error } = await callUntypedRpc<{ ok: boolean; fornecedores?: FornecedorCampo[] }>(
        "campo_listar_fornecedores",
        { p_token: token }
      );
      if (error || !data?.ok) return [];
      return data.fornecedores ?? [];
    },
    staleTime: 1000 * 60 * 5,
  });
  const nomeFornecedor = (id: string) => fornecedores.find((f) => f.id === id)?.nome;

  const addEfetivo = () => {
    const usaLivre = novoEfetivo.fornecedorId === OUTRO;
    if (!novoEfetivo.fornecedorId || !novoEfetivo.quantidade.trim()) return;
    if (usaLivre && !novoEfetivo.nomeLivre.trim()) return;
    setEfetivos((prev) => [...prev, novoEfetivo]);
    setNovoEfetivo(efetivoVazio());
  };
  const removerEfetivo = (i: number) => setEfetivos((prev) => prev.filter((_, k) => k !== i));

  const addImpedimento = () => {
    if (!novoImpedimento.descricao.trim()) return;
    setImpedimentos((prev) => [...prev, novoImpedimento]);
    setNovoImpedimento(impedimentoVazio());
  };
  const removerImpedimento = (i: number) => setImpedimentos((prev) => prev.filter((_, k) => k !== i));

  const addVisita = () => {
    const usaLivre = novaVisita.fornecedorId === OUTRO;
    if (!novaVisita.fornecedorId) return;
    if (usaLivre && !novaVisita.nomeLivre.trim()) return;
    setVisitas((prev) => [...prev, novaVisita]);
    setNovaVisita(visitaVazia());
  };
  const removerVisita = (i: number) => setVisitas((prev) => prev.filter((_, k) => k !== i));

  // Cacheada (react-query): se a conexão cair bem na hora de registrar, a lista
  // já buscada continua disponível — só a criação de tarefa nova exige rede.
  const { data: tarefasServidor = [] } = useQuery({
    queryKey: ["campo_tarefas"],
    queryFn: async (): Promise<TarefaCronograma[]> => {
      const token = getCampoToken();
      if (!token) return [];
      const { data, error } = await callUntypedRpc<{ ok: boolean; tarefas?: TarefaCronograma[] }>(
        "campo_listar_tarefas",
        { p_token: token }
      );
      if (error || !data?.ok) return [];
      return data.tarefas ?? [];
    },
    staleTime: 1000 * 60 * 5,
  });
  const tarefas = [...tarefasServidor, ...tarefasExtras];

  const addFotos = (files: FileList | null) => {
    if (!files) return;
    const novas = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .map((file) => ({ file, preview: URL.createObjectURL(file) }));
    setFotos((prev) => [...prev, ...novas]);
  };
  const removerFoto = (i: number) => {
    setFotos((prev) => {
      URL.revokeObjectURL(prev[i].preview);
      return prev.filter((_, k) => k !== i);
    });
  };

  const addMedicao = () => setMedicoes((prev) => [...prev, medicaoVazia()]);
  const removerMedicao = (i: number) => setMedicoes((prev) => prev.filter((_, k) => k !== i));
  const setMedicaoCampo = (i: number, campo: keyof MedicaoLocal, valor: string) =>
    setMedicoes((prev) => prev.map((m, k) => (k === i ? { ...m, [campo]: valor } : m)));

  const toggleTarefa = (id: string) => {
    setSelTarefas((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = { resultado: "avancou", observacao: "" };
      return next;
    });
  };
  const setResultadoTarefa = (id: string, resultado: ResultadoTarefa) =>
    setSelTarefas((prev) => ({ ...prev, [id]: { ...prev[id], resultado } }));
  const setObsTarefa = (id: string, observacao: string) =>
    setSelTarefas((prev) => ({ ...prev, [id]: { ...prev[id], observacao } }));

  // Criar tarefa exige rede: precisa do id real do servidor pra já poder ser
  // vinculada no mesmo envio (ver nota em campoOfflineQueue.ts sobre porquê a
  // fila offline não cobre este caso).
  const criarTarefa = async () => {
    const titulo = novaTarefaTitulo.trim();
    if (!titulo) return;
    const token = getCampoToken();
    if (!token || !navigator.onLine) {
      toast.error("Precisa de internet para criar uma tarefa nova", {
        description: "Sem sinal, marque uma tarefa que já existe.",
      });
      return;
    }
    setCriandoTarefa(true);
    try {
      const { data, error } = await callUntypedRpc<{ ok: boolean; tarefa_id?: string; erro?: string }>(
        "campo_criar_tarefa",
        { p_token: token, p_titulo: titulo }
      );
      if (error || !data?.ok || !data.tarefa_id) {
        toast.error("Não foi possível criar a tarefa", { description: data?.erro ?? "Tente de novo" });
        return;
      }
      setTarefasExtras((prev) => [...prev, { id: data.tarefa_id!, titulo, status: "a_fazer", frente_nome: null }]);
      setSelTarefas((prev) => ({ ...prev, [data.tarefa_id!]: { resultado: "avancou", observacao: "" } }));
      setNovaTarefaTitulo("");
    } finally {
      setCriandoTarefa(false);
    }
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getCampoToken();
    if (!token) {
      navigate("/campo/login", { replace: true });
      return;
    }

    // efetivo (total) é derivado da soma das linhas por fornecedor quando há
    // alguma lançada; sem nenhuma linha, continua o número solto (spec 062).
    const efetivoDerivado = somaEfetivo(efetivos.map((ef) => ({ quantidade: Number(ef.quantidade) || 0 })));
    const dia: FilaDiaPayload = {
      p_data: data,
      p_clima: clima,
      p_condicao: null,
      p_efetivo: efetivoDerivado ?? (efetivo.trim() === "" ? null : Number(efetivo)),
      p_atividades: atividades,
      p_ocorrencias: ocorrencias,
      p_pendencias: null,
    };

    // Só medições com item e quantidade válida entram; linha em branco é
    // deixada de lado em silêncio (o usuário só clicou "+" e não preencheu).
    const medicoesValidas: FilaMedicao[] = medicoes
      .filter((m) => m.item.trim() !== "" && m.quantidade.trim() !== "" && m.unidade.trim() !== "")
      .map((m) => ({
        item: m.item.trim(),
        quantidade: Number(m.quantidade),
        unidade: m.unidade.trim(),
        enviada: false,
      }));

    const tarefasSelecionadas: FilaTarefaVinculo[] = Object.entries(selTarefas).map(([tarefaId, s]) => ({
      tarefaId,
      resultado: s.resultado,
      observacao: s.observacao.trim(),
      enviada: false,
    }));

    const efetivosValidos: FilaEfetivo[] = efetivos.map((ef) => ({
      fornecedorId: ef.fornecedorId === OUTRO ? null : ef.fornecedorId,
      fornecedorNome: ef.fornecedorId === OUTRO ? ef.nomeLivre.trim() : null,
      quantidade: Number(ef.quantidade),
      enviada: false,
    }));
    const impedimentosValidos: FilaImpedimento[] = impedimentos.map((i) => ({
      descricao: i.descricao.trim(),
      tipo: i.tipo,
      enviada: false,
    }));
    const visitasValidas: FilaVisita[] = visitas.map((v) => ({
      fornecedorId: v.fornecedorId === OUTRO ? null : v.fornecedorId,
      fornecedorNome: v.fornecedorId === OUTRO ? v.nomeLivre.trim() : null,
      observacao: v.observacao.trim() || null,
      enviada: false,
    }));

    // Comprime antes de decidir online/offline: o arquivo original some quando
    // sair da tela, então a versão a subir precisa estar pronta nos dois casos.
    let fotosComprimidas: FilaFoto[] = [];
    setSaving(true);
    try {
      fotosComprimidas = await Promise.all(
        fotos.map(async (f) => ({ contentType: "image/jpeg", imageBase64: await comprimir(f.file), enviada: false }))
      );

      if (!navigator.onLine) {
        await enfileirarOffline({
          dia,
          fotos: fotosComprimidas,
          medicoes: medicoesValidas,
          tarefas: tarefasSelecionadas,
          efetivos: efetivosValidos,
          impedimentos: impedimentosValidos,
          visitas: visitasValidas,
        });
        toast.success("Sem conexão agora", {
          description: "Salvo no aparelho. Envia sozinho quando a internet voltar.",
        });
        navigate("/campo", { replace: true });
        return;
      }

      const { data: res, error } = await callUntypedRpc<{ ok: boolean; erro?: string; rdo_id?: string }>(
        "campo_salvar_rdo",
        { p_token: token, ...dia }
      );
      if (error) throw error;
      if (!res?.ok || !res.rdo_id) {
        toast.error("Não foi possível registrar", { description: res?.erro ?? "Tente de novo" });
        return;
      }

      // Sobe as fotos comprimidas. Falha parcial não perde o dia nem reenvia o
      // que já subiu: o que falhar fica na fila (com o rdo_id já criado).
      const fotosAtualizadas = [...fotosComprimidas];
      let falhas = 0;
      for (let i = 0; i < fotosAtualizadas.length; i++) {
        const { data: up, error: upErr } = await supabase.functions.invoke("campo-upload-foto", {
          body: {
            token,
            rdo_id: res.rdo_id,
            image_base64: fotosAtualizadas[i].imageBase64,
            content_type: fotosAtualizadas[i].contentType,
          },
        });
        if (!upErr && (up as { success?: boolean } | null)?.success) {
          fotosAtualizadas[i] = { ...fotosAtualizadas[i], enviada: true };
        } else {
          falhas++;
        }
      }

      const medicoesAtualizadas = [...medicoesValidas];
      for (let i = 0; i < medicoesAtualizadas.length; i++) {
        const { data: mRes, error: mErr } = await callUntypedRpc<{ ok: boolean }>("campo_registrar_medicao", {
          p_token: token,
          p_rdo_id: res.rdo_id,
          p_item: medicoesAtualizadas[i].item,
          p_quantidade: medicoesAtualizadas[i].quantidade,
          p_unidade: medicoesAtualizadas[i].unidade,
        });
        if (!mErr && mRes?.ok) {
          medicoesAtualizadas[i] = { ...medicoesAtualizadas[i], enviada: true };
        } else {
          falhas++;
        }
      }

      const tarefasAtualizadas = [...tarefasSelecionadas];
      for (let i = 0; i < tarefasAtualizadas.length; i++) {
        const { data: tRes, error: tErr } = await callUntypedRpc<{ ok: boolean }>("campo_registrar_tarefa_rdo", {
          p_token: token,
          p_rdo_id: res.rdo_id,
          p_tarefa_id: tarefasAtualizadas[i].tarefaId,
          p_resultado: tarefasAtualizadas[i].resultado,
          p_observacao: tarefasAtualizadas[i].observacao,
        });
        if (!tErr && tRes?.ok) {
          tarefasAtualizadas[i] = { ...tarefasAtualizadas[i], enviada: true };
        } else {
          falhas++;
        }
      }

      const efetivosAtualizados = [...efetivosValidos];
      for (let i = 0; i < efetivosAtualizados.length; i++) {
        const { data: eRes, error: eErr } = await callUntypedRpc<{ ok: boolean }>("campo_registrar_efetivo", {
          p_token: token,
          p_rdo_id: res.rdo_id,
          p_fornecedor_id: efetivosAtualizados[i].fornecedorId,
          p_fornecedor_nome: efetivosAtualizados[i].fornecedorNome,
          p_quantidade: efetivosAtualizados[i].quantidade,
        });
        if (!eErr && eRes?.ok) {
          efetivosAtualizados[i] = { ...efetivosAtualizados[i], enviada: true };
        } else {
          falhas++;
        }
      }

      const impedimentosAtualizados = [...impedimentosValidos];
      for (let i = 0; i < impedimentosAtualizados.length; i++) {
        const { data: iRes, error: iErr } = await callUntypedRpc<{ ok: boolean }>("campo_registrar_impedimento", {
          p_token: token,
          p_rdo_id: res.rdo_id,
          p_descricao: impedimentosAtualizados[i].descricao,
          p_tipo: impedimentosAtualizados[i].tipo,
        });
        if (!iErr && iRes?.ok) {
          impedimentosAtualizados[i] = { ...impedimentosAtualizados[i], enviada: true };
        } else {
          falhas++;
        }
      }

      const visitasAtualizadas = [...visitasValidas];
      for (let i = 0; i < visitasAtualizadas.length; i++) {
        const { data: vRes, error: vErr } = await callUntypedRpc<{ ok: boolean }>("campo_registrar_visita", {
          p_token: token,
          p_rdo_id: res.rdo_id,
          p_fornecedor_id: visitasAtualizadas[i].fornecedorId,
          p_fornecedor_nome: visitasAtualizadas[i].fornecedorNome,
          p_observacao: visitasAtualizadas[i].observacao,
        });
        if (!vErr && vRes?.ok) {
          visitasAtualizadas[i] = { ...visitasAtualizadas[i], enviada: true };
        } else {
          falhas++;
        }
      }

      if (falhas > 0) {
        await enfileirarOffline({
          dia,
          fotos: fotosAtualizadas,
          medicoes: medicoesAtualizadas,
          tarefas: tarefasAtualizadas,
          efetivos: efetivosAtualizados,
          impedimentos: impedimentosAtualizados,
          visitas: visitasAtualizadas,
          rdoId: res.rdo_id,
        });
        toast.warning(`Dia salvo, mas ${falhas} item${falhas > 1 ? "ns" : ""} não subiu`, {
          description: "Vamos tentar de novo automaticamente.",
        });
      } else {
        toast.success("Dia registrado");
      }
      navigate("/campo", { replace: true });
    } catch {
      // Falha de rede no meio do caminho: não perde o que foi preenchido.
      await enfileirarOffline({
        dia,
        fotos: fotosComprimidas,
        medicoes: medicoesValidas,
        tarefas: tarefasSelecionadas,
        efetivos: efetivosValidos,
        impedimentos: impedimentosValidos,
        visitas: visitasValidas,
      });
      toast.success("Sem conexão agora", {
        description: "Salvo no aparelho. Envia sozinho quando a internet voltar.",
      });
      navigate("/campo", { replace: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="flex items-center gap-2 border-b border-black/5 px-4 py-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/campo")} aria-label="Voltar">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <span className="font-semibold text-ink">Registrar o dia</span>
      </header>

      <form onSubmit={salvar} className="mx-auto max-w-md space-y-5 px-5 py-6">
        <div className="space-y-1.5">
          <Label htmlFor="data">Data</Label>
          <Input
            id="data"
            type="date"
            max={hoje()}
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="h-12 text-base"
          />
        </div>

        <div className="space-y-2">
          <Label>Clima</Label>
          <div className="grid grid-cols-2 gap-2">
            {CLIMA_OPCOES.map((c) => {
              const ativo = clima === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setClima(ativo ? null : c.value)}
                  className={cn(
                    "h-11 rounded-xl border text-sm font-medium transition-colors",
                    ativo ? "border-brand bg-brand text-ink" : "border-black/10 bg-muted/40 text-ink"
                  )}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="efetivo">Quantas pessoas trabalharam</Label>
          <Input
            id="efetivo"
            type="number"
            inputMode="numeric"
            min={0}
            disabled={efetivos.length > 0}
            value={
              efetivos.length > 0
                ? String(somaEfetivo(efetivos.map((ef) => ({ quantidade: Number(ef.quantidade) || 0 }))))
                : efetivo
            }
            onChange={(e) => setEfetivo(e.target.value)}
            placeholder="Ex: 8"
            className="h-12 text-base"
          />
          {efetivos.length > 0 && (
            <p className="text-xs text-muted-foreground">Somado a partir do efetivo por fornecedor abaixo.</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="atividades">O que foi feito hoje</Label>
          <Textarea
            id="atividades"
            rows={4}
            value={atividades}
            onChange={(e) => setAtividades(e.target.value)}
            placeholder="Ex: concretagem da laje, alvenaria do 2º pavimento…"
            className="text-base"
          />
        </div>

        <div className="space-y-2 rounded-xl border border-black/5 p-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Tarefas do cronograma</Label>
            <span className="text-[11px] text-muted-foreground">Marque o que andou</span>
          </div>

          {tarefas.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma tarefa no cronograma ainda. Crie a primeira abaixo.</p>
          ) : (
            <div className="max-h-56 space-y-1.5 overflow-y-auto">
              {tarefas.map((t) => {
                const marcada = !!selTarefas[t.id];
                return (
                  <div key={t.id} className="rounded-lg bg-muted/40 px-2.5 py-2">
                    <div className="flex items-start gap-2">
                      <Checkbox
                        id={`ct-${t.id}`}
                        checked={marcada}
                        onCheckedChange={() => toggleTarefa(t.id)}
                        className="mt-0.5"
                      />
                      <label htmlFor={`ct-${t.id}`} className="min-w-0 flex-1 cursor-pointer">
                        <span className="block truncate text-sm text-ink">{t.titulo}</span>
                        {t.frente_nome && (
                          <span className="block text-[11px] text-muted-foreground">{t.frente_nome}</span>
                        )}
                      </label>
                    </div>
                    {marcada && (
                      <div className="mt-2 flex flex-col gap-2 pl-6">
                        <Select
                          value={selTarefas[t.id].resultado}
                          onValueChange={(v) => setResultadoTarefa(t.id, v as ResultadoTarefa)}
                        >
                          <SelectTrigger className="h-9 w-full">
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
                          className="h-9"
                          placeholder="O que foi feito (opcional)"
                          value={selTarefas[t.id].observacao}
                          onChange={(e) => setObsTarefa(t.id, e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-2 border-t border-black/5 pt-2">
            <Input
              className="h-9 flex-1"
              placeholder="Nova tarefa (ex: concretar laje)"
              value={novaTarefaTitulo}
              onChange={(e) => setNovaTarefaTitulo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  criarTarefa();
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={criarTarefa}
              disabled={!novaTarefaTitulo.trim() || criandoTarefa}
              aria-label="Criar tarefa"
            >
              {criandoTarefa ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-black/5 p-3">
          <Label className="inline-flex items-center gap-1.5 text-sm">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            Efetivo por fornecedor
          </Label>
          {efetivos.map((ef, i) => (
            <div key={i} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-2.5 py-2 text-sm">
              <span className="min-w-0 truncate text-ink">
                {ef.fornecedorId === OUTRO ? ef.nomeLivre : (nomeFornecedor(ef.fornecedorId) ?? "Sem nome")}:{" "}
                {ef.quantidade}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => removerEfetivo(i)}
                aria-label="Remover"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <div className="flex flex-col gap-2">
            <Select
              value={novoEfetivo.fornecedorId || NAO_INFORMADO}
              onValueChange={(v) => setNovoEfetivo((p) => ({ ...p, fornecedorId: v === NAO_INFORMADO ? "" : v }))}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Fornecedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NAO_INFORMADO}>Selecione</SelectItem>
                {fornecedores.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nome}
                  </SelectItem>
                ))}
                <SelectItem value={OUTRO}>Outro (digitar nome)</SelectItem>
              </SelectContent>
            </Select>
            {novoEfetivo.fornecedorId === OUTRO && (
              <Input
                className="h-10 text-sm"
                placeholder="Nome do prestador"
                value={novoEfetivo.nomeLivre}
                onChange={(e) => setNovoEfetivo((p) => ({ ...p, nomeLivre: e.target.value }))}
              />
            )}
            <div className="flex items-center gap-2">
              <Input
                type="text"
                inputMode="numeric"
                className="h-10 flex-1 text-sm"
                placeholder="Quantas pessoas"
                value={novoEfetivo.quantidade}
                onChange={(e) => setNovoEfetivo((p) => ({ ...p, quantidade: e.target.value }))}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={addEfetivo}
                disabled={!novoEfetivo.fornecedorId || !novoEfetivo.quantidade.trim()}
                aria-label="Adicionar"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Fotos do serviço</Label>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(e) => {
              addFotos(e.target.files);
              e.target.value = "";
            }}
          />
          <div className="grid grid-cols-3 gap-2">
            {fotos.map((f, i) => (
              <div key={i} className="relative aspect-square overflow-hidden rounded-xl bg-muted">
                <img src={f.preview} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removerFoto(i)}
                  aria-label="Remover foto"
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-black/15 bg-muted/40 text-muted-foreground"
            >
              <Camera className="h-6 w-6" />
              <span className="text-[11px]">Foto</span>
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Medição (opcional)</Label>
            <span className="text-[11px] text-muted-foreground">Ex: concreto, tijolo, área de reboco</span>
          </div>
          {medicoes.map((m, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={m.item}
                onChange={(e) => setMedicaoCampo(i, "item", e.target.value)}
                placeholder="Item"
                className="h-10 flex-[2] text-sm"
              />
              <Input
                type="text"
                inputMode="decimal"
                value={m.quantidade}
                onChange={(e) => setMedicaoCampo(i, "quantidade", e.target.value.replace(",", "."))}
                placeholder="Qtd"
                className="h-10 flex-1 text-sm"
              />
              <Input
                value={m.unidade}
                onChange={(e) => setMedicaoCampo(i, "unidade", e.target.value)}
                placeholder="Un."
                className="h-10 w-16 text-sm"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={() => removerMedicao(i)}
                aria-label="Remover medição"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="w-full" onClick={addMedicao}>
            <Ruler className="mr-1.5 h-4 w-4" />
            Adicionar medição
          </Button>
        </div>

        <div className="space-y-2 rounded-xl border border-warning-mid-border bg-warning-soft p-3">
          <Label className="inline-flex items-center gap-1.5 text-sm text-warning-strong">
            <AlertTriangle className="h-3.5 w-3.5" />
            Impedimentos
          </Label>
          {impedimentos.map((imp, i) => (
            <div key={i} className="flex items-start justify-between gap-2 rounded-lg bg-white/60 px-2.5 py-2 text-sm">
              <span className="min-w-0 text-ink">
                <span className="font-medium">{TIPO_IMPEDIMENTO_OPCOES.find((o) => o.value === imp.tipo)?.label}:</span>{" "}
                {imp.descricao}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => removerImpedimento(i)}
                aria-label="Remover"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <div className="flex flex-col gap-2">
            <Select
              value={novoImpedimento.tipo}
              onValueChange={(v) => setNovoImpedimento((p) => ({ ...p, tipo: v as TipoImpedimento }))}
            >
              <SelectTrigger className="h-10">
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
            <div className="flex items-center gap-2">
              <Input
                className="h-10 flex-1 text-sm"
                placeholder="O que travou (ex: falta de cimento)"
                value={novoImpedimento.descricao}
                onChange={(e) => setNovoImpedimento((p) => ({ ...p, descricao: e.target.value }))}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={addImpedimento}
                disabled={!novoImpedimento.descricao.trim()}
                aria-label="Adicionar"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-black/5 p-3">
          <Label className="inline-flex items-center gap-1.5 text-sm">
            <UserCheck className="h-3.5 w-3.5 text-muted-foreground" />
            Visitas
          </Label>
          {visitas.map((v, i) => (
            <div key={i} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-2.5 py-2 text-sm">
              <span className="min-w-0 truncate text-ink">
                {v.fornecedorId === OUTRO ? v.nomeLivre : (nomeFornecedor(v.fornecedorId) ?? "Sem nome")}
                {v.observacao && <span className="text-muted-foreground"> — {v.observacao}</span>}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => removerVisita(i)}
                aria-label="Remover"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <div className="flex flex-col gap-2">
            <Select
              value={novaVisita.fornecedorId || NAO_INFORMADO}
              onValueChange={(v) => setNovaVisita((p) => ({ ...p, fornecedorId: v === NAO_INFORMADO ? "" : v }))}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Visitante" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NAO_INFORMADO}>Selecione</SelectItem>
                {fornecedores.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nome}
                  </SelectItem>
                ))}
                <SelectItem value={OUTRO}>Outro (digitar nome)</SelectItem>
              </SelectContent>
            </Select>
            {novaVisita.fornecedorId === OUTRO && (
              <Input
                className="h-10 text-sm"
                placeholder="Nome do visitante"
                value={novaVisita.nomeLivre}
                onChange={(e) => setNovaVisita((p) => ({ ...p, nomeLivre: e.target.value }))}
              />
            )}
            <div className="flex items-center gap-2">
              <Input
                className="h-10 flex-1 text-sm"
                placeholder="Motivo (opcional)"
                value={novaVisita.observacao}
                onChange={(e) => setNovaVisita((p) => ({ ...p, observacao: e.target.value }))}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={addVisita}
                disabled={!novaVisita.fornecedorId}
                aria-label="Adicionar"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ocorrencias">Ocorrências (opcional)</Label>
          <Textarea
            id="ocorrencias"
            rows={2}
            value={ocorrencias}
            onChange={(e) => setOcorrencias(e.target.value)}
            placeholder="Chuva, falta de material, acidente…"
            className="text-base"
          />
        </div>

        <Button type="submit" variant="brand" className="h-12 w-full text-base" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
          Salvar o dia
        </Button>
      </form>
    </div>
  );
}

/** Grava o dia na fila offline (IndexedDB) para o `useCampoSync` reenviar depois. */
async function enfileirarOffline(args: {
  dia: FilaDiaPayload;
  fotos: FilaFoto[];
  medicoes?: FilaMedicao[];
  tarefas?: FilaTarefaVinculo[];
  efetivos?: FilaEfetivo[];
  impedimentos?: FilaImpedimento[];
  visitas?: FilaVisita[];
  rdoId?: string;
}): Promise<void> {
  await filaOfflineDb.salvar({
    id: crypto.randomUUID(),
    criadoEm: Date.now(),
    dia: args.dia,
    fotos: args.fotos,
    medicoes: args.medicoes ?? [],
    tarefas: args.tarefas ?? [],
    efetivos: args.efetivos ?? [],
    impedimentos: args.impedimentos ?? [],
    visitas: args.visitas ?? [],
    rdoId: args.rdoId,
    tentativas: 0,
  });
}
