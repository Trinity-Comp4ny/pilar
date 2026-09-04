import type { PainelGestao } from "@/hooks/usePainelGestao";

/**
 * Dados de exemplo para o preview do seletor de widget (SPEC 092).
 *
 * O preview existe para mostrar o MODELO do indicador antes de colocá-lo no
 * painel, então ele usa números fictícios e o dialog diz isso na cara. Com dado
 * real, um indicador que a empresa ainda não alimenta apareceria vazio no
 * preview, e o usuário não veria o que está escolhendo.
 *
 * Os números são plausíveis e internamente consistentes de propósito (a
 * conversão fecha com o funil, o total do funil fecha com as contagens), para
 * o preview não ensinar a ler o indicador errado.
 */

const mes = (atras: number) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - atras);
  return d.toISOString().slice(0, 10);
};

const semana = (atras: number) => {
  const d = new Date();
  d.setDate(d.getDate() - atras * 7);
  return d.toISOString().slice(0, 10);
};

export const DADOS_EXEMPLO: PainelGestao = {
  gestao: {
    propostasTotais: { enviadas: 18, ganhas: 7, perdidas: 9, aguardando: 6, conversaoPct: 44 },
    funil: [
      { etapa: "rascunho", n: 4 },
      { etapa: "enviada", n: 6 },
      { etapa: "aceita", n: 7 },
      { etapa: "recusada", n: 7 },
      { etapa: "expirada", n: 2 },
    ],
    conversaoMensal: [
      { mes: mes(11), ganhas: 3, perdidas: 6 },
      { mes: mes(10), ganhas: 4, perdidas: 5 },
      { mes: mes(9), ganhas: 2, perdidas: 6 },
      { mes: mes(8), ganhas: 5, perdidas: 4 },
      { mes: mes(7), ganhas: 4, perdidas: 6 },
      { mes: mes(6), ganhas: 6, perdidas: 5 },
      { mes: mes(5), ganhas: 3, perdidas: 7 },
      { mes: mes(4), ganhas: 5, perdidas: 5 },
      { mes: mes(3), ganhas: 7, perdidas: 4 },
      { mes: mes(2), ganhas: 5, perdidas: 6 },
      { mes: mes(1), ganhas: 6, perdidas: 4 },
      { mes: mes(0), ganhas: 7, perdidas: 9 },
    ],
    motivosPerda: [
      { motivo: "Preço", n: 14 },
      { motivo: "Prazo", n: 8 },
      { motivo: "Sem resposta", n: 6 },
      { motivo: "Escopo", n: 3 },
      { motivo: "Concorrente", n: 2 },
    ],
    esperaProposta: [
      { faixa: "Até 7 dias", n: 2 },
      { faixa: "8 a 15 dias", n: 2 },
      { faixa: "16 a 30 dias", n: 1 },
      { faixa: "Mais de 30 dias", n: 1 },
    ],
    origemGanho: [
      { origem: "Indicação", leads: 22, ganhoPct: 58 },
      { origem: "Instagram", leads: 31, ganhoPct: 13 },
      { origem: "Site", leads: 14, ganhoPct: 29 },
      { origem: "Cliente antigo", leads: 9, ganhoPct: 67 },
    ],
    throughputSemanal: [
      { semana: semana(11), n: 41 },
      { semana: semana(10), n: 38 },
      { semana: semana(9), n: 45 },
      { semana: semana(8), n: 36 },
      { semana: semana(7), n: 42 },
      { semana: semana(6), n: 48 },
      { semana: semana(5), n: 39 },
      { semana: semana(4), n: 44 },
      { semana: semana(3), n: 37 },
      { semana: semana(2), n: 40 },
      { semana: semana(1), n: 31 },
      { semana: semana(0), n: 34 },
    ],
    cargaEquipe: [
      { pessoaId: "e1", nome: "Marcos A.", emDia: 7, atrasada: 2 },
      { pessoaId: "e2", nome: "Fernando L.", emDia: 5, atrasada: 3 },
      { pessoaId: "e3", nome: "Júlia R.", emDia: 6, atrasada: 0 },
      { pessoaId: "e4", nome: "Camila S.", emDia: 4, atrasada: 1 },
    ],
    filaAprovacao: [
      { escopoId: "a1", tipo: "aditivo", projetoId: "p1", projeto: "Residencial Vila Rica", dias: 22 },
      { escopoId: "a2", tipo: "original", projetoId: "p2", projeto: "CD logístico BR-101", dias: 11 },
      { escopoId: "a3", tipo: "aditivo", projetoId: "p3", projeto: "Retrofit Hospital Sta. Rita", dias: 6 },
    ],
  },
  projetos: {
    totais: {
      ativos: 17,
      emAndamento: 9,
      planejamento: 4,
      paralisado: 2,
      atrasados: 2,
      risco: 3,
      semPrazo: 1,
      concluidosAno: 14,
    },
    statusAtivos: [],
    pontualidadeMensal: [
      { mes: mes(11), pct: 82, total: 3 },
      { mes: mes(10), pct: 79, total: 2 },
      { mes: mes(9), pct: 81, total: 4 },
      { mes: mes(8), pct: 76, total: 3 },
      { mes: mes(7), pct: 74, total: 3 },
      { mes: mes(6), pct: 77, total: 2 },
      { mes: mes(5), pct: 72, total: 4 },
      { mes: mes(4), pct: 70, total: 3 },
      { mes: mes(3), pct: 74, total: 3 },
      { mes: mes(2), pct: 71, total: 4 },
      { mes: mes(1), pct: 69, total: 3 },
      { mes: mes(0), pct: 68, total: 2 },
    ],
    atrasoPorDisciplina: [
      { disciplina: "Elétrica", diasMedio: 14, entregas: 6 },
      { disciplina: "Climatização", diasMedio: 9, entregas: 4 },
      { disciplina: "Hidráulica", diasMedio: 7, entregas: 5 },
      { disciplina: "Estrutural", diasMedio: 3, entregas: 7 },
      { disciplina: "Arquitetura", diasMedio: 1, entregas: 9 },
    ],
    prazos15Dias: [
      {
        disciplinaId: "d1",
        disciplina: "Elétrica",
        projetoId: "p1",
        projeto: "Residencial Vila Rica",
        dias: -3,
        responsavel: "Fernando",
      },
      {
        disciplinaId: "d2",
        disciplina: "Estrutural",
        projetoId: "p2",
        projeto: "CD logístico BR-101",
        dias: 2,
        responsavel: "Marcos",
      },
      {
        disciplinaId: "d3",
        disciplina: "Hidráulica",
        projetoId: "p3",
        projeto: "Retrofit Hospital Sta. Rita",
        dias: 7,
        responsavel: "Camila",
      },
      {
        disciplinaId: "d4",
        disciplina: "Arquitetura",
        projetoId: "p4",
        projeto: "Escola Jd. Paulista",
        dias: 11,
        responsavel: "Júlia",
      },
    ],
    horasPorProjeto: [
      { projetoId: "p1", projeto: "Residencial Vila Rica", estimadas: 420, realizadas: 580, desvioPct: 38 },
      { projetoId: "p2", projeto: "CD logístico BR-101", estimadas: 640, realizadas: 806, desvioPct: 26 },
      { projetoId: "p3", projeto: "Retrofit Hospital", estimadas: 910, realizadas: 1083, desvioPct: 19 },
      { projetoId: "p4", projeto: "Ampliação Tecmol", estimadas: 480, realizadas: 466, desvioPct: -3 },
      { projetoId: "p5", projeto: "Ponte Córrego Fundo", estimadas: 520, realizadas: 458, desvioPct: -12 },
    ],
  },
  obras: {
    totais: { emAndamento: 4, planejadas: 2, paralisadas: 1, atrasadas: 1 },
    rdoPorObra: [
      { obraId: "o1", obra: "Galpão Nova Odessa", ultimoRdo: null, diasSemRdo: null },
      { obraId: "o2", obra: "Escola Jd. Paulista", ultimoRdo: semana(1), diasSemRdo: 6 },
      { obraId: "o3", obra: "CD logístico BR-101", ultimoRdo: semana(0), diasSemRdo: 1 },
    ],
    avancoPorObra: [
      { obraId: "o1", obra: "Galpão Nova Odessa", concluidas: 8, total: 40, pct: 20 },
      { obraId: "o2", obra: "Escola Jd. Paulista", concluidas: 22, total: 44, pct: 50 },
      { obraId: "o3", obra: "CD logístico BR-101", concluidas: 51, total: 60, pct: 85 },
    ],
  },
  financeiro: {
    mes: { recebido: 186000, aReceber: 328000, receberVencido: 41000 },
    despesaMes: { pago: 121000, aPagar: 94000, pagarVencido: 0 },
    faturamento: [
      { mes: mes(5), previsto: 180000, faturado: 165000 },
      { mes: mes(4), previsto: 180000, faturado: 152000 },
      { mes: mes(3), previsto: 190000, faturado: 171000 },
      { mes: mes(2), previsto: 200000, faturado: 168000 },
      { mes: mes(1), previsto: 190000, faturado: 174000 },
      { mes: mes(0), previsto: 210000, faturado: 158000 },
    ],
    margemPorProjeto: [
      { projetoId: "p1", projeto: "Condomínio Alto da Serra", pct: -11 },
      { projetoId: "p2", projeto: "Residencial Vila Rica", pct: -3 },
      { projetoId: "p3", projeto: "Retrofit Hospital", pct: 9 },
      { projetoId: "p4", projeto: "Escola Jd. Paulista", pct: 22 },
      { projetoId: "p5", projeto: "Subestação Interlagos", pct: 34 },
    ],
  },
  cobertura: { desde: mes(13), projetosSemPrazo: 1, leadsSemMotivoPadrao: 3 },
  extra: {
    efetivoObra: [
      { obraId: "o1", obra: "CD logístico BR-101", media: 24, dias: 6 },
      { obraId: "o2", obra: "Escola Jd. Paulista", media: 11, dias: 5 },
      { obraId: "o3", obra: "Galpão Nova Odessa", media: 7, dias: 3 },
    ],
    projetosPorCliente: [
      { clienteId: "c1", cliente: "Incorporadora Marlim", ativos: 6, atrasados: 2 },
      { clienteId: "c2", cliente: "Prefeitura de Nova Odessa", ativos: 4, atrasados: 0 },
      { clienteId: "c3", cliente: "Tecmol Industrial", ativos: 3, atrasados: 1 },
      { clienteId: "c4", cliente: "Construtora Aliança", ativos: 2, atrasados: 0 },
    ],
  },
};
