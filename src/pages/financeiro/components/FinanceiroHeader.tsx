import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, Filter, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Dispatch, SetStateAction } from "react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  visualizacao,
  setVisualizacao,
}: FinanceiroHeaderProps) {
  return (
    <div className="sticky top-0 z-10 bg-white border-b shadow-sm w-full">
      <div className="px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-medium tracking-tight">Financeiro</h1>
            <p className="text-sm text-black/60 mt-1">Gerencie receitas e despesas</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Período:</span>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "justify-start text-left font-normal text-xs h-9 min-w-[140px] rounded-full",
                        !dateFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3 w-3" />
                      {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Data início"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={setDateFrom}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "justify-start text-left font-normal text-xs h-9 min-w-[140px] rounded-full",
                        !dateTo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3 w-3" />
                      {dateTo ? format(dateTo, "dd/MM/yyyy") : "Data fim"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={setDateTo}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Visualização:</span>
              <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-lg border border-black/5">
                <Button
                  variant={visualizacao === "dia" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setVisualizacao("dia")}
                  className="text-xs h-8 rounded-full"
                >
                  Dia
                </Button>
                <Button
                  variant={visualizacao === "mes" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setVisualizacao("mes")}
                  className="text-xs h-8 rounded-full"
                >
                  Mês
                </Button>
                <Button
                  variant={visualizacao === "ano" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setVisualizacao("ano")}
                  className="text-xs h-8 rounded-full"
                >
                  Ano
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="w-full bg-white border-t">
        <TabsList className="w-full rounded-none bg-transparent border-none h-auto p-0 grid grid-cols-7 gap-0">
          <TabsTrigger 
            value="visao-geral" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#FF4000] data-[state=active]:bg-white data-[state=active]:text-[#FF4000] py-3"
          >
            Visão Geral
          </TabsTrigger>
          <TabsTrigger 
            value="fluxo-caixa" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#FF4000] data-[state=active]:bg-white data-[state=active]:text-[#FF4000] py-3"
          >
            Fluxo de Caixa
          </TabsTrigger>
          <TabsTrigger 
            value="mensal" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#FF4000] data-[state=active]:bg-white data-[state=active]:text-[#FF4000] py-3"
          >
            Resumo Mensal
          </TabsTrigger>
          <TabsTrigger 
            value="metas" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#FF4000] data-[state=active]:bg-white data-[state=active]:text-[#FF4000] py-3"
          >
            Metas
          </TabsTrigger>
          <TabsTrigger 
            value="receitas" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#FF4000] data-[state=active]:bg-white data-[state=active]:text-[#FF4000] py-3"
          >
            Receitas
          </TabsTrigger>
          <TabsTrigger 
            value="despesas" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#FF4000] data-[state=active]:bg-white data-[state=active]:text-[#FF4000] py-3"
          >
            Despesas
          </TabsTrigger>
          <TabsTrigger 
            value="configuracoes" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#FF4000] data-[state=active]:bg-white data-[state=active]:text-[#FF4000] py-3"
          >
            Configurações
          </TabsTrigger>
        </TabsList>
      </div>
    </div>
  );
}
