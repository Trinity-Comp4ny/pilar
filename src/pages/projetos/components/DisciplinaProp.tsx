import type React from "react";

export function Prop({
  icon: Icon,
  label,
  className,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex items-center gap-3 ${className ?? ""}`}>
      <span className="flex w-32 shrink-0 items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
