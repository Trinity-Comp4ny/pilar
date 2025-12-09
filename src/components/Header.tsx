
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { useNavigate } from "react-router-dom";
import { LogOut, User, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export function Header() {
  const navigate = useNavigate();
  const { state } = useSidebar();
  const { toast } = useToast();
  const [userName, setUserName] = useState("Usuário");
  const [headerLogo, setHeaderLogo] = useState<string | null>(null);

  useEffect(() => {
    const loadUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('nome')
          .eq('id', user.id)
          .single();

        if (profile?.nome) {
          setUserName(profile.nome);
        }
      }
    };

    loadUserData();

    // Recuperar configuração de marca da empresa
    const brandRaw = localStorage.getItem('pilar-company-brand');
    if (brandRaw) {
      try {
        const brand = JSON.parse(brandRaw);
        if (brand?.headerLogo) setHeaderLogo(brand.headerLogo);
      } catch { }
    }
  }, []);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Erro ao sair",
        description: error.message,
        variant: "destructive",
      });
    } else {
      navigate("/login");
    }
  };

  const handleProfile = () => {
    navigate("/profile");
  };

  const handleCompany = () => {
    navigate("/company");
  };

  return (
    <header className="h-16 border-b border-black/5 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 flex items-center justify-between px-6 md:px-10">
      <div className="flex items-center gap-3">
        <img src="/pilar-logo.svg" alt="Pilar" className="h-7 w-7 transition-opacity duration-200 hover:opacity-80" />
        <span className="text-base font-semibold tracking-tight">Pilar</span>
      </div>

      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 text-black/80 hover:text-accent-orange transition-colors focus:outline-none rounded-full px-3 py-1.5 hover:bg-black/5">
              <User size={16} />
              <span className="text-sm font-medium">{userName}</span>
              <ChevronDown size={14} className="opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[160px]">
            <DropdownMenuItem onClick={handleProfile}>Perfil</DropdownMenuItem>
            <DropdownMenuItem onClick={handleCompany}>Empresa</DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout}>Sair</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}