import { cnpjValido, describe, expect, it } from "vitest";
import {
  decidirCanal,
  decidirConfianca,
  ehDaRegiao,
  escolherTelefone,
  extrairTelefones,
  formatarTelefone,
  linhaParaLead,
  montarContato,
  notaPorPrioridade,
  saudacao,
  segmentoPorRotulo,
  type LeadParaMensagem,
} from "./prospeccaoLib";

// Dados sintéticos: nenhum lead real entra no repositório (público).
const MANHA = new Date("2026-11-20T13:00:00Z"); // 10h em Brasília
const TARDE = new Date("2026-11-20T18:00:00Z"); // 15h
const NOITE = new Date("2026-11-20T23:00:00Z"); // 20h

describe("extrairTelefones", () => {
  it("separa celular e fixo e ignora repetição", () => {
    const r = extrairTelefones("(14) 99999-0001 / (14) 3000-0002 e 14999990001");
    expect(r).toEqual([
      { e164: "5514999990001", tipo: "celular", exibicao: "(14) 99999-0001" },
      { e164: "551430000002", tipo: "fixo", exibicao: "(14) 3000-0002" },
    ]);
  });

  it("aceita prefixo +55 e devolve vazio sem telefone", () => {
    expect(extrairTelefones("+55 14 99999-0003")[0]?.e164).toBe("5514999990003");
    expect(extrairTelefones("sem número")).toEqual([]);
    expect(extrairTelefones(null)).toEqual([]);
  });
});

describe("escolherTelefone", () => {
  it("prefere o celular mesmo quando o fixo vem primeiro", () => {
    expect(escolherTelefone("(14) 3000-0002", "(14) 99999-0001")).toEqual({
      e164: "5514999990001",
      tipo: "celular",
    });
  });
  it("cai no fixo e depois em sem telefone", () => {
    expect(escolherTelefone("(14) 3000-0002", null).tipo).toBe("fixo");
    expect(escolherTelefone(null, "")).toEqual({ e164: null, tipo: "sem" });
  });
});

describe("decidirCanal", () => {
  it("celular vai para WhatsApp, fixo com e-mail para e-mail, fixo sozinho para ligação", () => {
    expect(decidirCanal("celular", "a@b.com")).toBe("whatsapp");
    expect(decidirCanal("fixo", "a@b.com")).toBe("email");
    expect(decidirCanal("fixo", null)).toBe("ligacao");
    expect(decidirCanal("sem", "a@b.com")).toBe("email");
    expect(decidirCanal("sem", null)).toBe("nenhum");
  });
});

describe("decidirConfianca", () => {
  it("só vira pessoa com nome, celular e WhatsApp indicado na fonte", () => {
    expect(decidirConfianca({ contatoNome: "Ana", tipo: "celular", whatsappNaFonte: true })).toBe("pessoa");
    expect(decidirConfianca({ contatoNome: "Ana", tipo: "celular", whatsappNaFonte: false })).toBe("empresa");
    expect(decidirConfianca({ contatoNome: "Ana", tipo: "fixo", whatsappNaFonte: true })).toBe("empresa");
    expect(decidirConfianca({ contatoNome: null, tipo: "celular", whatsappNaFonte: true })).toBe("empresa");
  });
});

describe("segmentoPorRotulo", () => {
  it("reconhece os oito segmentos da base e marca o ICP", () => {
    expect(segmentoPorRotulo("Arquitetura")?.icp).toBe(true);
    expect(segmentoPorRotulo("Engenharia")?.icp).toBe(true);
    expect(segmentoPorRotulo("Móveis planejados e marcenaria")?.slug).toBe("moveis_planejados");
    expect(segmentoPorRotulo("Construtoras")?.icp).toBe(false);
    expect(segmentoPorRotulo("Marmorarias")?.slug).toBe("marmorarias");
    expect(segmentoPorRotulo("Vidraçarias")?.slug).toBe("vidracarias");
    expect(segmentoPorRotulo("Esquadrias e alumínio")?.slug).toBe("esquadrias");
    expect(segmentoPorRotulo("Serralherias e estruturas")?.slug).toBe("serralherias");
    expect(segmentoPorRotulo("Padaria")).toBeNull();
    expect(segmentoPorRotulo(undefined)).toBeNull();
  });
});

describe("notaPorPrioridade", () => {
  it("dá mais nota à prioridade alta e um bônus ao ICP", () => {
    expect(notaPorPrioridade("Alta", true)).toBe(95);
    expect(notaPorPrioridade("Alta", false)).toBe(90);
    expect(notaPorPrioridade("Média", false)).toBe(60);
    expect(notaPorPrioridade("High", false)).toBe(90);
    expect(notaPorPrioridade(null, false)).toBe(50);
  });
});

