# Legal

Documentos legais e de privacidade. ← [voltar ao índice](../README.md)

| Documento                                    | Status                                       | O que é                                                                                                      |
| -------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [PRIVACY_POLICY.md](./PRIVACY_POLICY.md)     | 🚧 Rascunho, não publicado como rota própria | Versão "Pilar" completa; a rota ao vivo é `src/pages/Privacidade.tsx` (conteúdo próprio, já usa marca Pilar) |
| [TERMS_OF_SERVICE.md](./TERMS_OF_SERVICE.md) | ✅ Publicado em `/termos` (2026-08-18)       | `src/pages/Termos.tsx`; ainda sem revisão de advogado, ver risco abaixo                                      |
| [COOKIE_POLICY.md](./COOKIE_POLICY.md)       | 🚧 Texto rascunho, mecanismo já ativo        | Política de Cookies; o banner de consentimento que ela descreve já roda em produção                          |

## Situação da identidade legal (CNPJ próprio pendente)

A Pilar hoje **não tem CNPJ próprio**: é uma iniciativa em processo de virar
pessoa jurídica separada (decisão de negócio, 2026-08-18). A marca é sempre
"Pilar" em toda a superfície visível ao usuário (produto, site, `/privacidade`,
`/termos`); não citamos mais Trinity Company nem Labrynth AI em nenhum lugar.

A LGPD (Art. 9) exige que a política de privacidade identifique o controlador
com razão social e CNPJ reais; um contrato (Termos de Uso) sem parte
identificada nem foro definido tem o mesmo problema, agravado por ser um
contrato, não só uma política informativa. `/privacidade` e `/termos` dizem
"Pilar" e qualificam razão social/CNPJ/foro como "em regularização", em vez de
inventar dados fictícios. **Risco aceito conscientemente pelo CEO** em duas
decisões (2026-08-18: publicar a marca Pilar sem CNPJ; hoje: publicar `/termos`
mesmo assim), não pendência esquecida.

Por isso:

- Quando o CNPJ, endereço e foro saírem, atualizar `src/pages/Termos.tsx` e
  `src/pages/Privacidade.tsx` com os dados reais (não os `.md` em `docs/legal/`
  diretamente, que são referência/rascunho, não o que está ao vivo).
- O **Termos de Uso** publicado ainda não passou por revisão de advogado (não
  cobre nuances contratuais específicas do setor nem tem foro definitivo).
  Contratar essa revisão continua pendente, agora com mais urgência por já
  estar ao vivo.
- E-mail de contato em `/privacidade`, `/termos` e nos documentos:
  `privacidade@pilarsoft.com.br`. Essa caixa precisa existir e ser monitorada:
  usuários já podem estar mandando pedido de exclusão/exportação de dados
  (LGPD Art. 18) pra ela a partir de agora.

O **mecanismo técnico de consentimento de cookies já está ativo em produção**,
independente do CNPJ. Ver [SPEC 048](../specs/048-consentimento-cookies.md) e
[ADR 0022](../architecture/adr/0022-consentimento-cookies-client-side.md).

> Compliance operacional (SOC2, ISO, DPAs, ROPA) fica em [`../security/COMPLIANCE.md`](../security/COMPLIANCE.md).
