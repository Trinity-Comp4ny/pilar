import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { FormDialog } from "@/components/FormDialog";
import { PageLoader } from "@/components/motion/PageLoader";

export interface LinhaSincronizacao {
  id: string;
  nome: string;
  /** O que entraria ("2 serviços e 3 tarefas") ou por que não há nada a fazer. */
  resumo: string;
  temAlgo: boolean;
}

/**
 * "Atualizar o que já existe?": aparece depois de salvar uma mudança num fluxo (projeto ou obra) e lista quem
 * segue esse fluxo, com o que entraria em cada um. Só acrescenta o que falta; o que já está lá não muda.
 */
export function SincronizarFluxoDialog({
  open,
  onOpenChange,
  tipo,
  nomeFluxo,
  carregando,
  linhas,
  pending,
  onConfirmar,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tipo: "obras" | "projetos";
  nomeFluxo: string;
  carregando: boolean;
  linhas: LinhaSincronizacao[];
  pending: boolean;
  onConfirmar: (ids: string[]) => void;
}) {
  const [desmarcadas, setDesmarcadas] = useState<Set<string>>(new Set());
  const marcadas = linhas.filter((l) => l.temAlgo && !desmarcadas.has(l.id));
  const comAlgo = linhas.filter((l) => l.temAlgo).length;

  const alternar = (id: string) =>
    setDesmarcadas((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Atualizar ${tipo} que usam este fluxo?`}
      description={`Você mudou o fluxo "${nomeFluxo}". Só entra o que falta: o que já está ${tipo === "obras" ? "nas obras" : "nos projetos"} (datas, andamento e edições) não muda.`}
      size="md"
      submitLabel={marcadas.length > 0 ? `Atualizar ${marcadas.length}` : "Atualizar"}
      cancelLabel="Agora não"
      onSubmit={() => onConfirmar(marcadas.map((l) => l.id))}
      isPending={pending}
      submitDisabled={carregando || marcadas.length === 0}
    >
      {carregando ? (
        <PageLoader label={`Conferindo ${tipo}`} />
      ) : linhas.length === 0 ? (
        <p className="rounded-xl bg-muted/60 px-3 py-3 text-sm text-muted-foreground">
          {tipo === "obras" ? "Nenhuma obra segue" : "Nenhum projeto segue"} este fluxo ainda.{" "}
          {tipo === "obras"
            ? "Obras criadas com ele, ou onde você o aplicar daqui para frente,"
            : "Projetos criados com ele, ou onde você o aplicar daqui para frente,"}{" "}
          passam a ser atualizados.
        </p>
      ) : (
        <div className="space-y-2">
          {comAlgo === 0 && (
            <p className="text-sm text-muted-foreground">
              {linhas.length === 1 ? "O único" : `Os ${linhas.length}`} que seguem este fluxo já estão em dia.
            </p>
          )}
          <ul className="divide-y divide-black/5">
            {linhas.map((l) => (
              <li key={l.id} className="flex items-center gap-3 py-2.5">
                <Checkbox
                  checked={l.temAlgo && !desmarcadas.has(l.id)}
                  disabled={!l.temAlgo}
                  onCheckedChange={() => alternar(l.id)}
                  aria-label={`Atualizar ${l.nome}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{l.nome}</p>
                  <p className="text-xs text-muted-foreground">{l.resumo}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </FormDialog>
  );
}
