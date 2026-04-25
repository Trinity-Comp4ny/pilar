import { z } from "zod";

/**
 * Password policy Pilar.
 *
 * Server-side (Supabase): configurar em Dashboard → Authentication → Policies
 *   Minimum length: 12
 *   Require: uppercase, lowercase, digit, special character
 *
 * Client-side: usar `passwordSchema` em todos forms de set/reset password.
 */

const MIN_LENGTH = 12;
const HAS_LOWERCASE = /[a-z]/;
const HAS_UPPERCASE = /[A-Z]/;
const HAS_DIGIT = /\d/;
const HAS_SPECIAL = /[!@#$%^&*(),.?":{}|<>_\-+=/\\[\]`~';]/;

export const passwordSchema = z
  .string()
  .min(MIN_LENGTH, `Senha deve ter pelo menos ${MIN_LENGTH} caracteres`)
  .regex(HAS_LOWERCASE, "Senha deve conter letra minúscula")
  .regex(HAS_UPPERCASE, "Senha deve conter letra maiúscula")
  .regex(HAS_DIGIT, "Senha deve conter número")
  .regex(HAS_SPECIAL, "Senha deve conter caractere especial");

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: "muito fraca" | "fraca" | "média" | "forte" | "muito forte";
  feedback: string[];
}

export function evaluatePassword(password: string): PasswordStrength {
  const feedback: string[] = [];
  let score = 0;

  if (password.length >= MIN_LENGTH) score++;
  else feedback.push(`Adicione mais ${MIN_LENGTH - password.length} caracteres`);

  if (HAS_LOWERCASE.test(password)) score++;
  else feedback.push("Inclua letra minúscula");

  if (HAS_UPPERCASE.test(password)) score++;
  else feedback.push("Inclua letra maiúscula");

  const hasNumber = HAS_DIGIT.test(password);
  const hasSpecial = HAS_SPECIAL.test(password);
  if (hasNumber && hasSpecial) score++;
  else if (!hasNumber) feedback.push("Inclua número");
  else if (!hasSpecial) feedback.push("Inclua caractere especial");

  const labels: PasswordStrength["label"][] = ["muito fraca", "fraca", "média", "forte", "muito forte"];

  return {
    score: score as PasswordStrength["score"],
    label: labels[score],
    feedback,
  };
}
