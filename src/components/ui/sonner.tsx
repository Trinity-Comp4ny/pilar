import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      closeButton
      mobileOffset={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:!bg-brand group-[.toast]:!text-ink group-[.toast]:!rounded-full group-[.toast]:!px-3.5 group-[.toast]:!h-8 group-[.toast]:!text-sm group-[.toast]:!font-medium hover:group-[.toast]:!bg-brand/90",
          cancelButton: "group-[.toast]:!bg-muted group-[.toast]:!text-muted-foreground group-[.toast]:!rounded-full",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
