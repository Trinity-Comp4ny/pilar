import { z } from "zod";
import { passwordSchema } from "@/lib/passwordPolicy";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email inválido"),
  password: z.string().min(1, "Informe a senha"),
});
export type LoginFormData = z.infer<typeof loginSchema>;
export const loginDefaultValues: LoginFormData = { email: "", password: "" };

export const signupSchema = z
  .object({
    nome: z.string().trim().min(1, "Nome é obrigatório"),
    email: z.string().trim().toLowerCase().email("Email inválido"),
    telefone: z.string().trim().min(10, "Informe um celular válido"),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirme a senha"),
    companyName: z.string().trim().min(1, "Nome da empresa é obrigatório"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });
export type SignupFormData = z.infer<typeof signupSchema>;
export const signupDefaultValues: SignupFormData = {
  nome: "",
  email: "",
  telefone: "",
  password: "",
  confirmPassword: "",
  companyName: "",
};

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email inválido"),
});
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export const forgotPasswordDefaultValues: ForgotPasswordFormData = { email: "" };

export const passwordResetSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirme a senha"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });
export type PasswordResetFormData = z.infer<typeof passwordResetSchema>;
export const passwordResetDefaultValues: PasswordResetFormData = { password: "", confirmPassword: "" };

export const profileSetupSchema = z
  .object({
    firstName: z.string().trim().min(1, "Nome é obrigatório"),
    lastName: z.string().trim().min(1, "Sobrenome é obrigatório"),
    phone: z.string().trim().min(10, "Telefone obrigatório"),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirme a senha"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });
// Contas OAuth (Google) chegam sem senha própria: o onboarding não pede senha,
// então firstName/lastName/phone bastam. Ignora password/confirmPassword do form.
export const profileSetupOAuthSchema = z.object({
  firstName: z.string().trim().min(1, "Nome é obrigatório"),
  lastName: z.string().trim().min(1, "Sobrenome é obrigatório"),
  phone: z.string().trim().min(10, "Telefone obrigatório"),
});

export type ProfileSetupFormData = z.infer<typeof profileSetupSchema>;
export const profileSetupDefaultValues: ProfileSetupFormData = {
  firstName: "",
  lastName: "",
  phone: "",
  password: "",
  confirmPassword: "",
};

function validCnpjChecksum(digits: string): boolean {
  if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) return false;
  const calc = (s: string, w: number[]) => s.split("").reduce((sum, n, i) => sum + parseInt(n) * w[i], 0);
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, ...w1];
  const r1 = calc(digits.slice(0, 12), w1) % 11;
  const r2 = calc(digits.slice(0, 13), w2) % 11;
  return parseInt(digits[12]) === (r1 < 2 ? 0 : 11 - r1) && parseInt(digits[13]) === (r2 < 2 ? 0 : 11 - r2);
}

export const companySetupSchema = z
  .object({
    name: z.string().trim().min(1, "Nome é obrigatório"),
    cnpj: z.string().trim().optional().default(""),
  })
  .refine(
    (d) => {
      const digits = (d.cnpj ?? "").replace(/\D/g, "");
      if (digits.length === 0) return true;
      return validCnpjChecksum(digits);
    },
    { message: "CNPJ inválido", path: ["cnpj"] }
  );
export type CompanySetupFormData = z.infer<typeof companySetupSchema>;
export const companySetupDefaultValues: CompanySetupFormData = { name: "", cnpj: "" };

export const profileEditSchema = z.object({
  firstName: z.string().trim().min(1, "Nome é obrigatório"),
  lastName: z.string().trim().min(1, "Sobrenome é obrigatório"),
  contact: z.string().trim().optional().default(""),
});
export type ProfileEditFormData = z.infer<typeof profileEditSchema>;
export const profileEditDefaultValues: ProfileEditFormData = {
  firstName: "",
  lastName: "",
  contact: "",
};

export const clienteLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email inválido"),
  password: z.string().min(1, "Informe a senha"),
});
export type ClienteLoginFormData = z.infer<typeof clienteLoginSchema>;
export const clienteLoginDefaultValues: ClienteLoginFormData = { email: "", password: "" };

export const trocarSenhaPortalSchema = z
  .object({
    senhaAtual: z.string().min(1, "Informe a senha atual"),
    novaSenha: passwordSchema,
    confirmarSenha: z.string().min(1, "Confirme a nova senha"),
  })
  .refine((d) => d.novaSenha === d.confirmarSenha, {
    message: "As senhas não coincidem",
    path: ["confirmarSenha"],
  })
  .refine((d) => d.novaSenha !== d.senhaAtual, {
    message: "A nova senha deve ser diferente da atual",
    path: ["novaSenha"],
  });
export type TrocarSenhaPortalFormData = z.infer<typeof trocarSenhaPortalSchema>;
export const trocarSenhaPortalDefaultValues: TrocarSenhaPortalFormData = {
  senhaAtual: "",
  novaSenha: "",
  confirmarSenha: "",
};
