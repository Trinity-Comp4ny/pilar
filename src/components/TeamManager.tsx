import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Users, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Profile {
  id: string;
  nome: string;
  email: string;
  role: string;
  created_at: string;
}

export default function TeamManager() {
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const { toast } = useToast();

  // Invite Form State
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("user");

  useEffect(() => {
    fetchTeam();
  }, []);

  const fetchTeam = async () => {
    try {
      // O RLS garante que só retornem users da MINHA empresa
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      // Casting manual pois os tipos do Supabase podem não ter sido gerados ainda
      setMembers((data as unknown as Profile[]) || []);
    } catch (error) {
      console.error("Erro ao buscar equipe:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    // NOTA: Em um app real, isso chamaria uma Edge Function (supabase.functions.invoke('invite-user'))
    // Porque o cliente JS não deve ter permissão de service_role para convidar qualquer um.
    // Para este exemplo visual, vamos simular o sucesso.
    
    toast({
      title: "Funcionalidade de Convite",
      description: "Em produção, isso enviaria um email com o Link Mágico contendo o ID da empresa.",
    });

    console.log("Dados para envio:", {
      email: inviteEmail,
      options: {
        data: {
          nome: inviteName,
          cargo_convite: inviteRole,
          // Aqui o Backend pegaria o ID da empresa do admin logado e injetaria
          // empresa_id_convite: 'uuid-da-empresa'
        }
      }
    });

    setIsInviteOpen(false);
    setInviteEmail("");
    setInviteName("");
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin": return <Badge className="bg-red-500">Admin</Badge>;
      case "financeiro": return <Badge className="bg-green-500">Financeiro</Badge>;
      case "operacional": return <Badge className="bg-blue-500">Operacional</Badge>;
      case "marketing": return <Badge className="bg-purple-500">Marketing</Badge>;
      default: return <Badge variant="outline">Usuário</Badge>;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Gestão de Equipe
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie quem tem acesso à sua empresa.
          </p>
        </div>
        
        <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Convidar Membro
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Convidar Novo Membro</DialogTitle>
              <DialogDescription>
                O usuário receberá um email para criar a senha e entrar na sua empresa.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome</label>
                <Input 
                  placeholder="Ex: Maria Souza" 
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email Corporativo</label>
                <Input 
                  placeholder="maria@suaempresa.com" 
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Permissão (Role)</label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin (Acesso Total)</SelectItem>
                    <SelectItem value="financeiro">Financeiro</SelectItem>
                    <SelectItem value="operacional">Operacional</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="user">Usuário (Básico)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsInviteOpen(false)}>Cancelar</Button>
              <Button onClick={handleInvite}>Enviar Convite</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Permissão</TableHead>
              <TableHead>Entrou em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">Carregando equipe...</TableCell>
              </TableRow>
            ) : members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  Nenhum membro encontrado além de você.
                </TableCell>
              </TableRow>
            ) : (
              members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">{member.nome}</TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>{getRoleBadge(member.role)}</TableCell>
                  <TableCell>{new Date(member.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
