import { useState } from "react";
import { toast } from "sonner";
import { FormDialog } from "@/components/FormDialog";
import { EscolhaChips } from "@/components/forms/EscolhaChips";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ORIGENS_CONTATO } from "./cerebroLib";
import { useAnalisarReuniao } from "./reunioesApi";

const OPCOES_ORIGEM = Object.entries(ORIGENS_CONTATO).map(([value, label]) => ({ value, label }));

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAnalisada: (reuniaoId: string) => void;
}

/** Cola a transcrição de uma reunião e pede a análise (SPEC 169). Só o texto redigido é gravado. */
export function NovaReuniaoDialog({ open, onOpenChange, onAnalisada }: Props) {
  const analisar = useAnalisarReuniao();
  const [titulo, setTitulo] = useState("");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [origem, setOrigem] = useState<string | null>(null);
  const [escritorio, setEscritorio] = useState("");
  const [texto, setTexto] = useState("");

  const pronto = titulo.trim() && data && origem && texto.trim();

  const enviar = () => {
    if (!pronto || !origem) return;
    analisar.mutate(
      {
        titulo: titulo.trim(),
        ocorreu_em: `${data}T12:00:00-03:00`,
        origem_nome: escritorio.trim() || undefined,
        origem_contato: origem,
        transcript: texto,
      },
      {
        onSuccess: (r) => {
          toast.success(
            r.descartados_sem_citacao > 0
              ? `Reunião analisada. ${r.descartados_sem_citacao} achado(s) sem citação no texto foram descartados.`
              : "Reunião analisada."
          );
          setTitulo("");
          setEscritorio("");
          setTexto("");
          setOrigem(null);
          onOpenChange(false);
          onAnalisada(r.reuniao_id);
        },
        onError: (e: Error) => toast.error(e.message),
      }
    );
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Nova reunião"
      description="Cole a transcrição. E-mail, telefone, CPF, CNPJ, senha e valores são removidos antes de gravar."
      size="lg"
      onSubmit={enviar}
      submitLabel="Analisar"
      isPending={analisar.isPending}
      submitDisabled={!pronto}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="reuniao-titulo">Título</Label>
          <Input id="reuniao-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={200} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reuniao-data">Data</Label>
          <Input id="reuniao-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="reuniao-escritorio">Escritório ou pessoa (opcional)</Label>
        <Input
          id="reuniao-escritorio"
          value={escritorio}
          onChange={(e) => setEscritorio(e.target.value)}
          maxLength={200}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Como esse contato chegou</Label>
        <EscolhaChips ariaLabel="Como esse contato chegou" opcoes={OPCOES_ORIGEM} value={origem} onChange={setOrigem} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="reuniao-texto">Transcrição</Label>
        <Textarea
          id="reuniao-texto"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={10}
          placeholder="Cole aqui o texto da reunião"
        />
      </div>
    </FormDialog>
  );
}
