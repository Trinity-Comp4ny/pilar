#!/usr/bin/env python3
"""Audita um archive de Storage sem extrair nenhum dado de cliente no disco.

Uso: python3 scripts/backup/verify_storage_archive.py storage-Production.tar.gz
Exige manifesto SHA-256/tamanho (backups novos desde a PR #973).
"""
import hashlib
import json
import re
import sys
import tarfile
from pathlib import PurePosixPath

ROOT = "storage-backup/"
MANIFEST = ROOT + "manifest.json"
BUCKET = re.compile(r"^[\w .-]+$", flags=re.ASCII)
HASH = re.compile(r"^[a-f0-9]{64}$")


def safe_path(name):
    if not isinstance(name, str) or not name or "\\" in name or name.startswith("/"):
        raise ValueError("Nome de arquivo inseguro no tar")
    parts = name.rstrip("/").split("/")
    if any(part in ("", ".", "..") for part in parts):
        raise ValueError("Caminho inseguro no tar: " + name)
    return name.rstrip("/")


def verify_storage_tar(archive):
    with tarfile.open(archive, mode="r:gz") as tar:
        entries = {}
        for member in tar:
            name = safe_path(member.name)
            if member.issym() or member.islnk() or not (member.isfile() or member.isdir()):
                raise ValueError("Entrada nao regular no tar: " + name)
            if name in entries:
                raise ValueError("Entrada duplicada no tar: " + name)
            if not (name == "storage-backup" or name.startswith(ROOT)):
                raise ValueError("Entrada fora de storage-backup: " + name)
            entries[name] = member
        if MANIFEST not in entries or not entries[MANIFEST].isfile():
            raise ValueError("Manifesto de Storage ausente")
        source = tar.extractfile(entries[MANIFEST])
        if source is None:
            raise ValueError("Nao foi possivel ler o manifesto")
        manifest = json.load(source)
        if not isinstance(manifest, dict) or not isinstance(manifest.get("buckets"), list):
            raise ValueError("Estrutura invalida do manifesto")

        expected = {MANIFEST}
        total_bytes = 0
        count = 0
        buckets_seen = set()
        for bucket in manifest["buckets"]:
            if not isinstance(bucket, dict):
                raise ValueError("Bucket invalido no manifesto")
            bucket_id = bucket.get("id")
            if not isinstance(bucket_id, str) or not BUCKET.fullmatch(bucket_id) or bucket_id in (".", ".."):
                raise ValueError("Nome de bucket invalido")
            if bucket_id in buckets_seen:
                raise ValueError("Bucket duplicado")
            buckets_seen.add(bucket_id)
            objects = bucket.get("arquivos")
            if not isinstance(objects, list):
                raise ValueError("Lista de objetos invalida")
            for obj in objects:
                if not isinstance(obj, dict):
                    raise ValueError("Objeto invalido")
                rel = obj.get("caminho")
                if not isinstance(rel, str):
                    raise ValueError("Caminho de objeto ausente")
                safe_path(rel)
                name = ROOT + "objetos/" + bucket_id + "/" + rel
                if name in expected:
                    raise ValueError("Objeto repetido no manifesto")
                expected.add(name)
                entry = entries.get(name)
                if entry is None or not entry.isfile():
                    raise ValueError("Arquivo de Storage ausente: " + name)
                digest = obj.get("sha256")
                size = obj.get("tamanhoBaixado")
                if not isinstance(digest, str) or not HASH.fullmatch(digest):
                    raise ValueError("Checksum SHA-256 ausente/invalido: " + name)
                if type(size) is not int or size < 0 or entry.size != size:
                    raise ValueError("Tamanho divergente: " + name)
                stream = tar.extractfile(entry)
                if stream is None:
                    raise ValueError("Objeto nao pode ser lido: " + name)
                hasher = hashlib.sha256()
                read = 0
                while True:
                    chunk = stream.read(1024 * 1024)
                    if not chunk:
                        break
                    hasher.update(chunk)
                    read += len(chunk)
                if read != size or hasher.hexdigest() != digest:
                    raise ValueError("Arquivo corrompido: " + name)
                total_bytes += size
                count += 1
        unexpected = [name for name, member in entries.items() if member.isfile() and name not in expected]
        if unexpected:
            raise ValueError("Arquivos nao declarados no manifesto: " + ", ".join(unexpected[:3]))
        return {"buckets": len(buckets_seen), "arquivos": count, "bytes": total_bytes}


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Uso: verify_storage_archive.py <storage.tar.gz>", file=sys.stderr)
        sys.exit(2)
    try:
        result = verify_storage_tar(sys.argv[1])
    except (ValueError, OSError, tarfile.TarError, json.JSONDecodeError) as error:
        print("::error::Verificacao Storage falhou: " + str(error), file=sys.stderr)
        sys.exit(1)
    print("DR Storage verificado: {buckets} buckets, {arquivos} objetos, {bytes} bytes".format(**result))
