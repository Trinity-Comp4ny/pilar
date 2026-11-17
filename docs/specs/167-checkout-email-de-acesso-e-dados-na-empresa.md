# SPEC 167: Checkout pago: e-mail de acesso em destaque, dados na empresa e boas-vindas

**Data:** 2026-11-16  
**Status:** Em implementação  
**Autor:** Matheus  
**Módulo:** checkout / onboarding

## Problema

No checkout pago o acesso chega por um único e-mail. Um erro de digitação faz o escritório pagar e não
entrar. Depois, o dono digita de novo o CNPJ e o telefone que já informou no checkout, e não recebe
nenhum e-mail que confirme o que contratou.

## Objetivo

O e-mail de acesso é o primeiro campo do checkout, com confirmação. CNPJ e telefone do checkout chegam à
empresa e ao perfil do dono. Depois do pagamento sai um e-mail de boas-vindas (Resend) com o resumo.

## Critérios de aceite

- O checkout mostra "E-mail de acesso" no topo, com aviso, e "Confirme o e-mail" (colar bloqueado).
  E-mails diferentes bloqueiam o envio.
- O trigger `handle_new_user` (dono pago) grava `empresas.cnpj` só quando o documento do checkout tem 14
  dígitos (CPF não vira CNPJ) e `profiles.contato` com o telefone.
- `CompanySetup` e `ProfileSetup` já abrem preenchidos com esses valores.
- Depois do convite de acesso, o webhook envia `templateBoasVindasAssinatura` (tipo `checkout_boas_vindas`).
  Falha no envio não refaz o convite nem derruba o webhook.

## Fora de escopo

Mudar o CPF/CNPJ usado na cobrança do Asaas, ou o texto do e-mail de convite do Supabase.
