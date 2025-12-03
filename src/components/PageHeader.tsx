interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="px-6 py-4 w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-medium tracking-tight">{title}</h1>
          {description && (
            <p className="text-sm text-black/60 mt-1">{description}</p>
          )}
        </div>
        
        {children && (
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
