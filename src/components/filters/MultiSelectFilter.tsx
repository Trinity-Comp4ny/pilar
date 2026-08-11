import { useMemo, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface Props {
  label: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  className?: string;
  align?: "start" | "center" | "end";
}

export function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  placeholder = "Buscar…",
  className,
  align = "start",
}: Props) {
  const [open, setOpen] = useState(false);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const selectedLabels = useMemo(
    () => options.filter((o) => selectedSet.has(o.value)).map((o) => o.label),
    [options, selectedSet]
  );

  const toggle = (value: string) => {
    if (selectedSet.has(value)) onChange(selected.filter((v) => v !== value));
    else onChange([...selected, value]);
  };

  const clear = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const hasSelection = selected.length > 0;
  const triggerLabel = !hasSelection
    ? label
    : selected.length === 1
      ? `${label}: ${selectedLabels[0]}`
      : `${label} (${selected.length})`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 rounded-full gap-1.5 text-xs font-normal max-w-[220px]",
            hasSelection && "border-brand bg-brand text-ink hover:bg-brand/90 hover:text-ink",
            className
          )}
        >
          <span className="truncate">{triggerLabel}</span>
          {hasSelection ? (
            <span
              role="button"
              tabIndex={0}
              onClick={clear}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") clear(e);
              }}
              className="ml-0.5 rounded-full hover:bg-brand/20 p-0.5 cursor-pointer"
              aria-label="Limpar"
            >
              <X className="h-3 w-3" />
            </span>
          ) : (
            <ChevronDown className="h-3 w-3 opacity-60" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align={align}>
        <Command>
          <CommandInput placeholder={placeholder} className="h-9" />
          <CommandList>
            <CommandEmpty>Nenhum resultado</CommandEmpty>
            <CommandGroup>
              {options.map((o) => {
                const checked = selectedSet.has(o.value);
                return (
                  <CommandItem key={o.value} onSelect={() => toggle(o.value)} className="cursor-pointer">
                    <div
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border",
                        checked ? "bg-brand border-brand text-ink" : "border-input"
                      )}
                    >
                      {checked && <Check className="h-3 w-3" />}
                    </div>
                    <span className="truncate">{o.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
