import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, LayoutTemplate, Layers, Tags, Truck } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function ParametrosTab() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Catálogos da empresa</CardTitle>
          <CardDescription>Defina padrões que serão usados em todo o sistema</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ParamRow
            icon={LayoutTemplate}
            name="Templates de projeto"
            description="Fases e disciplinas padrão para novos projetos"
            status="ativo"
            onOpen={() => navigate("/templates")}
          />
          <ParamRow
            icon={Tags}
            name="Categorias financeiras"
            description="Grupos de receitas e despesas para relatórios"
            status="ativo"
            onOpen={() => navigate("/financeiro?tab=lancamentos")}
          />
          <ParamRow
            icon={Truck}
            name="Fornecedores"
            description="Cadastro de fornecedores para despesas recorrentes"
            status="em-breve"
          />
          <ParamRow
            icon={Layers}
            name="Disciplinas padrão"
            description="Lista global de disciplinas técnicas reutilizáveis"
            status="em-breve"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Status e fluxos
            <Badge variant="secondary">Em breve</Badge>
          </CardTitle>
          <CardDescription>Personalize status de projeto, lead e proposta conforme seu fluxo interno</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-black/70">
            Em breve você poderá criar status customizados por firma (ex: "Aguardando aprovação RT", "Em revisão
            legal"), alterar ordem de funil e definir cores por status.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ParamRow({
  icon: Icon,
  name,
  description,
  status,
  onOpen,
}: {
  icon: typeof LayoutTemplate;
  name: string;
  description: string;
  status: "ativo" | "em-breve";
  onOpen?: () => void;
}) {
  const disabled = status === "em-breve";
  return (
    <div className="flex items-center justify-between rounded-lg border border-black/5 bg-white p-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-9 w-9 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0">
          <Icon size={16} className="text-brand" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{name}</div>
          <div className="text-xs text-black/60 truncate">{description}</div>
        </div>
      </div>
      {disabled ? (
        <Badge variant="secondary" className="flex-shrink-0">
          em breve
        </Badge>
      ) : (
        <Button variant="ghost" size="sm" onClick={onOpen} className="gap-1 flex-shrink-0">
          Abrir
          <ArrowUpRight size={14} />
        </Button>
      )}
    </div>
  );
}
