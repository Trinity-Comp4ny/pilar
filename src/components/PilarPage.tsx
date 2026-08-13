import * as React from "react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";

/**
 * Envelope padrão de página (Pilar Design System, seção 4).
 * Junta PageLayout + PageHeader para a página declarar só conteúdo e regra de
 * negócio: título, busca, ação primária e o corpo. Largura, padding, shell,
 * foco a11y em troca de rota e o header fino vêm prontos. Não montar
 * PageLayout+PageHeader à mão. Os tipos derivam dos dois componentes, então
 * `primaryAction`, `search` e afins ficam sempre em sincronia com eles.
 */
type HeaderProps = React.ComponentProps<typeof PageHeader>;
type LayoutProps = React.ComponentProps<typeof PageLayout>;

interface PilarPageProps
  extends Pick<HeaderProps, "title" | "breadcrumbs" | "search" | "primaryAction">,
    Pick<LayoutProps, "sidebar" | "className" | "containerClassName"> {
  /** Ações secundárias no header, alinhadas antes da ação primária. */
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function PilarPage({
  title,
  breadcrumbs,
  search,
  primaryAction,
  actions,
  sidebar,
  className,
  containerClassName,
  children,
}: PilarPageProps) {
  return (
    <PageLayout
      sidebar={sidebar}
      className={className}
      containerClassName={containerClassName}
      header={
        <PageHeader title={title} breadcrumbs={breadcrumbs} search={search} primaryAction={primaryAction}>
          {actions}
        </PageHeader>
      }
    >
      {children}
    </PageLayout>
  );
}
