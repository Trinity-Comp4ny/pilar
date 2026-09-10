import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, forwardedRef) => {
  const innerRef = React.useRef<HTMLDivElement | null>(null);

  // Aba ativa pode nascer fora da área visível do scroll horizontal (lista com
  // mais itens do que cabe em 390px) — sem isso, ela aparece cortada na borda
  // em vez de inteira (mesmo achado do ModuleChipNav, corrigido aqui no
  // primitivo base para valer em toda tela que usa TabsList, ex. Obra/6 abas).
  // `scrollIntoView` teria sido mais simples, mas ele sobe a árvore de
  // ancestrais scrolláveis (inclusive um com `overflow: hidden`, que ainda
  // aceita scroll programático mesmo sem esconder barra) e rola qualquer um
  // deles — foi assim que uma tela inteira apareceu deslocada horizontalmente
  // sem nenhum scroll real do usuário (achado da auditoria mobile). Calcular
  // e aplicar o `scrollLeft` direto no container certo evita esse vazamento.
  React.useEffect(() => {
    const container = innerRef.current;
    const active = container?.querySelector<HTMLElement>('[data-state="active"]');
    if (!container || !active) return;
    const containerRect = container.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    const activeCenter = activeRect.left - containerRect.left + container.scrollLeft + activeRect.width / 2;
    container.scrollLeft = activeCenter - container.clientWidth / 2;
  });

  return (
    <TabsPrimitive.List
      ref={(node) => {
        innerRef.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }}
      className={cn(
        "inline-flex h-10 max-w-full items-center justify-center overflow-x-auto rounded-md bg-muted p-1 text-muted-foreground",
        className
      )}
      {...props}
    />
  );
});
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
