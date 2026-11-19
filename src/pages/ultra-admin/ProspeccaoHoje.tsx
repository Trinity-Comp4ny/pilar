import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { KPICard } from "@/components/KPICard";
import { EmptyState } from "@/components/EmptyState";
import { PageLoader } from "@/components/motion/PageLoader";
import {
  LIMITE_DIARIO,
  useFilaHoje,
  useMontarFila,
  useRegistrarEnvio,
  useResumo,
  type ProspecLead,
  type ResultadoEnvio,
} from "./prospeccaoApi";
import { formatarTelefone, linkWhatsapp, montarContato, SEGMENTOS } from "./prospeccaoLib";

/** Card de um lead da fila: texto pronto e editável, link do WhatsApp e o registro do que aconteceu. */
export function CardEnvio({ lead }: { lead: ProspecLead }) {
  const registrar = useRegistrarEnvio();
  const [nome, setNome] = useState(lead.contato_nome ?? "");
  const [editado, setEditado] = useState<string | null>(null);
  const [abriu, setAbriu] = useState(false);

  const gerado = useMemo(
    () =>
      montarContato({
        ...lead,
        contato_nome: nome.trim() || null,
        confianca_contato: nome.trim() ? "pessoa" : lead.confianca_contato,
      }).texto,
    [lead, nome]
  );
  const texto = editado ?? gerado;
  const segmento = SEGMENTOS[lead.segmento];

  const abrir = () => {
    if (!lead.telefone_e164) return;
    window.open(linkWhatsapp(lead.telefone_e164, texto), "_blank", "noopener");
    setAbriu(true);
  };

  const registrarResultado = (resultado: ResultadoEnvio, aviso: string) =>
    registrar.mutate(
      {
        leadId: lead.id,
        resultado,
        canal: "whatsapp",
        texto: resultado === "enviei" ? texto : undefined,
        contatoNome: nome.trim() || undefined,
      },
      { onSuccess: () => toast.success(aviso), onError: (e: Error) => toast.error(e.message) }
    );

  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{lead.nome}</p>
          <p className="text-sm text-ink-muted">
            {lead.cidade ?? "Cidade não informada"} · {formatarTelefone(lead.telefone_e164)}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="neutral">{segmento?.rotulo ?? lead.segmento}</Badge>
          {lead.segmento_teste && <Badge variant="info">Teste</Badge>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`nome-${lead.id}`}>Nome de quem atende (se souber)</Label>
        <Input
          id={`nome-${lead.id}`}
          value={nome}
          onChange={(e) => {
            setNome(e.target.value);
            setEditado(null);
          }}
          placeholder="Vazio: a mensagem pergunta quem decide"
          maxLength={120}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`texto-${lead.id}`}>Mensagem</Label>
        <Textarea id={`texto-${lead.id}`} value={texto} onChange={(e) => setEditado(e.target.value)} rows={7} />
      </div>

      {!abriu ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="brand" className="sm:flex-1" onClick={abrir} disabled={!lead.telefone_e164 || !texto.trim()}>
            <MessageCircle className="mr-2 h-4 w-4" /> Abrir no WhatsApp
          </Button>
          <Button
            variant="outline"
            loading={registrar.isPending}
            onClick={() => registrarResultado("pulei", "Lead voltou para a lista.")}
          >
            Pular
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-medium">Enviou?</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              variant="brand"
              loading={registrar.isPending}
              onClick={() => registrarResultado("enviei", "Registrado como enviado.")}
            >
              Enviei
            </Button>
            <Button
              variant="outline"
              disabled={registrar.isPending}
              onClick={() => registrarResultado("numero_errado", "Número marcado como errado.")}
            >
              Número errado
            </Button>
            <Button
              variant="outline"
              disabled={registrar.isPending}
              onClick={() => registrarResultado("parar", "Contato bloqueado para sempre.")}
            >
              Pediu para parar
            </Button>
            <Button variant="ghost" disabled={registrar.isPending} onClick={() => setAbriu(false)}>
              Voltar
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

/** Aba Hoje: meta do dia, aviso de risco e a fila de cards. */
export function ProspeccaoHoje() {
  const fila = useFilaHoje();
  const resumo = useResumo();
  const montar = useMontarFila();

  const r = resumo.data;
  const emRisco = (r?.bloqueiosSemana ?? 0) >= 2;

  const montarFila = () =>
    montar.mutate(LIMITE_DIARIO, {
      onSuccess: (total) =>
        toast.success(total > 0 ? `${total} lead(s) na fila de hoje.` : "Nenhum lead novo de WhatsApp disponível."),
      onError: (e: Error) => toast.error(e.message),
    });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard
          label="Enviadas hoje"
          value={`${r?.enviadosHoje ?? 0} de ${LIMITE_DIARIO}`}
          loading={resumo.isPending}
        />
        <KPICard label="Na fila" value={String(r?.naFila ?? 0)} loading={resumo.isPending} />
        <KPICard label="Prontos para WhatsApp" value={String(r?.novosProntos ?? 0)} loading={resumo.isPending} />
        <KPICard
          label="Bloqueios na semana"
          value={String(r?.bloqueiosSemana ?? 0)}
          tone={emRisco ? "danger" : undefined}
          loading={resumo.isPending}
        />
      </div>

      {emRisco && (
        <div role="alert" className="flex items-start gap-2 rounded-md bg-warning-soft p-3 text-sm text-warning-strong">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {r?.bloqueiosSemana} pedidos para parar ou números errados nos últimos 7 dias. Revise a mensagem e considere
            pausar antes de continuar: número que recebe denúncia pode ser restringido.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-muted">
          A fila completa até {LIMITE_DIARIO} por dia, ICP primeiro. Quem envia é você, pelo WhatsApp.
        </p>
        <Button variant="brand" size="sm" loading={montar.isPending} onClick={montarFila}>
          Montar fila de hoje
        </Button>
      </div>

      {fila.isPending ? (
        <PageLoader />
      ) : (fila.data ?? []).length === 0 ? (
        <EmptyState title="Fila vazia" description="Importe a base e monte a fila de hoje para ver os cards prontos." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {(fila.data ?? []).map((lead) => (
            <CardEnvio key={lead.id} lead={lead} />
          ))}
        </div>
      )}
    </div>
  );
}
