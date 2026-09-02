import { useState } from "react";
import { format, parse, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minDate?: string;
  maxDate?: string;
  className?: string;
  disabled?: boolean;
  captionLayout?: "label" | "dropdown";
  fromYear?: number;
  toYear?: number;
  id?: string;
}

function parseIso(iso?: string): Date | undefined {
  if (!iso) return undefined;
  const d = parse(iso, "yyyy-MM-dd", new Date());
  return isValid(d) ? d : undefined;
}

function toIso(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Selecione",
  minDate,
  maxDate,
  className,
  disabled,
  captionLayout = "label",
  fromYear,
  toYear,
  id,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);

  const selected = parseIso(value);
  const fromDate = parseIso(minDate);
  const toDate = parseIso(maxDate);

  const displayValue = selected ? format(selected, "dd/MM/yyyy") : null;

  return (
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "h-10 w-full justify-start text-left font-normal text-sm px-3 rounded-md border border-input bg-background shadow-none hover:bg-background",
              !displayValue && "text-muted-foreground",
              displayValue && !disabled && "pr-8",
              className
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            {displayValue ?? placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(date) => {
              onChange(date ? toIso(date) : "");
              setOpen(false);
            }}
            startMonth={fromDate ?? (fromYear ? new Date(fromYear, 0) : undefined)}
            endMonth={toDate ?? (toYear ? new Date(toYear, 11) : undefined)}
            disabled={[...(fromDate ? [{ before: fromDate }] : []), ...(toDate ? [{ after: toDate }] : [])]}
            captionLayout={captionLayout}
            defaultMonth={selected ?? fromDate}
            locale={ptBR}
            autoFocus
          />
        </PopoverContent>
      </Popover>
      {displayValue && !disabled && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChange("");
          }}
          aria-label="Limpar data"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
