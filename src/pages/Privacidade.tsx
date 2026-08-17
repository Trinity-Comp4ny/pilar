import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getSafeErrorMessage } from "@/lib/safeError";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type DataItem = {
  categoria: string;
  retencao: string;
  baseLegal: string;
};

const DATA_TABLE: DataItem[] = [
  {
    categoria: "Dados cadastrais (nome, email, telefone)",
    retencao: "Enquanto a conta estiver ativa + 5 anos",
    baseLegal: "Execução de contrato (LGPD Art. 7, V)",
  },
  {
    categoria: "Dados financeiros (lançamentos, contas, faturas)",
    retencao: "5 anos após o último movimento",
    baseLegal: "Obrigação legal fiscal (LGPD Art. 7, II)",
  },
  {
    categoria: "Dados de projetos e clientes",
    retencao: "Enquanto a conta estiver ativa + 3 anos",
    baseLegal: "Execução de contrato (LGPD Art. 7, V)",
  },
  {
    categoria: "Logs de auditoria (audit_logs)",
    retencao: "1 ano em hot storage + 4 anos em archive",
    baseLegal: "Legítimo interesse e segurança (LGPD Art. 7, IX)",
  },
  {
    categoria: "Cookies e dados de sessão",
    retencao: "Até 30 dias após logout",
    baseLegal: "Legítimo interesse (LGPD Art. 7, IX)",
  },
];

