"""
Testes locais para bank-sync — não precisam de credenciais nem conexão com banco.

Execução:
    cd scripts/bank-sync
    python test_transform.py

Cobre:
    - common.parse_valor()
    - common.parse_data_br()
    - bradesco.transform()
    - itau.transform()
"""

import os
import sys

# Env vars mínimas para os módulos carregarem
os.environ.setdefault("EMPRESA_ID", "test-empresa-uuid")
os.environ.setdefault("CONTA_UUID_SUPABASE", "test-bradesco-conta-uuid")
os.environ.setdefault("ITAU_CONTA_UUID_SUPABASE", "test-itau-conta-uuid")

# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

PASS = "\033[92m✓\033[0m"
FAIL = "\033[91m✗\033[0m"
_erros = []


def ok(descricao: str):
    print(f"  {PASS} {descricao}")


def erro(descricao: str, detalhe: str = ""):
    msg = f"  {FAIL} {descricao}"
    if detalhe:
        msg += f"\n      → {detalhe}"
    print(msg)
    _erros.append(descricao)


def checar(condicao: bool, descricao: str, detalhe: str = ""):
    if condicao:
        ok(descricao)
    else:
        erro(descricao, detalhe)


def secao(titulo: str):
    print(f"\n{'─' * 55}")
    print(f"  {titulo}")
    print(f"{'─' * 55}")


# ──────────────────────────────────────────────────────────────────────────────
# common.py
# ──────────────────────────────────────────────────────────────────────────────

secao("common.py — parse_valor e parse_data_br")

from common import parse_valor, parse_data_br

casos_valor = [
    ("1.234,56", 1234.56),
    ("0,00", 0.0),
    ("100,00", 100.0),
    ("1.000.000,99", 1000000.99),
    ("50,10", 50.10),
]

for entrada, esperado in casos_valor:
    resultado = parse_valor(entrada)
    checar(
        resultado == esperado,
        f"parse_valor('{entrada}') → {esperado}",
        f"obteve {resultado}",
    )

casos_data = [
    ("15/04/2026", "2026-04-15"),
    ("01/01/2025", "2025-01-01"),
    ("31/12/2024", "2024-12-31"),
]

for entrada, esperado in casos_data:
    resultado = parse_data_br(entrada)
    checar(
        resultado == esperado,
        f"parse_data_br('{entrada}') → '{esperado}'",
        f"obteve '{resultado}'",
    )


# ──────────────────────────────────────────────────────────────────────────────
# bradesco.transform()
# ──────────────────────────────────────────────────────────────────────────────

secao("bradesco.transform() — casos normais")

from bradesco import transform as bradesco_transform

MOCK_BRADESCO_NORMAL = {
    "extratoPorPeriodo": {
        "lstLancamentoMensal": [
            {
                "codigoLancamento": "1",
                "descritivoLancamentoCompleto": "PIX RECEBIDO DE CLIENTE",
                "valorLancamento": "1.500,00",
                "sinalLancamento": "+",
                "dataLancamento": "14/04/2026",
                "segundaLinhalLancamento": "REF: PROJETO 005",
            },
            {
                "codigoLancamento": "2",
                "descritivoLancamentoCompleto": "PAGAMENTO FORNECEDOR",
                "valorLancamento": "800,00",
                "sinalLancamento": "-",
                "dataLancamento": "14/04/2026",
                "segundaLinhalLancamento": "",
            },
            {
                "codigoLancamento": "3",
                "descritivoLancamentoCompleto": "TARIFA BANCARIA",
                "valorLancamento": "12,50",
                "sinalLancamento": "-",
                "dataLancamento": "14/04/2026",
                "segundaLinhalLancamento": "",
            },
        ]
    }
}

receitas, despesas = bradesco_transform(MOCK_BRADESCO_NORMAL)

checar(len(receitas) == 1, "1 receita identificada", f"obteve {len(receitas)}")
checar(len(despesas) == 2, "2 despesas identificadas", f"obteve {len(despesas)}")
checar(receitas[0]["valor"] == 1500.0, "valor da receita correto (1500.0)", f"obteve {receitas[0]['valor']}")
checar(receitas[0]["status"] == "Recebido", "status da receita = 'Recebido'")
checar(receitas[0]["data_recebimento"] == "2026-04-14", "data_recebimento no formato ISO")
checar(despesas[0]["status"] == "Pago", "status da despesa = 'Pago'")
checar(despesas[0]["data_pagamento"] == "2026-04-14", "data_pagamento no formato ISO")
checar(receitas[0]["empresa_id"] == "test-empresa-uuid", "empresa_id injetado")
checar(receitas[0]["conta_id"] == "test-bradesco-conta-uuid", "conta_id injetado")

secao("bradesco.transform() — filtros de investimento")

MOCK_BRADESCO_INVESTIMENTOS = {
    "extratoPorPeriodo": {
        "lstLancamentoMensal": [
            {
                "codigoLancamento": "1",
                "descritivoLancamentoCompleto": "APLIC.INVEST FACIL",
                "valorLancamento": "5.000,00",
                "sinalLancamento": "-",
                "dataLancamento": "14/04/2026",
                "segundaLinhalLancamento": "",
            },
            {
                "codigoLancamento": "2",
                "descritivoLancamentoCompleto": "RESGATE INVEST FACIL",
                "valorLancamento": "5.000,00",
                "sinalLancamento": "+",
                "dataLancamento": "14/04/2026",
                "segundaLinhalLancamento": "",
            },
            {
                "codigoLancamento": "3",
                "descritivoLancamentoCompleto": "PIX RECEBIDO REAL",
                "valorLancamento": "200,00",
                "sinalLancamento": "+",
                "dataLancamento": "14/04/2026",
                "segundaLinhalLancamento": "",
            },
        ]
    }
}

