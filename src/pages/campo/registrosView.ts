import type { ExtraidoRegistro, StatusRegistro } from "@/lib/registrosObra";
import type { FilaRegistroItem } from "./campoRegistroFila";

/** Uma linha de `campo_listar_registros`. */
export interface RegistroDoServidor {
  id: string;
  client_id: string;
  data_registro: string;
  tipo: "audio" | "foto" | "texto" | "misto";
  status: StatusRegistro;
  autor_nome: string;
  criado_em: string;
  erro: string | null;
  texto: string | null;
  extraido: ExtraidoRegistro | null;
  audio_duracao_s: number | null;
  tem_audio: boolean;
  fotos: number;
  meu: boolean;
}

/** `local`: ainda está no aparelho, esperando envio. `bloqueado`: o envio não vai se resolver sozinho. */
type EstadoDoRegistro = StatusRegistro | "local" | "bloqueado";

export interface RegistroView {
  /** Chave estável na lista: o client_id é igual no aparelho e no servidor. */
  chave: string;
  /** Id do servidor; ausente enquanto o registro só existe no aparelho. */
  id: string | null;
  data: string;
  criadoEm: number;
  autorNome: string;
  meu: boolean;
  estado: EstadoDoRegistro;
  texto: string | null;
  extraido: ExtraidoRegistro | null;
  duracaoS: number | null;
  temAudio: boolean;
  fotos: number;
  erro: string | null;
  /** Há tentativa de envio que falhou: "Esperando sinal" em vez de "Enviando". */
  semSinal: boolean;
}

/**
 * Junta o que o servidor já tem com o que ainda está na fila do aparelho. O client_id é o
 * mesmo dos dois lados, então o registro que acabou de subir não aparece duas vezes.
 */
export function montarRegistrosView(
  servidor: RegistroDoServidor[],
  locais: FilaRegistroItem[],
  nomeDaConta: string
): RegistroView[] {
  const doServidor: RegistroView[] = servidor.map((r) => ({
    chave: r.client_id,
    id: r.id,
    data: r.data_registro,
    criadoEm: new Date(r.criado_em).getTime(),
    autorNome: r.autor_nome,
    meu: r.meu,
    estado: r.status,
    texto: r.texto,
    extraido: r.extraido,
    duracaoS: r.audio_duracao_s,
    temAudio: r.tem_audio,
    fotos: r.fotos,
    erro: r.erro,
    semSinal: false,
  }));
  const jaNoServidor = new Set(servidor.map((r) => r.client_id));
  const doAparelho: RegistroView[] = locais
    .filter((l) => !jaNoServidor.has(l.id))
    .map((l) => ({
      chave: l.id,
      id: null,
      data: l.data,
      criadoEm: l.criadoEm,
      autorNome: nomeDaConta,
      meu: true,
      estado: l.erroDefinitivo ? "bloqueado" : "local",
      texto: l.texto ?? null,
      extraido: null,
      duracaoS: l.audio?.duracaoS ?? null,
      temAudio: Boolean(l.audio),
      fotos: l.fotos.length,
      erro: l.erroDefinitivo ?? null,
      semSinal: l.tentativas > 0,
    }));
  return [...doAparelho, ...doServidor].sort((a, b) =>
    a.data === b.data ? b.criadoEm - a.criadoEm : a.data < b.data ? 1 : -1
  );
}

/** Agrupa a lista (já ordenada) por dia, mantendo a ordem. */
export function agruparPorDia(registros: RegistroView[]): Array<{ data: string; registros: RegistroView[] }> {
  const grupos: Array<{ data: string; registros: RegistroView[] }> = [];
  for (const r of registros) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.data === r.data) ultimo.registros.push(r);
    else grupos.push({ data: r.data, registros: [r] });
  }
  return grupos;
}
