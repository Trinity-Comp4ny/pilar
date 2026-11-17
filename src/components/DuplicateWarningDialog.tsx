import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDateDisplay } from "@/lib/dateUtils";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ConfiancaDuplicata, DuplicateMatch } from "@/lib/duplicateCheck";

/** O que o usuário está tentando gravar, para comparar lado a lado com o existente. */
interface LancamentoNovoResumo {
  descricao: string;
  valor: number;
  data: Date;
  contraparte?: string | null;
  notaFiscal?: string | null;
}

interface DuplicateWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicates: DuplicateMatch[];
  novo?: LancamentoNovoResumo | null;
  onConfirm: () => void;
}

const CONFIANCA: Record<ConfiancaDuplicata, { label: string; classe: string }> = {
  certeza: { label: "Quase certo", classe: "bg-danger-soft text-danger-strong" },
  alta: { label: "Muito provável", classe: "bg-warning-soft text-warning-strong" },
  media: { label: "Possível", classe: "bg-info-soft text-info-strong" },
};

function Linha({
  titulo,
  valor,
  data,
  contraparte,
  nf,
}: {
  titulo: string;
  valor: number;
  data: string;
  contraparte?: string | null;
  nf?: string | null;
}) {
  return (
    <>
      <p className="font-medium leading-snug">{titulo}</p>
      <p className="text-muted-foreground">
        <span className="tabular-nums">{formatCurrency(valor)}</span> · vence {data}
        {contraparte ? ` · ${contraparte}` : ""}
        {nf ? ` · ${nf}` : ""}
      </p>
    </>
  );
}

/**
 * Aviso de duplicata (SPEC 150, fase 2): mostra o que está sendo lançado e cada
 * lançamento parecido que já existe, com o motivo ("Mesma nota fiscal", "Mesmo
 * fornecedor, mesmo valor e vencimento próximo") e o grau de certeza. A decisão é do
 * usuário: duas compras iguais no mesmo dia podem ser legítimas.
 */
export function DuplicateWarningDialog({
  open,
  onOpenChange,
  duplicates,
  novo,
  onConfirm,
}: DuplicateWarningDialogProps) {
  const certeza = duplicates.some((d) => d.confianca === "certeza");
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{certeza ? "Este lançamento parece já existir" : "Possível duplicata"}</AlertDialogTitle>
          <AlertDialogDescription>
            {duplicates.length === 1
              ? "Encontramos 1 lançamento parecido já cadastrado. Confira antes de salvar."
              : `Encontramos ${duplicates.length} lançamentos parecidos já cadastrados. Confira antes de salvar.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="my-2 space-y-3 text-sm">
          {novo && (
            <div className="rounded-md border p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Você está lançando
              </p>
              <Linha
                titulo={novo.descricao}
                valor={novo.valor}
                data={formatDateDisplay(novo.data.toISOString().slice(0, 10))}
                contraparte={novo.contraparte}
                nf={novo.notaFiscal}
              />
            </div>
          )}
          <div className="max-h-56 space-y-2 overflow-y-auto">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Já cadastrado</p>
            {duplicates.map((dup) => {
              const conf = CONFIANCA[dup.confianca] ?? CONFIANCA.media;
              return (
                <div key={dup.id} className="rounded-md border border-warning-mid-border bg-warning-soft/40 p-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className={cn("rounded-full px-2 py-0.5 text-2xs font-semibold", conf.classe)}>
                      {conf.label}
                    </span>
                    <span className="text-xs text-muted-foreground">{dup.motivo}</span>
                  </div>
                  <Linha
                    titulo={dup.descricao}
                    valor={dup.valor}
                    data={formatDateDisplay(dup.data_vencimento)}
                    contraparte={dup.contraparte_nome}
                    nf={dup.nota_fiscal}
                  />
                  {dup.status && <p className="mt-0.5 text-xs text-muted-foreground">Status: {dup.status}</p>}
                </div>
              );
            })}
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Não salvar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-brand text-ink hover:bg-brand/90">
            Salvar mesmo assim
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
