import { Link } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";
import { usePageMeta } from "../lib/seo";
import { EMPRESA } from "../lib/empresa";

/**
 * Termos de Uso publicados (v2.0), com o Anexo de Tratamento de Dados Pessoais
 * incorporado. A versão aceita no cadastro fica em `src/lib/legalVersions.ts` do app.
 * Mudança material aqui exige aviso de 30 dias a quem aceitou a versão anterior
 * (cláusula 15), por isso a data de vigência para contas existentes é separada.
 */

const VERSAO = "2.0";
const ATUALIZADA_EM = "10 de novembro de 2026";
const VIGENCIA_CONTAS_EXISTENTES = "10 de dezembro de 2026";

type Secao = { titulo: string; corpo: React.ReactNode };

const forte = (t: string) => <strong className="text-foreground">{t}</strong>;

const SECTIONS: Secao[] = [
  {
    titulo: "1. Definições",
    corpo: (
      <ul className="list-disc pl-6 space-y-1">
        <li>
          {forte("Plataforma")}: o software Pilar, incluindo aplicativo web, Pilar Campo, portal do cliente e APIs.
        </li>
        <li>{forte("Cliente")}: a empresa que contrata a Pilar e é titular da assinatura.</li>
        <li>{forte("Usuário")}: pessoa com login na conta do Cliente.</li>
        <li>
          {forte("Convidado")}: pessoa que acessa a Plataforma a convite do Cliente sem ser Usuário (cliente final no
          portal, fornecedor no link de cotação, profissional no Pilar Campo).
        </li>
        <li>
          {forte("Dados do Cliente")}: informações inseridas na Plataforma pelo Cliente, seus Usuários e Convidados
          (projetos, obras, clientes finais, fornecedores, equipe, financeiro, documentos, fotos e áudios).
        </li>
        <li>
          {forte("Agentes de IA")}: funções da Plataforma que usam modelos de inteligência artificial para preparar
          conteúdo (resumos, leituras de documento, sugestões, registros de obra) para revisão do Cliente.
        </li>
        <li>
          {forte("Créditos de IA")}: unidade de consumo dos Agentes de IA, incluídos no plano ou comprados à parte.
        </li>
      </ul>
    ),
  },
  {
    titulo: "2. Objeto e licença de uso",
    corpo: (
      <p>
        A Pilar concede ao Cliente uma licença não exclusiva e intransferível para usar a Plataforma durante a vigência
        da assinatura, para a gestão do próprio negócio. Não é permitido sublicenciar, revender ou disponibilizar a
        Plataforma a terceiros fora da empresa Cliente, exceto aos Convidados que o próprio Cliente chamar.
      </p>
    ),
  },
  {
    titulo: "3. Cadastro e conta",
    corpo: (
      <ul className="list-disc pl-6 space-y-1">
        <li>O Cliente mantém os dados cadastrais corretos e atualizados.</li>
        <li>Cada Usuário tem login individual. Contas não podem ser compartilhadas entre pessoas.</li>
        <li>
          O Cliente responde pela segurança das credenciais de seus Usuários e pelo que for feito com elas, e define o
          nível de acesso de cada um.
        </li>
        <li>O Cliente é responsável pelos Convidados que chama e pelo que compartilha com eles.</li>
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
          <li>Tentar acessar dados de outra empresa.</li>
          <li>
            Fazer engenharia reversa, extrair código-fonte ou burlar limites técnicos (limite de requisições,
            autenticação, consumo de Créditos de IA).
          </li>
          <li>
            Criar ou usar conta, inclusive em período de avaliação, para engenharia reversa, comparação comercial
            competitiva ou reprodução do produto, sem autorização prévia e por escrito da Pilar.
          </li>
          <li>Sobrecarregar a infraestrutura de propósito (raspagem agressiva, testes de carga não autorizados).</li>
          <li>
            Inserir dados pessoais sensíveis (saúde, biometria, origem racial, opinião política) fora do que a atividade
            do Cliente exige e sem base legal para isso.
          </li>
        </ul>
        <p className="mt-2">
          A violação destes itens autoriza a suspensão da conta, com aviso sempre que o risco permitir, sem prejuízo de
          outras medidas cabíveis.
        </p>
      </>
    ),
  },
  {
    titulo: "5. Agentes de IA e responsabilidade técnica",
    corpo: (
      <ul className="list-disc pl-6 space-y-1">
        <li>
          Os Agentes de IA preparam; o Cliente revisa e aprova. Nenhum conteúdo gerado é aplicado a proposta, projeto,
          obra, financeiro ou enviado a terceiros sem uma ação de um Usuário.
        </li>
        <li>
          Conteúdo gerado por IA pode conter erro, omissão ou interpretação incorreta do documento de origem. O Cliente
          confere o resultado antes de usá-lo.
        </li>
        <li>
          {forte(
            "A Plataforma não substitui o julgamento profissional nem a responsabilidade técnica do Cliente e de seus profissionais"
          )}
          , incluindo a Anotação de Responsabilidade Técnica (ART, CREA) e o Registro de Responsabilidade Técnica (RRT,
          CAU), o atendimento às normas técnicas aplicáveis e as decisões de projeto, orçamento e execução.
        </li>
        <li>
          Para funcionar, o conteúdo necessário a cada tarefa é enviado aos provedores de modelo listados na{" "}
          <Link to="/privacidade" className="text-ink underline">
            Política de Privacidade
          </Link>
          , que não usam esse conteúdo para treinar modelos.
        </li>
        <li>O resultado gerado a partir dos Dados do Cliente pertence ao Cliente.</li>
      </ul>
    ),
  },
  {
    titulo: "6. Dados do Cliente e proteção de dados",
    corpo: (
      <ul className="list-disc pl-6 space-y-1">
        <li>
          O Cliente é o {forte("controlador")} dos Dados do Cliente e a Pilar é {forte("operador")} (LGPD). O tratamento
          segue o Anexo de Tratamento de Dados Pessoais, no fim destes Termos, que faz parte deles.
        </li>
        <li>
          O Cliente garante ter base legal para os dados de terceiros que insere (clientes finais, fornecedores, equipe)
          e para gravar áudio e imagem pelo Pilar Campo, incluindo informar as pessoas gravadas.
        </li>
        <li>
          Os dados de conta dos Usuários e a cobrança da assinatura são tratados pela Pilar como controlador, conforme a
          Política de Privacidade.
        </li>
      </ul>
    ),
  },
  {
    titulo: "7. Acesso do suporte",
    corpo: (
      <p>
        A equipe da Pilar pode acessar a conta do Cliente somente para atender um pedido de suporte do Cliente,
        investigar falha ou incidente de segurança, ou cumprir obrigação legal. Todo acesso fica registrado, é feito por
        pessoa sob dever de sigilo e se limita ao necessário para a finalidade.
      </p>
    ),
  },
  {
    titulo: "8. Propriedade intelectual",
    corpo: (
      <ul className="list-disc pl-6 space-y-1">
        <li>O código, o design, a marca e os demais ativos da Plataforma pertencem à Pilar.</li>
        <li>O Cliente mantém todos os direitos sobre os Dados do Cliente e sobre o conteúdo gerado a partir deles.</li>
        <li>
          Sugestões enviadas pelo Cliente podem ser usadas para melhorar o produto, sem obrigação de compensação e sem
          uso dos Dados do Cliente.
        </li>
      </ul>
    ),
  },
  {
    titulo: "9. Pagamento, cobrança e Créditos de IA",
    corpo: (
      <ul className="list-disc pl-6 space-y-1">
        <li>Planos e valores são os da página de Planos vigente no momento da contratação.</li>
        <li>
          A cobrança é recorrente, por ciclo do plano contratado, e se renova automaticamente até o cancelamento, como
          autorizado pelo Cliente no momento da contratação.
        </li>
        <li>
          Reajuste de preço é avisado por e-mail com 30 dias de antecedência e vale a partir do ciclo seguinte. Quem não
          concordar pode cancelar antes, sem multa.
        </li>
        <li>Atraso no pagamento pode levar à suspensão do acesso, depois de aviso prévio.</li>
        <li>
          O cancelamento pode ser feito a qualquer momento e vale ao fim do ciclo já pago, sem reembolso proporcional,
          salvo disposição legal em contrário. Cancelamento em até 7 dias da primeira cobrança gera estorno integral.
        </li>
        <li>
          Os Créditos de IA do plano renovam a cada ciclo e o saldo não usado expira na virada do ciclo. Créditos
          comprados à parte não expiram enquanto a conta estiver ativa e são consumidos depois dos créditos do plano.
        </li>
        <li>
          A compra de Créditos de IA à parte pode ser desfeita em até 7 dias, com estorno integral, se nenhum crédito do
          pacote tiver sido usado. Créditos não têm valor monetário fora da Plataforma, não são transferíveis e não são
          convertidos em dinheiro no encerramento da conta.
        </li>
      </ul>
    ),
  },
  {
    titulo: "10. Disponibilidade do serviço",
    corpo: (
      <p>
        A Plataforma é fornecida {forte('"como está" e "conforme disponível"')}, sem garantia de disponibilidade
        ininterrupta. Fazemos esforços razoáveis para manter o serviço no ar e avisar manutenções planejadas com
        antecedência, mas não há acordo de nível de serviço (SLA) nesta fase do produto.
      </p>
    ),
  },
  {
    titulo: "11. Limitação de responsabilidade",
    corpo: (
      <>
        <p>
          Na máxima extensão permitida por lei, a Pilar não responde por danos indiretos ou lucros cessantes, nem por
          dano decorrente de: uso indevido da Plataforma; uso de conteúdo gerado por Agente de IA sem a revisão prevista
          na cláusula 5; falha de terceiros fora do controle razoável da Pilar; ou descumprimento destes Termos pelo
          Cliente.
        </p>
        <p className="mt-2">
          A responsabilidade total da Pilar por este contrato fica limitada ao valor pago pelo Cliente nos 12 meses
          anteriores ao fato que a originou. Esta limitação não se aplica a dolo, culpa grave, nem a violação de dados
          pessoais causada por falha de segurança atribuível à Pilar, nem a outra hipótese em que a lei proíba limitar.
        </p>
      </>
    ),
  },
  {
    titulo: "12. Confidencialidade",
    corpo: (
      <p>
        As partes mantêm sigilo sobre informações confidenciais trocadas em razão do contrato (dados de negócio,
        informações técnicas não públicas) e as usam só para executá-lo. O dever de sigilo continua por 5 anos depois do
        encerramento.
      </p>
    ),
  },
  {
    titulo: "13. Vigência, rescisão e devolução dos dados",
    corpo: (
      <ul className="list-disc pl-6 space-y-1">
        <li>O contrato vigora enquanto a assinatura estiver ativa.</li>
        <li>Qualquer parte pode rescindir a qualquer momento; o Cliente mantém acesso até o fim do ciclo já pago.</li>
        <li>
          A Pilar pode suspender ou encerrar a conta por violação destes Termos, inadimplência não resolvida depois de
          aviso, ou uso fraudulento.
        </li>
        <li>
          Encerrado o contrato (inclusive o fim de um período de avaliação sem contratação), a conta fica em modo
          somente leitura por {forte("90 dias")}, com exportação disponível. Depois, os dados são eliminados, salvo os
          que a lei obriga a guardar, que são anonimizados quando possível.
        </li>
      </ul>
    ),
  },
  {
    titulo: "14. Comunicações",
    corpo: (
      <p>
        Avisos sobre o contrato são enviados ao e-mail dos administradores da conta e, quando fizer sentido, exibidos na
        Plataforma. O Cliente mantém esse contato atualizado.
      </p>
    ),
  },
  {
    titulo: "15. Alterações destes Termos",
    corpo: (
      <p>
        Alterações materiais são avisadas por e-mail com {forte("30 dias")} de antecedência. Alteração que aumente preço
        ou obrigação do Cliente depende de aceite expresso na Plataforma ou dá ao Cliente o direito de cancelar sem
        multa antes de ela valer. Para as demais, o uso continuado depois da data de vigência vale como aceite. Ajustes
        de redação podem ser feitos sem aviso.
      </p>
    ),
  },
  {
    titulo: "16. Lei aplicável e foro",
    corpo: (
      <p>
        Estes Termos são regidos pela lei brasileira. Fica eleito o foro do domicílio do Cliente para resolver qualquer
        questão deles decorrente.
      </p>
    ),
  },
  {
    titulo: "17. Contato",
    corpo: (
      <p>
        Dúvidas sobre estes Termos ou sobre proteção de dados:{" "}
        <a href="mailto:privacidade@pilarsoft.com.br" className="text-ink underline">
          privacidade@pilarsoft.com.br
        </a>
        .
      </p>
    ),
  },
];

