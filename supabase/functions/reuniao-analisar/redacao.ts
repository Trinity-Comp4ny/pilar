// SPEC 169: redação antes de gravar. O transcript cru nunca é persistido; só o texto
// redigido e a contagem por tipo (sem o valor). Função pura.

export type TipoRedacao = "email" | "telefone" | "cpf" | "cnpj" | "url_token" | "senha" | "valor";

export interface ResultadoRedacao {
  texto: string;
  contagem: Partial<Record<TipoRedacao, number>>;
}

const REGRAS: Array<{ tipo: TipoRedacao; re: RegExp; marca: string }> = [
  { tipo: "url_token", re: /https?:\/\/[^\s]*[?&](?:token|key|apikey|api_key|access_token|secret)=[^\s]+/gi, marca: "[URL REDIGIDA]" },
  { tipo: "email", re: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, marca: "[EMAIL]" },
  { tipo: "cnpj", re: /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, marca: "[CNPJ]" },
  { tipo: "cpf", re: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, marca: "[CPF]" },
  { tipo: "telefone", re: /(?:\+?55[\s-]?)?\(?\b\d{2}\)?[\s-]?9?\d{4}[\s-]?\d{4}\b/g, marca: "[TELEFONE]" },
  { tipo: "valor", re: /R\$\s?\d[\d.]*(?:,\d{1,2})?/g, marca: "[VALOR]" },
];

// "senha é a b c 1 2 3", "a senha: Abc123xyz": o que vem depois da palavra some.
const SENHA = /(senha|password|token)\s*(?:é|e|:|=|seria)?\s+([^\s.,;]+(?:\s+[^\s.,;]{1,3}){0,8})/gi;

export function redigir(entrada: string): ResultadoRedacao {
  const contagem: Partial<Record<TipoRedacao, number>> = {};
  let texto = entrada;
  const conta = (tipo: TipoRedacao, n: number) => {
    if (n > 0) contagem[tipo] = (contagem[tipo] ?? 0) + n;
  };

  texto = texto.replace(SENHA, (_m, palavra: string) => {
    conta("senha", 1);
    return `${palavra} [SENHA]`;
  });

  for (const { tipo, re, marca } of REGRAS) {
    texto = texto.replace(re, () => {
      conta(tipo, 1);
      return marca;
    });
  }
  return { texto, contagem };
}
