# SPEC 135: Diário de obra em registros (falar, enviar, a IA organiza)

**Data:** 2026-10-19
**Status:** Aprovada
**Autor:** Matheus
**Módulo:** obras (Pilar Campo, aba Diário do escritório, portal do cliente)
**Depende de:** [SPEC 042](./042-pilar-campo-app-de-campo.md), [SPEC 080](./080-rdo-por-voz.md), [SPEC 086](./086-rdo-voz-sugestoes-estruturadas.md), [SPEC 087](./087-diario-obra-feed-instagram.md), [ADR 0062](../architecture/adr/0062-guardar-o-audio-do-registro-de-obra.md)
**Protótipo (aprovado em 19/10):** https://claude.ai/artifact/TQNijhoXhiM1Tdn11gHwwQ (página "Diário de obra")

## Problema

O diário é um formulário por dia. O RDO por voz só existe no escritório, a pessoa espera a transcrição terminar
na tela e a IA espera campos fixos (clima, efetivo). O pedreiro e o mestre de obra, que são quem sabe o que
aconteceu, só têm formulário no Pilar Campo. Resultado: o diário é preenchido tarde, por quem não estava lá.

## Objetivo

Quem está na obra grava um registro falando, em menos de 10 segundos de interação, e fecha o app. A IA organiza
em segundo plano. O gestor vê uma timeline de registros e fecha o RDO do dia a partir de um resumo montado
sozinho.

**Fora de escopo:** transcrição em tempo real garantida (é só uma prévia opcional no aparelho); mudar a regra do
portal de nunca mostrar ocorrência, pendência e efetivo por fornecedor (decisão de 01/09); cobrança nova (usa o
motor de tokens); app nativo.

## Requisitos

**A. Registrar (Pilar Campo e escritório)**

1. O botão principal da obra é "Gravar o que foi feito". Foto e texto são atalhos ao lado. A pessoa pode
   gravar quantos registros quiser por dia.
2. Ao parar, o registro entra na timeline na hora, com o áudio e o selo "Organizando", e a pessoa pode sair
   do app. Não existe tela de espera.
3. Sem internet, o registro (áudio e fotos) fica na fila offline existente e sobe quando a conexão volta.
4. Durante a gravação, a tela mostra o tempo, a onda e uma dica. Quando o navegador oferece reconhecimento de
   fala, mostra a prévia do texto. A prévia nunca é o texto final.
5. A primeira gravação de uma conta de campo mostra o aviso da ADR 0062 e registra o aceite.
6. Limite de 3 minutos por registro, com aviso aos 2:40.

**B. Organizar (servidor)**

7. Cada registro com áudio segue `enviado`, `organizando`, `pronto` ou `falhou`.
8. A organização tem dois passos: transcrever (rápido, sem raciocínio estendido) e extrair do texto o que
   a pessoa disse: pessoas na obra, serviço que avançou, material que faltou, problema, tarefas do cronograma
   citadas (casadas com o cadastro, nunca inventadas) e pendências. Campo não dito fica vazio.
9. Falha de IA marca `falhou`, guarda o áudio e mostra "Tentar de novo". Nunca perde o registro.
10. Se faltar um dado importante (ex.: quantas pessoas), o card mostra uma pergunta opcional com "Pular". Nada
    bloqueia.
11. Cada registro debita tokens da empresa pelo motor existente (`agentKey: "registro-voz"`).

**C. Timeline e RDO (escritório)**

12. A aba Diário mostra a timeline agrupada por dia, com filtro por pessoa, frente e tipo.
13. Cada dia tem o "Resumo do dia" em rascunho: clima, efetivo (total e por equipe), o que avançou,
    pendências e ocorrências, montado a partir dos registros.
14. "Revisar e fechar o RDO" abre o formulário de RDO já preenchido pelo resumo; salvar grava o `obra_rdo`
    do dia (upsert por obra e data, como hoje) e liga os registros a ele.
15. O gestor pode corrigir o texto de um registro, ouvir o áudio, vincular a tarefa ou compra e escolher se o
    cliente vê.

**D. Portal do cliente**

16. O portal mostra o resumo curado da semana e os registros marcados como visíveis, só texto e fotos. Nunca
    áudio, ocorrência, pendência interna nem efetivo por fornecedor.
17. Registro nasce `interno`. Só vira visível quando o gestor liga "Mostrar ao cliente".

Requisitos não-funcionais:

- **Segurança / RLS:** `obra_registro` isolado por `empresa_id`; conta de campo escreve e lê só a própria obra,
  por RPC que valida o token (padrão da SPEC 042); áudio no bucket privado da ADR 0062.