const ANEXO: Secao[] = [
  {
    titulo: "A1. Objeto e papéis",
    corpo: (
      <p>
        Este Anexo regula o tratamento dos dados pessoais contidos nos Dados do Cliente. O Cliente é controlador e o
        Pilar é operador (LGPD, art. 5º, VI e VII). Em conflito com o restante dos Termos sobre proteção de dados,
        prevalece este Anexo.
      </p>
    ),
  },
  {
    titulo: "A2. Instruções do Cliente",
    corpo: (
      <p>
        A Pilar trata os dados somente para prestar o serviço, conforme as instruções do Cliente dadas pelo uso normal
        da Plataforma e por estes Termos, e nunca para finalidade própria. Se uma instrução parecer contrária à lei, o
        Pilar avisa o Cliente.
      </p>
    ),
  },
  {
    titulo: "A3. Categorias de dados e de titulares",
    corpo: (
      <p>
        Titulares: equipe do Cliente, clientes finais, fornecedores, profissionais de obra e outros Convidados. Dados:
        identificação e contato, documentos (CPF, CNPJ), dados de contrato, financeiros e de folha, endereço e
        localização de obra, fotos, áudios e documentos enviados, e registros de uso.
      </p>
    ),
  },
  {
    titulo: "A4. Confidencialidade e segurança",
    corpo: (
      <p>
        Quem trata os dados na Pilar está sob dever de sigilo. A Pilar mantém medidas técnicas e administrativas
        compatíveis com o risco (LGPD, art. 46), descritas na seção 8 da Política de Privacidade, incluindo isolamento
        entre empresas, conexão cifrada, cópia de segurança cifrada e registro de auditoria.
      </p>
    ),
  },
  {
    titulo: "A5. Suboperadores",
    corpo: (
      <p>
        O Cliente autoriza os fornecedores listados na seção 4 da Política de Privacidade. A Pilar exige deles
        obrigações de proteção de dados compatíveis com este Anexo e responde por eles perante o Cliente. Antes de
        incluir fornecedor novo que trate Dados do Cliente, a Pilar avisa os administradores da conta por e-mail com 30
        dias de antecedência. O Cliente pode se opor por motivo ligado à proteção de dados; se não houver solução, pode
        rescindir sem multa, com reembolso do período pago e não usado.
      </p>
    ),
  },
  {
    titulo: "A6. Transferência internacional",
    corpo: (
      <p>
        Parte dos fornecedores processa dados fora do Brasil. A Pilar adota para cada um as garantias do art. 33 da
        LGPD, pelas cláusulas-padrão da ANPD (Resolução CD/ANPD nº 19/2024) ou mecanismo equivalente admitido.
      </p>
    ),
  },
  {
    titulo: "A7. Direitos dos titulares",
    corpo: (
      <p>
        Pedido de titular sobre Dados do Cliente que chegar à Pilar é encaminhado ao Cliente. A Pilar oferece meios para
        o Cliente atender (correção, exportação, exclusão) e ajuda no que depender dele.
      </p>
    ),
  },
  {
    titulo: "A8. Incidentes de segurança",
    corpo: (
      <p>
        A Pilar avisa o Cliente em até 2 dias úteis depois de confirmar incidente que envolva Dados do Cliente, com o
        que se sabe sobre natureza, dados e titulares afetados e medidas tomadas, e coopera para o Cliente cumprir suas
        próprias comunicações à ANPD e aos titulares (Resolução CD/ANPD nº 15/2024).
      </p>
    ),
  },
  {
    titulo: "A9. Fim do tratamento",
    corpo: (
      <p>
        Encerrado o contrato, o Cliente pode exportar os dados por 90 dias (cláusula 13). Depois, a Pilar elimina os
        Dados do Cliente, inclusive das cópias de segurança no ciclo normal de 30 dias delas, salvo o que a lei obrigue
        a guardar.
      </p>
    ),
  },
  {
    titulo: "A10. Comprovação",
    corpo: (
      <p>
        A Pilar fornece ao Cliente, mediante pedido razoável e no máximo uma vez por ano (salvo incidente), as
        informações necessárias para demonstrar o cumprimento deste Anexo, incluindo a lista atualizada de fornecedores
        e a descrição das medidas de segurança.
      </p>
    ),
  },
];

