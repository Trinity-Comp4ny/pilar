import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { AvatarStack } from "@/components/AvatarStack";
import { usePerfilPublico } from "@/hooks/usePerfilPublico";

interface PerfilPessoaPopoverProps {
  pessoaId: string;
  children: ReactNode;
}

/**
 * Cartão com o perfil público de um colega (spec 103): nome, cargo, e-mail e as
 * disciplinas liberadas em que é responsável. Só busca quando abre.
 */
export function PerfilPessoaPopover({ pessoaId, children }: PerfilPessoaPopoverProps) {
  const [open, setOpen] = useState(false);
  const { data: perfil, isLoading, isError } = usePerfilPublico(open ? pessoaId : null);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        {isLoading ? (
          <div className="flex items-center gap-3 p-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ) : isError ? (
          <p className="p-4 text-sm text-muted-foreground">Não deu para carregar o perfil. Feche e tente de novo.</p>
        ) : !perfil ? (
          <p className="p-4 text-sm text-muted-foreground">Essa pessoa não está mais na equipe.</p>
        ) : (
          <div>
            <div className="flex items-center gap-3 p-4">
              <AvatarStack pessoas={[{ nome: perfil.nome, avatarUrl: perfil.avatar_url }]} size="lg" max={1} />
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">{perfil.nome}</p>
                {perfil.cargo && <p className="truncate text-sm text-muted-foreground">{perfil.cargo}</p>}
                {!perfil.tem_conta && <p className="text-xs text-muted-foreground">Ainda sem acesso ao Pilar</p>}
              </div>
            </div>
            {perfil.email && (
              <a
                href={`mailto:${perfil.email}`}
                className="flex items-center gap-2 border-t px-4 py-2.5 text-sm text-foreground hover:bg-muted"
              >
                <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{perfil.email}</span>
              </a>
            )}
            {perfil.disciplinas.length > 0 && (
              <div className="border-t px-4 py-3">
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Trabalhando em</p>
                <ul className="space-y-1">
                  {perfil.disciplinas.map((d) => (
                    <li key={d.id}>
                      <Link
                        to={`/projetos/${d.projeto_id}?disciplina=${d.id}`}
                        onClick={() => setOpen(false)}
                        className="block rounded-md px-1.5 py-1 text-sm hover:bg-muted"
                      >
                        <span className="block truncate text-foreground">{d.nome}</span>
                        <span className="block truncate text-xs text-muted-foreground">{d.projeto_nome}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