- **Multi-tenant:** nenhuma URL de áudio ou foto sai sem checar `empresa_id`.
- **Performance:** da parada da gravação ao registro visível na timeline, menos de 2 segundos em rede boa;
  organização pronta em até 20 segundos para 1 minuto de áudio.

## Critérios de aceite

- [ ] Dado a conta de campo logada, quando grava 30 s e toca em "Parar e enviar", então o registro aparece na
      timeline com "Organizando" em menos de 2 s e o app pode ser fechado.
- [ ] Dado o registro enviado, quando a organização termina, então o card mostra texto limpo e chips, e o
      gestor vê o mesmo registro no escritório.
- [ ] Dado áudio em que a pessoa diz "cinco da elétrica e três nossos", então o efetivo extraído é 8 e o
      efetivo por equipe lista os dois grupos.
- [ ] Dado áudio que cita uma tarefa que não existe no cronograma, então nenhuma tarefa é vinculada.
- [ ] Dado falha do provedor de IA, então o registro fica `falhou`, o áudio continua ouvível e "Tentar de novo"
      reprocessa.
- [ ] Dado aparelho sem rede, quando grava, então o registro entra na fila e sobe sozinho quando a rede volta,
      sem duplicar.
- [ ] Dado o dia com 3 registros, quando o gestor toca em "Revisar e fechar o RDO", então o formulário vem
      preenchido e, ao salvar, o `obra_rdo` do dia existe e os 3 registros apontam para ele.
- [ ] Dado registro `interno`, então o portal do cliente não o mostra; ao ligar "Mostrar ao cliente", mostra
      só o texto e as fotos.
- [ ] Dado a conta de campo de outra obra, quando tenta ler ou ouvir um registro, então recebe negado.
- [ ] Caso de borda: dado áudio de 3 min e 1 s, então o app corta em 3 min e avisa.
- [ ] Caso de borda: dado áudio sem fala, então o registro vira `pronto` com texto vazio e a pergunta "O que
      foi feito hoje?".

## Dados e contratos

Migration nova (depois de `gen:types:local`):

- `obra_registro`: `id`, `empresa_id`, `obra_id`, `rdo_id` (nulo até fechar o dia), `autor_user_id`,
  `autor_campo_account_id`, `autor_nome`, `autor_funcao`, `data_registro` (data local da obra), `tipo`
  (`audio | foto | texto | misto`), `texto_bruto`, `texto_organizado`, `extraido jsonb`, `audio_path`,
  `audio_duracao_s`, `status`, `visivel_cliente boolean default false`, `criado_em`, `atualizado_em`.
- `obra_registro_foto` ou reaproveitar `obra_rdo_foto` com `registro_id` (decidir no plano da Fase A).
- `campo_accounts.aceite_audio_em timestamptz`.
- Bucket privado `obra-registro-audio` e job diário de retenção (ADR 0062).

RPCs e funções de borda:

- `campo_criar_registro` (anon, valida token), `campo_listar_registros`.
- Edge `campo-registro-audio`: recebe o áudio, grava no bucket, cria o registro e responde 202 na hora;
  a organização roda em segundo plano (`EdgeRuntime.waitUntil`) e um job reprocessa `enviado` parado há mais
  de 5 minutos.
- Edge `ai-registro-organizar` (transcrever e extrair) e `ai-resumo-dia` (rascunho do dia).
- A edge `ai-rdo-voz` do formulário do escritório continua até a Fase B, depois é aposentada.

## Plano de implementação

Três PRs, cada um entregando valor sozinho:

1. **Fase A, registrar e ver:** migration, bucket e aceite; `campo-registro-audio` e `ai-registro-organizar`;
   Campo (home, gravando, registro, fila offline) e timeline na aba Diário do escritório.
2. **Fase B, resumo e RDO:** `ai-resumo-dia`, "Resumo do dia" e fechamento do RDO pelo formulário existente;
   aposentar o RDO por voz do formulário.
3. **Fase C, portal:** visibilidade por registro, resumo da semana e timeline no portal.

Cada fase termina com teste automatizado do que muda (RLS, schema de entrada, fila offline) e o fluxo real
exercitado no Chrome com prints.

## Decisões e riscos

- [ADR 0062](../architecture/adr/0062-guardar-o-audio-do-registro-de-obra.md): guardar o áudio, com retenção de
  12 meses (suposição a confirmar).
- Registro nasce interno: no protótipo os registros do Zé e do Marcos aparecem como "Cliente vê"; aqui o padrão
  é o contrário, para nunca vazar "cimento acaba amanhã" ao cliente por descuido.
- Reconhecimento de fala no navegador varia (Safari, Chrome, WebView); por isso é só prévia.
- Risco: `EdgeRuntime.waitUntil` encerra a função antes de terminar em áudio longo; o job de reprocesso cobre,
  mas precisa de alerta.
