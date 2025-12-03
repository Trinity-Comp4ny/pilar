export const stats = {
  receitasTotal: 145000,
  despesasTotal: 98000,
  saldo: 47000,
  receitasMes: 12.5,
  despesasMes: -8.2,
};

export const chartDataMensal = [
  { mes: 'Jan', receitas: 85000, despesas: 62000, saldo: 23000 },
  { mes: 'Fev', receitas: 92000, despesas: 68000, saldo: 24000 },
  { mes: 'Mar', receitas: 105000, despesas: 75000, saldo: 30000 },
  { mes: 'Abr', receitas: 118000, despesas: 82000, saldo: 36000 },
  { mes: 'Mai', receitas: 135000, despesas: 89000, saldo: 46000 },
  { mes: 'Jun', receitas: 145000, despesas: 98000, saldo: 47000 },
];

export const chartDataDiario = Array.from({ length: 30 }, (_, i) => ({
  dia: i + 1,
  receitas: Math.floor(Math.random() * 5000) + 1000,
  despesas: Math.floor(Math.random() * 3000) + 500,
}));

export const categoriaData = [
  { name: 'Projetos', value: 85000, color: '#16a34a' }, // green-600
  { name: 'Consultorias', value: 35000, color: '#22c55e' }, // green-500
  { name: 'Outros', value: 25000, color: '#86efac' }, // green-300
];

export const despesasCategoriaData = [
  { name: 'Pessoal', value: 45000, color: '#dc2626' }, // red-600
  { name: 'Operacional', value: 28000, color: '#ef4444' }, // red-500
  { name: 'Infraestrutura', value: 15000, color: '#f87171' }, // red-400
  { name: 'Marketing', value: 10000, color: '#fca5a5' }, // red-300
];

export const topReceitasDetalhadas = [
  { categoria: 'Projetos', items: ['Projeto Residencial XYZ: R$ 45k', 'Edifício ABC: R$ 28k', 'Shopping: R$ 12k'] },
  { categoria: 'Consultorias', items: ['Consultoria Empresa A: R$ 18k', 'Auditoria Técnica: R$ 10k', 'Assessoria: R$ 7k'] },
];

export const topDespesasDetalhadas = [
  { categoria: 'Pessoal', items: ['Folha Pagamento: R$ 35k', 'Encargos: R$ 8k', 'Benefícios: R$ 2k'] },
  { categoria: 'Operacional', items: ['Aluguel: R$ 12k', 'Energia: R$ 8k', 'Internet: R$ 3k'] },
];
