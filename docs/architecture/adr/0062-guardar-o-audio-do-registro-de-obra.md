# ADR 0062: Guardar o áudio do registro de obra

**Data:** 2026-10-19  
**Status:** Proposed

## Contexto

A [SPEC 080](../../specs/080-rdo-por-voz.md) decidiu que o áudio do RDO por voz nunca é guardado: ele passa pela
memória do request, vira texto e some. Foi uma escolha para não abrir escopo de retenção e LGPD.

A [SPEC 135](../../specs/135-diario-de-obra-em-registros.md) muda o desenho do diário: quem está na obra grava um
registro curto e fecha o app, e a IA organiza em segundo plano. Isso exige que o áudio exista depois que o request
termina (para a organização rodar sem a pessoa na tela, para tentar de novo quando a IA falha, e para o gestor ouvir
o original quando a transcrição parecer errada). Em 2026-10-19 o Matheus decidiu guardar o áudio
([DECISOES.md](../../strategy/DECISOES.md)).

Opções consideradas:

- **A. Guardar só até a organização terminar** (apagar em minutos): menor risco de LGPD, mas o gestor não ouve o
  original e "tentar de novo" depois de um dia falha.
- **B. Guardar enquanto o registro existir, com teto de tempo**: o original fica ouvível, e o texto sobrevive ao áudio.
- **C. Guardar para sempre**: simples, mas custo de storage cresce sem limite e voz de trabalhador vira passivo.

## Decisão

Opção B.

- **Onde:** bucket privado `obra-registro-audio`, caminho `{empresa_id}/{obra_id}/{registro_id}.{ext}`. Sem URL pública.
- **Formato e tamanho:** o que o `MediaRecorder` entrega (webm/opus ou mp4/aac), até 3 minutos por registro.
- **Retenção:** o áudio é apagado 12 meses depois da data do registro por um job diário; o texto e os campos
  extraídos continuam. Excluir o registro, a obra, a conta de campo ou a empresa apaga o áudio junto, pela API do
  Storage (não por `DELETE` em `storage.objects`).
- **Acesso:** o gestor da empresa ouve por URL assinada de 5 minutos, com RLS por `empresa_id` e papel de gestão. A
  conta de campo ouve só os próprios registros, por uma edge que valida o token. O cliente do portal nunca acessa
  áudio, nem URL de áudio, só o texto curado.
- **Aviso:** a primeira gravação de cada conta de campo mostra "O áudio fica guardado para a sua empresa ouvir de
  novo", e o aceite fica registrado na conta.
- **LGPD:** voz do trabalhador é dado pessoal. O fluxo de pedidos LGPD do ultra admin passa a apagar também os
  áudios da pessoa.
- **Provedor de IA:** nada muda. O áudio já ia ao Gemini na SPEC 080.

**Como a exclusão roda (BEZ-33):** a edge `registro-audio-limpar` roda todo dia às 5h15 (UTC) e apaga pela API do
Storage o que a função `registro_audio_para_apagar` lista, em três casos: registro com mais de 12 meses, registro de
conta de campo excluída (autor sumiu) e arquivo órfão (registro, obra ou empresa excluídos, com 1 dia de folga porque o
upload vem antes do registro). O registro ganha `audio_apagado_em` e o texto fica. Obra apenas arquivada (soft delete)
mantém o áudio até o prazo de 12 meses, porque pode ser restaurada.

O prazo de 12 meses é uma suposição minha: se o Matheus quiser outro, muda a constante do job e este ADR.

## Consequências

**Positivas:**

- Registro sem espera: a pessoa fala, fecha o app, e a IA termina depois.
- Falha da IA não perde nada: o áudio fica, e "Tentar de novo" funciona dias depois.
- O gestor confere o original quando a transcrição parecer errada.

**Negativas:**

- Passamos a guardar dado pessoal (voz): precisa de aviso, de exclusão que funcione e de teste de acesso.
- Custo de storage: cerca de 1 MB por minuto em opus, a monitorar no Ultra.
- A exclusão tem dois lugares (banco e Storage), então o job de limpeza precisa de teste e de alerta de falha.

## Decisões relacionadas

- [SPEC 080](../../specs/080-rdo-por-voz.md): decisão "áudio bruto não persiste" fica superada para o diário em registros.
- [SPEC 135](../../specs/135-diario-de-obra-em-registros.md)
