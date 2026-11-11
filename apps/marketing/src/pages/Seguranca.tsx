import { Link } from "react-router-dom";
import { ArrowLeft, Lock } from "lucide-react";
import { APP_URL } from "../config";
import { usePageMeta } from "../lib/seo";

// Página pública de segurança (trust center). Cada afirmação aqui tem fonte no repositório,
// que é público: docs/legal/SUBPROCESSADORES.md, docs/security/SECURITY.md,
// docs/operations/DISASTER_RECOVERY.md, .github/workflows/backup-nightly.yml,
// drill-restore-mensal.yml e monitor-producao.yml, supabase/tests/cross_tenant_matrix.sql,
// ADR 0031 (MFA) e ADR 0047 (status page), SPEC 115/116 (LGPD). Mudou o fato, muda aqui.
// Não citar certificação que o Pilar não tem.

const REPO = "https://github.com/Trinity-Comp4ny/pilar";
const SUBPROCESSADORES_URL = `${REPO}/blob/main/docs/legal/SUBPROCESSADORES.md`;
const REPORTE_URL = `${REPO}/security/advisories/new`;
const STATUS_URL = `${APP_URL}/status`;

type Fornecedor = { nome: string; funcao: string; local: string };

const FORNECEDORES: Fornecedor[] = [
  {
    nome: "Supabase",
    funcao: "Banco de dados, login e arquivos (logos, fotos de obra, documentos)",
    local: "São Paulo, Brasil",
  },
  { nome: "Vercel", funcao: "Hospedagem do app e deste site", local: "Rede global; pode processar fora do Brasil" },
  { nome: "Resend", funcao: "E-mails do sistema: convite, recuperação de senha, avisos", local: "EUA" },
  { nome: "Asaas", funcao: "Cobrança da assinatura do Pilar", local: "Brasil" },
  {
    nome: "Sentry",
    funcao: "Monitoramento de erros. CPF, CNPJ, senhas e dados bancários são filtrados antes do envio",
    local: "EUA/UE",
  },
  { nome: "PostHog", funcao: "Análise de uso, só com o seu consentimento de cookies", local: "EUA" },
  {
    nome: "Google (Gemini API)",
    funcao: "Modelo dos agentes de IA. Uso no plano pago da API, cujos termos não usam o conteúdo para treinar modelo",
    local: "EUA/global",
  },
  {
    nome: "Vercel AI Gateway",
    funcao: "Ponte para modelos de outros fornecedores (como Anthropic), quando uma função é configurada para eles",
    local: "EUA/global",
  },
  { nome: "Cloudflare (Turnstile)", funcao: "Proteção contra abuso no cadastro", local: "Global" },
];

const linkClass = "text-ink underline";

