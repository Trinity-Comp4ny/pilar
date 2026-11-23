# Medição de aquisição da Pilar

O build da landing confere se todas as rotas pré-renderizadas estão no sitemap,
se as páginas usam o canonical esperado e se nenhuma delas contém noindex.
Depois do cutover, valide na Search Console em **Inspeção de URL** a home,
`/engenharia`, um artigo prioritário e `/planos`. Confira também o redirecionamento
de `/checkout?plano=pro` para o app com o parâmetro preservado.

## Funil no PostHog

| Etapa | Evidência | Como interpretar |
|---|---|---|
| Descoberta | Impressões e cliques por consulta/página na Search Console | Comparar períodos equivalentes, separando marca e termos de compra |
| Interesse | `landing_cta_clicked` com `cta`, `location`, `canal` e `pagina` | Cliques em demonstração medem intenção |
| Demonstração | Reunião confirmada no CRM | Registrar canal de atribuição quando disponível |
| Trial e cliente pago | Conta ativada e assinatura confirmada | Deduplicar por empresa e comparar os totais com o funil comercial |

A referência da auditoria de 19/11/2026 é de 40 cliques e 566 impressões
entre 16/08 e 16/11. Usar essa janela como referência histórica. Conferir
se origem e eventos aparecem em um teste com consentimento aceito.
