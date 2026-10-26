import { useNavigate } from "react-router-dom";
import { Calculator, Plus, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function Opcao({
  icone: Icone,
  titulo,
  descricao,
  destaque,
  onClick,
}: {
  icone: LucideIcon;
  titulo: string;
  descricao: string;
  destaque?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-2xl border bg-card p-4 text-left transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${destaque ? "bg-brand" : "bg-muted"}`}>
        <Icone className="h-[18px] w-[18px] text-ink" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
          {titulo}
          {destaque && <Badge variant="highlight">Recomendado</Badge>}
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-ink-soft">{descricao}</span>
      </span>
    </button>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Abre o formulário da obra em branco. */
  onEmBranco: () => void;
}

/**
 * Nova obra para quem tem a estimativa (SPEC 136, BEZ-24): começar pela estimativa, que gera custo e cronograma
 * para ajustar, ou criar a obra em branco como sempre.
 */
export function EscolherInicioObraDialog({ open, onOpenChange, onEmBranco }: Props) {
  const navigate = useNavigate();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Como quer começar a obra?</DialogTitle>
          <DialogDescription>Você pode estimar agora e criar a obra depois, com o cronograma pronto.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Opcao
            icone={Calculator}
            titulo="Começar com estimativa"
            descricao="Descreva a obra e receba custo e cronograma prontos para ajustar."
            destaque
            onClick={() => {
              onOpenChange(false);
              navigate("/obras/estimativas/nova");
            }}
          />
          <Opcao
            icone={Plus}
            titulo="Começar em branco"
            descricao="Crie a obra e monte o cronograma você mesmo."
            onClick={() => {
              onOpenChange(false);
              onEmBranco();
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
