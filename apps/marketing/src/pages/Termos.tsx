import { Link } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";
import { usePageMeta } from "../lib/seo";

const SECTIONS: { titulo: string; corpo: React.ReactNode }[] = [
  {
    titulo: "1. Definições",
    corpo: (
      <ul className="list-disc pl-6 space-y-1">
        <li>
          <strong className="text-foreground">Plataforma</strong>: o software Pilar, incluindo web app, APIs e
          integrações.
        </li>
        <li>
          <strong className="text-foreground">Cliente</strong>: a empresa que contrata o Pilar (titular da assinatura).
        </li>
        <li>
          <strong className="text-foreground">Usuário</strong>: qualquer pessoa com login na conta do Cliente.
        </li>
        <li>
          <strong className="text-foreground">Dados do Cliente</strong>: informações inseridas pelo Cliente na
          Plataforma (projetos, clientes finais, financeiro, documentos).
        </li>
        <li>
          <strong className="text-foreground">Conta</strong>: o espaço isolado de dados do Cliente na Plataforma
          (multi-tenant por empresa).
        </li>
      </ul>
    ),
  },
  {
    titulo: "2. Objeto e licença de uso",
    corpo: (
      <p>
        O Pilar concede ao Cliente uma licença não exclusiva, intransferível e revogável para usar a Plataforma durante
        a vigência do contrato, estritamente para gestão interna do próprio negócio do Cliente. Não é permitido
        sublicenciar, revender ou disponibilizar a Plataforma a terceiros fora do escopo da própria empresa Cliente.
      </p>
    ),
  },
  {
    titulo: "3. Cadastro e conta",
    corpo: (
      <ul className="list-disc pl-6 space-y-1">
        <li>O Cliente é responsável por manter os dados cadastrais corretos e atualizados.</li>
        <li>Cada Usuário deve ter login individual: contas não podem ser compartilhadas entre pessoas.</li>
        <li>
          O Cliente é responsável pela segurança das credenciais de seus Usuários e por qualquer atividade realizada com
          elas.
        </li>
        <li>O Cliente controla o nível de acesso de cada Usuário (admin, membro etc.).</li>
      </ul>
    ),
  },
  {
    titulo: "4. Uso aceitável",
    corpo: (
      <>
        <p className="mb-2">Não é permitido:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Usar a Plataforma para fins ilegais ou para violar direitos de terceiros.</li>
          <li>Tentar acessar dados de outra empresa (fora da sua conta).</li>
          <li>
            Fazer engenharia reversa, extrair código-fonte ou burlar limites técnicos (rate limiting, autenticação) da
            Plataforma.
          </li>
          <li>
            Sobrecarregar a infraestrutura de forma deliberada (scraping agressivo, testes de carga não autorizados).
          </li>
          <li>
            Usar a Plataforma para armazenar dados de categorias sensíveis não previstas no escopo do produto (saúde,
            biometria, opinião política).
          </li>
        </ul>
        <p className="mt-2">
          Violação destes itens autoriza suspensão imediata da conta, sem prejuízo de outras medidas cabíveis.
        </p>
      </>
    ),
  },
  {
    titulo: "5. Dados do Cliente",
    corpo: (
      <ul className="list-disc pl-6 space-y-1">
        <li>
          O Cliente é o <strong className="text-foreground">controlador</strong> dos Dados do Cliente (LGPD); o Pilar
          atua como <strong className="text-foreground">operador</strong>, processando esses dados apenas conforme
          instruído pelo Cliente e pela Política de Privacidade.
        </li>
        <li>
          O Cliente é responsável por ter base legal para os dados de terceiros (clientes finais, fornecedores) que
          insere na Plataforma.
        </li>
        <li>
          Ao encerrar o contrato, o Cliente pode exportar seus dados por até <strong>30 dias</strong>; depois disso, os
          dados são anonimizados ou eliminados conforme a Política de Privacidade e obrigações legais de retenção (ex.:
          fiscal, 5 anos).
        </li>
      </ul>
    ),
  },
  {
    titulo: "6. Propriedade intelectual",
    corpo: (
      <ul className="list-disc pl-6 space-y-1">
        <li>O código, design, marca e demais ativos de propriedade intelectual da Plataforma pertencem ao Pilar.</li>
        <li>O Cliente mantém todos os direitos sobre os Dados do Cliente inseridos na Plataforma.</li>
        <li>
          Feedback e sugestões enviados pelo Cliente podem ser usados pelo Pilar para melhorar o produto, sem obrigação
          de compensação.
        </li>
      </ul>
    ),
  },
  {
    titulo: "7. Pagamento e cobrança",
    corpo: (
      <ul className="list-disc pl-6 space-y-1">
        <li>Planos e valores estão descritos na página de Planos vigente no momento da contratação.</li>
        <li>
          Cobrança é recorrente (mensal ou conforme plano contratado), via os meios de pagamento disponíveis na
          Plataforma.
        </li>
        <li>Atraso no pagamento pode resultar em suspensão de acesso após aviso prévio.</li>
        <li>
          Cancelamento pode ser feito a qualquer momento; não há reembolso proporcional de período já pago, salvo
          disposição legal em contrário.
        </li>
      </ul>
    ),
  },
  {
    titulo: "8. Disponibilidade do serviço",
    corpo: (
      <p>
        A Plataforma é fornecida <strong className="text-foreground">"como está" e "conforme disponível"</strong>, sem
        garantia de disponibilidade ininterrupta. Fazemos esforços razoáveis para manter o serviço no ar e comunicar
        manutenções planejadas com antecedência, mas não há SLA contratual formal nesta fase do produto.
      </p>
    ),
  },
  {
    titulo: "9. Limitação de responsabilidade",
    corpo: (
      <p>
        Na máxima extensão permitida por lei, o Pilar não se responsabiliza por danos indiretos, lucros cessantes ou
        perda de dados decorrentes de uso indevido da Plataforma pelo Cliente, falhas de terceiros (provedores de
        infraestrutura, gateways de pagamento) fora do nosso controle razoável, ou descumprimento pelo Cliente destes
        Termos. Nada aqui exclui responsabilidade que não pode ser limitada por lei (ex.: dolo, violação de dados por
        falha de segurança comprovadamente atribuível ao Pilar).
      </p>
    ),
  },
  {
    titulo: "10. Confidencialidade",
    corpo: (
      <p>
        Ambas as partes se comprometem a manter sigilo sobre informações confidenciais trocadas em razão do contrato
        (dados de negócio, informações técnicas não públicas), usando-as apenas para a execução do contrato.
      </p>
    ),
  },
  {
    titulo: "11. Vigência e rescisão",
    corpo: (
      <ul className="list-disc pl-6 space-y-1">
        <li>O contrato vigora enquanto a assinatura estiver ativa.</li>
        <li>Qualquer parte pode rescindir a qualquer momento; o Cliente mantém acesso até o fim do período já pago.</li>
        <li>
          O Pilar pode suspender ou encerrar a conta em caso de violação destes Termos, inadimplência não sanada após
          aviso, ou uso fraudulento.
        </li>
      </ul>
    ),
  },
  {
    titulo: "12. Alterações destes Termos",
    corpo: (
      <p>
        Alterações materiais são comunicadas por email com <strong>30 dias</strong> de antecedência. O uso continuado da
        Plataforma após a data de vigência da alteração constitui aceite dos novos Termos. Alterações menores (clareza,
        formatação) podem ser aplicadas sem aviso prévio.
      </p>
    ),
  },
  {
    titulo: "13. Lei aplicável e foro",
    corpo: (
      <p>
        Estes Termos são regidos pela lei brasileira. O foro será definido e publicado nesta página assim que a
        formalização societária da Pilar (razão social e CNPJ próprios, hoje em regularização) estiver concluída.
      </p>
    ),
  },
  {
    titulo: "14. Contato",
    corpo: <p>Dúvidas sobre estes Termos: privacidade@pilarsoft.com.br.</p>,
  },
];

