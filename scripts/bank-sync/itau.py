"""
Automação de extrato Itaú Empresas.

ANTES DE RODAR:
1. Gere credenciais e certificado no devportal.itau.com.br (self-service)
   → Login → Gestão de credenciais → Gerar credencial (produto: Extrato)
   → Gestão de certificados → Gerar certificado (usa o token temporário recebido)
2. Confirme EXTRATO_URL no devportal (requer login para ver docs da API de Extrato)
3. Cadastre os GitHub Secrets no environment 'itau-vrz'

Variáveis de ambiente necessárias:
    ITAU_CLIENT_ID
    ITAU_CLIENT_SECRET
    ITAU_CERT_CRT_B64      # certificado .crt encodado em base64
    ITAU_CERT_KEY_B64      # chave .key encodada em base64
    ITAU_CONTA             # número da conta (sem dígito)
    ITAU_AGENCIA           # número da agência (sem dígito)
    EMPRESA_ID             # UUID da empresa no Supabase
    ITAU_CONTA_UUID_SUPABASE  # UUID da conta Itaú na tabela `contas`
    SUPABASE_URL
    SUPABASE_SERVICE_KEY
"""

import os
import requests
from datetime import date, timedelta

from common import insert_supabase, parse_data_br

# Token endpoint — confirmado em devportal.itau.com.br/autenticacao-documentacao
TOKEN_URL = "https://sts.itau.com.br/api/oauth/token"

# ─── CONFIRMAR no devportal.itau.com.br (requer login) ───────────────────────
# Login → Nossas APIs → Extrato → ver endpoint e parâmetros aceitos
EXTRATO_URL = "CONFIRMAR_NO_DEVPORTAL"  # Ex: https://api.itau.com.br/extrato/v1/...
# ─────────────────────────────────────────────────────────────────────────────

CERT_PATH = ("cert/ITAU.crt", "cert/ITAU.key")

# Filtros: transações internas a ignorar (confirmar descrições reais após teste)
FILTROS_IGNORAR = []


def get_token() -> str:
    """Autentica via OAuth 2.0 client_credentials + mTLS e retorna access_token."""
    payload = {
        "client_id": os.environ["ITAU_CLIENT_ID"],
        "client_secret": os.environ["ITAU_CLIENT_SECRET"],
        "grant_type": "client_credentials",
    }
    response = requests.post(TOKEN_URL, cert=CERT_PATH, data=payload)
    response.raise_for_status()
    return response.json()["access_token"]


def get_extrato(access_token: str) -> dict:
    """Busca extrato do dia anterior (D-1). Ajuste 'days' se necessário."""
    data_alvo = (date.today() - timedelta(days=1)).strftime("%d%m%Y")

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }

    # CONFIRMAR nomes exatos dos parâmetros na documentação do devportal
    params = {
        "conta": os.environ["ITAU_CONTA"],
        "agencia": os.environ["ITAU_AGENCIA"],
        "dataInicio": data_alvo,
        "dataFim": data_alvo,
    }

    response = requests.get(EXTRATO_URL, headers=headers, params=params, cert=CERT_PATH, timeout=30)
    response.raise_for_status()
    return response.json()


def transform(data: dict) -> tuple[list, list]:
    """
    Converte o response da API Itaú em listas de receitas e despesas.

    ATENÇÃO: Os nomes dos campos abaixo (ex: 'lancamentos', 'valor', 'tipo',
    'dataLancamento', 'descricao') são SUPOSTOS com base no padrão Open Finance.
    Confirme os nomes reais após a primeira chamada de teste imprimindo `data`.
    """
    if not data:
        print("AVISO: Resposta da API veio vazia ou None.")
        return [], []

    # ADAPTAR: ajuste a chave raiz conforme o response real do Itaú
    lancamentos = data.get("lancamentos", [])

    if not lancamentos:
        print("AVISO: Nenhum lançamento encontrado.")
        return [], []

    receitas = []
    despesas = []

    registro_base = {
        "empresa_id": os.environ["EMPRESA_ID"],
        "conta_id": os.environ["ITAU_CONTA_UUID_SUPABASE"],
    }

    for lancamento in lancamentos:
        try:
            # ADAPTAR: ajuste os nomes dos campos conforme o response real
            descricao = lancamento.get("descricao", "")
            valor_raw = str(lancamento.get("valor", "0"))
            data_iso = parse_data_br(lancamento.get("dataLancamento", ""))

            # ADAPTAR: verificar como o Itaú sinaliza débito/crédito
            # Padrões comuns: campo 'tipo' ('D'/'C'), campo 'sinal' ('-'/'+'),
            # ou valor negativo indicando débito
            tipo = lancamento.get("tipo", "")
            is_debito = tipo == "D" or float(valor_raw) < 0

            if any(f in descricao for f in FILTROS_IGNORAR):
                continue

            base = {
                **registro_base,
                "descricao": descricao,
                "observacao": lancamento.get("complemento", ""),
                "valor": abs(float(valor_raw)),
            }

            if is_debito:
                despesas.append({
                    **base,
                    "data_pagamento": data_iso,
                    "data_vencimento": data_iso,
                    "status": "Pago",
                })
            else:
                receitas.append({
                    **base,
                    "data_recebimento": data_iso,
                    "data_vencimento": data_iso,
                    "status": "Recebido",
                })

        except Exception as e:
            print(f"ERRO ao processar lançamento: {e} | Dados: {lancamento}")

    return receitas, despesas


def run():
    access_token = get_token()
    data = get_extrato(access_token)

    # Para depurar o formato do response na primeira execução:
    # import json; print(json.dumps(data, indent=2, ensure_ascii=False))

    receitas, despesas = transform(data)
    insert_supabase(receitas, despesas)


if __name__ == "__main__":
    run()
