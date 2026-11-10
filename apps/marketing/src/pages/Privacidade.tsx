import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Cookie, ShieldCheck } from "lucide-react";
import { APP_URL } from "../config";
import { getCookieConsent, CONSENT_CHANGED_EVENT, requestCookieConsentReview } from "../cookieConsent";
import { usePageMeta } from "../lib/seo";

/**
 * Política de Privacidade publicada (v2.0). Fonte de verdade do que está ao vivo;
 * `docs/legal/` guarda o contexto e os rascunhos. Cada afirmação aqui tem de bater
 * com o código e com `docs/legal/SUBPROCESSADORES.md`: política que promete o que o
 * sistema não faz é pior do que política curta (LGPD art. 6º, VI).
 */

const ATUALIZADA_EM = "10 de novembro de 2026";
const VERSAO = "2.0";

type Linha = string[];

function Tabela({ cabecalho, linhas }: { cabecalho: string[]; linhas: Linha[] }) {
  return (
    <div className="rounded-lg border overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            {cabecalho.map((c) => (
              <th key={c} className="px-4 py-3 text-left font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) => (
            <tr key={linha[0]} className="border-t">
              {linha.map((celula, i) => (
                <td key={i} className={`px-4 py-3 align-top ${i === 0 ? "" : "text-muted-foreground"}`}>
                  {celula}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-medium tracking-tight mb-3">{titulo}</h2>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

const DADOS: Linha[] = [
  [
    "Conta: nome, e-mail, telefone, cargo e empresa",
    "Criar e manter a conta, autenticar, enviar avisos do serviço",
    "Execução de contrato (art. 7º, V)",
  ],
  [
    "Segurança e acesso: senha (só o hash), segundo fator, IP, navegador, data e hora, ações feitas no sistema",
    "Proteger a conta, prevenir fraude e abuso, auditar alterações, guardar registros de acesso",
    "Obrigação legal (art. 7º, II; Marco Civil, art. 15) e legítimo interesse (art. 7º, IX)",
  ],
  [
    "Cobrança da assinatura: nome ou razão social, CPF ou CNPJ, cartão (guardado pelo Asaas, nunca por nós)",
    "Cobrar a assinatura e os créditos de IA, emitir comprovantes",
    "Execução de contrato e obrigação legal fiscal (art. 7º, II e V)",
  ],
  [
    "Comprovantes de aceite e de consentimento: versão do documento, data e escolha feita",
    "Provar o que foi aceito e quando",
    "Obrigação legal (art. 8º, §2º) e exercício regular de direitos (art. 7º, VI)",
  ],
  [
    "Navegação no site e no aplicativo: páginas, cliques em botões e identificador pseudônimo",
    "Entender o uso e melhorar o produto",
    "Consentimento (art. 7º, I), só se você aceitar os cookies de análise",
  ],
  [
    "Origem da visita: parâmetros de campanha (UTM), site que trouxe você, identificador de clique em anúncio",
    "Saber qual canal traz visitantes. Fica só na sessão do navegador e não identifica você",
    "Legítimo interesse (art. 7º, IX)",
  ],
  [
    "Falhas técnicas: registro do erro, identificador do usuário e reprodução da tela com todo texto, campo e imagem mascarados",
    "Encontrar e corrigir falhas",
    "Legítimo interesse (art. 7º, IX)",
  ],
  [
    "Dados que o escritório insere: clientes, equipe, fornecedores, projetos, obras, financeiro, documentos, fotos e áudios do Pilar Campo",
    "Prestar o serviço contratado pelo escritório",
    "Definida pelo escritório, que é o controlador. O Pilar trata como operador (seção 1)",
  ],
];

const OPERADORES: Linha[] = [
  ["Supabase", "Banco de dados, autenticação e arquivos", "Brasil (São Paulo)"],
  ["Vercel", "Hospedagem do site, do aplicativo e das funções", "Global"],
  [
    "Google (Gemini)",
    "Agentes de IA: chat, leitura de documentos, transcrição de áudio do Pilar Campo",
    "EUA / global",
  ],
  [
    "Vercel AI Gateway, Anthropic e TypeSafe AI",
    "Modelos de IA alternativos do chat, só quando ativados",
    "EUA / global",
  ],
  ["Resend", "E-mails do serviço (convite, recuperação de senha, avisos)", "EUA"],
  ["Sentry", "Registro de falhas técnicas", "EUA"],
  ["PostHog", "Análise de uso, só com seu consentimento", "EUA"],
  ["Google (Tag Manager e Analytics)", "Análise de uso no aplicativo, só com seu consentimento", "EUA"],
  ["Asaas", "Cobrança da assinatura e dos créditos de IA", "Brasil"],
  ["Cloudflare (Turnstile)", "Proteção contra robôs em formulários", "Global"],
  ["GitHub", "Guarda da cópia de segurança diária, cifrada antes de sair do banco", "EUA"],
  [
    "Consultas públicas: BrasilAPI, ViaCEP, OpenStreetMap, Open-Meteo e BigDataCloud",
    "Endereço pelo CEP, conferência de CNPJ, mapa e previsão do tempo da obra. Recebem CEP, CNPJ, endereço ou coordenada, nunca nome ou e-mail",
    "Brasil, Europa e Austrália",
  ],
];

const RETENCAO: Linha[] = [
  [
    "Conta ativa",
    "Enquanto a conta existir. Encerrada a conta ou atendido um pedido de exclusão, o dado pessoal é apagado ou anonimizado",
  ],
  [
    "Dados do escritório depois do fim da assinatura (ou da avaliação concedida após a demonstração)",
    "90 dias em modo somente leitura, com exportação disponível. Depois, o que tem obrigação fiscal é anonimizado e o restante é eliminado",
  ],
  ["Registros financeiros e fiscais", "5 anos, como exige a legislação fiscal"],
  ["Registros de auditoria e de acesso", "1 ano em uso e mais 4 anos arquivados, depois eliminados"],
  ["Áudio gravado no Pilar Campo", "12 meses. Depois o áudio é apagado e o texto do registro continua"],
  ["Cópias de segurança", "30 dias, cifradas"],
  ["Arquivo de exportação dos seus dados", "Link válido por 7 dias"],
  ["Escolha sobre cookies", "12 meses. Depois disso perguntamos de novo"],
  [
    "Comprovantes de aceite e de consentimento",
    "Enquanto puderem ser exigidos para provar o aceite, mesmo depois do encerramento da conta",
  ],
];

const COOKIES: Linha[] = [
  ["Sessão de login (Supabase)", "Essencial", "Manter você conectado", "Até sair da conta ou a sessão expirar"],
  ["pilar_cookie_consent", "Essencial", "Lembrar sua escolha sobre cookies no site e no aplicativo", "12 meses"],
  ["pilar_logged_hint", "Essencial", "Levar quem já tem conta direto ao aplicativo", "Até sair da conta"],
  ["Cloudflare Turnstile", "Essencial", "Diferenciar pessoa de robô em formulários", "Sessão"],
  ["Preferências de interface", "Essencial", "Lembrar ajustes de tela", "Até você limpar o navegador"],
  ["PostHog (ph_*)", "Análise", "Medir páginas visitadas e cliques", "Até 12 meses ou até você revogar"],
  [
    "Google Analytics (_ga*), via Tag Manager",
    "Análise",
    "Medir o uso do aplicativo",
    "Até 2 anos ou até você revogar",
  ],
];

const DIREITOS = [
  "Confirmação de que tratamos dados seus",
  "Acesso aos dados",
  "Correção de dados incompletos, inexatos ou desatualizados",
  "Anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade com a lei",
  "Portabilidade para outro fornecedor",
  "Eliminação dos dados tratados com base no seu consentimento",
  "Informação sobre com quem compartilhamos seus dados",
  "Informação sobre a possibilidade de não consentir e o que acontece se você não consentir",
  "Revogação do consentimento, a qualquer momento",
  "Oposição a tratamento feito com base em outra hipótese legal, se houver descumprimento da lei",
  "Revisão de decisão tomada só com tratamento automatizado (art. 20)",
  "Petição à Autoridade Nacional de Proteção de Dados (ANPD)",
];

export function Privacidade() {
  const [analyticsConsent, setAnalyticsConsent] = useState(() => getCookieConsent()?.analytics ?? false);

  usePageMeta({
    titulo: "Política de Privacidade | Pilar",
    descricao:
      "Como o Pilar coleta, usa e protege os dados do seu escritório de engenharia ou arquitetura, e quais são os seus direitos pela LGPD.",
    caminho: "/privacidade",
  });

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
          <div className="text-sm text-muted-foreground leading-relaxed space-y-3">
            <p>
              O Pilar é um sistema de gestão com agentes de IA para escritórios de engenharia e arquitetura. Esta página
              explica quais dados pessoais tratamos, para quê, com quem compartilhamos, por quanto tempo guardamos e
              como você exerce seus direitos pela Lei Geral de Proteção de Dados (Lei 13.709/2018, LGPD).
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Não vendemos dados. Nenhum fornecedor usa seus dados para treinar modelo de IA.</li>
              <li>Cookies de análise só funcionam se você aceitar. Recusar não muda nada no uso do produto.</li>
              <li>Parte dos fornecedores fica fora do Brasil (seção 5).</li>
              <li>Você pode exportar ou excluir seus dados pelo próprio aplicativo.</li>
            </ul>
          </div>
        </section>

        <Secao titulo="1. Quem somos e quem decide sobre os dados">
          <p>
            <strong className="text-foreground">Controlador:</strong> Pilar (razão social, CNPJ e endereço próprios em
            regularização; serão publicados nesta página assim que a formalização for concluída).
          </p>
          <p>O Pilar tem dois papéis, e eles mudam a quem você deve se dirigir:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong className="text-foreground">Controlador</strong> dos dados de quem usa o Pilar (conta, acesso,
              cobrança, consentimentos) e de quem visita este site.
            </li>
            <li>
              <strong className="text-foreground">Operador</strong> dos dados que o escritório cliente insere no
              sistema: os clientes dele, a equipe, os fornecedores, as obras. Aqui quem decide é o escritório, e o Pilar
              trata esses dados conforme as instruções dele e os{" "}
              <Link to="/termos" className="text-ink underline">
                Termos de Uso
              </Link>
              .
            </li>
          </ul>
          <p>
            Se você é cliente de um escritório que usa o Pilar (portal do cliente), fornecedor que respondeu uma cotação
            por link, ou profissional que usa o Pilar Campo a convite de um escritório, o controlador dos seus dados é
            esse escritório. Peça a ele o exercício dos seus direitos. Se escrever para nós, encaminhamos o pedido.
          </p>
        </Secao>

        <Secao titulo="2. Que dados tratamos, para quê e com qual base legal">
          <Tabela cabecalho={["Dado", "Para quê", "Base legal (LGPD)"]} linhas={DADOS} />
          <p>
            O Pilar não foi feito para dados sensíveis (saúde, biometria, origem racial, opinião política). Eles podem
            aparecer por acaso em texto livre ou em áudio; nesse caso são tratados com o mesmo cuidado e sob a
            responsabilidade do escritório que os inseriu.
          </p>
        </Secao>

        <Secao titulo="3. Agentes de IA">
          <p>
            Quando você usa um agente de IA do Pilar (chat, leitura de cotação ou documento financeiro, organização do
            registro de obra a partir de áudio e fotos), o conteúdo necessário para a tarefa é enviado ao provedor do
            modelo: hoje o Google Gemini e, quando ativados, Anthropic e TypeSafe AI pelo Vercel AI Gateway.
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>O provedor recebe só o que a tarefa exige e não usa o conteúdo para treinar modelo.</li>
            <li>
              A IA prepara, a sua equipe revisa e aprova. Nenhum agente toma sozinho decisão com efeito jurídico ou que
              afete significativamente uma pessoa.
            </li>
            <li>
              Se entender que alguma decisão sobre você foi tomada só de forma automatizada, você pode pedir revisão
              (art. 20 da LGPD) pelo e-mail da seção 10.
            </li>
          </ul>
        </Secao>

        <Secao titulo="4. Com quem compartilhamos">
          <p>
            Compartilhamos dados com os fornecedores abaixo, cada um limitado à função descrita. Além deles, só com
            autoridade pública, quando houver ordem judicial ou obrigação legal.
          </p>
          <Tabela cabecalho={["Fornecedor", "Função", "Onde processa"]} linhas={OPERADORES} />
          <p>
            <strong className="text-foreground">Acesso do suporte:</strong> para resolver um problema, a equipe do Pilar
            pode acessar a conta do escritório. Todo acesso fica registrado.
          </p>
        </Secao>

        <Secao titulo="5. Transferência internacional">
          <p>
            O banco de dados fica no Brasil (São Paulo). Os fornecedores marcados como EUA, Europa, Austrália ou global
            na seção 4 processam dados fora do Brasil, sempre com conexão cifrada. Estamos formalizando com cada um as
            garantias do art. 33 da LGPD, pelas cláusulas-padrão da ANPD (Resolução CD/ANPD nº 19/2024) ou pelo acordo
            de tratamento de dados equivalente do fornecedor. Esta página é atualizada conforme cada formalização é
            concluída.
          </p>
        </Secao>

        <Secao titulo="6. Por quanto tempo guardamos">
          <Tabela cabecalho={["Dado", "Prazo"]} linhas={RETENCAO} />
        </Secao>

        <section className="rounded-lg border bg-muted/30 p-6 space-y-4">
          <div className="flex items-start gap-3">
            <Cookie className="w-5 h-5 text-foreground mt-0.5" />
            <div className="flex-1 space-y-2">
              <h2 className="text-xl font-medium tracking-tight">7. Cookies</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Cookies essenciais funcionam sempre: sem eles o login e a navegação não funcionam (legítimo interesse e
                execução de contrato). Cookies de análise só são gravados depois que você aceita, e nada é enviado ao
                PostHog ou ao Google antes disso. Não usamos cookies de publicidade. Hoje:{" "}
                <strong className="text-foreground">
                  {analyticsConsent ? "cookies de análise aceitos" : "cookies de análise recusados"}
                </strong>
                .
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Sua escolha vale neste site e no aplicativo. Se você tem conta no Pilar, ela fica registrada na conta e
                pode ser alterada em Configurações, Privacidade.
              </p>
            </div>
          </div>
          <Tabela cabecalho={["Cookie ou registro", "Tipo", "Para quê", "Duração"]} linhas={COOKIES} />
          <button
            type="button"
            onClick={requestCookieConsentReview}
            className="px-4 py-2 rounded-full border border-ink/15 text-sm font-medium text-ink-soft hover:bg-slate-50 transition-colors"
          >
            Alterar preferências de cookies
          </button>
        </section>

        <Secao titulo="8. Segurança">
          <ul className="list-disc pl-6 space-y-1">
            <li>Conexão sempre cifrada (HTTPS).</li>
            <li>Senhas guardadas só como hash. Segundo fator de autenticação disponível para toda conta.</li>
            <li>Isolamento entre escritórios no próprio banco de dados, verificado por testes a cada mudança.</li>
            <li>Registro de auditoria das ações e dos acessos do suporte.</li>
            <li>Cópia de segurança diária, cifrada.</li>
          </ul>
          <p>
            Se um incidente de segurança puder causar risco ou dano relevante a você, avisamos você e a ANPD nos prazos
            da Resolução CD/ANPD nº 15/2024.
          </p>
        </Secao>

        <Secao titulo="9. Seus direitos (LGPD, art. 18)">
          <ul className="list-disc pl-6 space-y-1">
            {DIREITOS.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </Secao>

        <section className="rounded-lg border bg-muted/30 p-6 space-y-3">
          <h3 className="font-medium">Como exercer</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Exportar ou excluir seus dados: faça{" "}
            <a href={`${APP_URL}/login`} className="text-ink underline">
              login
            </a>{" "}
            e acesse Configurações, Privacidade. Para os demais direitos, ou se não tiver acesso à conta, escreva para{" "}
            <a href="mailto:privacidade@pilarsoft.com.br" className="text-ink underline">
              privacidade@pilarsoft.com.br
            </a>
            . Respondemos em até 15 dias. Dados com obrigação legal de guarda (fiscais, por exemplo) são mantidos pelo
            prazo da lei, e informamos isso na resposta.
          </p>
        </section>

        <Secao titulo="10. Encarregado pelo tratamento de dados">
          <p>
            Fale com o encarregado pelo e-mail{" "}
            <a href="mailto:privacidade@pilarsoft.com.br" className="text-ink underline">
              privacidade@pilarsoft.com.br
            </a>
            . Se a resposta não resolver, você pode recorrer à{" "}
            <a href="https://www.gov.br/anpd/pt-br" className="text-ink underline" rel="noopener noreferrer">
              ANPD
            </a>
            .
          </p>
        </Secao>

        <Secao titulo="11. Menores de idade">
          <p>
            O Pilar é um serviço para empresas e não se destina a menores de 18 anos. Se identificarmos dado de menor
            cadastrado como usuário, ele é excluído.
          </p>
        </Secao>

        <Secao titulo="12. Mudanças nesta política">
          <p>
            Mudanças relevantes (nova finalidade, novo fornecedor, nova categoria de cookie) são avisadas por e-mail aos
            administradores das contas antes de valer e, quando dependem de consentimento, pedimos de novo. Ajustes de
            redação podem ser feitos sem aviso. A versão e a data ficam no fim desta página.
          </p>
        </Secao>

        <p className="text-xs text-muted-foreground pt-8 border-t">
          Versão {VERSAO}. Última atualização: {ATUALIZADA_EM}.
        </p>
      </main>
    </div>
  );
}
