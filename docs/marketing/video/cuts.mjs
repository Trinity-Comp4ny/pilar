// Cuts of the Pilar marketing videos. Focus boxes are in take CSS px (1440 x 900).
// Copy rules: brand/voice-tone.md and brand/messaging.md (no em dash, only agents that run in production).

const F = {
  inicioResumo: { cx: 760, cy: 190, w: 1150, vw: 760 },
  leads: { cx: 900, cy: 420, w: 1150 },
  propostas: { cx: 820, cy: 300, w: 1150 },
  board: { cx: 820, cy: 420, w: 1300 },
  modal: { cx: 720, cy: 300, w: 1300 },
  margem: { cx: 1080, cy: 240, w: 950, vw: 700 },
  aditivoPend: { cx: 860, cy: 450, w: 950, vw: 760 },
  aditivoEscopo: { cx: 820, cy: 730, w: 1150, vw: 820 },
  clima: { cx: 700, cy: 235, w: 1000, vw: 820 },
  full: { cx: 720, cy: 450, w: 1440, vw: 1100 },
  crono: { cx: 900, cy: 400, w: 1200, vw: 820 },
  registro: { cx: 880, cy: 560, w: 950, vw: 700 },
  kpis: { cx: 800, cy: 340, w: 1150, vw: 760 },
};
const at = (t, f, d) => ({ at: t, ...f, ...(d ? { d } : {}) });

const END = { type: 'end', tagline: 'Do contrato à execução, | num fluxo *só*.', cta: 'Agende uma demonstração', url: 'pilarsoft.com.br', min: 4.2 };

