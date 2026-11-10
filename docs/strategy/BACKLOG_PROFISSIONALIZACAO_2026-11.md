# Backlog de profissionalização (novembro de 2026)

Origem: análise do código + referências globais (Linear, GitHub, Intercom, Canny, Notion, Omie,
Procore), em `research/themes/profissionalizacao-saas-referencias.md`. Decisão de direção em
`DECISOES.md` (2026-11-10). Este arquivo faz as vezes do quadro enquanto o tracker não está
conectado: um card por linha, com o estado real no código.

## Estado dos cards

| # | Card | Estado | Onde |
|---|------|--------|------|
| 1 | "O que mudou" ligado ao aviso de nova versão | Feito | SPEC 152 |
| 2 | Você pediu, entregamos | Feito | SPEC 152 |
| 3 | NPS dentro do app | Feito | SPEC 156 |
| 4 | Pergunta de esforço (CES) | Feito | SPEC 156 |
| 5 | Faixa de incidente e manutenção | Feito | SPEC 153 |
| 6 | Comunicados da plataforma | Feito (faixa e modal; e-mail e sino na fase 2) | SPEC 157 |
| 7 | Central de ajuda e ajuda contextual | Feito (12 artigos) | SPEC 154 |
| 8 | Agente no canto da tela | Feito (fase 1: responde pela central, sem token) | SPEC 155 |
| 9 | Falar com o suporte com contexto | Feito (feedback com a dúvida, tela e versão) | SPEC 155 |
| 10 | Novo aceite dos termos | Feito (desligado até a próxima mudança material) | SPEC 158 |
| 11 | Alerta de acesso novo e navegadores da conta | Feito | SPEC 159 |
| 12 | Versão visível ao usuário | Feito (Configurações → Conta → Sobre o Pilar) | commit `feat(settings)` |
| 13 | Pendências do scorecard de agosto | Desfazer em leads e projetos já existia; scorecard estava desatualizado | ver abaixo |
| 14 | Roadmap público, modo escuro, indicação | Depois do lote principal | — |
| 15 | Nova varredura de refinamentos | Feita (seção abaixo) | — |
| 16 | Prévia de recursos | Feito (mecanismo; nenhum recurso em prévia ainda) | SPEC 160 |
| 17 | Bug zero com prazo + polimento semanal | Feito (7 dias, filtro de atrasados, ritual) | SPEC 160, `operations/BUG_ZERO_E_POLIMENTO.md` |
| 18 | Página de Segurança e confiança | Feito (`/seguranca` na LP) | commit `feat(marketing)` |
| 19 | Escritório de exemplo e modelos | Spec com 3 decisões pendentes | SPEC 161 (Draft) |
| 20 | UI otimista + desfazer universal | Desfazer já existia em leads, projetos, propostas, fornecedores; UI otimista fica para quando um fluxo pedir | — |
| 21 | Lacunas da ajuda | Feito (`/ultra-admin/ajuda`) | SPEC 155 |
| 22 | Agente pelo WhatsApp | Discovery (respeita a decisão de 2026-10-15) | `strategy/DISCOVERY_AGENTE_WHATSAPP.md` |
| 23 | Painel de atalhos de teclado | Feito (tecla `?`) | commit `feat(atalhos)` |

Correções que saíram no caminho: "Criar" do ⌘K agora abre o formulário certo (antes só
navegava, e Nova receita/despesa abria uma aba inexistente).

## Para ligar em produção

- Segredos `RELEASE_NOTAS_TOKEN` (edge `release-rascunho`) e `RELEASE_NOTAS_URL`/
  `RELEASE_NOTAS_TOKEN` (GitHub). Sem eles, o rascunho de novidades do release é feito à mão.
- Status page externa: `VITE_STATUS_URL` e o DNS de `status.pilarsoft.com.br` (ADR 0047). Hoje
  os links caem na `/status` interna.

## Varredura: próximos refinamentos encontrados

1. **Aprovação da proposta pelo portal quase nunca aparece.** O card só surge com a proposta
   enviada e já ligada a um projeto, mas converter em projeto marca a proposta como aceita
   (`20261025000002_portal_proposta_aguardando_aprovacao.sql` x
   `20260835000000_fecha_rpc_authenticated_cross_tenant.sql`). Decidir: aprovação pelo portal
   antes da conversão, ou tirar o card.
2. **Não há emissão de cobrança ou fatura para o cliente.** "Faturas" no Financeiro são as do
   cartão do escritório; o que o cliente paga vira receita. Para o ICP, cobrar é parte do
   contrato à execução: vale discovery (boleto/PIX pela plataforma, link de pagamento).
3. **`docs/security/SECURITY.md` desatualizado** em MFA obrigatório para admin (a ADR 0031
   reverteu). Corrigir o texto.
4. **Scorecard de agosto desatualizado:** desfazer em leads e projetos (#4) e command palette
   (#9) já existem. Atualizar ou arquivar o scorecard.
5. **Agente da ajuda, fase 2:** responder "como faço" pelo modelo dentro do `ai-chat`, com os
   artigos como fonte, quando a pergunta não casar com nenhum artigo.
6. **Artigos novos a partir das lacunas:** a cada mês, os 5 mais repetidos em
   `/ultra-admin/ajuda` viram artigo.
7. **Faixa de avisos no portal do cliente e no app de campo** (fase 2 da SPEC 153).
8. **NPS por e-mail para o sócio que quase não entra** (fase 2 da SPEC 156).
9. **Comunicado também no sino e por e-mail** (fase 2 da SPEC 157).
10. **Antes e depois das telas novas** no PR (regra do dono): Novidades, Ajuda, faixa,
    agente, NPS, Segurança, Prévia, seções novas do Ultra admin. Exige o app local com o seed.
