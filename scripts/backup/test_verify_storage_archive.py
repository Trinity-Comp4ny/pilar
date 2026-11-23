"""Testes isolados: artefatos sintéticos, sem dados reais de produção."""
import hashlib
import io
import json
import tarfile
import tempfile
import unittest
from pathlib import Path

from scripts.backup.verify_storage_archive import verify_storage_tar

PHOTO = b"foto de teste"


def make_tar(path, *, file_bytes=PHOTO, path_name="objetos/obra-campo/obra-1/foto.jpg", checksum=None, size=None,
             add_unknown=False, symlink=False):
    actual = "storage-backup/" + path_name
    document = {
        "buckets": [
            {
                "id": "obra-campo",
                "arquivos": [
                    {
                        "caminho": "obra-1/foto.jpg",
                        "sha256": checksum if checksum is not None else hashlib.sha256(PHOTO).hexdigest(),
                        "tamanhoBaixado": size if size is not None else len(PHOTO),
                    }
                ],
            }
        ]
    }
    with tarfile.open(path, mode="w:gz") as tar:
        manifest = json.dumps(document).encode("utf8")
        info = tarfile.TarInfo("storage-backup/manifest.json")
        info.size = len(manifest)
        tar.addfile(info, io.BytesIO(manifest))
        if symlink:
            info = tarfile.TarInfo(actual)
            info.type = tarfile.SYMTYPE
            info.linkname = "/etc/passwd"
            tar.addfile(info)
        else:
            info = tarfile.TarInfo(actual)
            info.size = len(file_bytes)
            tar.addfile(info, io.BytesIO(file_bytes))
        if add_unknown:
            data = b"unexpected"
            info = tarfile.TarInfo("storage-backup/objetos/obra-campo/hidden.txt")
            info.size = len(data)
            tar.addfile(info, io.BytesIO(data))


class VerifyStorageArchiveTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="pilar-dr-test-")
        self.path = Path(self.temp.name) / "storage.tar.gz"

    def tearDown(self):
        self.temp.cleanup()

    def test_valid_archive(self):
        make_tar(self.path)
        self.assertEqual(verify_storage_tar(self.path), {"buckets": 1, "arquivos": 1, "bytes": len(PHOTO)})

    def test_corrupt_file_bytes(self):
        make_tar(self.path, file_bytes=b"foto adulterada")
        with self.assertRaisesRegex(ValueError, "Tamanho divergente|Arquivo corrompido"):
            verify_storage_tar(self.path)

    def test_same_size_but_different_checksum(self):
        make_tar(self.path, file_bytes=b"X" * len(PHOTO))
        with self.assertRaisesRegex(ValueError, "Arquivo corrompido"):
            verify_storage_tar(self.path)

    def test_missing_checksum(self):
        make_tar(self.path, checksum="not-a-sha")
        with self.assertRaisesRegex(ValueError, "Checksum"):
            verify_storage_tar(self.path)

    def test_reject_path_traversal(self):
        make_tar(self.path, path_name="objetos/obra-campo/../../etc/passwd")
        with self.assertRaisesRegex(ValueError, "Caminho inseguro"):
            verify_storage_tar(self.path)

    def test_reject_symlink(self):
        make_tar(self.path, symlink=True)
        with self.assertRaisesRegex(ValueError, "Entrada nao regular"):
            verify_storage_tar(self.path)

    def test_reject_oversized_manifest_before_reading(self):
        make_tar(self.path)
        from unittest.mock import patch
        with patch("scripts.backup.verify_storage_archive.MAX_MANIFEST_BYTES", 1):
            with self.assertRaisesRegex(ValueError, "Manifesto.*excede"):
                verify_storage_tar(self.path)

    def test_reject_excessive_archive_entries(self):
        make_tar(self.path, add_unknown=True)
        from unittest.mock import patch
        with patch("scripts.backup.verify_storage_archive.MAX_ARCHIVE_MEMBERS", 1):
            with self.assertRaisesRegex(ValueError, "Limite de entradas"):
                verify_storage_tar(self.path)

    def test_reject_unmanifested_files(self):
        make_tar(self.path, add_unknown=True)
        with self.assertRaisesRegex(ValueError, "nao declarados"):
            verify_storage_tar(self.path)


if __name__ == "__main__":
    unittest.main()
