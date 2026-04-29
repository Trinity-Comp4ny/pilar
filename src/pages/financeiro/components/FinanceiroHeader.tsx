import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, CalendarDays } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from "date-fns";
import { cn } from "@/lib/utils";
import { Dispatch, SetStateAction, useState, useEffect } from "react";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface FinanceiroHeaderProps {
  dateFrom: Date | undefined;
  setDateFrom: Dispatch<SetStateAction<Date | undefined>>;
  dateTo: Date | undefined;
  setDateTo: Dispatch<SetStateAction<Date | undefined>>;
  visualizacao: "dia" | "mes" | "ano";
  setVisualizacao: Dispatch<SetStateAction<"dia" | "mes" | "ano">>;
}

export function FinanceiroHeader({
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  visualizacao: _visualizacao,
  setVisualizacao: _setVisualizacao,
}: FinanceiroHeaderProps) {
  const { isMobile } = useSidebar();
  const [filterType, setFilterType] = useState("this-month");

  useEffect(() => {
    // Set default filter to current month on mount
    const now = new Date();
    setDateFrom(startOfMonth(now));
    setDateTo(endOfMonth(now));
  }, [setDateFrom, setDateTo]);

  const handleFilterChange = (value: string) => {
    setFilterType(value);
    const now = new Date();

    if (value === "this-month") {
      setDateFrom(startOfMonth(now));
      setDateTo(endOfMonth(now));
    } else if (value === "last-month") {
      const last = subMonths(now, 1);
      setDateFrom(startOfMonth(last));
      setDateTo(endOfMonth(last));
    } else if (value === "this-year") {
      setDateFrom(startOfYear(now));
      setDateTo(endOfYear(now));
    } else if (value === "custom") {
      // Do not change dates, let user pick
    }
  };

  return (
    <div className="sticky top-0 z-10 bg-white border-b shadow-sm w-full">
      <div className="px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            {isMobile && (
              <SidebarTrigger className="mt-0.5 text-black/80 hover:text-accent-orange hover:bg-black/5 transition-colors rounded-full h-9 w-9" />
            )}
            <div>
              <h1 className="text-2xl md:text-3xl font-medium tracking-tight">Financeiro</h1>
              <p className="text-sm text-black/60 mt-1">Gerencie receitas e despesas</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Período:</span>

              <Select value={filterType} onValueChange={handleFilterChange}>
                <SelectTrigger className="w-[180px] h-9 text-xs rounded-full">
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="this-month">Este Mês</SelectItem>
                  <SelectItem value="last-month">Mês Passado</SelectItem>
                  <SelectItem value="this-year">Este Ano</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>

              {filterType === "custom" && (
                <div className="flex gap-2 animate-in fade-in slide-in-from-left-5 duration-300">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "justify-start text-left font-normal text-xs h-9 min-w-[120px] rounded-full",
                          !dateFrom && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-3 w-3" />
                        {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Início"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "justify-start text-left font-normal text-xs h-9 min-w-[120px] rounded-full",
                          !dateTo && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-3 w-3" />
                        {dateTo ? format(dateTo, "dd/MM/yyyy") : "Fim"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
