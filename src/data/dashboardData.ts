// Dados financeiros

// Dados diários expandidos para múltiplos meses e anos
export const receitasDataDiario = [
  // Janeiro 2023
  { periodo: "10/01", valor: 8500 },
  { periodo: "15/01", valor: 12000 },
  { periodo: "20/01", valor: 9800 },
  { periodo: "25/01", valor: 11200 },
  
  // Fevereiro 2023
  { periodo: "05/02", valor: 10500 },
  { periodo: "12/02", valor: 9000 },
  { periodo: "18/02", valor: 13200 },
  { periodo: "25/02", valor: 8700 },
  
  // Março 2023
  { periodo: "03/03", valor: 7600 },
  { periodo: "10/03", valor: 9400 },
  { periodo: "15/03", valor: 12800 },
  { periodo: "22/03", valor: 10500 },
  { periodo: "28/03", valor: 8900 },
  
  // Dados do semestre atual
  { periodo: "05/01", valor: 15000 },
  { periodo: "15/01", valor: 18000 },
  { periodo: "25/01", valor: 12500 },
  
  { periodo: "10/02", valor: 16000 },
  { periodo: "20/02", valor: 19000 },
  
  { periodo: "08/03", valor: 14000 },
  { periodo: "18/03", valor: 16500 },
  { periodo: "28/03", valor: 11000 },
  
  { periodo: "05/04", valor: 13500 },
  { periodo: "15/04", valor: 15800 },
  { periodo: "25/04", valor: 12000 },
  
  { periodo: "07/05", valor: 17200 },
  { periodo: "17/05", valor: 14500 },
  { periodo: "27/05", valor: 16800 },
  
  { periodo: "06/06", valor: 18500 },
  { periodo: "16/06", valor: 15300 },
  { periodo: "26/06", valor: 19200 },
  
  // Julho (mês atual)
  { periodo: "01/07", valor: 12000 },
  { periodo: "02/07", valor: 19000 },
  { periodo: "03/07", valor: 3000 },
  { periodo: "04/07", valor: 5000 },
  { periodo: "05/07", valor: 2000 },
  { periodo: "06/07", valor: 3000 },
  { periodo: "07/07", valor: 9000 },
  { periodo: "10/07", valor: 14000 },
  { periodo: "15/07", valor: 16500 },
];

export const despesasDataDiario = [
  // Janeiro 2023
  { periodo: "08/01", valor: 5800 },
  { periodo: "14/01", valor: 7200 },
  { periodo: "19/01", valor: 6400 },
  { periodo: "26/01", valor: 8100 },
  
  // Fevereiro 2023
  { periodo: "03/02", valor: 6700 },
  { periodo: "10/02", valor: 5900 },
  { periodo: "17/02", valor: 7800 },
  { periodo: "24/02", valor: 6200 },
  
  // Março 2023
  { periodo: "05/03", valor: 5400 },
  { periodo: "12/03", valor: 6800 },
  { periodo: "19/03", valor: 7500 },
  { periodo: "26/03", valor: 6300 },
  
  // Dados do semestre atual
  { periodo: "04/01", valor: 9200 },
  { periodo: "14/01", valor: 10500 },
  { periodo: "24/01", valor: 8700 },
  
  { periodo: "07/02", valor: 9800 },
  { periodo: "17/02", valor: 11200 },
  { periodo: "27/02", valor: 10100 },
  
  { periodo: "06/03", valor: 8900 },
  { periodo: "16/03", valor: 10300 },
  { periodo: "26/03", valor: 9500 },
  
  { periodo: "03/04", valor: 9000 },
  { periodo: "13/04", valor: 10700 },
  { periodo: "23/04", valor: 8800 },
  
  { periodo: "05/05", valor: 9600 },
  { periodo: "15/05", valor: 11000 },
  { periodo: "25/05", valor: 10200 },
  
  { periodo: "04/06", valor: 10800 },
  { periodo: "14/06", valor: 9700 },
  { periodo: "24/06", valor: 11500 },
  
  // Julho (mês atual)
  { periodo: "01/07", valor: 7500 },
  { periodo: "02/07", valor: 6200 },
  { periodo: "03/07", valor: 1200 },
  { periodo: "04/07", valor: 900 },
  { periodo: "05/07", valor: 1500 },
  { periodo: "06/07", valor: 1000 },
  { periodo: "07/07", valor: 1300 },
  { periodo: "08/07", valor: 800 },
  { periodo: "09/07", valor: 1100 },
  { periodo: "12/07", valor: 8900 },
  { periodo: "14/07", valor: 7800 },
];

