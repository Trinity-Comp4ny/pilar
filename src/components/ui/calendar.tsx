import * as React from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, type DropdownProps } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

// Dropdown de mês/ano (captionLayout="dropdown"): o react-day-picker usa um
// <select> nativo do SO por padrão. Aqui trocamos por um Select do shadcn
// (Radix) para o dropdown seguir o tema do app em vez do menu nativo do PC.
// O rdp entrega um onChange no formato de evento de <select>, então sintetizamos.
function DropdownSelect({ options, value, onChange, disabled, "aria-label": ariaLabel }: DropdownProps) {
  const selectedValue = value !== undefined && value !== "" ? String(value) : undefined;

  return (
    <Select
      value={selectedValue}
      disabled={disabled}
      onValueChange={(next) => {
        onChange?.({ target: { value: next } } as React.ChangeEvent<HTMLSelectElement>);
      }}
    >
      <SelectTrigger
        aria-label={ariaLabel}
        className="h-8 w-fit gap-1 border-input px-2 text-sm font-medium focus:ring-0 focus:ring-offset-0"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-[min(24rem,var(--radix-select-content-available-height))]">
        {options?.map((option) => (
          <SelectItem key={option.value} value={String(option.value)} disabled={option.disabled}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// react-day-picker v9: as classes mudaram de nome (caption→month_caption,
// head_row→weekdays, cell→day, day→day_button...) e os modificadores
// (selected/today/range) passaram a cair na CÉLULA, não no botão — por isso o
// estilo do dia usa o seletor [&>button]. Ícones agora vêm de um único
// componente Chevron com `orientation`.
function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-4",
        month: "space-y-4",
        month_caption: "flex justify-center pt-1 relative items-center h-9",
        caption_label: "text-sm font-medium",
        // Container dos dois dropdowns (mês + ano) quando captionLayout="dropdown".
        dropdowns: "flex items-center justify-center gap-1.5",
        nav: "absolute top-1 inset-x-1 flex items-center justify-between z-10",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 disabled:pointer-events-none disabled:opacity-30"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 disabled:pointer-events-none disabled:opacity-30"
        ),
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex",
        weekday: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        week: "flex w-full mt-2",
        day: cn(
          "relative h-9 w-9 p-0 text-center text-sm focus-within:relative focus-within:z-20",
          "[&:has([aria-selected])]:bg-accent [&:has([aria-selected].day-range-end)]:rounded-r-md",
          "first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
        ),
        day_button: cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 p-0 font-normal aria-selected:opacity-100"),
        range_start: "day-range-start rounded-l-md",
        range_end: "day-range-end rounded-r-md",
        range_middle: "[&>button]:bg-accent [&>button]:text-accent-foreground [&>button:hover]:bg-accent",
        selected:
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button:hover]:bg-primary [&>button:hover]:text-primary-foreground [&>button:focus]:bg-primary [&>button:focus]:text-primary-foreground",
        today: "[&>button]:bg-accent [&>button]:text-accent-foreground",
        outside:
          "day-outside text-muted-foreground opacity-50 [&[aria-selected]]:text-muted-foreground [&[aria-selected]]:opacity-30",
        disabled: "text-muted-foreground opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Dropdown: DropdownSelect,
        Chevron: ({ orientation, className: chevronClassName }) => {
          const cls = cn("h-4 w-4", chevronClassName);
          if (orientation === "left") return <ChevronLeft className={cls} />;
          if (orientation === "right") return <ChevronRight className={cls} />;
          // orientation "down"/"up": chevron dos dropdowns de mês/ano
          return <ChevronDown className={cls} />;
        },
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
