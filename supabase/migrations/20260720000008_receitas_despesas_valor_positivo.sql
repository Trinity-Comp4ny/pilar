-- ACH-FIN-11: receitas e despesas não tinham CHECK(valor > 0) (só transferencias
-- tinha). A UI bloqueia zero/negativo, mas caminhos fora do zod (RPCs, colagem,
-- inserts diretos) podiam gravar valor <= 0. Adiciona a trava no banco como
-- defesa em profundidade. NOT VALID: passa a valer para novos inserts/updates
-- sem reprovar linhas legadas eventualmente inválidas no deploy.

ALTER TABLE public.receitas
  ADD CONSTRAINT receitas_valor_positivo CHECK (valor > 0) NOT VALID;

ALTER TABLE public.despesas
  ADD CONSTRAINT despesas_valor_positivo CHECK (valor > 0) NOT VALID;
