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
        <TabsContent value="primary" className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden">
          {primary}
        </TabsContent>
        <TabsContent value="secondary" className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden">
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