export const CUTS = [
  {
    id: 'v01-pilar-em-90s',
    name: 'Pilar em 90 segundos (16:9)',
    w: 1920, h: 1080,
    scenes: [
      { type: 'title', lines: ['Proposta no Word.', 'Controle no Excel.', 'Obra no *WhatsApp*.'], step: 0.9, vo: ['Proposta no Word. Controle no Excel. Obra no WhatsApp.'] },
      { type: 'title', kicker: 'O mesmo número', lines: ['4×'], big: true, vo: ['O mesmo número é digitado quatro vezes. E o prejuízo só aparece quando o projeto acaba.'] },
      { type: 'title', ink: true, kicker: 'Pilar', lines: ['Do contrato à execução,', 'num fluxo *só*.'], step: 0.7, vo: ['A Pilar leva o dado do contrato à execução, num fluxo só.'] },
      { type: 'take', take: 'comercial', label: ['01 · Comercial', 'Proposta aceita vira projeto'], focus: [at(0, F.leads), at(5.4, F.propostas)], vo: ['O lead vira proposta. E a proposta aceita vira projeto, com as disciplinas e as parcelas no financeiro.'] },
      { type: 'take', take: 'projetos', label: ['02 · Projetos', 'Margem de cada projeto, agora'], labelAt: 6.8, focus: [at(0, F.board), at(3.3, F.modal), at(6.4, F.margem)], vo: ['Cada projeto mostra a margem enquanto ainda dá para agir. Este aqui já passou do orçamento.'] },
      { type: 'take', take: 'pendencias', label: ['03 · Agentes', 'A IA prepara. O sistema confere. Você aprova.'], labelAt: 2.4, focus: [at(0, F.full), at(1.8, F.aditivoPend)], vo: ['Então o agente prepara o aditivo, citando as despesas que sustentam cada valor.', 'O sistema confere. Você aprova.'] },
      { type: 'take', take: 'obra', label: ['04 · Obra', 'Alerta de chuva na concretagem'], labelAt: 1.6, focus: [at(0, F.full), at(0.9, F.clima)], vo: ['Na obra, o cronograma cruza com a previsão do tempo. Se a concretagem cair num dia de chuva, a Pilar avisa antes.'] },
      { type: 'take', take: 'diario', label: ['05 · Diário', 'O canteiro registra, o escritório vê'], labelAt: 2.2, focus: [at(0, F.full), at(1.9, F.registro)], vo: ['Quem está no canteiro registra o dia, e o registro chega organizado ao escritório. O cliente só vê o que você liberar.'] },
      { type: 'take', take: 'inicio', label: ['06 · Início', 'Resumo da semana, número conferido'], labelAt: 1.0, focus: [at(0, F.inicioResumo)], vo: ['E toda semana, um resumo do que importa, com cada número conferido.'] },
      { ...END, vo: ['Pilar. Do contrato à execução, num fluxo só. Agende uma demonstração.'] },
    ],
  },
  {
    id: 'v02-problemas',
    name: 'Os problemas que a Pilar resolve (9:16)',
    w: 1080, h: 1920,
    scenes: [
      { type: 'title', lines: ['Proposta no Word.', 'Controle no Excel.', 'Obra no *WhatsApp*.'], step: 0.8, lead: 0.15, vo: ['Proposta no Word. Controle no Excel. Obra no WhatsApp.'] },
      { type: 'title', lines: ['O prejuízo aparece', 'no *fim*.'], step: 0.6, vo: ['E o prejuízo só aparece quando o projeto acaba.'] },
      { type: 'title', lines: ['Concretagem marcada', 'no dia da *chuva*.'], step: 0.6, vo: ['A concretagem foi marcada para o dia da chuva.'] },
      { type: 'title', lines: ['Cliente ligando', 'para saber *como está*.'], step: 0.6, vo: ['E o cliente liga toda semana para saber como está a obra.'] },
      { type: 'take', take: 'projetos', hook: 'Margem na tela, *antes* do fim.', from: 6.3, focus: [at(0, F.margem)], vo: ['Na Pilar, a margem de cada projeto aparece antes do fim.'] },
      { type: 'take', take: 'obra', hook: 'Chuva? Você é *avisado*.', from: 0.8, focus: [at(0, F.clima)], vo: ['A chuva na concretagem vira alerta.'] },
      { type: 'take', take: 'pendencias', hook: 'A IA prepara. *Você* aprova.', from: 2.0, focus: [at(0, F.aditivoPend)], vo: ['E o aditivo chega pronto para você aprovar.'] },
      { ...END, vo: ['Pilar. Do contrato à execução, num fluxo só.'] },
    ],
  },
  {
    id: 'v03a-agentes',
    name: 'Funcionalidade: agentes preparam o aditivo (9:16)',
    w: 1080, h: 1920,
    scenes: [
      { type: 'take', take: 'projetos', hook: 'O projeto passou do *orçamento*.', from: 6.3, focus: [at(0, F.margem)], vo: ['O retrofit passou do orçamento de horas. A margem já está negativa.'] },
      { type: 'take', take: 'pendencias', hook: 'O agente montou o *aditivo*.', label: ['Agentes', 'Cada valor cita as despesas'], labelAt: 2.6, focus: [at(0, F.full), at(1.8, F.aditivoPend)], vo: ['O agente montou o aditivo e citou as despesas que justificam cada valor.'] },
      { type: 'take', take: 'aditivo', hook: 'O sistema confere. *Você* aprova.', from: 1.6, focus: [at(0, F.aditivoEscopo)], vo: ['O sistema confere a conta. Nada vai para o cliente sem você aprovar.'] },
      { ...END, vo: ['A IA prepara. O sistema confere. Você aprova.'] },
    ],
  },
  {
    id: 'v03b-fluxo',
    name: 'Funcionalidade: da proposta ao projeto (9:16)',
    w: 1080, h: 1920,
    scenes: [
      { type: 'take', take: 'comercial', hook: 'O lead entra no *funil*.', focus: [at(0, F.leads), at(5.4, F.propostas)], vo: ['O lead entra no funil e vira proposta, com as disciplinas e o valor de cada uma.'] },
      { type: 'take', take: 'projetos', hook: 'Aceitou? Virou *projeto*.', focus: [at(0, F.board), at(3.3, F.modal)], vo: ['Proposta aceita vira projeto, com as disciplinas, os responsáveis e as parcelas no financeiro.'] },
      { type: 'take', take: 'financeiro', hook: 'Sem *redigitar* nada.', from: 0.4, focus: [at(0, F.kpis)], vo: ['O financeiro já sabe o que tem a receber. Ninguém redigita nada.'] },
      { ...END, vo: ['Pilar. Do contrato à execução, num fluxo só.'] },
    ],
  },
  {
    id: 'v03c-clima',
    name: 'Funcionalidade: alerta de clima na obra (9:16)',
    w: 1080, h: 1920,
    scenes: [
      { type: 'take', take: 'obra', hook: 'Sua concretagem vai pegar *chuva*?', from: 0.5, focus: [at(0, F.full), at(0.6, F.clima)], vo: ['Sua concretagem de sábado vai pegar chuva?'] },
      { type: 'take', take: 'cronograma', hook: 'O cronograma cruza com a *previsão*.', from: 1.8, focus: [at(0, F.crono)], vo: ['Marque a tarefa como sensível ao clima. A Pilar cruza o cronograma com a previsão do local da obra.'] },
      { type: 'take', take: 'obra', hook: 'Você é avisado *antes*.', label: ['Obra', 'Quem decide reprogramar é você'], labelAt: 0.8, from: 2.5, focus: [at(0, F.clima)], vo: ['E avisa antes, citando a tarefa, o dia e a chance de chuva. Quem decide reprogramar é você.'] },
      { ...END, vo: ['Pilar. Obra não para por surpresa.'] },
    ],
  },
  {
    id: 'v03d-diario',
    name: 'Funcionalidade: diário de obra organizado (9:16)',
    w: 1080, h: 1920,
    scenes: [
      { type: 'title', lines: ['Diário de obra', 'no *caderno*?'], step: 0.6, vo: ['Diário de obra no caderno ou perdido no grupo do WhatsApp?'] },
      { type: 'take', take: 'diario', hook: 'O canteiro *conta*. O registro chega pronto.', from: 1.8, focus: [at(0, F.registro)], vo: ['Na Pilar, o mestre de obras conta o que aconteceu no dia, e o registro chega organizado: atividades, efetivo e pendências.'] },
      { type: 'take', take: 'diario', hook: 'O cliente vê só o que você *liberar*.', from: 4.0, focus: [at(0, F.registro)], vo: ['O registro nasce interno. Só vai para o cliente quando você liberar.'] },
      { ...END, vo: ['O canteiro registra. O cliente acompanha. Seu WhatsApp descansa.'] },
    ],
  },
  {
    id: 'v03e-numeros',
    name: 'Funcionalidade: números da semana (9:16)',
    w: 1080, h: 1920,
    scenes: [
      { type: 'title', lines: ['Quanto sobrou', 'este *mês*?'], step: 0.6, vo: ['Quanto sobrou este mês? E qual projeto puxou para baixo?'] },
      { type: 'take', take: 'financeiro', hook: 'Lucro, receitas e o que falta *receber*.', from: 0.4, focus: [at(0, F.kpis)], vo: ['Lucro, receitas, despesas e o que falta receber, no mesmo lugar.'] },
      { type: 'take', take: 'inicio', hook: 'Toda semana, um *resumo*.', focus: [at(0, F.inicioResumo)], vo: ['E toda semana, um resumo do que importa. Cada número é conferido antes de chegar a você.'] },
      { ...END, vo: ['Pilar. Número antes do fim.'] },
    ],
  },
];
