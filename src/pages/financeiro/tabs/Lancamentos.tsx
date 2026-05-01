import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import Receitas from "./Receitas";
import Despesas from "./Despesas";

export default function Lancamentos() {
  return (
    <div className="space-y-6 w-full">
      <Card className="vrz-card w-full border-none shadow-none bg-transparent">
        <CardHeader className="px-0 pt-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold">Lançamentos</CardTitle>
              <CardDescription>Gerencie suas receitas e despesas em um só lugar</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          <Tabs defaultValue="receitas" className="w-full">
            <TabsList className="grid w-full grid-cols-2 gap-2 mb-6">
              <TabsTrigger
                value="receitas"
                className="data-[state=active]:bg-positive/10 data-[state=active]:text-positive"
              >
                <ArrowUpCircle className="mr-2 h-4 w-4" />
                Receitas
              </TabsTrigger>
              <TabsTrigger value="despesas" className="data-[state=active]:bg-red-100 data-[state=active]:text-red-700">
                <ArrowDownCircle className="mr-2 h-4 w-4" />
                Despesas
              </TabsTrigger>
            </TabsList>

            <TabsContent value="receitas" className="mt-0">
              <Receitas />
            </TabsContent>

            <TabsContent value="despesas" className="mt-0">
              <Despesas />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
