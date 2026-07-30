import { useCallback, useEffect, useState } from "react";

export interface CidadeSalva {
  label: string;
  latitude: number;
  longitude: number;
}

const KEY = "pilar.clima.cidades";
const MAX = 8;

function ler(): CidadeSalva[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (c): c is CidadeSalva =>
        !!c &&
        typeof (c as CidadeSalva).label === "string" &&
        typeof (c as CidadeSalva).latitude === "number" &&
        typeof (c as CidadeSalva).longitude === "number"
    );
  } catch {
    return [];
  }
}

/** Cidades favoritas do Clima (estilo iPhone): troca rápida, persistidas no browser. */
export function useCidadesSalvas() {
  const [cidades, setCidades] = useState<CidadeSalva[]>(ler);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(cidades));
    } catch {
      // localStorage indisponível (modo privado): sem persistência, sem erro.
    }
  }, [cidades]);

  const mesma = (a: CidadeSalva, b: CidadeSalva) =>
    Math.abs(a.latitude - b.latitude) < 0.01 && Math.abs(a.longitude - b.longitude) < 0.01;

  const adicionar = useCallback((c: CidadeSalva) => {
    setCidades((prev) => (prev.some((x) => mesma(x, c)) ? prev : [c, ...prev].slice(0, MAX)));
  }, []);

  const remover = useCallback((c: CidadeSalva) => {
    setCidades((prev) => prev.filter((x) => !mesma(x, c)));
  }, []);

  const salva = useCallback(
    (c: { latitude: number; longitude: number }) => cidades.some((x) => mesma(x, c as CidadeSalva)),
    [cidades]
  );

  return { cidades, adicionar, remover, salva };
}
