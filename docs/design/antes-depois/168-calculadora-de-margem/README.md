# SPEC 168: calculadora de margem na proposta

`proposta-lead-projeto.jpg`: antes (`origin/staging`) e depois (esta branch), lado a lado.

Captura feita com os componentes reais (`DisciplinasEditor`, `CalculadoraMargem`, `MargemPropostaBadge`,
`ProjetoDetailInfo`) numa página de teste com dado fixo (custo R$ 7.000, valor R$ 10.000, imposto 6%,
cartão 1x a 3,5%, desconto 10%), sem Supabase. O card do lead é uma linha de exemplo com o mesmo selo.

- Proposta: o painel "Quanto sobra no fim" entra abaixo das disciplinas.
- Lead: selo de margem líquida com semáforo ao lado do valor.
- Projeto: o card Margem Bruta ganha a linha "Prometida na proposta".