export function Termos() {
  usePageMeta({
    titulo: "Termos de Uso | Pilar",
    descricao: "As condições de uso da plataforma Pilar: conta, trial, pagamento, dados e responsabilidades.",
    caminho: "/termos",
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
            <FileText className="w-5 h-5 text-foreground" />
            <h1 className="text-lg font-medium tracking-tight">Termos de Uso</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12 max-w-3xl space-y-12">
        <section className="rounded-lg border bg-muted/30 p-6">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Estes Termos de Uso regem o uso da plataforma Pilar, oferecida por{" "}
            <strong className="text-foreground">Pilar</strong> (razão social e CNPJ próprios em regularização), por
            escritórios de engenharia e seus usuários. Ao criar uma conta ou usar a plataforma, você concorda com estes
            Termos. Veja também a{" "}
            <Link to="/privacidade" className="text-ink underline">
              Política de Privacidade
            </Link>
            .
          </p>
        </section>

        {SECTIONS.map((section) => (
          <section key={section.titulo}>
            <h2 className="text-xl font-medium tracking-tight mb-3">{section.titulo}</h2>
            <div className="text-sm text-muted-foreground leading-relaxed">{section.corpo}</div>
          </section>
        ))}

        <p className="text-xs text-muted-foreground pt-8 border-t">Última atualização: 18 de agosto de 2026.</p>
      </main>
    </div>
  );
}
