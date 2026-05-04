import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

interface PageLayoutProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  sidebar?: React.ReactNode;
  className?: string;
  containerClassName?: string;
}

export function PageLayout({ children, header, sidebar, className, containerClassName }: PageLayoutProps) {
  const { state, isMobile } = useSidebar();

  return (
    <div
      className="fixed top-0 right-0 bottom-0 bg-white z-40 overflow-hidden flex flex-col transition-[left] duration-300 ease-in-out"
      style={{ left: isMobile ? "0px" : state === "collapsed" ? "64px" : "240px" }}
    >
      {header && <div className="sticky top-0 z-20 w-full bg-white border-b">{header}</div>}

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {sidebar}
        <div className={cn("flex-1 overflow-y-auto w-full bg-gray-50/50 p-6 md:p-8 xl:p-10 2xl:p-12", className)}>
          <div className={cn("w-full mx-auto space-y-6", containerClassName)}>{children}</div>
        </div>
      </div>
    </div>
  );
}
