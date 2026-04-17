import os
from datetime import datetime
from supabase import create_client


def parse_valor(valor_str: str) -> float:
    """Converte string de valor brasileiro para float. Ex: '1.234,56' → 1234.56"""
    return float(valor_str.replace(".", "").replace(",", "."))


def parse_data_br(data_str: str) -> str:
    """Converte data no formato BR para ISO. Ex: '15/04/2026' → '2026-04-15'"""
    return datetime.strptime(data_str, "%d/%m/%Y").date().isoformat()


def insert_supabase(receitas: list, despesas: list) -> None:
    """Insere receitas e despesas no Supabase usando service_role."""
    if not receitas and not despesas:
        print("SAÍDA: Nada para inserir.")
        return

    supabase = create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_KEY"],
    )

    if receitas:
        print(f"ENVIANDO: {len(receitas)} receitas...")
        supabase.table("receitas").insert(receitas).execute()

    if despesas:
        print(f"ENVIANDO: {len(despesas)} despesas...")
        supabase.table("despesas").insert(despesas).execute()

    print("SUCESSO: Inserção concluída.")
