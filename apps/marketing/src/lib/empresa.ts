// Identificação legal de quem opera o Pilar. Fonte única para a Política de Privacidade
// (LGPD art. 9º, III e art. 41), os Termos de Uso e o rodapé (Decreto 7.962/2013, art. 2º:
// nome empresarial, CNPJ e endereço físico e eletrônico em local de fácil visualização).
export const EMPRESA = {
  razaoSocial: "MATHEUS PREZIA REZENDE TECH LTDA",
  cnpj: "63.418.862/0001-59",
  endereco: "Rua Pedro Salido Nogueira, 63, Casa 10, Solar das Esmeraldas, Marília, SP, CEP 17516-545",
  email: "privacidade@pilarsoft.com.br",
  encarregado: "Matheus Prezia Rezende",
} as const;

/** "Razão social, CNPJ x" numa linha, para texto corrido. */
export const IDENTIFICACAO = `${EMPRESA.razaoSocial}, CNPJ ${EMPRESA.cnpj}`;