// Dados por categoria - Diários
export const receitasCategoriaDataDiario = [
  { categoria: "Projetos", valor: 8500, cor: "#22c55e" },
  { categoria: "Consultoria", valor: 3200, cor: "#10b981" },
  { categoria: "Execução", valor: 1500, cor: "#059669" },
  { categoria: "Outros", valor: 800, cor: "#047857" },
];

export const despesasCategoriaDataDiario = [
  { categoria: "Materiais", valor: 4500, cor: "#ff6411" },
  { categoria: "Pessoal", valor: 5200, cor: "#ff8411" },
  { categoria: "Equipamentos", valor: 2800, cor: "#ffA411" },
  { categoria: "Outros", valor: 1500, cor: "#ffC411" },
];

// Dados por forma de pagamento - Diários
export const receitasFormaPagtoDataDiario = [
  { forma: "Transferência", valor: 7800, cor: "#0ea5e9" },
  { forma: "Cartão", valor: 3500, cor: "#38bdf8" },
  { forma: "Boleto", valor: 1200, cor: "#7dd3fc" },
  { forma: "Dinheiro", valor: 1500, cor: "#bae6fd" },
];

export const despesasFormaPagtoDataDiario = [
  { forma: "Transferência", valor: 6800, cor: "#f43f5e" },
  { forma: "Cartão", valor: 4200, cor: "#fb7185" },
  { forma: "Boleto", valor: 2500, cor: "#fda4af" },
  { forma: "Dinheiro", valor: 500, cor: "#fecdd3" },
];

export const despesasFornecedorDataDiario = [
  { fornecedor: "Construmega", valor: 3500, cor: "#8b5cf6" },
  { fornecedor: "TechBuild", valor: 2800, cor: "#a78bfa" },
  { fornecedor: "Elétrica Plus", valor: 1200, cor: "#c4b5fd" },
  { fornecedor: "Hidrosol", valor: 1000, cor: "#ddd6fe" },
  { fornecedor: "Outros", valor: 5500, cor: "#ede9fe" },
];

