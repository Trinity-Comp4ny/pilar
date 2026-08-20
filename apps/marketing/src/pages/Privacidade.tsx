import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Cookie, ShieldCheck } from "lucide-react";
import { APP_URL } from "../config";
import { getCookieConsent, CONSENT_CHANGED_EVENT, requestCookieConsentReview } from "../cookieConsent";

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

// Texto legal público. As ações de exportar/excluir dados (que exigem sessão
// autenticada) ficam no app, em Configurações → Privacidade — ver ADR 0025.
export function Privacidade() {
  const [analyticsConsent, setAnalyticsConsent] = useState(() => getCookieConsent()?.analytics ?? false);

  useEffect(() => {
    document.title = "Política de Privacidade | Pilar";
  }, []);

  useEffect(() => {
    const onConsentChanged = () => setAnalyticsConsent(getCookieConsent()?.analytics ?? false);
    window.addEventListener(CONSENT_CHANGED_EVENT, onConsentChanged);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, onConsentChanged);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-6 py-6 flex items-center gap-4">
          <Link
            to="/"
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-ink-soft hover:bg-paper-alt transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Link>
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
            Controlador: Pilar. Encarregado de Dados (DPO): privacidade@pilarsoft.com.br. O tratamento de dados ocorre
            em servidores da Supabase Inc. e parceiros, hospedados na América do Sul (São Paulo).
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

        <section className="rounded-lg border bg-muted/30 p-6 space-y-3">
          <div className="flex items-start gap-3">
            <Cookie className="w-5 h-5 text-foreground mt-0.5" />
            <div className="flex-1">
              <h2 className="text-xl font-medium tracking-tight mb-1">4. Cookies</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Usamos cookies estritamente necessários (sessão) sempre. Cookies de análise (PostHog) só são ativados
                com o seu consentimento explícito. Hoje:{" "}
                <strong className="text-foreground">
                  {analyticsConsent ? "cookies de análise aceitos" : "cookies de análise recusados"}
                </strong>
                .
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                Sua escolha vale neste site e no aplicativo. Se você tem conta no Pilar, ela fica registrada na conta e
                pode ser alterada a qualquer momento em Configurações, Privacidade.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={requestCookieConsentReview}
            className="px-4 py-2 rounded-full border border-ink/15 text-sm font-medium text-ink-soft hover:bg-slate-50 transition-colors"
          >
            Alterar preferências de cookies
          </button>
        </section>

        <section>
          <h2 className="text-xl font-medium tracking-tight mb-3">5. Seus direitos (LGPD Art. 18)</h2>
          <ul className="text-sm text-muted-foreground leading-relaxed list-disc pl-6 space-y-1">
            <li>Confirmação da existência de tratamento</li>
            <li>Acesso e portabilidade dos dados</li>
            <li>Correção de dados incompletos ou desatualizados</li>
            <li>Anonimização, bloqueio ou eliminação de dados desnecessários</li>
            <li>Revogação do consentimento</li>
          </ul>
        </section>

        <section className="rounded-lg border bg-muted/30 p-6 space-y-4">
          <div>
            <h3 className="font-medium mb-1">Exercer seus direitos (exportar ou excluir dados)</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Você pode solicitar a exportação ou a exclusão dos seus dados pessoais a qualquer momento. Faça{" "}
              <a href={`${APP_URL}/login`} className="text-ink underline">
                login
              </a>{" "}
              e acesse Configurações → Privacidade. Processamos a solicitação em até 15 dias, respeitando obrigações
              legais que exigem retenção (ex.: dados fiscais por 5 anos). Sem acesso à conta, envie um email para
              privacidade@pilarsoft.com.br.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-medium tracking-tight mb-3">6. Encarregado de Dados (DPO)</h2>
          <div className="text-sm text-muted-foreground leading-relaxed space-y-2">
            <p>
              <strong className="text-foreground">Controlador:</strong> Pilar (razão social e CNPJ próprios em
              regularização)
            </p>
            <p>
              <strong className="text-foreground">Encarregado (DPO):</strong> privacidade@pilarsoft.com.br
            </p>
            <p>
              Você pode exercer todos os direitos do Art. 18 da LGPD (acesso, correção, portabilidade, exclusão,
              revogação de consentimento) diretamente pelo sistema (autenticado) ou pelo email acima. Respondemos em até
              15 dias.
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