export function Seguranca() {
  usePageMeta({
    titulo: "Segurança e confiança | Pilar",
    descricao:
      "Onde ficam os dados do seu escritório, como o acesso é protegido, backup, LGPD, disponibilidade e como reportar uma vulnerabilidade.",
    caminho: "/seguranca",
  });

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
            <Lock className="w-5 h-5 text-foreground" />
            <h1 className="text-lg font-medium tracking-tight">Segurança e confiança</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12 max-w-3xl space-y-12">
        <section className="rounded-lg border bg-muted/30 p-6 space-y-2">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Esta página descreve o que o Pilar faz hoje para proteger os dados do seu escritório. O código do Pilar é
            aberto: cada item aqui pode ser conferido no{" "}
            <a href={REPO} target="_blank" rel="noopener noreferrer" className={linkClass}>
              repositório
            </a>
            . Onde ainda há limite, ele está escrito.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            O Pilar ainda não tem certificação própria de segurança, como SOC 2 ou ISO 27001.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-medium tracking-tight mb-3">1. Onde os dados ficam</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            O banco de dados do Pilar fica em São Paulo. Os fornecedores abaixo processam dados para o produto
            funcionar, cada um só no que a função exige. Não vendemos dados.
          </p>
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Fornecedor</th>
                  <th className="px-4 py-3 text-left font-medium">Para quê</th>
                  <th className="px-4 py-3 text-left font-medium">Onde</th>
                </tr>
              </thead>
              <tbody>
                {FORNECEDORES.map((f) => (
                  <tr key={f.nome} className="border-t">
                    <td className="px-4 py-3 align-top text-foreground">{f.nome}</td>
                    <td className="px-4 py-3 align-top text-muted-foreground">{f.funcao}</td>
                    <td className="px-4 py-3 align-top text-muted-foreground">{f.local}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed mt-4">
            Lista completa e atualizada, com os serviços públicos de consulta de CEP e CNPJ:{" "}
            <a href={SUBPROCESSADORES_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
              subprocessadores do Pilar
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-xl font-medium tracking-tight mb-3">2. Proteção de acesso</h2>
          <ul className="text-sm text-muted-foreground leading-relaxed list-disc pl-6 space-y-2">
            <li>
              <strong className="text-foreground">Cada escritório é isolado no banco.</strong> Toda tabela com dado de
              escritório tem regra de acesso por linha (RLS) amarrada à empresa. Um teste automático tenta ler, alterar
              e excluir dados de outro escritório a cada mudança de código; qualquer vazamento reprova a mudança.
            </li>
            <li>
              <strong className="text-foreground">Verificação em duas etapas.</strong> Código de app autenticador (TOTP)
              e códigos de backup, ativados em Configurações, Segurança. É opcional para quem usa o Pilar e obrigatória
              para a equipe do Pilar que dá suporte a mais de um escritório.
            </li>
            <li>
              <strong className="text-foreground">Login individual, por convite.</strong> Cada pessoa entra com a
              própria conta e o administrador do escritório define o papel de cada uma. Em Configurações, Segurança,
              você encerra o acesso em todos os outros aparelhos.
            </li>
            <li>
              <strong className="text-foreground">Conexão cifrada.</strong> Todo acesso é por HTTPS, com HSTS e política
              de segurança de conteúdo (CSP) no app e neste site.
            </li>
            <li>
              <strong className="text-foreground">Registro de auditoria.</strong> As alterações ficam num registro que
              só aceita inclusão, encadeado por hash: adulterar uma linha quebra a corrente.
            </li>
            <li>
              <strong className="text-foreground">Código verificado a cada mudança.</strong> Varredura de segredos
              vazados, auditoria de dependências e testes de regra de acesso rodam antes de qualquer entrega.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-medium tracking-tight mb-3">3. Backup e recuperação</h2>
          <ul className="text-sm text-muted-foreground leading-relaxed list-disc pl-6 space-y-2">
            <li>
              <strong className="text-foreground">Backup diário.</strong> Todo dia às 3h (horário de Brasília), cópia
              completa do banco e dos arquivos enviados, cifrada com AES-256 e guardada por 30 dias.
            </li>
            <li>
              <strong className="text-foreground">Restauração testada todo mês.</strong> No dia 1º, o último backup de
              produção é restaurado num banco vazio e conferido tabela por tabela, junto com as regras de acesso. Se
              falhar, a equipe é avisada.
            </li>
            <li>
              <strong className="text-foreground">Limite atual.</strong> O ponto de recuperação é o último backup: até
              24 horas de dado. Ainda não há recuperação para qualquer instante (PITR). A meta para restaurar o serviço
              é de até 4 horas.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-medium tracking-tight mb-3">4. LGPD e direitos do titular</h2>
          <ul className="text-sm text-muted-foreground leading-relaxed list-disc pl-6 space-y-2">
            <li>
              <strong className="text-foreground">Exportar seus dados.</strong> Em Configurações, Privacidade, o pedido
              gera uma cópia dos seus dados e envia por e-mail um link válido por 7 dias.
            </li>
            <li>
              <strong className="text-foreground">Excluir seus dados.</strong> No mesmo lugar. A equipe analisa e
              conclui em até 15 dias: o dado pessoal é apagado, o perfil é anonimizado e o login é bloqueado. Ficam só
              os registros que a lei obriga a guardar, como os fiscais por 5 anos.
            </li>
            <li>
              <strong className="text-foreground">Sem acesso à conta?</strong> Escreva para o encarregado de dados:
              privacidade@pilarsoft.com.br.
            </li>
            <li>
              <strong className="text-foreground">Incidente.</strong> Se um incidente de segurança afetar seus dados,
              você é avisado por e-mail e a ANPD é comunicada, como manda a Lei 13.709/2018.
            </li>
          </ul>
          <p className="text-sm text-muted-foreground leading-relaxed mt-4">
            Retenção, base legal e todos os direitos do art. 18 estão na{" "}
            <Link to="/privacidade" className={linkClass}>
              Política de Privacidade
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="text-xl font-medium tracking-tight mb-3">5. Disponibilidade</h2>
          <div className="text-sm text-muted-foreground leading-relaxed space-y-2">
            <p>
              Acompanhe o estado do sistema na{" "}
              <a href={STATUS_URL} className={linkClass}>
                página de status
              </a>
              . Monitores externos checam app, login, banco, pagamentos, e-mails e agentes de IA a cada poucos minutos,
              e um teste faz login real em produção a cada 10 minutos.
            </p>
            <p>A meta interna é 99,9% de disponibilidade. Não há SLA contratual por enquanto.</p>
          </div>
        </section>

        <section className="rounded-lg border bg-muted/30 p-6 space-y-3">
          <h2 className="text-xl font-medium tracking-tight">6. Como reportar uma vulnerabilidade</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Use o{" "}
            <a href={REPORTE_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
              reporte privado do GitHub
            </a>
            , que só os mantenedores veem. Não abra issue pública. Descreva a falha, os passos para reproduzir e o
            impacto. Respondemos em até 72 horas úteis.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Não há recompensa em dinheiro hoje; com a sua permissão, reconhecemos o reporte publicamente. A política
            também está em{" "}
            <a href="/.well-known/security.txt" className={linkClass}>
              /.well-known/security.txt
            </a>
            .
          </p>
        </section>

        <p className="text-xs text-muted-foreground pt-8 border-t">Última atualização: 10 de novembro de 2026.</p>
      </main>
    </div>
  );
}
