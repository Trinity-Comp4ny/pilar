# SPEC: Alerta de acesso por navegador novo

**Data:** 2026-11-10
**Status:** Em implementação
**Autor:** Matheus Rezende
**Módulo:** plataforma (segurança da conta)
**Relacionada:** [SPEC 096](096-notificacao-por-email.md) (notificação por e-mail)

## Problema

A conta guarda o financeiro do escritório, mas a pessoa não fica sabendo quando alguém entra
por outro navegador. Em Configurações só existe "Sair dos outros dispositivos".

## Objetivo

Todo acesso por um navegador que a conta nunca usou avisa a dona da conta, no sino e por e-mail,
com o caminho para reagir; e ela vê a lista dos navegadores que já entraram.

**Fora de escopo:** localização por IP, encerrar uma sessão específica (o Supabase Auth não
expõe a lista de sessões ao cliente), alerta para quem entra pelo portal do cliente ou pelo app
de campo.

## Requisitos

1. Cada navegador ganha um id aleatório guardado nele (sem impressão digital do aparelho). Ao
   entrar, o app registra o id e uma descrição ("Chrome no Windows").
2. O primeiro navegador da conta não gera alerta. A partir do segundo, id novo gera a
   notificação `acesso_novo` (crítica): "Sua conta foi acessada por <navegador> em <data>. Se
   não foi você, troque a senha e use Sair dos outros dispositivos", com link `/seguranca`.
3. O e-mail desse alerta sai mesmo se a notificação já foi lida no app e não depende da
   preferência de e-mail (quem invadiu veria o sino primeiro).
4. Configurações → Segurança lista os navegadores (primeiro e último acesso, "Este navegador") e
   permite esquecer um.

## Critérios de aceite

- [x] Primeiro e mesmo navegador não alertam; segundo alerta uma vez.
- [x] Registro só pela RPC; a pessoa lê e apaga só os próprios.
- [ ] pgTAP: alerta lido continua na fila do e-mail imediato.

## Decisões e riscos

- **Id no navegador, não impressão digital:** respeita a privacidade e é o que a LGPD aceita sem
  consentimento extra. Custo: limpar os dados do navegador gera um alerta falso, e o texto diz o
  que fazer.
- `notificacoes_pendentes_email` é recriada idêntica, com três linhas marcadas `SPEC 159`.
