# Inventário de funções privilegiadas do Supabase

Execute `scripts/inventario-funcoes-privilegiadas.sql` com uma conexão de
auditoria em staging. Compare a saída de produção com o mesmo script antes e
depois da promoção. O relatório mostra metadados, sem executar as funções.

| Coluna | Revisão |
|---|---|
| Acesso anônimo | Classifique em endpoint público intencional ou grant que exige correção |
| Acesso autenticado | Confirme módulo, papel, tenant e autorização de escrita em testes com duas empresas fictícias |
| Search path | Confira se é restrito e se objetos referenciados estão qualificados |
| Extensão | Confirme se a assinatura pertence a extensão antes de propor alteração |
| Views seguras | Avalie compatibilidade com a RLS subjacente antes de migrar para security_invoker |

Grants identificam quem pode invocar a função. Valide a checagem de permissão
dentro de cada família de RPC antes de propor revogações. Registre exceções
públicas intencionais, proprietário e link para o teste que demonstra o limite.
