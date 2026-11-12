import { useEffect, useState } from "react";
import { ExternalLink, Trash2, Video } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { FormDialog } from "@/components/FormDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CHAVE_EVENTOS_AGENDA } from "@/hooks/useGoogleAgenda";
import {
  type DadosReuniao,
  type EventoAgenda,
  OPCOES_AVISO,
  criarReuniao,
  editarReuniao,
  excluirReuniao,
  rotuloAviso,
} from "@/lib/googleAgenda";
import { getSafeErrorMessage } from "@/lib/safeError";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Reunião aberta para ver/editar; null = nova. */
  reuniao: EventoAgenda | null;
  /** Dia em que a nova reunião nasce (YYYY-MM-DD). */
  diaInicial: string;
  /** Aviso padrão da pessoa (Configurações), para o rótulo de "Padrão". */
  avisoPadrao: number | null;
};

const PADRAO = "padrao";
const SEM_AVISO = "-1";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const doisDigitos = (n: number) => String(n).padStart(2, "0");
const diaLocal = (d: Date) => `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;
const horaLocal = (d: Date) => `${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`;

/** Hora cheia seguinte (hoje) ou 09:00 (outro dia). */
function horaSugerida(dia: string): string {
  const agora = new Date();
  if (dia !== diaLocal(agora)) return "09:00";
  return `${doisDigitos(Math.min(agora.getHours() + 1, 23))}:00`;
}

function somarUmaHora(hora: string): string {
  const [h, m] = hora.split(":").map(Number);
  return `${doisDigitos(Math.min(h + 1, 23))}:${doisDigitos(h + 1 > 23 ? 59 : m)}`;
}

/** Dia (YYYY-MM-DD) de um evento de dia inteiro, que a Pilar guarda ao meio-dia UTC. */
const diaDoDiaInteiro = (iso: string) => iso.slice(0, 10);

function diaAnterior(dia: string): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Criar, ver, editar e excluir uma reunião do Google Agenda sem sair da Pilar (SPEC 164).
 * Salvar grava direto no Google (convite por e-mail aos convidados, sala do Meet se pedida).
 */
export function ReuniaoDialog({ open, onOpenChange, reuniao, diaInicial, avisoPadrao }: Props) {
  const queryClient = useQueryClient();
  const editando = !!reuniao;
  const somenteLeitura = !!reuniao && !reuniao.pode_editar;

  const [titulo, setTitulo] = useState("");
  const [diaInteiro, setDiaInteiro] = useState(false);
  const [dia, setDia] = useState(diaInicial);
  const [diaFim, setDiaFim] = useState(diaInicial);
  const [inicio, setInicio] = useState("09:00");
  const [fim, setFim] = useState("10:00");
  const [local, setLocal] = useState("");
  const [convidados, setConvidados] = useState("");
  const [descricao, setDescricao] = useState("");
  const [meet, setMeet] = useState(true);
  const [aviso, setAviso] = useState(PADRAO);
  const [salvando, setSalvando] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  // Abrir o diálogo preenche com a reunião (ou com uma nova no dia escolhido).
  useEffect(() => {
    if (!open) return;
    if (reuniao) {
      const ini = new Date(reuniao.inicio);
      const fi = new Date(reuniao.fim);
      setTitulo(reuniao.titulo);
      setDiaInteiro(reuniao.dia_inteiro);
      setDia(reuniao.dia_inteiro ? diaDoDiaInteiro(reuniao.inicio) : diaLocal(ini));
      // Dia inteiro: o Google guarda o dia seguinte como fim; a tela mostra o último dia.
      setDiaFim(reuniao.dia_inteiro ? diaAnterior(diaDoDiaInteiro(reuniao.fim)) : diaLocal(fi));
      setInicio(horaLocal(ini));
      setFim(horaLocal(fi));
      setLocal(reuniao.local ?? "");
      setConvidados(reuniao.convidados.join(", "));
      setDescricao(reuniao.descricao ?? "");
      setMeet(!!reuniao.link_reuniao);
      setAviso(reuniao.lembrete_minutos === null ? PADRAO : String(reuniao.lembrete_minutos));
      return;
    }
    const hora = horaSugerida(diaInicial);
    setTitulo("");
    setDiaInteiro(false);
    setDia(diaInicial);
    setDiaFim(diaInicial);
    setInicio(hora);
    setFim(somarUmaHora(hora));
    setLocal("");
    setConvidados("");
    setDescricao("");
    setMeet(true);
    setAviso(PADRAO);
  }, [open, reuniao, diaInicial]);

  const listaConvidados = convidados
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const convidadoInvalido = listaConvidados.find((e) => !EMAIL.test(e));

  const salvar = async () => {
    if (somenteLeitura) return;
    if (!titulo.trim()) {
      toast.error("Dê um título para a reunião");
      return;
    }
    if (convidadoInvalido) {
      toast.error("E-mail de convidado inválido", { description: convidadoInvalido });
      return;
    }
    const ini = diaInteiro ? dia : new Date(`${dia}T${inicio}:00`).toISOString();
    const fi = diaInteiro ? diaFim || dia : new Date(`${dia}T${fim}:00`).toISOString();
    if (diaInteiro ? fi < ini : new Date(fi) <= new Date(ini)) {
      toast.error("O fim precisa ser depois do início");
      return;
    }
    const dados: DadosReuniao = {
      titulo: titulo.trim(),
      inicio: ini,
      fim: fi,
      dia_inteiro: diaInteiro,
      local: local.trim() || null,
      descricao: descricao.trim() || null,
      convidados: listaConvidados,
      meet,
      lembrete_minutos: aviso === PADRAO ? null : Number(aviso),
    };
    setSalvando(true);
    try {
      if (reuniao) await editarReuniao(reuniao.id, dados);
      else await criarReuniao(dados);
      await queryClient.invalidateQueries({ queryKey: CHAVE_EVENTOS_AGENDA });
      toast.success(reuniao ? "Reunião atualizada" : "Reunião criada", {
        description: listaConvidados.length ? "Os convidados recebem o convite por e-mail." : undefined,
      });
      onOpenChange(false);
    } catch (e) {
      toast.error(reuniao ? "Não foi possível salvar a reunião" : "Não foi possível criar a reunião", {
        description: getSafeErrorMessage(e, "Tente de novo."),
      });
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async () => {
    if (!reuniao) return;
    setExcluindo(true);
    try {
      await excluirReuniao(reuniao.id);
      await queryClient.invalidateQueries({ queryKey: CHAVE_EVENTOS_AGENDA });
      toast.success("Reunião excluída");
      setConfirmarExclusao(false);
      onOpenChange(false);
    } catch (e) {
      toast.error("Não foi possível excluir a reunião", { description: getSafeErrorMessage(e, "Tente de novo.") });
    } finally {
      setExcluindo(false);
    }
  };

  const abrir = (url: string) => window.open(url, "_blank", "noopener,noreferrer");

  return (
    <>
      <FormDialog
        open={open}
        onOpenChange={onOpenChange}
        title={editando ? (somenteLeitura ? "Reunião" : "Editar reunião") : "Nova reunião"}
        description={
          somenteLeitura
            ? "Você foi convidado. Só quem organiza muda os dados desta reunião."
            : "Salva direto no seu Google Agenda."
        }
        onSubmit={salvar}
        submitLabel={editando ? "Salvar" : "Criar reunião"}
        isPending={salvando}
        submitDisabled={somenteLeitura}
      >
        {reuniao && (reuniao.link_reuniao || reuniao.link_google) && (
          <div className="flex flex-wrap gap-2">
            {reuniao.link_reuniao && (
              <Button type="button" variant="brand" size="sm" onClick={() => abrir(reuniao.link_reuniao!)}>
                <Video className="h-4 w-4" />
                Entrar na reunião
              </Button>
            )}
            {reuniao.link_google && (
              <Button type="button" variant="outline" size="sm" onClick={() => abrir(reuniao.link_google!)}>
                <ExternalLink className="h-4 w-4" />
                Abrir no Google Agenda
              </Button>
            )}
          </div>
        )}

        <fieldset disabled={somenteLeitura} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="reuniao-titulo">Título</Label>
            <Input
              id="reuniao-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Alinhamento do projeto com o cliente"
              maxLength={300}
              autoFocus={!editando}
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch id="reuniao-dia-inteiro" checked={diaInteiro} onCheckedChange={setDiaInteiro} />
            <Label htmlFor="reuniao-dia-inteiro">Dia inteiro</Label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>{diaInteiro ? "De" : "Dia"}</Label>
              <DatePicker value={dia || undefined} onChange={(v) => setDia(v)} />
            </div>
            {diaInteiro ? (
              <div className="space-y-1.5">
                <Label>Até</Label>
                <DatePicker value={diaFim || undefined} onChange={(v) => setDiaFim(v)} />
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="reuniao-inicio">Início</Label>
                  <Input id="reuniao-inicio" type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reuniao-fim">Fim</Label>
                  <Input id="reuniao-fim" type="time" value={fim} onChange={(e) => setFim(e.target.value)} />
                </div>
              </>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reuniao-convidados">Convidados</Label>
            <Input
              id="reuniao-convidados"
              value={convidados}
              onChange={(e) => setConvidados(e.target.value)}
              placeholder="e-mails separados por vírgula"
              aria-invalid={!!convidadoInvalido}
            />
            {convidadoInvalido && <p className="text-xs text-danger-strong">E-mail inválido: {convidadoInvalido}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reuniao-local">Local</Label>
            <Input
              id="reuniao-local"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              placeholder="Escritório, obra ou link"
              maxLength={300}
            />
          </div>

          {!reuniao?.link_reuniao && (
            <div className="flex items-center gap-2">
              <Switch id="reuniao-meet" checked={meet} onCheckedChange={setMeet} />
              <Label htmlFor="reuniao-meet">Criar sala do Google Meet</Label>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Aviso</Label>
            <Select value={aviso} onValueChange={setAviso}>
              <SelectTrigger className="h-9" aria-label="Aviso">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PADRAO}>Padrão ({rotuloAviso(avisoPadrao).toLowerCase()})</SelectItem>
                {OPCOES_AVISO.map((o) => (
                  <SelectItem key={o.valor} value={String(o.valor)}>
                    {o.rotulo}
                  </SelectItem>
                ))}
                <SelectItem value={SEM_AVISO}>Não avisar</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reuniao-descricao">Descrição</Label>
            <Textarea
              id="reuniao-descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Pauta, documentos, observações"
              rows={3}
              maxLength={8000}
            />
          </div>
        </fieldset>

        {reuniao?.pode_editar && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-danger-strong"
            onClick={() => setConfirmarExclusao(true)}
            disabled={salvando}
          >
            <Trash2 className="h-4 w-4" />
            Excluir reunião
          </Button>
        )}
      </FormDialog>

      <ConfirmDialog
        open={confirmarExclusao}
        onOpenChange={setConfirmarExclusao}
        onConfirm={excluir}
        loading={excluindo}
        variant="destructive"
        title="Excluir a reunião?"
        description="Sai do seu Google Agenda e os convidados recebem o cancelamento por e-mail."
        itemName={reuniao?.titulo}
        confirmText="Excluir"
      />
    </>
  );
}