function Bloco({ secao }: { secao: Secao }) {
  return (
    <section>
      <h2 className="text-xl font-medium tracking-tight mb-3">{secao.titulo}</h2>
      <div className="text-sm text-muted-foreground leading-relaxed">{secao.corpo}</div>
    </section>
  );
}

export function Termos() {
  usePageMeta({
    titulo: "Termos de Uso da plataforma de gestãa Pilar | Pilar",
    descricao:
      "As condições de uso da plataforma Pilar para escritórios de engenharia e arquitetura: conta, contratação, pagamento, IA, dados e responsabilidades.",
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
        <section className="rounded-lg border bg-muted/30 p-6 space-y-2">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {forte("Finalidade deste documento:")} estabelecer as condições de uso da plataforma Pilar, oferecida por{" "}
            {forte(EMPRESA.razaoSocial)}, CNPJ {EMPRESA.cnpj}, com sede na {EMPRESA.endereco} ("Pilar"), por escritórios
            de engenharia e arquitetura, seus usuários e convidados. Ao criar uma conta ou usar a plataforma, você
            concorda com estes Termos e com o Anexo de Tratamento de Dados Pessoais. Veja também a{" "}
            <Link to="/privacidade" className="text-ink underline">
              Política de Privacidade
            </Link>
            .
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Para contas que aceitaram a versão anterior, esta versão vale a partir de {VIGENCIA_CONTAS_EXISTENTES}.
          </p>
        </section>

        {SECTIONS.map((s) => (
          <Bloco key={s.titulo} secao={s} />
        ))}

        <div className="space-y-12 border-t pt-12">
          <div>
            <h2 className="text-2xl font-medium tracking-tight">Anexo: Tratamento de Dados Pessoais</h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Parte integrante destes Termos, aceito junto com eles. Substitui a necessidade de um acordo de tratamento
              de dados (DPA) separado, salvo se a política interna do Cliente exigir assinatura própria.
            </p>
          </div>
          {ANEXO.map((s) => (
            <Bloco key={s.titulo} secao={s} />
          ))}
        </div>

        <p className="text-xs text-muted-foreground pt-8 border-t">
          Versão {VERSAO}. Última atualização: {ATUALIZADA_EM}.
        </p>
      </main>
    </div>
  );
}
