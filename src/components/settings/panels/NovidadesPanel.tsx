import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { NOVIDADES, ROTULO_TIPO, ULTIMA_VERSAO, VARIANTE_TIPO } from "@/lib/novidades";
import { useNovidades } from "@/hooks/useNovidades";

// Aba Novidades das configurações (antigo NovidadesDialog, spec 038). Lista os
// releases voltados ao usuário, do mais recente ao mais antigo, cada item com um
// selo do tipo (Novo/Melhoria/Correção). Marca a versão atual como vista ao abrir.
export function NovidadesPanel() {
  const { marcarVista } = useNovidades();

  useEffect(() => {
    marcarVista();
  }, [marcarVista]);

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">
        O que chegou de novo, melhorou e foi corrigido no Pilar. Versão atual: {ULTIMA_VERSAO}.
      </p>

      {NOVIDADES.map((release) => (
        <section key={release.versao} className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold tracking-tight text-ink">{release.titulo}</h3>
            <span className="shrink-0 text-xs text-muted-foreground">{release.data}</span>
          </div>
          <ul className="space-y-2.5">
            {release.itens.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <Badge variant={VARIANTE_TIPO[item.tipo]} className="mt-0.5 shrink-0">
                  {ROTULO_TIPO[item.tipo]}
                </Badge>
                <span className="text-sm leading-relaxed text-foreground">{item.texto}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export default NovidadesPanel;
