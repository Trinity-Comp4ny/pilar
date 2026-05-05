import { z } from "zod";
import { passwordSchema } from "@/lib/passwordPolicy";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email inválido"),
  password: z.string().min(1, "Informe a senha"),
});
export type LoginFormData = z.infer<typeof loginSchema>;
export const loginDefaultValues: LoginFormData = { email: "", password: "" };

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
export type ProfileSetupFormData = z.infer<typeof profileSetupSchema>;
export const profileSetupDefaultValues: ProfileSetupFormData = {
  firstName: "",
  lastName: "",
  phone: "",
  password: "",
  confirmPassword: "",
};

export const companySetupSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório"),
  cnpj: z.string().trim().optional().default(""),
});
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
