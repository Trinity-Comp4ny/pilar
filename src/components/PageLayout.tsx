import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

interface PageLayoutProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  className?: string;
}

export function PageLayout({ children, header, className }: PageLayoutProps) {
  const { state } = useSidebar();

  return (
    <div 
      className="fixed top-0 right-0 bottom-0 bg-white z-40 overflow-hidden flex flex-col transition-[left] duration-300 ease-in-out"
      style={{ left: state === "collapsed" ? "64px" : "240px" }}
    >
      {header && (
        <div className="sticky top-0 z-20 w-full bg-white border-b">
          {header}
        </div>
      )}
      
      <div className={cn("flex-1 overflow-y-auto w-full bg-gray-50/50 p-6 md:p-8", className)}>
        <div className="w-full mx-auto space-y-6">
          {children}
        </div>
      </div>
    </div>
  );
}
