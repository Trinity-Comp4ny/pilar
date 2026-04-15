import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  const { isMobile } = useSidebar();

  return (
    <div className="px-6 py-4 w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          {isMobile && (
            <SidebarTrigger className="mt-0.5 text-black/80 hover:text-accent-orange hover:bg-black/5 transition-colors rounded-full h-9 w-9" />
          )}
          <div>
            <h1 className="text-2xl md:text-3xl font-medium tracking-tight">{title}</h1>
            {description && <p className="text-sm text-black/60 mt-1">{description}</p>}
          </div>
        </div>

        {children && <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">{children}</div>}
      </div>
    </div>
  );
}