// Fluxo de Caixa com dados expandidos para múltiplos meses e anos
export const fluxoCaixaDataDiario = [
  // 2023 - Primeiro trimestre
  { periodo: "10/01", receitas: 8500, despesas: 5800, saldo: 2700 },
  { periodo: "15/01", receitas: 12000, despesas: 7200, saldo: 4800 },
  { periodo: "20/01", receitas: 9800, despesas: 6400, saldo: 3400 },
  { periodo: "25/01", receitas: 11200, despesas: 8100, saldo: 3100 },
  
  { periodo: "05/02", receitas: 10500, despesas: 6700, saldo: 3800 },
  { periodo: "12/02", receitas: 9000, despesas: 5900, saldo: 3100 },
  { periodo: "18/02", receitas: 13200, despesas: 7800, saldo: 5400 },
  { periodo: "25/02", receitas: 8700, despesas: 6200, saldo: 2500 },
  
  { periodo: "03/03", receitas: 7600, despesas: 5400, saldo: 2200 },
  { periodo: "10/03", receitas: 9400, despesas: 6800, saldo: 2600 },
  { periodo: "15/03", receitas: 12800, despesas: 7500, saldo: 5300 },
  { periodo: "22/03", receitas: 10500, despesas: 6300, saldo: 4200 },
  { periodo: "28/03", receitas: 8900, despesas: 6100, saldo: 2800 },
  
  // 2025 - Primeiro semestre (ano atual)
  { periodo: "05/01", receitas: 15000, despesas: 9200, saldo: 5800 },
  { periodo: "15/01", receitas: 18000, despesas: 10500, saldo: 7500 },
  { periodo: "25/01", receitas: 12500, despesas: 8700, saldo: 3800 },
  
  { periodo: "10/02", receitas: 16000, despesas: 9800, saldo: 6200 },
  { periodo: "20/02", receitas: 19000, despesas: 11200, saldo: 7800 },
  
  { periodo: "08/03", receitas: 14000, despesas: 8900, saldo: 5100 },
  { periodo: "18/03", receitas: 16500, despesas: 10300, saldo: 6200 },
  { periodo: "28/03", receitas: 11000, despesas: 9500, saldo: 1500 },
  
  { periodo: "05/04", receitas: 13500, despesas: 9000, saldo: 4500 },
  { periodo: "15/04", receitas: 15800, despesas: 10700, saldo: 5100 },
  { periodo: "25/04", receitas: 12000, despesas: 8800, saldo: 3200 },
  
  { periodo: "07/05", receitas: 17200, despesas: 9600, saldo: 7600 },
  { periodo: "17/05", receitas: 14500, despesas: 11000, saldo: 3500 },
  { periodo: "27/05", receitas: 16800, despesas: 10200, saldo: 6600 },
  
  { periodo: "06/06", receitas: 18500, despesas: 10800, saldo: 7700 },
  { periodo: "16/06", receitas: 15300, despesas: 9700, saldo: 5600 },
  { periodo: "26/06", receitas: 19200, despesas: 11500, saldo: 7700 },
  
  // Julho 2025 (mês atual)
  { periodo: "01/07", receitas: 12000, despesas: 7500, saldo: 4500 },
  { periodo: "02/07", receitas: 19000, despesas: 6200, saldo: 12800 },
  { periodo: "03/07", receitas: 3000, despesas: 1200, saldo: 1800 },
  { periodo: "04/07", receitas: 5000, despesas: 900, saldo: 4100 },
  { periodo: "05/07", receitas: 2000, despesas: 1500, saldo: 500 },
  { periodo: "06/07", receitas: 3000, despesas: 1000, saldo: 2000 },
  { periodo: "07/07", receitas: 9000, despesas: 1300, saldo: 7700 },
  { periodo: "10/07", receitas: 14000, despesas: 8900, saldo: 5100 },
  { periodo: "15/07", receitas: 16500, despesas: 7800, saldo: 8700 },
];



// Dados mensais
export const receitasDataMensal = [
  // 2023
  { periodo: "Jan", valor: 45000, ano: "2023" },
  { periodo: "Fev", valor: 52000, ano: "2023" },
  { periodo: "Mar", valor: 49000, ano: "2023" },
  { periodo: "Abr", valor: 58000, ano: "2023" },
  { periodo: "Mai", valor: 55000, ano: "2023" },
  { periodo: "Jun", valor: 60000, ano: "2023" },
  { periodo: "Jul", valor: 63000, ano: "2023" },
  { periodo: "Ago", valor: 59000, ano: "2023" },
  { periodo: "Set", valor: 61000, ano: "2023" },
  { periodo: "Out", valor: 64000, ano: "2023" },
  { periodo: "Nov", valor: 68000, ano: "2023" },
  { periodo: "Dez", valor: 72000, ano: "2023" },
  
  // 2025
  { periodo: "Jan", valor: 52000, ano: "2025" },
  { periodo: "Fev", valor: 57000, ano: "2025" },
  { periodo: "Mar", valor: 54000, ano: "2025" },
  { periodo: "Abr", valor: 63000, ano: "2025" },
  { periodo: "Mai", valor: 59000, ano: "2025" },
  { periodo: "Jun", valor: 65000, ano: "2025" },
  { periodo: "Jul", valor: 68000, ano: "2025" },
  { periodo: "Ago", valor: 64000, ano: "2025" },
  { periodo: "Set", valor: 67000, ano: "2025" },
  { periodo: "Out", valor: 69000, ano: "2025" },
  { periodo: "Nov", valor: 73000, ano: "2025" },
  { periodo: "Dez", valor: 78000, ano: "2025" },
  
  // 2025 (ano atual)
  { periodo: "Jan", valor: 58000, ano: "2025" },
  { periodo: "Fev", valor: 63000, ano: "2025" },
  { periodo: "Mar", valor: 60000, ano: "2025" },
  { periodo: "Abr", valor: 69000, ano: "2025" },
  { periodo: "Mai", valor: 65000, ano: "2025" },
  { periodo: "Jun", valor: 71000, ano: "2025" },
  { periodo: "Jul", valor: 45000, ano: "2025" },
];

