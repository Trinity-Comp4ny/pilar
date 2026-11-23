#!/usr/bin/env bash
set -euo pipefail

# Altera a cópia do checkout no runner. As portas 543xx estão na faixa
# efêmera padrão do Linux e podem estar em uso antes de o job começar.
sed -i -E \
  -e 's/^major_version = 15$/major_version = 17/' \
  -e 's/^(port|shadow_port|smtp_port) = 543(31|32|33|34|35|42)$/\1 = 243\2/' \
  -e 's/^pop3_port[[:space:]]*=.*/pop3_port = 0/' \
  -e 's|(http://host\.docker\.internal:)54331/|\124331/|' \
  supabase/config.toml
