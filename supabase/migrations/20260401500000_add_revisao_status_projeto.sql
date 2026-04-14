-- Adiciona o valor 'Revisão' ao enum status_projeto, posicionado após 'Em andamento'
ALTER TYPE status_projeto ADD VALUE IF NOT EXISTS 'Revisão' AFTER 'Em andamento';