describe("linhaParaLead", () => {
  it("lê o cabeçalho da planilha de leads", () => {
    const r = linhaParaLead({
      Empresa: "Estúdio Exemplo",
      Segmento: "Arquitetura",
      Cidade: "Marília",
      "Telefone principal": "(14) 3000-0002",
      "Telefone adicional": "(14) 99999-0001",
      WhatsApp: "Sim - indicado na fonte",
      "E-mail": "contato@exemplo.test",
      "Nome público associado": "Ana Souza",
      "Prioridade sugerida": "Alta",
    });
    expect("lead" in r && r.lead).toMatchObject({
      nome: "Estúdio Exemplo",
      segmento: "arquitetura",
      segmento_teste: false,
      telefone_e164: "5514999990001",
      tipo_telefone: "celular",
      canal: "whatsapp",
      confianca_contato: "pessoa",
      whatsapp_na_fonte: true,
      nota_encaixe: 95,
    });
  });

  it("lê o cabeçalho em inglês do CSV do ClickUp", () => {
    const r = linhaParaLead({
      "Task Name": "Marcenaria Exemplo",
      Segment: "Móveis planejados e marcenaria",
      City: "Garça",
      Phone: "(14) 3000-0002",
      Email: "m@exemplo.test",
      Priority: "Medium",
    });
    expect("lead" in r && r.lead).toMatchObject({
      segmento: "moveis_planejados",
      segmento_teste: true,
      canal: "email",
      confianca_contato: "empresa",
      nota_encaixe: 60,
    });
  });

  it("descarta linha sem nome, sem segmento conhecido ou sem nenhum contato", () => {
    expect(linhaParaLead({ Segmento: "Arquitetura", "Telefone principal": "(14) 99999-0001" })).toEqual({
      descarte: "sem_nome",
    });
    expect(linhaParaLead({ Empresa: "X", Segmento: "Padaria", "Telefone principal": "(14) 99999-0001" })).toEqual({
      descarte: "segmento_desconhecido",
    });
    expect(linhaParaLead({ Empresa: "X", Segmento: "Arquitetura" })).toEqual({ descarte: "sem_contato" });
  });
});

describe("saudacao", () => {
  it("segue o horário de Brasília", () => {
    expect(saudacao(MANHA)).toBe("Bom dia");
    expect(saudacao(TARDE)).toBe("Boa tarde");
    expect(saudacao(NOITE)).toBe("Boa noite");
  });
});

describe("ehDaRegiao", () => {
  it("reconhece cidade da região sem depender de acento ou caixa", () => {
    expect(ehDaRegiao("Garça")).toBe(true);
    expect(ehDaRegiao("POMPÉIA")).toBe(true);
    expect(ehDaRegiao("Curitiba")).toBe(false);
    expect(ehDaRegiao(null)).toBe(false);
  });
});

const base: LeadParaMensagem = {
  nome: "Estúdio Exemplo",
  segmento: "arquitetura",
  cidade: "Marília",
  canal: "whatsapp",
  confianca_contato: "empresa",
  contato_nome: null,
  telefone_e164: "5514999990001",
  email: null,
};

describe("montarContato", () => {
  it("variante pessoa usa o primeiro nome e o texto do fundador", () => {
    const c = montarContato({ ...base, confianca_contato: "pessoa", contato_nome: "Liane Souza" }, MANHA);
    expect(c.texto).toBe(
      [
        "Bom dia, Liane! Tudo bem?",
        "Sou o Matheus, fundador da Pilar, um software de gestão para escritórios de arquitetura que nasceu aqui em Marília.",
        "A Pilar reúne orçamentos, projetos, equipe e financeiro em um só lugar, e estamos apresentando para empresas da região.",
        "Podemos marcar uma reunião para te apresentar?",
      ].join("\n")
    );
    expect(c.href).toBe(`https://wa.me/5514999990001?text=${encodeURIComponent(c.texto)}`);
  });

  it("variante empresa pergunta quem cuida da gestão", () => {
    const c = montarContato(base, TARDE);
    expect(c.texto).toContain("Boa tarde! Aqui é o Matheus, fundador da Pilar. Falo com a Estúdio Exemplo?");
    expect(c.texto).toContain("Com quem eu falo sobre a gestão por aí?");
    expect(c.canal).toBe("whatsapp");
  });

  it("fora da região não afirma proximidade", () => {
    const c = montarContato({ ...base, cidade: "Curitiba" }, MANHA);
    expect(c.texto).toContain("nasceu em Marília (SP)");
    expect(c.texto).not.toContain("aqui em Marília");
  });

  it("segmento de teste usa o público e a oferta do segmento", () => {
    const c = montarContato({ ...base, segmento: "marmorarias" }, MANHA);
    expect(c.texto).toContain("software de gestão para marmorarias");
    expect(c.texto).toContain("projetos sob medida");
  });

  it("e-mail e ligação devolvem mailto e tel", () => {
    const e = montarContato({ ...base, canal: "email", email: "a@b.test", telefone_e164: null }, MANHA);
    expect(e.href?.startsWith("mailto:a@b.test?subject=")).toBe(true);
    expect(e.assunto).toContain("Pilar");
    const l = montarContato({ ...base, canal: "ligacao", telefone_e164: "551430000002" }, MANHA);
    expect(l.href).toBe("tel:+551430000002");
  });

  it("sem canal ou sem telefone não gera link", () => {
    expect(montarContato({ ...base, canal: "nenhum" }, MANHA).href).toBeNull();
    expect(montarContato({ ...base, telefone_e164: null }, MANHA).href).toBeNull();
  });
});

describe("formatarTelefone", () => {
  it("formata e164 e tolera vazio", () => {
    expect(formatarTelefone("5514999990001")).toBe("(14) 99999-0001");
    expect(formatarTelefone("551430000002")).toBe("(14) 3000-0002");
    expect(formatarTelefone(null)).toBe("");
  });
});

describe("cnpjValido", () => {
  it("aceita formatado e rejeita curto", () => {
    expect(cnpjValido("11.222.333/0001-81")).toBe("11222333000181");
    expect(cnpjValido("123")).toBeNull();
    expect(cnpjValido(null)).toBeNull();
  });
});