export const despesasDataMensal = [
  // 2023
  { periodo: "Jan", valor: 35000, ano: "2023" },
  { periodo: "Fev", valor: 38000, ano: "2023" },
  { periodo: "Mar", valor: 33000, ano: "2023" },
  { periodo: "Abr", valor: 42000, ano: "2023" },
  { periodo: "Mai", valor: 40000, ano: "2023" },
  { periodo: "Jun", valor: 45000, ano: "2023" },
  { periodo: "Jul", valor: 44000, ano: "2023" },
  { periodo: "Ago", valor: 41000, ano: "2023" },
  { periodo: "Set", valor: 43000, ano: "2023" },
  { periodo: "Out", valor: 46000, ano: "2023" },
  { periodo: "Nov", valor: 48000, ano: "2023" },
  { periodo: "Dez", valor: 50000, ano: "2023" },
  
  // 2025
  { periodo: "Jan", valor: 38000, ano: "2025" },
  { periodo: "Fev", valor: 41000, ano: "2025" },
  { periodo: "Mar", valor: 36000, ano: "2025" },
  { periodo: "Abr", valor: 45000, ano: "2025" },
  { periodo: "Mai", valor: 43000, ano: "2025" },
  { periodo: "Jun", valor: 48000, ano: "2025" },
  { periodo: "Jul", valor: 47000, ano: "2025" },
  { periodo: "Ago", valor: 44000, ano: "2025" },
  { periodo: "Set", valor: 46000, ano: "2025" },
  { periodo: "Out", valor: 49000, ano: "2025" },
  { periodo: "Nov", valor: 51000, ano: "2025" },
  { periodo: "Dez", valor: 53000, ano: "2025" },
  
  // 2025 (ano atual)
  { periodo: "Jan", valor: 42000, ano: "2025" },
  { periodo: "Fev", valor: 45000, ano: "2025" },
  { periodo: "Mar", valor: 40000, ano: "2025" },
  { periodo: "Abr", valor: 49000, ano: "2025" },
  { periodo: "Mai", valor: 47000, ano: "2025" },
  { periodo: "Jun", valor: 52000, ano: "2025" },
  { periodo: "Jul", valor: 28000, ano: "2025" },
];

export const fluxoCaixaDataMensal = [
  { periodo: "Jan", receitas: 45000, despesas: 38000, saldo: 7000 },
  { periodo: "Fev", receitas: 52000, despesas: 41000, saldo: 11000 },
  { periodo: "Mar", receitas: 48000, despesas: 45000, saldo: 3000 },
  { periodo: "Abr", receitas: 61000, despesas: 52000, saldo: 9000 },
  { periodo: "Mai", receitas: 55000, despesas: 49000, saldo: 6000 },
  { periodo: "Jun", receitas: 58000, despesas: 51000, saldo: 7000 },
];

// Dados anuais
export const receitasDataAnual = [
  { periodo: "2020", valor: 520000 },
  { periodo: "2021", valor: 580000 },
  { periodo: "2022", valor: 650000 },
  { periodo: "2023", valor: 720000 },
  { periodo: "2024", valor: 830000 },
  { periodo: "2025", valor: 319000 }, // Ano atual (parcial)
];

export const despesasDataAnual = [
  { periodo: "2020", valor: 450000 },
  { periodo: "2021", valor: 510000 },
  { periodo: "2022", valor: 560000 },
  { periodo: "2023", valor: 630000 },
  { periodo: "2024", valor: 720000 },
  { periodo: "2025", valor: 278000 }, // Ano atual (parcial)
];

// Dados por categoria - Anuais
export const receitasCategoriaDataAnual = [
  { categoria: "Projetos", valor: 2200000, cor: "#22c55e" },
  { categoria: "Consultoria", valor: 750000, cor: "#10b981" },
  { categoria: "Execução", valor: 520000, cor: "#059669" },
  { categoria: "Outros", valor: 149000, cor: "#047857" },
];

