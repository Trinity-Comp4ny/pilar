import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface ResponsiveDetailPanelsProps {
  primary: React.ReactNode;
  primaryLabel: string;
  secondary: React.ReactNode;
  secondaryLabel: string;
  primaryDefaultSize?: number;
  primaryMinSize?: number;
  secondaryDefaultSize?: number;
  secondaryMinSize?: number;
  className?: string;
}

/**
 * Layout de dois painéis dos modais de detalhe (tarefa, disciplina, fluxo de
 * disciplinas, projeto): lado a lado e redimensionáveis no desktop, em abas
 * empilhadas no mobile. Painéis lado a lado espremiam o secundário a um mínimo
 * ilegível em 390px (achado da auditoria mobile) porque o `ResizablePanelGroup`
 * não tem variante responsiva.
 */
export function ResponsiveDetailPanels({
  primary,
  primaryLabel,
  secondary,
  secondaryLabel,
  primaryDefaultSize = 68,
  primaryMinSize = 45,
  secondaryDefaultSize = 32,
  secondaryMinSize = 22,
  className,
}: ResponsiveDetailPanelsProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Tabs defaultValue="primary" className={cn("flex min-h-0 flex-1 flex-col", className)}>
        <TabsList className="mx-4 mt-3 self-start">
          <TabsTrigger value="primary">{primaryLabel}</TabsTrigger>
          <TabsTrigger value="secondary">{secondaryLabel}</TabsTrigger>
        </TabsList>
        {/* Radix esconde a aba inativa via atributo `hidden`, mas a classe
            `flex` (especificidade de classe) vencia o `[hidden]{display:none}`
            do user-agent stylesheet (especificidade de atributo) e as duas
            abas ficavam abertas ao mesmo tempo, dividindo a altura ao meio
            (achado: conteúdo sumia depois de "Prazo" sem nenhum erro visível).
            `hidden` + `data-[state=active]:flex` resolve porque usa o próprio
            data-state do Radix em vez de disputar com o atributo nativo. */}
        <TabsContent
          value="primary"
          className="mt-0 hidden min-h-0 flex-1 flex-col overflow-hidden data-[state=active]:flex"
        >
          {primary}
        </TabsContent>
        <TabsContent
          value="secondary"
          className="mt-0 hidden min-h-0 flex-1 flex-col overflow-hidden data-[state=active]:flex"
        >
          {secondary}
        </TabsContent>
      </Tabs>
    );
  }

  return (
    <ResizablePanelGroup direction="horizontal" className={className}>
      <ResizablePanel defaultSize={primaryDefaultSize} minSize={primaryMinSize}>
        {primary}
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={secondaryDefaultSize} minSize={secondaryMinSize}>
        {secondary}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