receitas, despesas = bradesco_transform(MOCK_BRADESCO_INVESTIMENTOS)

checar(len(receitas) == 1, "investimentos filtrados — só 1 receita real", f"obteve {len(receitas)}")
checar(len(despesas) == 0, "aplicação de investimento filtrada", f"obteve {len(despesas)}")

secao("bradesco.transform() — edge cases")

# Resposta vazia
receitas, despesas = bradesco_transform({})
checar(receitas == [] and despesas == [], "response vazio → listas vazias")

# Valor zerado deve ser ignorado
MOCK_BRADESCO_ZERO = {
    "extratoPorPeriodo": {
        "lstLancamentoMensal": [
            {
                "codigoLancamento": "1",
                "descritivoLancamentoCompleto": "SALDO ANTERIOR",
                "valorLancamento": "0,00",
                "sinalLancamento": "+",
                "dataLancamento": "14/04/2026",
                "segundaLinhalLancamento": "",
            },
        ]
    }
}
receitas, despesas = bradesco_transform(MOCK_BRADESCO_ZERO)
checar(receitas == [] and despesas == [], "valor zerado ignorado")

# Lançamento 'Saldo Anterior' deve ser ignorado
MOCK_BRADESCO_SALDO = {
    "extratoPorPeriodo": {
        "lstLancamentoMensal": [
            {
                "codigoLancamento": "0",
                "descritivoLancamentoCompleto": "Saldo Anterior",
                "valorLancamento": "10.000,00",
                "sinalLancamento": "+",
                "dataLancamento": "14/04/2026",
                "segundaLinhalLancamento": "",
            },
        ]
    }
}
receitas, despesas = bradesco_transform(MOCK_BRADESCO_SALDO)
checar(receitas == [] and despesas == [], "Saldo Anterior ignorado")


# ──────────────────────────────────────────────────────────────────────────────
# itau.transform()
# ──────────────────────────────────────────────────────────────────────────────

secao("itau.transform() — casos normais")

from itau import transform as itau_transform

# Formato provável baseado no padrão Open Finance Brasil.
# Após a primeira chamada real, ajuste os campos em itau.transform() se necessário.
MOCK_ITAU_NORMAL = {
    "lancamentos": [
        {
            "descricao": "PIX RECEBIDO OBRA FAMEMA",
            "valor": "25000.00",
            "tipo": "C",
            "dataLancamento": "14/04/2026",
            "complemento": "REF CONTRATO 005",
        },
        {
            "descricao": "PAGAMENTO MATERIAL CONSTRUCAO",
            "valor": "-3200.00",
            "tipo": "D",
            "dataLancamento": "14/04/2026",
            "complemento": "NF 4512",
        },
        {
            "descricao": "TRANSFERENCIA INTERNA",
            "valor": "-1000.00",
            "tipo": "D",
            "dataLancamento": "14/04/2026",
            "complemento": "",
        },
    ]
}

receitas, despesas = itau_transform(MOCK_ITAU_NORMAL)

checar(len(receitas) == 1, "1 receita identificada", f"obteve {len(receitas)}")
checar(len(despesas) == 2, "2 despesas identificadas", f"obteve {len(despesas)}")
checar(receitas[0]["valor"] == 25000.0, "valor da receita correto (25000.0)", f"obteve {receitas[0]['valor']}")
checar(receitas[0]["status"] == "Recebido", "status da receita = 'Recebido'")
checar(receitas[0]["data_recebimento"] == "2026-04-14", "data_recebimento no formato ISO")
checar(despesas[0]["status"] == "Pago", "status da despesa = 'Pago'")
checar(receitas[0]["empresa_id"] == "test-empresa-uuid", "empresa_id injetado")
checar(receitas[0]["conta_id"] == "test-itau-conta-uuid", "conta_id injetado")
checar(despesas[0]["observacao"] == "NF 4512", "campo complemento → observacao")

secao("itau.transform() — edge cases")

receitas, despesas = itau_transform({})
checar(receitas == [] and despesas == [], "response vazio → listas vazias")

receitas, despesas = itau_transform({"lancamentos": []})
checar(receitas == [] and despesas == [], "lancamentos vazio → listas vazias")

# Valor negativo sem campo 'tipo' também deve virar despesa
MOCK_ITAU_SEM_TIPO = {
    "lancamentos": [
        {
            "descricao": "DEBITO SEM CAMPO TIPO",
            "valor": "-500.00",
            "dataLancamento": "14/04/2026",
            "complemento": "",
        }
    ]
}
receitas, despesas = itau_transform(MOCK_ITAU_SEM_TIPO)
checar(len(despesas) == 1, "valor negativo sem campo 'tipo' vira despesa", f"obteve {len(despesas)}")


# ──────────────────────────────────────────────────────────────────────────────
# Resultado final
# ──────────────────────────────────────────────────────────────────────────────

print(f"\n{'═' * 55}")
if _erros:
    print(f"  {FAIL} {len(_erros)} FALHA(S):")
    for e in _erros:
        print(f"      • {e}")
    sys.exit(1)
else:
    print(f"  {PASS} Todos os testes passaram!")
print(f"{'═' * 55}\n")