export const despesasCategoriaDataAnual = [
  { categoria: "Materiais", valor: 180000, cor: "#ff6411" },
  { categoria: "Pessoal", valor: 240000, cor: "#ff8411" },
  { categoria: "Equipamentos", valor: 120000, cor: "#ffA411" },
  { categoria: "Outros", valor: 60000, cor: "#ffC411" },
];

// Dados por forma de pagamento - Anuais
export const receitasFormaPagtoDataAnual = [
  { forma: "Transferência", valor: 1900000, cor: "#0ea5e9" },
  { forma: "Cartão", valor: 950000, cor: "#38bdf8" },
  { forma: "Boleto", valor: 590000, cor: "#7dd3fc" },
  { forma: "Dinheiro", valor: 180000, cor: "#bae6fd" },
];

export const despesasFormaPagtoDataAnual = [
  { forma: "Transferência", valor: 1400000, cor: "#f43f5e" },
  { forma: "Cartão", valor: 750000, cor: "#fb7185" },
  { forma: "Boleto", valor: 480000, cor: "#fda4af" },
  { forma: "Dinheiro", valor: 120000, cor: "#fecdd3" },
];

// Dados por fornecedor - Anuais
export const despesasFornecedorDataAnual = [
  { fornecedor: "Construmega", valor: 520000, cor: "#8b5cf6" },
  { fornecedor: "TechBuild", valor: 380000, cor: "#a78bfa" },
  { fornecedor: "Elétrica Plus", valor: 210000, cor: "#c4b5fd" },
  { fornecedor: "Hidrosol", valor: 180000, cor: "#ddd6fe" },
  { fornecedor: "Outros", valor: 750000, cor: "#ede9fe" },
];

export const fluxoCaixaDataAnual = [
  { periodo: "2020", receitas: 520000, despesas: 450000, saldo: 70000 },
  { periodo: "2021", receitas: 580000, despesas: 510000, saldo: 70000 },
  { periodo: "2022", receitas: 650000, despesas: 560000, saldo: 90000 },
  { periodo: "2023", receitas: 720000, despesas: 630000, saldo: 90000 },
  { periodo: "2024", receitas: 830000, despesas: 720000, saldo: 110000 },
  { periodo: "2025", receitas: 319000, despesas: 278000, saldo: 41000 }, // Ano atual (parcial)
];

// Dados por categoria - Mensais
export const receitasCategoriaDataMensal = [
  { categoria: "Projetos", valor: 180000, cor: "#22c55e" },
  { categoria: "Consultoria", valor: 60000, cor: "#10b981" },
  { categoria: "Execução", valor: 45000, cor: "#059669" },
  { categoria: "Outros", valor: 34000, cor: "#047857" },
];

export const despesasCategoriaDataMensal = [
  { categoria: "Materiais", valor: 25000, cor: "#f97316" },
  { categoria: "Pessoal", valor: 30000, cor: "#fb923c" },
  { categoria: "Equipamentos", valor: 15000, cor: "#fdba74" },
  { categoria: "Outros", valor: 8000, cor: "#fed7aa" },
];

// Dados por forma de pagamento - Mensais
export const receitasFormaPagtoDataMensal = [
  { forma: "Transferência", valor: 160000, cor: "#0ea5e9" },
  { forma: "Cartão", valor: 80000, cor: "#38bdf8" },
  { forma: "Boleto", valor: 55000, cor: "#7dd3fc" },
  { forma: "Dinheiro", valor: 24000, cor: "#bae6fd" },
];

export const despesasFormaPagtoDataMensal = [
  { forma: "Transferência", valor: 32000, cor: "#f43f5e" },
  { forma: "Cartão", valor: 22000, cor: "#fb7185" },
  { forma: "Boleto", valor: 15000, cor: "#fda4af" },
  { forma: "Dinheiro", valor: 9000, cor: "#fecdd3" },
];

// Dados por fornecedor - Mensais
export const despesasFornecedorDataMensal = [
  { fornecedor: "Construmega", valor: 28000, cor: "#8b5cf6" },
  { fornecedor: "TechBuild", valor: 22000, cor: "#a78bfa" },
  { fornecedor: "Elétrica Plus", valor: 12000, cor: "#c4b5fd" },
  { fornecedor: "Hidrosol", valor: 9000, cor: "#ddd6fe" },
  { fornecedor: "Outros", valor: 7000, cor: "#ede9fe" },
];

