-- Guardião de margem (spec 081) cria o rascunho de aditivo mas nunca avisa
-- ninguém ativamente: a única forma de descobrir era abrir /agentes e ver o
-- badge. Esta função dá ao guardiao-margem-cron um jeito de notificar sem
-- duplicar a lógica de roteamento de destinatário (ADR 0015, SPEC 091).
--
-- Mesma audiência e categoria de 'orcamento_excedido' (_notif_ve_financeiro,
-- categoria 'financeiro'): é a continuação natural daquele aviso — primeiro
-- "o projeto estourou", 15 minutos depois "o aditivo já está pronto pra revisar"
-- (20260890000000_agenda_guardiao_margem_cron.sql já documentava essa ordem).
-- Categoria 'financeiro' também cai no default de e-mail (SPEC 096), então quem
-- não abre o app é avisado por e-mail via notificacoes-email-cron.

CREATE OR REPLACE FUNCTION public.notificar_aditivo_pronto(
  p_empresa_id  uuid,
  p_projeto_id  uuid,
  p_projeto_nome text,
  p_valor       numeric
) RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.notificar(
    p_empresa_id,
    public._notif_ve_financeiro(p_empresa_id),
    'aditivo_pronto', 'financeiro', 'high',
    'Aditivo pronto pra revisar: ' || p_projeto_nome,
    'O guardião de margem preparou um rascunho de aditivo de R$ ' ||
      to_char(p_valor, 'FM999999990.00') || ' pra cobrir o estouro de orçamento. ' ||
      'Aprove ou rejeite na aba Escopo do projeto.',
    'projeto', p_projeto_id, '/projetos/' || p_projeto_id || '#escopo'
  );
$$;

COMMENT ON FUNCTION public.notificar_aditivo_pronto IS
  'Notifica quem vê financeiro (mesma audiência de orcamento_excedido) que o guardião de margem preparou um rascunho de aditivo. Chamada pelo guardiao-margem-cron logo após criar o escopo.';

REVOKE ALL ON FUNCTION public.notificar_aditivo_pronto(uuid, uuid, text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notificar_aditivo_pronto(uuid, uuid, text, numeric) TO service_role;
