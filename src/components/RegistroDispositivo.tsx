import { useRegistrarDispositivo } from "@/hooks/useRegistrarDispositivo";

/**
 * Registra o navegador da sessão (SPEC 159). Componente sem tela, carregado sob demanda no
 * Layout: o alerta de acesso novo não precisa estar no carregamento inicial.
 */
export function RegistroDispositivo() {
  useRegistrarDispositivo();
  return null;
}
