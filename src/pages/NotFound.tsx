import { useEffect, useMemo, useState } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ArrowRight } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (mounted) setIsAuthenticated(!!session);
    };
    check();
    return () => { mounted = false; };
  }, []);

  const primaryHref = useMemo(() => {
    if (isAuthenticated === true) return "/dashboard";
    return "/";
  }, [isAuthenticated]);

  if (isAuthenticated === null) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-100">Carregando...</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-slate-50 px-6 py-12">
      <div className="w-full max-w-2xl">
        <div className="mb-6 flex items-center justify-center gap-3">
          <img src="/pilar-logo.svg" alt="Pilar" className="h-10 w-10" />
          <span className="text-lg font-medium tracking-tight text-slate-900">Pilar</span>
        </div>

        <Card className="border-slate-200/70 shadow-sm">
          <CardContent className="p-8 md:p-10">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="text-6xl md:text-7xl font-semibold tracking-tight text-slate-900">
                404
              </div>
              <div className="space-y-2">
                <h1 className="text-xl md:text-2xl font-semibold text-slate-900">
                  Página não encontrada
                </h1>
                <p className="text-sm md:text-base text-slate-600">
                  Não encontramos o endereço que você tentou acessar.
                </p>
              </div>

              <div className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-left">
                <div className="text-xs font-medium text-slate-500">Caminho</div>
                <div className="mt-1 font-mono text-sm text-slate-900 break-all">
                  {location.pathname}
                </div>
              </div>

              <div className="mt-2 flex flex-col sm:flex-row gap-3 w-full">
                <Button className="w-full" asChild>
                  <Link to={primaryHref}>
                    {isAuthenticated ? "Ir para o Dashboard" : "Ir para o início"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate(-1)}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Página anterior
                </Button>
              </div>

              {isAuthenticated === false && (
                <div className="text-sm text-slate-600">
                  Quer acessar sua conta?{" "}
                  <Link to="/login" className="font-medium text-accent-orange hover:underline">
                    Ir para login
                  </Link>
                </div>
              )}

              <div className="pt-4 text-xs text-slate-400">
                Se você acredita que isso é um erro, fale com o suporte.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NotFound;
