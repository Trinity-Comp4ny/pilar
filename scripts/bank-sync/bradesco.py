import os
import pathlib
import requests
from datetime import date, timedelta

from common import insert_supabase, parse_valor, parse_data_br

TOKEN_URL = "https://openapi.bradesco.com.br/auth/server-mtls/v1/token"
EXTRATO_URL = "https://openapi.bradesco.com.br/v1/fornecimento-extratos-contas/extratos"
CERT_PATH = ("cert/VRZENGENHARIA.crt", "cert/VRZENGENHARIA.key")

FILTROS_RECEITAS = ["RENTAB.INVEST FACILCRED*", "RESGATE INVEST FACIL", "RESG/VENCTO CDB"]
FILTROS_DESPESAS = ["APLIC.INVEST FACIL", "APLICACAO CDB"]


def get_token() -> str:
    payload = {
        "client_id": os.environ["BRADESCO_CLIENT_ID"],
        "client_secret": os.environ["BRADESCO_CLIENT_SECRET"],
        "grant_type": "client_credentials",
    }
    response = requests.post(TOKEN_URL, cert=CERT_PATH, data=payload)
    response.raise_for_status()
    return response.json()["access_token"]


def get_extrato(access_token: str) -> dict:
    data_alvo = (date.today() - timedelta(days=3)).strftime("%d%m%Y")

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    params = {
        "conta": os.environ["CONTA"],
        "agencia": os.environ["AGENCIA"],
        "tipo": "cc",
        "dataInicio": data_alvo,
        "dataFim": data_alvo,
    }

    response = requests.get(EXTRATO_URL, headers=headers, params=params, cert=CERT_PATH, timeout=30)
    response.raise_for_status()
    return response.json()


def transform(data: dict) -> tuple[list, list]:
    if not data:
        print("AVISO: Resposta da API veio vazia ou None.")
        return [], []

    extrato = data.get("extratoPorPeriodo")
    if not extrato:
        print("AVISO: extratoPorPeriodo não encontrado na resposta.")
        return [], []

    lancamentos = extrato.get("lstLancamentoMensal", [])
    if not lancamentos:
        print(extrato.get("mensagem", "Nenhum lançamento encontrado."))
        return [], []

    receitas = []
    despesas = []

    registro_base = {
        "empresa_id": os.environ["EMPRESA_ID"],
        "conta_id": os.environ["CONTA_UUID_SUPABASE"],
    }

    for lancamento in lancamentos:
        try:
            if (
                lancamento.get("codigoLancamento") == "0"
                or lancamento.get("descritivoLancamentoCompleto") == "Saldo Anterior"
                or lancamento.get("valorLancamento") in ("0,00", "0.0", "0.00")
            ):
                continue

            descricao = lancamento.get("descritivoLancamentoCompleto", "")
            valor = parse_valor(lancamento["valorLancamento"])
            is_debito = lancamento.get("sinalLancamento") == "-"
            data_iso = parse_data_br(lancamento["dataLancamento"])

            base = {
                **registro_base,
                "descricao": descricao,
                "observacao": lancamento.get("segundaLinhalLancamento", ""),
                "valor": abs(valor),
            }

            if is_debito:
                if any(f in descricao for f in FILTROS_DESPESAS):
                    continue
                despesas.append({
                    **base,
                    "data_pagamento": data_iso,
                    "data_vencimento": data_iso,
                    "status": "Pago",
                })
            else:
                if any(f in descricao for f in FILTROS_RECEITAS):
                    continue
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
    receitas, despesas = transform(data)
    insert_supabase(receitas, despesas)


if __name__ == "__main__":
    run()