export default function Privacidade() {
  const { user } = useAuth();
  const [motivo, setMotivo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const [exportSubmitting, setExportSubmitting] = useState(false);
  const [exportRequested, setExportRequested] = useState(false);

  const handleRequestExport = async () => {
    if (!user) return;
    setExportSubmitting(true);
    try {
      const { data, error } = await (
        supabase.rpc as unknown as (
          fn: string,
          args?: Record<string, unknown>
        ) => Promise<{ data: { error?: string } | null; error: { message: string } | null }>
      )("request_data_export");
      if (error) throw error;
      if (data?.error === "already_pending") {
        toast.info("Já existe uma solicitação de exportação em andamento.");
        return;
      }
      setExportRequested(true);
      toast.success("Solicitação registrada. Enviaremos seus dados por email em até 15 dias.");
    } catch (err) {
      toast.error("Não foi possível registrar a solicitação", {
        description: getSafeErrorMessage(err, "Tente de novo em instantes."),
      });
    } finally {
      setExportSubmitting(false);
    }
  };

  const handleRequestDeletion = async () => {
    if (!user) {
      toast.error("Você precisa estar autenticado para solicitar exclusão.");
      return;
    }
    setSubmitting(true);
    // RPC criada na migration 20260504400000 — types ainda não regenerados
    const { error } = await (
      supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>
      ) => Promise<{ error: { message: string } | null }>
    )("request_data_deletion", {
      p_motivo: motivo.trim() || null,
    });
    setSubmitting(false);

    if (error) {
      toast.error("Não foi possível registrar a solicitação", {
        description: getSafeErrorMessage(error, "Tente de novo em instantes."),
      });
      return;
    }

    toast.success("Solicitação registrada. Nossa equipe entrará em contato em até 15 dias.");
    setMotivo("");
    setOpen(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-6 py-6 flex items-center gap-4">
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Voltar
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-foreground" />
            <h1 className="text-lg font-medium tracking-tight">Política de Privacidade</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12 max-w-3xl space-y-12">
        <section>
          <h2 className="text-2xl font-medium tracking-tight mb-3">Resumo</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            O Pilar é um sistema de gestão para escritórios de arquitetura e engenharia. Tratamos seus dados em
            conformidade com a Lei Geral de Proteção de Dados (Lei 13.709/2018). Esta página descreve quais dados
            coletamos, por quanto tempo guardamos, e como você pode exercer seus direitos.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-medium tracking-tight mb-3">1. Quem somos</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Controlador: Trinity Company. Encarregado de Dados (DPO): privacidade@trnty.com.br. O tratamento de dados
            ocorre em servidores da Supabase Inc. e parceiros, hospedados na América do Sul (São Paulo).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-medium tracking-tight mb-3">2. O que coletamos</h2>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Categoria</th>
                  <th className="px-4 py-3 text-left font-medium">Retenção</th>
                  <th className="px-4 py-3 text-left font-medium">Base legal</th>
                </tr>
              </thead>
              <tbody>
                {DATA_TABLE.map((item) => (
                  <tr key={item.categoria} className="border-t">
                    <td className="px-4 py-3 align-top">{item.categoria}</td>
                    <td className="px-4 py-3 align-top text-muted-foreground">{item.retencao}</td>
                    <td className="px-4 py-3 align-top text-muted-foreground">{item.baseLegal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-medium tracking-tight mb-3">3. Compartilhamento</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Não vendemos dados. Compartilhamos com operadores estritamente necessários (Supabase para hospedagem, Resend
            para emails transacionais, Asaas/PIX para cobrança) e somente quando exigido por lei. Todos sob contrato com
            cláusulas LGPD.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-medium tracking-tight mb-3">4. Seus direitos (LGPD Art. 18)</h2>
          <ul className="text-sm text-muted-foreground leading-relaxed list-disc pl-6 space-y-1">
            <li>Confirmação da existência de tratamento</li>
            <li>Acesso e portabilidade dos dados</li>
            <li>Correção de dados incompletos ou desatualizados</li>
            <li>Anonimização, bloqueio ou eliminação de dados desnecessários</li>
            <li>Revogação do consentimento</li>
          </ul>
        </section>

        <section className="rounded-lg border bg-muted/30 p-6 space-y-4">
          <div className="flex items-start gap-3">
            <Trash2 className="w-5 h-5 text-destructive mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium mb-1">Solicitar exclusão dos meus dados</h3>
              <p className="text-sm text-muted-foreground">
                Você pode solicitar a eliminação dos seus dados pessoais a qualquer momento. Processaremos a solicitação
                em até 15 dias, respeitando obrigações legais que exigem retenção (ex: dados fiscais por 5 anos).
              </p>
            </div>
          </div>

          {user ? (
            <AlertDialog open={open} onOpenChange={setOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Solicitar exclusão de dados
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar solicitação de exclusão</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta solicitação será revisada pela nossa equipe. Dados sujeitos à retenção legal (fiscal,
                    auditoria) podem ser mantidos pelo prazo exigido pela LGPD. Você receberá uma confirmação por email.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2">
                  <label htmlFor="motivo" className="text-sm font-medium">
                    Motivo (opcional)
                  </label>
                  <Textarea
                    id="motivo"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Conte-nos o motivo para nos ajudar a melhorar..."
                    rows={3}
                    maxLength={500}
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.preventDefault();
                      handleRequestDeletion();
                    }}
                    disabled={submitting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {submitting ? "Enviando..." : "Confirmar solicitação"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <p className="text-sm text-muted-foreground">
              Para solicitar a exclusão pelo sistema, faça{" "}
              <Link to="/login" className="text-ink underline">
                login
              </Link>
              . Ou envie um email para privacidade@trnty.com.br.
            </p>
          )}
        </section>

        <section className="rounded-lg border bg-muted/30 p-6 space-y-4">
          <div className="flex items-start gap-3">
            <Download className="w-5 h-5 text-foreground mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium mb-1">Solicitar exportação dos meus dados</h3>
              <p className="text-sm text-muted-foreground">
                Você pode solicitar uma cópia de todos os dados pessoais que tratamos (LGPD Art. 18, V — portabilidade).
                Enviaremos um arquivo JSON para o seu email cadastrado em até 15 dias.
              </p>
            </div>
          </div>

          {user ? (
            exportRequested ? (
              <p className="text-sm text-positive-strong font-medium">
                ✓ Solicitação registrada — aguarde contato em até 15 dias úteis.
              </p>
            ) : (
              <Button variant="outline" size="sm" onClick={handleRequestExport} disabled={exportSubmitting}>
                <Download className="w-4 h-4 mr-2" />
                {exportSubmitting ? "Enviando..." : "Solicitar exportação de dados"}
              </Button>
            )
          ) : (
            <p className="text-sm text-muted-foreground">
              Para solicitar a exportação pelo sistema, faça{" "}
              <Link to="/login" className="text-ink underline">
                login
              </Link>
              . Ou envie um email para privacidade@trnty.com.br.
            </p>
          )}
        </section>

        <section>
          <h2 className="text-xl font-medium tracking-tight mb-3">5. Encarregado de Dados (DPO)</h2>
          <div className="text-sm text-muted-foreground leading-relaxed space-y-2">
            <p>
              <strong className="text-foreground">Controlador:</strong> Trinity Company LTDA
            </p>
            <p>
              <strong className="text-foreground">Encarregado (DPO):</strong> privacidade@trnty.com.br
            </p>
            <p>
              Você pode exercer todos os direitos do Art. 18 da LGPD (acesso, correção, portabilidade, exclusão,
              revogação de consentimento) diretamente nesta página ou pelo email acima. Respondemos em até 15 dias.
            </p>
            <p>
              Em caso de incidente de segurança que afete seus dados, você será notificado por email e a ANPD será
              comunicada conforme previsto na Lei 13.709/2018.
            </p>
          </div>
        </section>

        <p className="text-xs text-muted-foreground pt-8 border-t">Última atualização: 05 de maio de 2026.</p>
      </main>
    </div>
  );
}
