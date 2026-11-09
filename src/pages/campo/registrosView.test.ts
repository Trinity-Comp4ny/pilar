import { describe, expect, it } from "vitest";
import { novoItemDeRegistro } from "./campoRegistroFila";
import { agruparPorDia, montarRegistrosView, type RegistroDoServidor } from "./registrosView";

const servidor = (id: string, clientId: string, extra: Partial<RegistroDoServidor> = {}): RegistroDoServidor => ({
  id,
  client_id: clientId,
  data_registro: "2026-10-19",
  tipo: "audio",
  status: "pronto",
  autor_nome: "Zé",
  criado_em: "2026-10-19T14:00:00.000Z",
  erro: null,
  texto: "Parede pronta",
  extraido: null,
  audio_duracao_s: 20,
  tem_audio: true,
  fotos: 0,
  meu: true,
  ...extra,
});

describe("montarRegistrosView", () => {
  it("o registro que já subiu não aparece duas vezes (mesmo client_id)", () => {
    const local = novoItemDeRegistro({ id: "c1", data: "2026-10-19", texto: "x", fotos: [], aceiteAudio: false });
    const v = montarRegistrosView([servidor("s1", "c1")], [local], "Zé");
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ id: "s1", estado: "pronto" });
  });

  it("o que só está no aparelho vira local, com o nome da conta", () => {
    const local = novoItemDeRegistro({
      id: "c2",
      agora: 5,
      data: "2026-10-19",
      texto: "Chuva",
      fotos: [],
      aceiteAudio: false,
    });
    const [v] = montarRegistrosView([], [local], "Zé");
    expect(v).toMatchObject({ id: null, chave: "c2", estado: "local", autorNome: "Zé", meu: true, semSinal: false });
  });

  it("depois de uma tentativa que falhou mostra esperando sinal; erro definitivo bloqueia", () => {
    const tentou = {
      ...novoItemDeRegistro({ id: "c3", data: "2026-10-19", texto: "a", fotos: [], aceiteAudio: false }),
      tentativas: 2,
    };
    const preso = {
      ...novoItemDeRegistro({ id: "c4", data: "2026-10-19", texto: "b", fotos: [], aceiteAudio: false }),
      erroDefinitivo: "Áudio grande demais",
    };
    const v = montarRegistrosView([], [tentou, preso], "Zé");
    expect(v.find((r) => r.chave === "c3")?.semSinal).toBe(true);
    expect(v.find((r) => r.chave === "c4")).toMatchObject({ estado: "bloqueado", erro: "Áudio grande demais" });
  });

  it("ordena do dia mais novo para o mais antigo e, no mesmo dia, do mais novo para o mais antigo", () => {
    const v = montarRegistrosView(
      [
        servidor("s1", "c1", { criado_em: "2026-10-19T10:00:00.000Z" }),
        servidor("s2", "c2", { criado_em: "2026-10-19T15:00:00.000Z" }),
        servidor("s3", "c3", { data_registro: "2026-10-18", criado_em: "2026-10-18T20:00:00.000Z" }),
      ],
      [],
      "Zé"
    );
    expect(v.map((r) => r.id)).toEqual(["s2", "s1", "s3"]);
  });
});

describe("agruparPorDia", () => {
  it("agrupa dias seguidos e mantém a ordem", () => {
    const v = montarRegistrosView(
      [servidor("s1", "c1"), servidor("s2", "c2"), servidor("s3", "c3", { data_registro: "2026-10-18" })],
      [],
      "Zé"
    );
    const g = agruparPorDia(v);
    expect(g.map((d) => [d.data, d.registros.length])).toEqual([
      ["2026-10-19", 2],
      ["2026-10-18", 1],
    ]);
  });
});
