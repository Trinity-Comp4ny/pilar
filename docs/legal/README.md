# Legal

Documentos legais e de privacidade. ← [voltar ao índice](../README.md)

| Documento                                    | Status                                      | O que é                                                                                                    |
| -------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [PRIVACY_POLICY.md](./PRIVACY_POLICY.md)     | ⚠️ Superado pela v2.0 ao vivo (2026-11-10)  | Rascunho antigo. A política publicada e completa é `apps/marketing/src/pages/Privacidade.tsx` (v2.0)       |
| [TERMS_OF_SERVICE.md](./TERMS_OF_SERVICE.md) | ✅ Publicado em `/termos` (2026-08-18)      | `src/pages/Termos.tsx`; ainda sem revisão de advogado, ver risco abaixo                                    |
| [COOKIE_POLICY.md](./COOKIE_POLICY.md)       | 🚧 Rascunho; tabela de cookies já publicada | A seção 7 de `/privacidade` (v2.0) traz a tabela de cookies; este texto longo ainda não tem página própria |
| [SUBPROCESSADORES.md](./SUBPROCESSADORES.md) | ✅ v1, 2026-09-08                           | Lista pública dos fornecedores que processam dado pessoal em nome do Pilar                                 |
| [RIPD.md](./RIPD.md)                         | ✅ v1, 2026-10-13                           | Relatório de Impacto à Proteção de Dados: tratamento, riscos, controles e plano dos riscos residuais       |

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

### Revisão de 2026-11-10 (parecer LGPD)

- `/privacidade` reescrita (v2.0): papéis controlador/operador, base legal por dado, agentes de IA,
  todos os operadores com localização, transferência internacional dita como está (garantias do
  art. 33 em formalização), retenção conferida no código, tabela de cookies e os 12 direitos.
  Saíram duas afirmações falsas da v1: "hospedados em São Paulo" e "todos sob contrato com
  cláusulas LGPD".
- Google Tag Manager do app só carrega com consentimento de análise (`src/lib/gtm.ts`); antes
  carregava em toda página pelo `index.html`. Google Fonts trocado por Inter autohospedada.
- Aviso do áudio do Pilar Campo passa a dizer que a transcrição é feita por IA (Google Gemini).
- Continua pendente (decisão ou contratação, não código): CNPJ, nome do encarregado, DPAs dos
  fornecedores com cláusulas-padrão da ANPD (Res. 19/2024), Termos v2 (IA e responsabilidade
  técnica, créditos de IA, acesso do suporte, teto de responsabilidade, foro) com o DPA de
  clientes anexo, avisos no portal do cliente, cotação e Campo, e revisão por advogado.

O **mecanismo técnico de consentimento de cookies já está ativo em produção**,
independente do CNPJ. Ver [SPEC 048](../specs/048-consentimento-cookies.md) e
[ADR 0022](../architecture/adr/0022-consentimento-cookies-client-side.md).

> Compliance operacional (SOC2, ISO, DPAs, ROPA) fica em [`../security/COMPLIANCE.md`](../security/COMPLIANCE.md).
