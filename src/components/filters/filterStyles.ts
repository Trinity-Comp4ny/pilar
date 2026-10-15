import { cn } from "@/lib/utils";

/**
 * Classe do gatilho de qualquer filtro (SPEC 121 / ADR 0058): mesma altura, raio e
 * estado ativo em toda tela. Ativo é fundo verde com texto `ink` (verde nunca em
 * primeiro plano, regra de contraste da marca).
 */
export function filterTriggerClass(ativo: boolean, className?: string) {
  return cn(
    "h-9 max-w-[240px] shrink-0 gap-1.5 rounded-full px-3.5 text-[13px] font-normal",
    // Gatilho de filtro é `outline` que muda de estado, não botão primário: a regra
    // contra re-estilizar com bg-brand não se aplica.
    // eslint-disable-next-line no-restricted-syntax
    ativo && "border-brand bg-brand text-ink hover:bg-brand/90 hover:text-ink",
    className
  );
}