// Dados de projetos
export const projetosData = [
  { nome: "Residencial Solar", status: "Em andamento", progresso: 75, valor: 280000, previsaoTermino: "Ago/2025" },
  { nome: "Comercial Centro", status: "Concluído", progresso: 100, valor: 520000, previsaoTermino: "Jun/2025" },
  { nome: "Edifício Horizon", status: "Atrasado", progresso: 45, valor: 820000, previsaoTermino: "Out/2025" },
  { nome: "Casa Moderna", status: "Em andamento", progresso: 60, valor: 180000, previsaoTermino: "Set/2025" },
  { nome: "Reforma Apartamentos", status: "Em andamento", progresso: 90, valor: 150000, previsaoTermino: "Jul/2025" },
  { nome: "Condomínio Jardins", status: "Planejamento", progresso: 15, valor: 950000, previsaoTermino: "Mar/2026" },
];

export const projetosStatusData = [
  { status: "Em andamento", quantidade: 12, cor: "#60a5fa" },
  { status: "Concluído", quantidade: 8, cor: "#22c55e" },
  { status: "Atrasado", quantidade: 3, cor: "#ef4444" },
  { status: "Planejamento", quantidade: 5, cor: "#f59e0b" },
];

export const projetosTimelineData = [
  { periodo: "Jan", projetos: 3 },
  { periodo: "Fev", projetos: 5 },
  { periodo: "Mar", projetos: 4 },
  { periodo: "Abr", projetos: 6 },
  { periodo: "Mai", projetos: 8 },
  { periodo: "Jun", projetos: 7 },
];

// Dados de clientes
export const clientesData = [
  { periodo: "Jan", novos: 8, ativos: 42 },
  { periodo: "Fev", novos: 12, ativos: 54 },
  { periodo: "Mar", novos: 5, ativos: 59 },
  { periodo: "Abr", novos: 10, ativos: 69 },
  { periodo: "Mai", novos: 15, ativos: 84 },
  { periodo: "Jun", novos: 7, ativos: 91 },
];

export const clientesTipoData = [
  { tipo: "Pessoa Física", quantidade: 45, cor: "#f97316" },
  { tipo: "Pessoa Jurídica", quantidade: 35, cor: "#fb923c" },
  { tipo: "Órgão Público", quantidade: 15, cor: "#fdba74" },
  { tipo: "Outros", quantidade: 5, cor: "#fed7aa" },
];

export const clientesRecorrenciaData = [
  { tipo: "Primeira vez", quantidade: 24, cor: "#f97316" },
  { tipo: "Recorrente", quantidade: 68, cor: "#fb923c" },
  { tipo: "Indicação", quantidade: 8, cor: "#fdba74" },
];

// Dados de funcionários
export const funcionariosData = [
  { departamento: "Engenharia", quantidade: 8, cor: "#3b82f6" },
  { departamento: "Arquitetura", quantidade: 5, cor: "#ec4899" },
  { departamento: "Administrativo", quantidade: 3, cor: "#14b8a6" },
  { departamento: "Financeiro", quantidade: 2, cor: "#f59e0b" },
  { departamento: "Comercial", quantidade: 4, cor: "#8b5cf6" },
];

export const funcionariosTempoData = [
  { tempo: "< 1 ano", quantidade: 6 },
  { tempo: "1-2 anos", quantidade: 8 },
  { tempo: "3-5 anos", quantidade: 5 },
  { tempo: "> 5 anos", quantidade: 3 },
];

export const funcionariosCustoData = [
  { periodo: "Jan", salarios: 85000, beneficios: 15000, encargos: 25000 },
  { periodo: "Fev", salarios: 85000, beneficios: 15000, encargos: 25000 },
  { periodo: "Mar", salarios: 90000, beneficios: 16000, encargos: 27000 },
  { periodo: "Abr", salarios: 90000, beneficios: 16000, encargos: 27000 },
  { periodo: "Mai", salarios: 95000, beneficios: 17000, encargos: 28500 },
  { periodo: "Jun", salarios: 95000, beneficios: 17000, encargos: 28500 },
];
