import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Loader2, Building2, CheckCircle } from "lucide-react";

export default function CompanySetup() {
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // 1. Pegar ID da empresa do usuário logado
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não logado");

      const { data: profile } = await supabase
        .from('profiles')
        .select('empresa_id')
        .eq('id', user.id)
        .single();

      if (!profile?.empresa_id) throw new Error("Empresa não encontrada");

      // 2. Atualizar dados da empresa
      const { error } = await supabase
        .from('empresas')
        .update({ nome: name, cnpj: cnpj })
        .eq('id', profile.empresa_id);

      if (error) throw error;

      toast({
        title: "Empresa configurada!",
        description: "Bem-vindo ao sistema Pilar.",
      });
      
      navigate("/dashboard");

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-lg shadow-xl border-t-4 border-primary">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Configurar sua Empresa</CardTitle>
          <CardDescription>
            Finalize o cadastro da sua organização para começar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Razão Social / Nome Fantasia</Label>
              <Input 
                id="name" 
                placeholder="Ex: Construtora Pilar Ltda" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ (Opcional)</Label>
              <Input 
                id="cnpj" 
                placeholder="00.000.000/0000-00" 
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
              />
            </div>

            <Button className="w-full" type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Finalizar Configuração
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
