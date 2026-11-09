/** "Bom dia" até 11h59, "Boa tarde" até 17h59, "Boa noite" depois. */
export function saudacao(agora: Date): string {
  const hora = agora.getHours();
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}
