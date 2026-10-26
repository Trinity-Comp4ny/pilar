# SPEC 135: Diário de obra em registros (falar, enviar, a IA organiza)

**Data:** 2026-10-19
**Status:** Em implementação (fase A entregue)
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
- A edge `ai-rdo-voz` do formulário do escritório foi aposentada em 21/10/2026 (BEZ-85), depois da gravação pelo escritório.

## Plano de implementação

Três PRs, cada um entregando valor sozinho:

1. **Fase A, registrar e ver:** migration, bucket e aceite; `campo-registro-audio` e `ai-registro-organizar`;
   Campo (home, gravando, registro, fila offline) e timeline na aba Diário do escritório.
2. **Fase B, resumo e RDO:** `ai-resumo-dia`, "Resumo do dia" e fechamento do RDO pelo formulário existente;
   aposentar o RDO por voz do formulário.
3. **Fase C, portal:** visibilidade por registro, resumo da semana e timeline no portal.

**Fase A, o que entrou:** migration `20261114000200_obra_registro.sql` (tabela, bucket privado, aceite,
RPCs), edges `campo-registro-criar` e `registro-reprocessar`, organizador em dois passos, Pilar Campo
(gravar, foto, texto, fila offline, cartão com estados, pergunta do efetivo) e a visão "Registros" na aba
Diário do escritório (ouvir áudio, fotos, corrigir texto, liberar ao cliente, apagar, tentar de novo).
Medido no banco e na IA locais: a edge responde 202 em 84 ms e um áudio de 12 s fica pronto em ~5 s.
**Fora da fase A, entregue depois:** retenção do áudio (BEZ-33), gravar pelo escritório (BEZ-55) e fotos e áudio
no cartão do campo (BEZ-130).

**Fase B, o que entrou (BEZ-34):** "Resumo do dia" no topo de cada dia da aba Diário e "Revisar e fechar o RDO",
que abre o formulário de RDO já preenchido (atividades, ocorrências, pendências, efetivo por equipe e falta de
material) e, ao salvar, liga os registros do dia ao `obra_rdo`. **Desvio da spec:** o resumo não usa a edge
`ai-resumo-dia`. Ele soma o que a IA já extraiu de cada registro (`resumirDia`, puro e testado): não gasta token,
não demora e o gestor revisa tudo no formulário. Efetivo não conta a mesma equipe duas vezes (vale o maior número
citado por equipe). Dia que já tem RDO abre esse RDO para editar e os registros passam a apontar para ele.
**RDO por voz aposentado (BEZ-85):** o formulário do RDO não grava mais áudio. Sem a etapa "Gravar" e sem o bloco
"RDO por voz" nem as sugestões da fala: o diálogo abre direto nos campos (novo e edição). Saíram a edge `ai-rdo-voz`,
o hook `useTranscreverRdoVoz` e `mesclarExtracaoVoz`; o `RdoFormDialog` caiu de 1520 para 933 linhas. A função já
publicada no Supabase não some sozinha com o deploy: apagar de staging e produção (`supabase functions delete`).
Pendente: clima do resumo (o formulário já sugere pela previsão do tempo).

**Fase C, o que entrou (BEZ-35):** a função do portal `get_cliente_obra_detail` devolve `registros`: só os que o
gestor liberou ("Mostrar ao cliente"), já organizados pela IA, dos últimos 30 dias, com data, texto e quantidade de
fotos. Nunca áudio, autor, extraído (efetivo, pendência, problema), texto bruto nem caminho de foto. A edge
`portal-obra-fotos` ganhou `registro_ids` e assina as fotos depois de revalidar cada registro contra a sessão do
cliente. O portal mostra a seção "Registros da equipe" acima do Diário. Registro continua nascendo interno.
**Fora da fase C, pendente:** resumo curado da semana no portal e a decisão do dono sobre o padrão de visibilidade.

**Resumo da semana no portal (BEZ-57, protótipo aprovado em 20/10):** cartão "Resumo da semana" no topo da seção
"Registros da equipe". A edge `portal-resumo-semana` (token do portal, mesmo gate de obra do cliente) manda ao
modelo SÓ o texto dos registros que o gestor liberou nos últimos 7 dias (nada de autor, efetivo, pendência ou
problema) e pede 2 a 3 frases sem inventar nada. O texto fica em `obra_resumo_semana` junto de um hash dos registros
usados: se o gestor liberar, tirar ou corrigir um registro o hash muda e o resumo é refeito; se nada mudou, a IA não
é chamada. Debita tokens da empresa (`agentKey` `registro-resumo-semana`); sem saldo ou com falha da IA o cartão
não aparece e o resto do portal segue normal. Escolha por IA (e não texto montado): o protótipo aprovado é prosa
corrida, que só a IA escreve bem.

**Gravar pelo escritório (BEZ-55, protótipo aprovado em 20/10):** botão "Gravar registro" na aba Diário (em todas as
visões, flutuante no celular). O painel tem voz, foto e texto, e tudo o que estiver preenchido vai junto. A edge
`registro-criar` (JWT) guarda o áudio e as fotos e insere o registro pelo cliente do usuário, então a RLS decide se a
obra é da empresa dele; a IA organiza em segundo plano, igual ao campo. Sem aviso de áudio guardado no escritório
(decisão do Matheus). Desvio do protótipo: não há prévia de texto antes de enviar (a transcrição é da IA, depois do
envio); o gestor ouve o áudio gravado e pode regravar. O gravador, a compressão de foto e os helpers de envio
subiram para `src/hooks` e `src/lib` porque o campo e o escritório os usam.

**Campo vê as próprias fotos e ouve o próprio áudio (BEZ-130):** o cartão do registro no Pilar Campo ganha "Ouvir"
e "Ver as N fotos", só nos registros da própria conta. A edge `campo-registro-arquivos` valida o token e devolve URLs
assinadas de 5 minutos; registro de outra pessoa responde "não encontrado" (ADR 0062). Nada é assinado até a pessoa
tocar. Com isso a fase A fica completa.

Cada fase termina com teste automatizado do que muda (RLS, schema de entrada, fila offline) e o fluxo real
exercitado no Chrome com prints.

## Decisões e riscos

- [ADR 0062](../architecture/adr/0062-guardar-o-audio-do-registro-de-obra.md): guardar o áudio, com retenção de
  12 meses (confirmado em 20/10).
- Registro nasce interno: no protótipo os registros do Zé e do Marcos aparecem como "Cliente vê"; aqui o padrão
  é o contrário, para nunca vazar "cimento acaba amanhã" ao cliente por descuido.
- Reconhecimento de fala no navegador varia (Safari, Chrome, WebView); por isso é só prévia.
- Risco: `EdgeRuntime.waitUntil` encerra a função antes de terminar em áudio longo; o job de reprocesso cobre,
  mas precisa de alerta.
